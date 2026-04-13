import React, { useState, useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import type { ChartPoint, VenueSnapshot } from './types';
import { computeFlowRisk } from './utils/metrics';
import { useBackendWS } from './hooks/useWebSocket';
import { useTrueMarketsWS } from './hooks/useTrueMarketsWS';
import { Header } from './components/Header';
import { OrderBook } from './components/OrderBook';
import { ChartCarousel } from './components/ChartCarousel';
import { InsightEngine } from './components/InsightEngine';
import { ScoreCards } from './components/ScoreCard';
import { TrueMarketsLogo } from './components/TrueMarketsLogo';

export default function App() {
  const [asset, setAsset] = useState('BTC');
  const [benchmark, setBenchmark] = useState('Kraken');
  const [history, setHistory] = useState<ChartPoint[]>([]);

  const { data: backendData, connected: backendConnected, error: backendError, changeSubscription } = useBackendWS(asset, benchmark);
  const { snapshot: tmLive, connected: tmConnected, error: tmError, usingFallback: tmFallback } = useTrueMarketsWS(asset);

  const truemarkets: VenueSnapshot | null = useMemo(() => {
    if (tmLive && !tmFallback) return tmLive;
    if (backendData?.truemarkets) return backendData.truemarkets;
    return null;
  }, [tmLive, tmFallback, backendData]);

  const bench: VenueSnapshot | null = backendData?.benchmark || null;
  const insights = backendData?.insights || null;
  const realLagMs = backendData?.lag_ms ?? 0;

  React.useEffect(() => {
    if (!truemarkets || !bench) return;
    const spreadGap = truemarkets.spread_bps - bench.spread_bps;
    const midGap = bench.mid > 0 ? Math.abs((truemarkets.mid - bench.mid) / bench.mid) * 10000 : 0;
    setHistory(prev => {
      const pt: ChartPoint = {
        time: new Date().toLocaleTimeString([], { hour12: false, second: '2-digit' }),
        spreadGap: Number(spreadGap.toFixed(2)),
        midGap: Number(midGap.toFixed(2)),
        lagMs: realLagMs,
      };
      const h = [...prev, pt];
      if (h.length > 60) h.shift();
      return h;
    });
  }, [truemarkets, bench, realLagMs]);

  const handleAssetChange = (a: string) => { setAsset(a); setHistory([]); changeSubscription(a, benchmark); };
  const handleBenchChange = (b: string) => { setBenchmark(b); setHistory([]); changeSubscription(asset, b); };

  // Loading
  if (!truemarkets || !bench) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0d1117] text-white">
        <div className="text-center">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-blue-500" />
          <div className="flex justify-center mb-2 opacity-60"><TrueMarketsLogo size="md" /></div>
          <p className="text-[#484f58] text-xs font-mono">
            {!backendConnected ? 'Connecting to engine...' : 'Awaiting market data...'}
          </p>
          {backendError && <p className="text-yellow-600 text-[10px] mt-1">{backendError}</p>}
        </div>
      </div>
    );
  }

  const spreadGap = truemarkets.spread_bps - bench.spread_bps;
  const tmDepth = truemarkets.bid_depth_5 + truemarkets.ask_depth_5;
  const benchDepth = bench.bid_depth_5 + bench.ask_depth_5;
  const depthRatio = benchDepth > 0 ? tmDepth / benchDepth : 1;
  const avgLag = history.length > 0 ? Math.round(history.reduce((a, b) => a + b.lagMs, 0) / history.length) : 0;
  const flowRisk = computeFlowRisk(spreadGap, depthRatio, realLagMs);
  
  const lagEvents = history.filter(p => p.lagMs > 100);
  const lagEventsCount = lagEvents.length;
  const lastLagEventMs = lagEvents.length > 0 ? lagEvents[lagEvents.length - 1].lagMs : 0;

  return (
    <div className="h-screen w-screen bg-[#0d1117] text-[#c9d1d9] font-sans flex flex-col overflow-hidden">
      {/* Top bar */}
      <Header
        asset={asset} benchmark={benchmark}
        backendConnected={backendConnected} tmConnected={tmConnected}
        tmFallback={tmFallback} tmError={tmError} backendError={backendError}
        midPrice={truemarkets.mid} spreadVariance={spreadGap}
        insightStatus={insights?.status} lagMs={realLagMs}
        onAssetChange={handleAssetChange} onBenchmarkChange={handleBenchChange}
      />

      {/* Main content: Chart left, Orderbooks right */}
      <div className="flex-grow flex min-h-0">
        {/* Left: Chart area */}
        <div className="flex-grow border-r border-[#21262d] min-h-0 flex flex-col">
          <ChartCarousel history={history} />
        </div>

        {/* Right: Two orderbooks stacked */}
        <div className="w-[320px] xl:w-[380px] flex-shrink-0 flex flex-col min-h-0">
          <div className="flex-1 border-b border-[#21262d] min-h-0 overflow-auto">
            <OrderBook snapshot={truemarkets} title="TRUE MARKETS" isTrueMarkets />
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            <OrderBook snapshot={bench} title={bench.venue.toUpperCase()} />
          </div>
        </div>
      </div>

      {/* Score cards row */}
      <ScoreCards
        flowRisk={flowRisk} lagMs={realLagMs} avgLag={avgLag}
        depthRatio={depthRatio} tmDepth={tmDepth} benchDepth={benchDepth} benchName={benchmark}
        lastLagEventMs={lastLagEventMs} lagEventsCount={lagEventsCount} history={history}
      />

      {/* Insight engine row */}
      <InsightEngine
        truemarkets={truemarkets} benchmark={bench}
        spreadGap={spreadGap} lagMs={realLagMs} history={history}
      />
    </div>
  );
}
