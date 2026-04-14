import React, { useState, useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import type { ChartPoint, VenueSnapshot } from './types';
import { computeFlowRisk, computeOverallStatus } from './utils/metrics';
import { useBackendWS } from './hooks/useWebSocket';
import { useTrueMarketsWS } from './hooks/useTrueMarketsWS';
import { HeaderBar } from './components/HeaderBar';
import { InsightHero } from './components/InsightHero';
import { ComparisonCharts } from './components/ComparisonCharts';
import { OrderBookCard } from './components/OrderBookCard';
import { VenueComparisonTable } from './components/VenueComparisonTable';
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

  // Feed mode
  const feedMode: 'Live' | 'Fallback Mock' | 'Live (Backend)' | 'Connecting...' =
    tmConnected && !tmFallback ? 'Live'
    : tmFallback ? 'Fallback Mock'
    : backendConnected ? 'Live (Backend)'
    : 'Connecting...';

  // ── Loading / skeleton state ──
  if (!truemarkets || !bench) {
    return (
      <div className="h-screen w-screen bg-[#060B14] flex flex-col">
        <div className="h-[2px] bg-[#6F7C8E] flex-shrink-0" />
        <div className="h-14 bg-[#0B1220] border-b border-[#1F2A3A] flex items-center px-4">
          <TrueMarketsLogo size="sm" />
          <span className="ml-3 text-[14px] font-bold text-[#E5EDF7] font-ui">LiquidityConsole</span>
        </div>
        {/* Skeleton insight hero */}
        <div className="mx-4 mt-2 h-[120px] bg-[#0B1220] border border-[#1F2A3A] rounded-lg animate-pulse" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-3 text-[#4DA3FF]" />
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
      {/* ═══ Row 1: Header (56px + 2px accent) ═══ */}
      <HeaderBar
        asset={asset} benchmark={benchmark}
        feedMode={feedMode} lastUpdate={lastUpdate} statusInfo={statusInfo}
        onAssetChange={handleAssetChange} onBenchmarkChange={handleBenchChange}
      />

      {/* ═══ Row 2: Insight Hero Band (120px) ═══ */}
      <InsightHero
        truemarkets={truemarkets} benchmark={bench}
        spreadGap={spreadGap} midDeviation={midDeviation}
        lagMs={realLagMs} avgLag={avgLag} depthRatio={depthRatio}
        statusInfo={statusInfo} flowRisk={flowRisk}
      />

      {/* ═══ Row 3: Body (fills remaining) ═══ */}
      <div className="flex flex-1 gap-3 px-4 pb-3 pt-1 min-h-0">
        {/* Left: 3 chart cards stacked (7/12) */}
        <div className="flex-[7] min-h-0">
          <ComparisonCharts history={history} />
        </div>

        {/* Right: 2 books + comparison table (5/12) */}
        <div className="flex-[5] flex flex-col gap-2 min-h-0">
          <div className="flex-[2] border border-[#1F2A3A] rounded-lg min-h-0 overflow-hidden">
            <OrderBookCard snapshot={truemarkets} title="True Markets" isTrueMarkets />
          </div>
          <div className="flex-[2] border border-[#1F2A3A] rounded-lg min-h-0 overflow-hidden">
            <OrderBookCard snapshot={bench} title={bench.venue} />
          </div>
          <div className="flex-[1] min-h-0">
            <VenueComparisonTable
              truemarkets={truemarkets} benchmark={bench}
              lagMs={realLagMs} benchName={benchmark}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
