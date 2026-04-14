import React, { useState, useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import type { ChartPoint, VenueSnapshot } from './types';
import { computeFlowRisk, computeOverallStatus } from './utils/metrics';
import { useBackendWS } from './hooks/useWebSocket';
import { useTrueMarketsWS } from './hooks/useTrueMarketsWS';
import { HeaderBar } from './components/HeaderBar';
import { KpiStrip } from './components/KpiStrip';
import { ComparisonCharts } from './components/ComparisonCharts';
import { OrderBookCard } from './components/OrderBookCard';
import { LagTimelineCard } from './components/LagTimelineCard';
import { DepthComparisonCard } from './components/DepthComparisonCard';
import { CompetitiveSnapshotCard } from './components/CompetitiveSnapshotCard';
import { InsightPanel } from './components/InsightPanel';
import { LegendPanel } from './components/LegendPanel';
import { TrueMarketsLogo } from './components/TrueMarketsLogo';

export default function App() {
  const [asset, setAsset] = useState('BTC');
  const [benchmark, setBenchmark] = useState('Kraken');
  const [history, setHistory] = useState<ChartPoint[]>([]);
  const [lastUpdate, setLastUpdate] = useState('--:--:--');

  const { data: backendData, connected: backendConnected, error: backendError, changeSubscription } = useBackendWS(asset, benchmark);
  const { snapshot: tmLive, connected: tmConnected, usingFallback: tmFallback } = useTrueMarketsWS(asset);

  const truemarkets: VenueSnapshot | null = useMemo(() => {
    if (tmLive && !tmFallback) return tmLive;
    if (backendData?.truemarkets) return backendData.truemarkets;
    return null;
  }, [tmLive, tmFallback, backendData]);

  const bench: VenueSnapshot | null = backendData?.benchmark || null;
  const realLagMs = backendData?.lag_ms ?? 0;

  // History accumulation
  React.useEffect(() => {
    if (!truemarkets || !bench) return;
    const spreadGap = truemarkets.spread_bps - bench.spread_bps;
    const midGap = bench.mid > 0 ? ((truemarkets.mid - bench.mid) / bench.mid) * 10000 : 0;
    setLastUpdate(new Date().toLocaleTimeString([], { hour12: false }));
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

  // Determine feed mode — reflects actual data source
  // Backend always provides real Kraken/Crypto.com data + TM mock derived from it
  // TrueMarkets WS is a direct connection attempt (usually fails on UAT)
  const feedMode: 'Live' | 'Fallback Mock' | 'Live (Backend)' | 'Connecting...' =
    tmConnected && !tmFallback ? 'Live'           // Direct TM WebSocket connected
    : tmFallback ? 'Fallback Mock'                 // TM WS explicitly failed, using backend mock
    : backendConnected ? 'Live (Backend)'           // Backend is sending real benchmark data
    : 'Connecting...';

  // ── Loading / skeleton state ──
  if (!truemarkets || !bench) {
    return (
      <div className="h-screen w-screen bg-[#060B14] flex flex-col">
        {/* Skeleton header */}
        <div className="h-16 bg-[#0B1220] border-b border-[#1F2A3A] flex items-center px-4">
          <TrueMarketsLogo size="sm" />
          <span className="ml-3 text-[15px] font-bold text-[#E5EDF7] font-ui">LiquidityConsole</span>
        </div>
        {/* Skeleton KPIs */}
        <div className="grid grid-cols-6 gap-3 px-4 py-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-[#0B1220] border border-[#1F2A3A] rounded-lg h-[84px] animate-pulse" />
          ))}
        </div>
        {/* Loading message */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-[#4DA3FF]" />
            <p className="text-[#6F7C8E] text-sm font-ui">
              {!backendConnected ? 'Connecting to feeds...' : 'Awaiting market data...'}
            </p>
            {backendError && <p className="text-[#F5B942] text-xs mt-2 font-mono">{backendError}</p>}
          </div>
        </div>
      </div>
    );
  }

  // ── Computed metrics ──
  const spreadGap = truemarkets.spread_bps - bench.spread_bps;
  const midDeviation = bench.mid > 0 ? ((truemarkets.mid - bench.mid) / bench.mid) * 10000 : 0;
  const tmDepth = truemarkets.bid_depth_5 + truemarkets.ask_depth_5;
  const benchDepth = bench.bid_depth_5 + bench.ask_depth_5;
  const depthRatio = benchDepth > 0 ? tmDepth / benchDepth : 1;
  const avgLag = history.length > 0 ? Math.round(history.reduce((a, b) => a + b.lagMs, 0) / history.length) : 0;
  const flowRisk = computeFlowRisk(spreadGap, depthRatio, realLagMs);
  const statusInfo = computeOverallStatus(spreadGap, depthRatio, realLagMs);

  return (
    <div className="h-screen w-screen bg-[#060B14] text-[#E5EDF7] font-ui flex flex-col overflow-hidden">
      {/* ═══════════════ Zone 1: Header (64px) ═══════════════ */}
      <HeaderBar
        asset={asset}
        benchmark={benchmark}
        feedMode={feedMode}
        lastUpdate={lastUpdate}
        statusInfo={statusInfo}
        onAssetChange={handleAssetChange}
        onBenchmarkChange={handleBenchChange}
      />

      {/* ═══════════════ Zone 2: KPI Strip (96px) ═══════════════ */}
      <KpiStrip
        tmMid={truemarkets.mid}
        tmSpreadBps={truemarkets.spread_bps}
        benchMid={bench.mid}
        benchSpreadBps={bench.spread_bps}
        spreadGap={spreadGap}
        midDeviation={midDeviation}
        lagMs={realLagMs}
        avgLag={avgLag}
        flowRisk={flowRisk}
      />

      {/* ═══════════════ Zone 3: Main Analysis Row ═══════════════ */}
      <div className="flex flex-1 min-h-0 px-4 gap-3">
        {/* Left: Comparison Charts (7/12) */}
        <div className="flex-[7] bg-[#0B1220] border border-[#1F2A3A] rounded-lg min-h-0 overflow-hidden">
          <ComparisonCharts history={history} />
        </div>

        {/* Right: Order Books (5/12) */}
        <div className="flex-[5] flex flex-col gap-3 min-h-0">
          <div className="flex-1 border border-[#1F2A3A] rounded-lg min-h-0 overflow-hidden">
            <OrderBookCard snapshot={truemarkets} title="True Markets" isTrueMarkets />
          </div>
          <div className="flex-1 border border-[#1F2A3A] rounded-lg min-h-0 overflow-hidden">
            <OrderBookCard snapshot={bench} title={bench.venue} />
          </div>
        </div>
      </div>

      {/* ═══════════════ Zone 4: Secondary Analytics (200px) ═══════════════ */}
      <div className="grid grid-cols-3 gap-3 px-4 pt-3 flex-shrink-0" style={{ height: '200px' }}>
        <LagTimelineCard history={history} lagMs={realLagMs} />
        <DepthComparisonCard truemarkets={truemarkets} benchmark={bench} benchName={benchmark} />
        <CompetitiveSnapshotCard
          truemarkets={truemarkets} benchmark={bench}
          spreadGap={spreadGap} lagMs={realLagMs}
        />
      </div>

      {/* ═══════════════ Zone 5: Insight + Legend (160px) ═══════════════ */}
      <div className="flex gap-3 px-4 py-3 flex-shrink-0" style={{ height: '170px' }}>
        {/* Left: Insight Engine (8/12) */}
        <div className="flex-[8]">
          <InsightPanel
            truemarkets={truemarkets} benchmark={bench}
            spreadGap={spreadGap} lagMs={realLagMs} depthRatio={depthRatio}
            statusInfo={statusInfo}
          />
        </div>
        {/* Right: Legend (4/12) */}
        <div className="flex-[4]">
          <LegendPanel />
        </div>
      </div>
    </div>
  );
}
