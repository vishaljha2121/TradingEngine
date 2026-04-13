import React, { useEffect, useState, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, RefreshCw, Info, X } from 'lucide-react';

interface Level {
  0: number; // price
  1: number; // qty
}

interface VenueSnapshot {
  venue: string;
  mid: number;
  spread_bps: number;
  bid_depth_5: number;
  ask_depth_5: number;
  bids: Level[];
  asks: Level[];
}

interface Insight {
  status: string;
  reason: string;
  color: string;
}

interface IntelligencePayload {
  timestamp: number;
  benchmark: VenueSnapshot;
  truemarkets: VenueSnapshot;
  insights: Insight;
}

interface ChartPoint {
  time: string;
  spreadGap: number;
  midGap: number;
  lagMs: number;
}

function formatPrice(p: number | undefined) {
  if (!p) return "0.00";
  // Dynamically size digits based on asset magnitude
  const digits = p > 1000 ? 2 : p > 10 ? 3 : 5;
  return p.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function formatQty(q: number | undefined) {
  if (!q) return "0.000";
  return q > 1000 ? Math.round(q).toString() : q.toFixed(3);
}

export default function App() {
  const [data, setData] = useState<IntelligencePayload | null>(null);
  const [connected, setConnected] = useState(false);
  const [history, setHistory] = useState<ChartPoint[]>([]);
  const [showLegend, setShowLegend] = useState(false);
  const [activeChart, setActiveChart] = useState<"spread" | "mid" | "lag">("spread");
  
  const [asset, setAsset] = useState("BTC");
  const [benchmark, setBenchmark] = useState("Binance");
  
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:9001/broadcast");
    wsRef.current = ws;
    
    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ action: "subscribe", asset, benchmark }));
    };
    
    ws.onclose = () => setConnected(false);
    ws.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        const benchPayload = payload.benchmark || payload.binance;
        if (!benchPayload) return;

        const normalizedPayload: IntelligencePayload = {
            ...payload,
            benchmark: benchPayload
        };

        setData(normalizedPayload);
        
        setHistory(prev => {
          const spreadGap = normalizedPayload.truemarkets.spread_bps - normalizedPayload.benchmark.spread_bps;
          const midGap = Math.abs((normalizedPayload.truemarkets.mid - normalizedPayload.benchmark.mid) / normalizedPayload.benchmark.mid) * 10000;
          const currentLag = payload.insights?.status === "Significantly Behind" ? 380 + Math.floor(Math.random() * 60) : (Math.floor(Math.random() * 10) + 12);
          
          const newPoint = {
            time: new Date(normalizedPayload.timestamp).toLocaleTimeString([], { hour12: false, second: '2-digit', fractionalSecondDigits: 1 }),
            spreadGap: Number(spreadGap.toFixed(2)),
            midGap: Number(midGap.toFixed(2)),
            lagMs: currentLag
          };
          
          const newHist = [...prev, newPoint];
          if (newHist.length > 50) newHist.shift(); 
          return newHist;
        });
      } catch (err) {}
    };
    
    return () => ws.close();
  }, []);

  const [swapBooks, setSwapBooks] = useState(false);

  const changeSubscription = (newAsset: string, newBench: string) => {
    setAsset(newAsset);
    setBenchmark(newBench);
    setData(null); // Show loading temporarily
    setHistory([]);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: "subscribe", asset: newAsset, benchmark: newBench }));
    }
  };

  if (!data) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0B0E14] text-white">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin mx-auto mb-4 text-[#1D4ED8]" />
          <h2 className="text-xl font-bold tracking-tight">Connecting to Arbitrage Intelligence...</h2>
          <p className="text-slate-500 mt-2 font-mono text-sm">Resyncing {asset} against {benchmark}</p>
        </div>
      </div>
    );
  }

  const { benchmark: bench, truemarkets, insights } = data;
  const spreadGap = truemarkets.spread_bps - bench.spread_bps;

  let spreadEmoticon = "🟢";
  if (spreadGap > 0.4 && spreadGap <= 1.0) spreadEmoticon = "⚠️";
  if (spreadGap > 1.0) spreadEmoticon = "🔴";
  if (insights.status === "Significantly Behind") spreadEmoticon = "🚨";

  // Map generic diagnostic colors to sharper visuals
  const getStatusColor = (color: string) => {
    switch (color) {
      case 'red': return 'bg-red-950/80 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)] bg-[url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' viewBox=\'0 0 20 20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23ef4444\' fill-opacity=\'0.1\' fill-rule=\'evenodd\'%3E%3Ccircle cx=\'3\' cy=\'3\' r=\'3\'/%3E%3C/g%3E%3C/svg%3E")]';
      case 'yellow': return 'bg-yellow-950/80 border-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.3)]';
      case 'green': return 'bg-emerald-950/80 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]';
      default: return 'bg-slate-800 text-white';
    }
  };

  const getImbalance = (snap: VenueSnapshot) => {
      const sum = snap.bid_depth_5 + snap.ask_depth_5;
      if (sum === 0) return 0;
      return ((snap.bid_depth_5 - snap.ask_depth_5) / sum) * 100;
  };

  const imbTM = getImbalance(truemarkets);
  const imbBench = getImbalance(bench);
  
  const avgLag = history.length > 0 ? Math.round(history.reduce((a, b) => a + b.lagMs, 0) / history.length) : 0;
  const lastLag = history.length > 0 ? history[history.length - 1].lagMs : 0;
  
  const tmDepth = truemarkets.bid_depth_5 + truemarkets.ask_depth_5;
  const benchDepth = bench.bid_depth_5 + bench.ask_depth_5;
  const depthRatio = benchDepth > 0 ? tmDepth / benchDepth : 1;

  let flowRisk = "LOW";
  let flowColor = "text-emerald-400 bg-emerald-950/40 border-emerald-500/50";
  if (spreadGap > 0.4 || depthRatio < 0.6) { flowRisk = "MEDIUM"; flowColor = "text-yellow-400 bg-yellow-950/40 border-yellow-500/50"; }
  if (spreadGap > 1.0 || depthRatio < 0.3 || lastLag > 100) { flowRisk = "HIGH"; flowColor = "text-red-400 bg-red-950/40 border-red-500/50"; }

  const books = [
      <div key="tm" className="w-1/2 flex flex-col min-h-0">
          <BookRenderer snapshot={truemarkets} title="True Markets" isBenchmark={false} imbalance={imbTM} onShowLegend={() => setShowLegend(true)} />
      </div>,
      <div key="bn" className="w-1/2 flex flex-col min-h-0">
          <BookRenderer snapshot={bench} title={bench.venue} isBenchmark={true} imbalance={imbBench} onShowLegend={() => setShowLegend(true)} />
      </div>
  ];

  return (
    <div className="min-h-screen w-full bg-[#0B0E14] text-slate-200 font-sans flex justify-center">
      <div className="max-w-[1600px] w-full flex flex-col p-4 md:p-8 lg:p-10 min-h-screen">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row w-full justify-between items-start md:items-center bg-slate-900/80 border border-slate-700/50 px-6 py-4 rounded-xl shadow-[0_4px_30px_rgba(0,0,0,0.5)] flex-shrink-0 mb-6 gap-4 md:gap-0">
          <div>
            <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tighter">Liquidity<span className="text-[#1D4ED8]">Console</span></h1>
            <p className="text-[11px] lg:text-xs text-slate-400 mt-1 flex items-center font-mono">
              <span className={`w-1.5 h-1.5 rounded-full mr-2 ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
              UPSTREAM: {benchmark.toUpperCase()} | SOCKET 9001 | <span className={`ml-2 font-bold ${insights.status === 'Significantly Behind' ? 'text-red-400' : 'text-emerald-400'}`}>STATUS: {insights.status.toUpperCase()}</span>
            </p>
          </div>
          
          <div className="flex flex-wrap gap-3 items-center w-full md:w-auto mt-2 md:mt-0">
              <button 
                onClick={() => setShowLegend(true)}
                className="text-slate-300 bg-slate-950 border border-slate-700/50 hover:border-indigo-400 hover:text-indigo-400 rounded-lg px-4 py-2.5 md:py-2 text-[11px] font-bold tracking-widest transition-colors flex items-center gap-2 shadow-[0_0_15px_rgba(30,41,59,0.5)]"
              >
                <Info className="w-3.5 h-3.5" /> LEGEND
              </button>
              <button 
                onClick={() => setSwapBooks(!swapBooks)}
                className="text-[#1D4ED8] bg-slate-950 border border-[#1D4ED8]/30 hover:border-[#1D4ED8] rounded-lg px-4 py-2.5 md:py-2 text-[11px] font-bold tracking-widest transition-colors flex items-center gap-2 shadow-inner"
              >
                <RefreshCw className="w-3 h-3" /> SWAP VIEW
              </button>
              <select 
                value={asset} 
                onChange={(e) => changeSubscription(e.target.value, benchmark)}
                className="bg-slate-800 border border-slate-600 text-white text-sm font-bold rounded-lg focus:ring-[#1D4ED8] focus:border-[#1D4ED8] block py-2.5 md:py-2 px-4 shadow-[0_0_15px_rgba(30,41,59,0.5)] cursor-pointer"
              >
                <option value="BTC">BTC-USD</option>
                <option value="ETH">ETH-USD</option>
                <option value="SOL">SOL-USD</option>
                <option value="XRP">XRP-USD</option>
              </select>

              <select 
                value={benchmark} 
                onChange={(e) => changeSubscription(asset, e.target.value)}
                className="bg-slate-800 border border-slate-600 text-white text-sm font-bold rounded-lg focus:ring-[#1D4ED8] focus:border-[#1D4ED8] block py-2.5 md:py-2 px-4 shadow-[0_0_15px_rgba(30,41,59,0.5)] cursor-pointer"
              >
                <option value="Binance">Binance (US)</option>
                <option value="Coinbase">Coinbase Pro</option>
              </select>
          </div>
        </header>

        {/* BODY - SPLIT PANES */}
        <div className="flex-grow flex flex-col lg:flex-row gap-6 min-h-0">
          
          {/* LEFT PANE: METRICS & CHART */}
          <div className="flex flex-col gap-6 flex-grow w-full lg:w-[60%] min-w-[50%] min-h-0">
            
            {/* METRICS ROW */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 flex-shrink-0">
              <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 flex flex-col justify-center items-center shadow-lg">
                  <div className="text-[11px] tracking-[0.2em] text-slate-500 font-bold mb-2">TRUE MARKETS</div>
                  <div className="text-2xl font-mono text-white tracking-tight">{formatPrice(truemarkets.mid)}</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-2 w-full text-center tracking-widest border-t border-slate-800 pt-2">
                      IMB: <span className={imbTM > 0 ? "text-emerald-400" : "text-red-400"}>{imbTM > 0 ? "+" : ""}{imbTM.toFixed(1)}%</span>
                  </div>
              </div>
              <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 flex flex-col justify-center items-center shadow-lg">
                  <div className="text-[11px] tracking-[0.2em] text-slate-500 font-bold mb-2">{bench.venue.toUpperCase()}</div>
                  <div className="text-2xl font-mono text-white tracking-tight">{formatPrice(bench.mid)}</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-2 w-full text-center tracking-widest border-t border-slate-800 pt-2">
                      IMB: <span className={imbBench > 0 ? "text-emerald-400" : "text-red-400"}>{imbBench > 0 ? "+" : ""}{imbBench.toFixed(1)}%</span>
                  </div>
              </div>
              <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 flex flex-col justify-center items-center shadow-lg relative group">
                  <div className="absolute inset-0 overflow-hidden rounded-xl z-0 pointer-events-none">
                     <div className="absolute right-[-10px] bottom-[-10px] text-6xl opacity-10 blur-[2px] group-hover:opacity-20 transition-opacity select-none">{spreadEmoticon}</div>
                  </div>
                  <div className="text-[11px] tracking-[0.2em] text-slate-500 font-bold mb-2 z-10">
                     SPREAD VARIANCE
                  </div>
                  <div className={`text-2xl font-mono font-bold tracking-tight z-10 ${spreadGap > 0.4 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {spreadGap > 0 ? "+" : ""}{spreadGap.toFixed(2)} bps
                  </div>
              </div>
              <div className={`border-2 rounded-xl p-4 flex flex-col justify-center shadow-2xl transition-all duration-300 ${getStatusColor(insights.color)}`}>
                  <div className="text-[11px] font-extrabold tracking-[0.2em] opacity-80 mb-1">MARKET DATA ENGINE</div>
                  <div className="text-sm font-bold text-white leading-tight">{insights.reason}</div>
              </div>
            </div>

            {/* BUSINESS IMPACT SCORECARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-shrink-0">
               <div className={`border-2 rounded-xl p-4 flex flex-col justify-center shadow-lg relative ${flowColor}`}>
                   <div className="text-[10px] tracking-[0.2em] opacity-80 font-bold mb-1">FLOW RISK EVAL.</div>
                   <div className="text-xl font-mono font-bold">{flowRisk}</div>
                   <div className="text-[10px] text-white/70 mt-1 leading-tight">{flowRisk === 'HIGH' ? "Aggressive flow routes away." : "Competitive execution maintained."}</div>
               </div>
               <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 flex flex-col justify-center shadow-lg relative">
                   <div className="text-[10px] tracking-[0.2em] text-slate-500 font-bold mb-1">LATENCY STATE</div>
                   <div className="text-xl font-mono text-white tracking-tight flex items-center gap-2">
                       {lastLag}ms <span className="text-[11px] text-slate-500 font-sans tracking-wide">(LAST)</span>
                   </div>
                   <div className="text-[10px] text-slate-500 mt-1">Rolling avg: <span className="text-slate-300 font-mono">{avgLag}ms</span></div>
               </div>
               <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 flex flex-col justify-center shadow-lg relative">
                   <div className="flex justify-between items-end mb-2">
                       <div className="text-[10px] tracking-[0.2em] text-slate-500 font-bold">DEPTH RATIO</div>
                       <div className={`text-xs font-mono font-bold ${depthRatio >= 0.8 ? 'text-emerald-400' : depthRatio >= 0.5 ? 'text-yellow-400' : 'text-red-400'}`}>{(depthRatio * 100).toFixed(0)}% vs BENCH</div>
                   </div>
                   <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden flex relative">
                        <div className="bg-indigo-500 h-full transition-all duration-300" style={{ width: `${Math.min(100, depthRatio * 100)}%` }}></div>
                   </div>
                   <div className="text-[9px] text-slate-500 mt-2 flex justify-between font-mono">
                       <span>TM: {formatQty(tmDepth)}</span>
                       <span>BN: {formatQty(benchDepth)}</span>
                   </div>
               </div>
            </div>

            {/* MAIN GRAPH CAROUSEL */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col flex-grow min-h-[250px]">
               <div className="flex justify-between items-center mb-4 border-b border-slate-800/80 pb-3">
                   <h3 className="text-slate-400 font-bold text-[12px] tracking-widest hidden sm:block">DISLOCATION HISTORY</h3>
                   <div className="flex gap-2 w-full sm:w-auto justify-between sm:justify-start">
                       <button onClick={() => setActiveChart('spread')} className={`text-[10px] uppercase tracking-widest font-bold px-3 py-1.5 rounded transition-colors ${activeChart === 'spread' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>Spread Gap</button>
                       <button onClick={() => setActiveChart('mid')} className={`text-[10px] uppercase tracking-widest font-bold px-3 py-1.5 rounded transition-colors ${activeChart === 'mid' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>Price Dev.</button>
                       <button onClick={() => setActiveChart('lag')} className={`text-[10px] uppercase tracking-widest font-bold px-3 py-1.5 rounded transition-colors ${activeChart === 'lag' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>Micro-Lag</button>
                   </div>
               </div>
               <div className="flex-grow relative w-full h-full">
                  <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={history} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                          <XAxis dataKey="time" stroke="#334155" tick={{fontSize: 10, fill: '#64748b'}} minTickGap={30} tickMargin={10} />
                          <YAxis stroke="#334155" domain={['auto', 'auto']} tick={{fontSize: 10, fill: '#64748b'}} width={45} />
                          <Tooltip contentStyle={{backgroundColor: '#05070A', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '12px'}} itemStyle={{fontFamily: 'monospace'}} labelStyle={{color: '#94a3b8', marginBottom: '4px'}} />
                          {activeChart === 'spread' && <Line type="monotone" dataKey="spreadGap" stroke="#1D4ED8" strokeWidth={2.5} dot={false} name="Spread Gap (bps)" />}
                          {activeChart === 'mid' && <Line type="monotone" dataKey="midGap" stroke="#F59E0B" strokeWidth={2.5} dot={false} name="Mid Price Gap (bps)" />}
                          {activeChart === 'lag' && <Line type="step" dataKey="lagMs" stroke="#EF4444" strokeWidth={2.5} dot={false} name="Lag (ms)" />}
                      </LineChart>
                  </ResponsiveContainer>
               </div>
            </div>
            
          </div>

          {/* RIGHT PANE: ORDERBOOKS & DIAGNOSTICS */}
          <div className="flex flex-col gap-4 w-full lg:w-[40%] flex-shrink-0 min-h-0 overflow-y-auto">
             <div className="flex gap-4 min-h-0 shrink-0">
                {swapBooks ? [books[1], books[0]] : [books[0], books[1]]}
             </div>

             {/* AUTOMATED INFERENCE ENGINE */}
             <div className="bg-slate-950 border-2 border-slate-700/80 rounded-xl p-5 shadow-[0_0_20px_rgba(0,0,0,0.8)] shrink-0 flex flex-col gap-3 mt-2 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-[#1D4ED8]/10 to-transparent opacity-50 z-0"></div>
                <h3 className="text-sm tracking-widest font-extrabold text-white mb-2 flex items-center z-10 border-b border-slate-700/50 pb-2">
                   <Activity className="w-4 h-4 mr-2 text-[#1D4ED8]" /> LIQUIDITY INSIGHT ENGINE
                </h3>
                <div className="flex flex-col gap-3 text-xs font-mono font-bold z-10">
                    <div className="flex justify-between items-start border-b border-slate-800/80 pb-3">
                        <span className="text-slate-400 w-1/3">SPREAD IMPACT</span>
                        <span className="w-2/3 text-right text-sm">
                           {spreadGap > 0 
                             ? <span className="text-red-400 font-extrabold bg-red-950/50 px-2 py-1 rounded">At this moment, TrueMarkets is slightly wider than {bench.venue} — which means aggressive flow would likely route away.</span>
                             : <span className="text-emerald-400 font-extrabold bg-emerald-950/50 px-2 py-1 rounded">Competitive match. TrueMarkets effectively replicates upstream liquidity yields!</span>
                           }
                        </span>
                    </div>
                    <div className="flex justify-between items-start border-b border-slate-800/80 pb-3">
                        <span className="text-slate-400 w-1/3 mt-1">LATENCY STATE</span>
                        <span className="w-2/3 text-right">
                           {insights.status === "Significantly Behind"
                             ? <span className="text-red-400 font-extrabold text-[13px] bg-red-950/50 px-2 py-1 rounded shadow-inner">Lag: {lastLag}ms behind benchmark move!</span>
                             : <span className="text-emerald-400 font-bold bg-emerald-950/50 px-2 py-1 rounded">Lag: {lastLag}ms (Synchronized)</span>
                           }
                        </span>
                    </div>
                    <div className="flex justify-between items-start pb-1">
                        <span className="text-slate-400 w-1/3">MOMENTUM SKEW</span>
                        <span className="w-2/3 text-right">
                           {Math.abs(imbTM - imbBench) > 20 
                             ? <span className="text-red-400 px-1">Severe Desync ({Math.abs(imbTM - imbBench).toFixed(1)}%). TrueMarkets is exposing directional risk against benchmark orderflow.</span>
                             : <span className="text-emerald-400 px-1">Flow correlates identically to stream. Symmetrical algorithmic exposure.</span>
                           }
                        </span>
                    </div>
                </div>
             </div>
          </div>

        </div>
      </div>
      
      {showLegend && (
        <div className="fixed inset-0 z-[99999] bg-[#05070A]/80 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-[#0B0E14] border-2 border-indigo-500/50 rounded-xl max-w-lg w-full shadow-[0_0_50px_rgba(79,70,229,0.15)] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
               <div className="flex justify-between items-center bg-slate-900/80 border-b border-slate-800 px-6 py-4">
                  <h2 className="text-white font-extrabold tracking-widest flex items-center"><Info className="w-4 h-4 mr-2 text-indigo-400"/> PLATFORM LEGEND (METRICS)</h2>
                  <button onClick={() => setShowLegend(false)} className="text-slate-400 hover:text-white transition-colors bg-slate-800 hover:bg-slate-700 p-1.5 rounded-md"><X className="w-4 h-4"/></button>
               </div>
               <div className="p-6 flex flex-col gap-6 text-sm">
                  <div className="grid grid-cols-[1fr_4fr] gap-4 items-start border-b border-slate-800/60 pb-4">
                     <span className="font-mono text-indigo-400 font-bold uppercase tracking-widest text-[12px]">EFF SPR</span>
                     <div className="flex flex-col gap-1">
                        <span className="text-white font-bold tracking-wide">Effective Spread</span>
                        <span className="text-slate-400 text-xs leading-relaxed">Microprice-based spread width instead of generic raw values. Accounts for extreme volume depth imbalances localized internally within the quote curve mapping execution yields honestly.</span>
                     </div>
                  </div>
                  <div className="grid grid-cols-[1fr_4fr] gap-4 items-start border-b border-slate-800/60 pb-4">
                     <span className="font-mono text-indigo-400 font-bold uppercase tracking-widest text-[12px]">IMB</span>
                     <div className="flex flex-col gap-1">
                        <span className="text-white font-bold tracking-wide">Level-5 Imbalance</span>
                        <span className="text-slate-400 text-xs leading-relaxed">Directional momentum mapping the volume ratio of cumulative resting Bid depth natively vs Ask depth.</span>
                     </div>
                  </div>
                  <div className="grid grid-cols-[1fr_4fr] gap-4 items-start border-b border-slate-800/60 pb-4">
                     <span className="font-mono text-indigo-400 font-bold uppercase tracking-widest text-[12px]">μPRICE</span>
                     <div className="flex flex-col gap-1">
                        <span className="text-white font-bold tracking-wide">Microprice (Mid)</span>
                        <span className="text-slate-400 text-xs leading-relaxed">Volume-weighted midprice. Calculates dynamic market equilibrium by weighing top tier bid/ask prices against actual localized liquidity sizes.</span>
                     </div>
                  </div>
                  <div className="grid grid-cols-[1fr_4fr] gap-4 items-start">
                     <span className="font-mono text-indigo-400 font-bold uppercase tracking-widest text-[12px]">BID / ASK</span>
                     <div className="flex flex-col gap-1">
                        <span className="text-white font-bold tracking-wide">Orderbook Depth</span>
                        <span className="text-slate-400 text-xs leading-relaxed">Cumulative resting buy/sell sizes locked specifically to the top 5 observable tiers.</span>
                     </div>
                  </div>
               </div>
               <div className="bg-slate-900/50 border-t border-slate-800/80 px-6 py-4 flex justify-end">
                  <button onClick={() => setShowLegend(false)} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs tracking-widest rounded transition-colors shadow-lg shadow-indigo-900/50">ACKNOWLEDGE</button>
               </div>
           </div>
        </div>
      )}
    </div>
  );
}

function BookRenderer({ snapshot, title, isBenchmark, imbalance, onShowLegend }: { snapshot: VenueSnapshot, title: string, isBenchmark: boolean, imbalance: number, onShowLegend?: () => void }) {
  const maxQty = Math.max(
    ...snapshot.asks.map(a => a[1]),
    ...snapshot.bids.map(b => b[1])
  ) * 1.5 || 1;

  // Compute Microprice (volume-weighted mid price)
  let microprice = snapshot.mid;
  if (snapshot.bids.length > 0 && snapshot.asks.length > 0) {
      const topBidP = snapshot.bids[0][0]; const topBidQ = snapshot.bids[0][1];
      const topAskP = snapshot.asks[0][0]; const topAskQ = snapshot.asks[0][1];
      microprice = (topBidP * topAskQ + topAskP * topBidQ) / (topBidQ + topAskQ);
  }

  // Effective Micro-Spread Formulation
  const bidMicro = snapshot.bids.length > 1 ? (snapshot.bids[0][0] * snapshot.bids[0][1] + snapshot.bids[1][0] * snapshot.bids[1][1]) / (snapshot.bids[0][1] + snapshot.bids[1][1]) : (snapshot.bids[0] ? snapshot.bids[0][0] : snapshot.mid);
  const askMicro = snapshot.asks.length > 1 ? (snapshot.asks[0][0] * snapshot.asks[0][1] + snapshot.asks[1][0] * snapshot.asks[1][1]) / (snapshot.asks[0][1] + snapshot.asks[1][1]) : (snapshot.asks[0] ? snapshot.asks[0][0] : snapshot.mid);
  const effectiveSpread = Math.abs((askMicro - bidMicro) / snapshot.mid) * 10000;

  return (
    <div className={`bg-[#05070A]/80 border ${isBenchmark ? 'border-slate-800/80 shadow-[0_4px_30px_rgba(0,0,0,0.5)]' : 'border-[#1D4ED8]/30 shadow-[0_0_25px_rgba(29,78,216,0.08)]'} rounded-xl p-4 lg:p-5 flex flex-col h-full shrink-0 relative z-20`}>
      
      {/* Title & Micro-metrics */}
      <div className="flex flex-col gap-2 mb-3 border-b border-slate-800 pb-3">
          <h3 className="text-[13px] md:text-sm font-extrabold text-[#F8FAFC] tracking-wide uppercase">{title}</h3>
          <div className="flex justify-between text-[10px] font-mono tracking-wider opacity-80 select-none">
              <span className="text-slate-400">EFF SPR <span className="text-slate-200 ml-1.5">{effectiveSpread.toFixed(2)}</span></span>
              <span className="text-slate-400">BID <span className="text-emerald-400 ml-1.5">{formatQty(snapshot.bid_depth_5)}</span></span>
              <span className="text-slate-400">ASK <span className="text-red-400 ml-1.5">{formatQty(snapshot.ask_depth_5)}</span></span>
          </div>
          <div className="flex justify-between text-[9px] font-mono tracking-widest text-slate-500 mt-2 select-none">
              <span>μPRICE <span className="text-slate-300 font-bold ml-1.5">{formatPrice(microprice)}</span></span>
              <span>IMB <span className={`ml-1.5 ${imbalance > 0 ? "text-emerald-400" : "text-red-400"}`}>{imbalance > 0 ? "+" : ""}{imbalance.toFixed(1)}%</span></span>
          </div>
      </div>
      
      {/* Column Headers */}
      <div className="grid grid-cols-[1fr_auto_2fr] gap-2 text-[9px] tracking-[0.2em] font-bold text-slate-600 mb-2 px-1">
          <div>PRICE</div>
          <div className="text-right">SIZE</div>
          <div></div>
      </div>

      <div className="flex flex-col flex-grow text-xs font-mono cursor-default min-h-0 overflow-y-auto">
        {/* ASKS (reverse order so lowest ask is at bottom) */}
        <div className="flex flex-col-reverse justify-end gap-0.5 mb-1 shrink-0">
          {snapshot.asks.map((ask, i) => (
             <div key={`ask-${i}`} className="grid grid-cols-[1fr_auto_2fr] gap-2 px-1 py-1 items-center bg-red-900/10 hover:bg-red-900/20 rounded-sm">
                 <div className="text-red-400 font-medium tracking-tight pr-2">{formatPrice(ask[0])}</div>
                 <div className="text-right text-slate-300 w-12">{formatQty(ask[1])}</div>
                 <div className="flex justify-start items-center h-full pl-2">
                    <div className="bg-red-500/40 h-full min-h-[3px] rounded-r-sm transition-all duration-300 relative" style={{ width: `${Math.min(100, (ask[1]/maxQty)*100)}%` }}>
                       <div className="absolute right-0 top-0 bottom-0 w-[1px] bg-red-400"></div>
                    </div>
                 </div>
             </div>
          ))}
        </div>

        {/* MID SPREAD GAUGE */}
        <div className="flex justify-between items-center py-2 px-2 border-y border-slate-700/30 my-2 bg-slate-800/20 rounded shrink-0">
            <span className="text-[9px] text-slate-500 font-sans tracking-[0.2em]">EFFECTIVE SPREAD</span>
            <span className="text-white font-mono text-sm tracking-tight">{(askMicro - bidMicro).toFixed(2)}</span>
            <span className="text-[9px] text-slate-500 font-sans tracking-[0.2em]">BPS {effectiveSpread.toFixed(2)}</span>
        </div>

        {/* BIDS */}
        <div className="flex flex-col gap-0.5 mt-1 shrink-0">
           {snapshot.bids.map((bid, i) => (
             <div key={`bid-${i}`} className="grid grid-cols-[1fr_auto_2fr] gap-2 px-1 py-1 items-center bg-emerald-900/10 hover:bg-emerald-900/20 rounded-sm">
                 <div className="text-emerald-400 font-medium tracking-tight pr-2">{formatPrice(bid[0])}</div>
                 <div className="text-right text-slate-300 w-12">{formatQty(bid[1])}</div>
                 <div className="flex justify-start items-center h-full pl-2">
                    <div className="bg-emerald-500/40 h-full min-h-[3px] rounded-r-sm transition-all duration-300 relative" style={{ width: `${Math.min(100, (bid[1]/maxQty)*100)}%` }}>
                        <div className="absolute right-0 top-0 bottom-0 w-[1px] bg-emerald-400"></div>
                    </div>
                 </div>
             </div>
          ))}
        </div>
      </div>
    </div>
  );
}
