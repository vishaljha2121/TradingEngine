import React, { useState, useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import type { ChartPoint, VenueSnapshot, MetricTrend } from './types';
import { computeOverallStatus, computeSlippageAdvantage } from './utils/metrics';
import { useBackendWS } from './hooks/useWebSocket';
import { useTrueMarketsWS } from './hooks/useTrueMarketsWS';
import { useDashboardLayout } from './hooks/useDashboardLayout';
import { HeaderBar } from './components/HeaderBar';
import { AppSidebar } from './components/AppSidebar';
import { ComparisonCharts } from './components/ComparisonCharts';
import { OrderBookCard } from './components/OrderBookCard';
import { VenueComparisonTable } from './components/VenueComparisonTable';
import { TrueMarketsLogo } from './components/TrueMarketsLogo';
import { WidgetFrame } from './components/dashboard/WidgetFrame';
import { CollapsedRail } from './components/dashboard/CollapsedRail';
import { MetricCard } from './components/widgets/MetricCard';
import { useMetricAlerts } from './hooks/useMetricAlerts';
import { AlertToast } from './components/widgets/AlertToast';
import { DecisionBand } from './components/widgets/DecisionBand';
import { ExecutionSimulator } from './components/widgets/ExecutionSimulator';
import { MarketHealthPanel } from './components/widgets/MarketHealthPanel';
import type { ExecutionSide } from './utils/executionAnalytics';

// ─── Metric History Tracking ───
interface MetricHistory {
  slippage: number[];
  spreadDelta: number[];
  latency: number[];
  depthRatio: number[];
  routingRisk: number[];
}

const MAX_HISTORY = 60;

function computeRoutingRiskScore(spreadGap: number, slipAdv: number, depthRatio: number, lagMs: number): number {
  // Composite routing risk: 0 = safe, 100 = severe
  let score = 0;
  // Spread contribution (0-30)
  score += Math.min(30, Math.max(0, spreadGap * 15));
  // Slippage contribution (0-30) — penalty when negative
  score += Math.min(30, Math.max(0, -slipAdv * 10));
  // Depth contribution (0-20) — worse when thin
  score += Math.min(20, Math.max(0, (1 - depthRatio) * 40));
  // Latency contribution (0-20)
  score += Math.min(20, Math.max(0, lagMs / 10));
  return Math.min(100, Math.max(0, score));
}

function computeTrend(series: number[], invert = false): MetricTrend {
  if (series.length < 5) return 'stable';
  const recent = series.slice(-5);
  const older = series.slice(-10, -5);
  if (older.length === 0) return 'stable';
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
  const diff = recentAvg - olderAvg;
  const threshold = Math.abs(olderAvg) * 0.1 || 0.5;
  if (Math.abs(diff) < threshold) return 'stable';
  const improving = invert ? diff > 0 : diff < 0;
  return improving ? 'improving' : 'worsening';
}

export default function App() {
  const [asset, setAsset] = useState('BTC');
  const [benchmark, setBenchmark] = useState('Kraken');
  const [history, setHistory] = useState<ChartPoint[]>([]);
  const [lastUpdate, setLastUpdate] = useState('--/--/----, --:--:-- ---');
  const [executionSide, setExecutionSide] = useState<ExecutionSide>('buy');
  const [executionSize, setExecutionSize] = useState(1);
  const [metricHistory, setMetricHistory] = useState<MetricHistory>({
    slippage: [], spreadDelta: [], latency: [], depthRatio: [], routingRisk: [],
  });

  const dashboardLayout = useDashboardLayout();
  const alerts = useMetricAlerts();
  const checkSnapshotsRef = React.useRef(alerts.checkSnapshots);

  const { data: backendData, connected: backendConnected, error: backendError, changeSubscription } = useBackendWS(asset, benchmark);
  const { snapshot: tmLive, connected: tmConnected, usingFallback: tmFallback } = useTrueMarketsWS(asset);
  const metricSnapshots = backendData?.metric_snapshots;

  React.useEffect(() => {
    checkSnapshotsRef.current = alerts.checkSnapshots;
  }, [alerts.checkSnapshots]);

  const truemarkets: VenueSnapshot | null = useMemo(() => {
    if (tmLive && !tmFallback) return tmLive;
    if (backendData?.truemarkets) return backendData.truemarkets;
    return null;
  }, [tmLive, tmFallback, backendData]);

  const bench: VenueSnapshot | null = backendData?.benchmark || null;
  const realLagMs = backendData?.lag_ms ?? 0;

  // ── History accumulation ──
  React.useEffect(() => {
    if (!truemarkets || !bench) return;
    const spreadGap = truemarkets.spread_bps - bench.spread_bps;
    const midGap = bench.mid > 0 ? ((truemarkets.mid - bench.mid) / bench.mid) * 10000 : 0;
    setLastUpdate(new Date().toLocaleString('en-US', { hour12: false, timeZoneName: 'short' }));
    const slip = computeSlippageAdvantage(truemarkets, bench);

    // Trigger alerts check if we have data from backend
    if (metricSnapshots) {
      checkSnapshotsRef.current(metricSnapshots);
    }
    setHistory(prev => {
      const pt: ChartPoint = {
        time: new Date().toLocaleTimeString([], { hour12: false, second: '2-digit' }),
        spreadGap: Number(spreadGap.toFixed(2)),
        midGap: Number(midGap.toFixed(2)),
        lagMs: realLagMs,
        slipAdv: Number(slip.toFixed(2))
      };
      const h = [...prev, pt];
      if (h.length > MAX_HISTORY) h.shift();
      return h;
    });

    // Metric history for sparklines
    const tmDepth = truemarkets.bid_depth_5 + truemarkets.ask_depth_5;
    const benchDepth = bench.bid_depth_5 + bench.ask_depth_5;
    const dr = benchDepth > 0 ? tmDepth / benchDepth : 1;
    const riskScore = computeRoutingRiskScore(spreadGap, slip, dr, realLagMs);

    setMetricHistory(prev => {
      const push = (arr: number[], val: number) => {
        const next = [...arr, val];
        if (next.length > MAX_HISTORY) next.shift();
        return next;
      };
      return {
        slippage: push(prev.slippage, slip),
        spreadDelta: push(prev.spreadDelta, spreadGap),
        latency: push(prev.latency, realLagMs),
        depthRatio: push(prev.depthRatio, dr),
        routingRisk: push(prev.routingRisk, riskScore),
      };
    });
  }, [truemarkets, bench, realLagMs, metricSnapshots]);

  const handleAssetChange = (a: string) => { setAsset(a); setHistory([]); setMetricHistory({ slippage: [], spreadDelta: [], latency: [], depthRatio: [], routingRisk: [] }); changeSubscription(a, benchmark); };
  const handleBenchChange = (b: string) => { setBenchmark(b); setHistory([]); setMetricHistory({ slippage: [], spreadDelta: [], latency: [], depthRatio: [], routingRisk: [] }); changeSubscription(asset, b); };

  const feedMode: 'Live' | 'Fallback Mock' | 'Live (Backend)' | 'Connecting...' =
    tmConnected && !tmFallback ? 'Live'
    : tmFallback ? 'Fallback Mock'
    : backendConnected ? 'Live (Backend)'
    : 'Connecting...';

  // ── Loading / skeleton state ──
  if (!truemarkets || !bench) {
    return (
      <div className="liquidity-shell h-screen w-screen flex flex-col">
        <div className="h-[2px] bg-[#4F7DFF] flex-shrink-0" />
        <div className="h-14 bg-[#0D0B22]/95 border-b border-divider/70 flex items-center px-5">
          <TrueMarketsLogo size="sm" />
          <div className="ml-3 flex flex-col">
            <span className="text-[14px] font-semibold text-txt-primary font-ui leading-none">Liquidity Intelligence</span>
            <span className="mt-1 text-[10px] uppercase tracking-wide text-txt-muted font-ui">True Markets execution demo</span>
          </div>
        </div>
        <div className="flex-1 overflow-hidden p-5">
          <div className="mx-auto flex h-full max-w-[1680px] flex-col gap-4">
            <div className="h-[118px] animate-pulse rounded-md border border-divider/80 bg-panel" />
            <div className="grid auto-rows-[136px] grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[0, 1, 2, 3].map((idx) => (
                <div key={idx} className="animate-pulse rounded-md border border-divider/80 bg-panel" />
              ))}
            </div>
            <div className="grid flex-1 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(420px,500px)]">
              <div className="grid grid-rows-2 gap-4">
                <div className="animate-pulse rounded-md border border-divider/80 bg-panel" />
                <div className="animate-pulse rounded-md border border-divider/80 bg-panel" />
              </div>
              <div className="animate-pulse rounded-md border border-divider/80 bg-panel" />
            </div>
          </div>
          <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
            <div className="rounded-md border border-divider bg-panel/95 px-5 py-4 text-center shadow-2xl">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-3 text-info" />
              <p className="text-txt-secondary text-sm font-ui tracking-wide">
                {!backendConnected ? 'Establishing data feeds...' : 'Awaiting order book sync...'}
              </p>
              {backendError && <p className="text-warning text-xs mt-2 font-mono">{backendError}</p>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Computed metrics ──
  const spreadGap = truemarkets.spread_bps - bench.spread_bps;
  const tmDepth = truemarkets.bid_depth_5 + truemarkets.ask_depth_5;
  const benchDepth = bench.bid_depth_5 + bench.ask_depth_5;
  const depthRatio = benchDepth > 0 ? tmDepth / benchDepth : 1;
  const slipAdv = computeSlippageAdvantage(truemarkets, bench);
  const riskScore = computeRoutingRiskScore(spreadGap, slipAdv, depthRatio, realLagMs);
  const flowRiskLevel = riskScore > 60 ? 'HIGH' : riskScore > 30 ? 'ELEVATED' : 'LOW';
  const statusInfo = computeOverallStatus(spreadGap, depthRatio, realLagMs);

  return (
    <div className="liquidity-shell h-screen w-screen text-[#E5EDF7] font-ui flex overflow-hidden">
      <AlertToast events={alerts.activeEvents} onDismiss={alerts.dismissEvent} />
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <HeaderBar
          asset={asset} benchmark={benchmark}
          feedMode={feedMode} lastUpdate={lastUpdate} statusInfo={statusInfo}
          onAssetChange={handleAssetChange} onBenchmarkChange={handleBenchChange}
          editMode={dashboardLayout.editMode}
          onToggleEditMode={dashboardLayout.toggleEditMode}
          onResetLayout={dashboardLayout.resetLayout}
        />
        <div className="flex flex-1 min-h-0 overflow-hidden">
        <CollapsedRail
          side="left"
          collapsedWidgets={dashboardLayout.collapsed}
          onRestore={dashboardLayout.restoreWidget}
        />

        <main className="flex-1 min-w-0 overflow-y-auto">
          <div className="dashboard-canvas mx-auto flex min-h-full w-full max-w-[1560px] flex-col gap-4 px-4 py-4 lg:px-5 lg:py-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
              <h1 className="text-[22px] font-semibold tracking-normal text-txt-primary">True Markets Liquidity Intelligence</h1>
              <p className="mt-1 text-[12px] text-txt-muted">Real-time venue quality, executable depth, and routing pressure for the Superday demo.</p>
              </div>
              <div className="hidden items-center gap-6 rounded bg-[#09081D]/70 px-3 py-2 ring-1 ring-divider/60 md:flex">
                <div>
                  <div className="text-[9px] font-semibold uppercase tracking-wide text-txt-muted">Asset</div>
                  <div className="mt-0.5 font-mono text-[12px] font-semibold text-txt-primary">{asset}-PYUSD</div>
                </div>
                <div>
                  <div className="text-[9px] font-semibold uppercase tracking-wide text-txt-muted">Benchmark</div>
                  <div className="mt-0.5 font-mono text-[12px] font-semibold text-txt-primary">{benchmark}</div>
                </div>
                <div>
                  <div className="text-[9px] font-semibold uppercase tracking-wide text-txt-muted">Mode</div>
                  <div className="mt-0.5 font-mono text-[12px] font-semibold text-info">{feedMode === 'Live (Backend)' ? 'Live' : feedMode}</div>
                </div>
              </div>
            </div>
            <DecisionBand
              statusInfo={statusInfo}
              spreadGap={spreadGap}
              slipAdv={slipAdv}
              depthRatio={depthRatio}
              lagMs={realLagMs}
              riskScore={riskScore}
              flowRiskLevel={flowRiskLevel}
              asset={asset}
              benchmarkName={benchmark}
              feedMode={feedMode}
            />

            <div className="grid min-h-[330px] grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(420px,500px)]">
              {!dashboardLayout.collapsed.has('execution-simulator') && (
                <WidgetFrame
                  id="execution-simulator" title="Execution Simulator"
                  editMode={dashboardLayout.editMode}
                  onCollapse={() => dashboardLayout.collapseWidget('execution-simulator')}
                  expandable
                  expanded={dashboardLayout.expandedWidget === 'execution-simulator'}
                  onExpand={() => dashboardLayout.expandWidget(dashboardLayout.expandedWidget === 'execution-simulator' ? null : 'execution-simulator')}
                  noPad
                >
                  <ExecutionSimulator
                    truemarkets={truemarkets}
                    benchmark={bench}
                    benchmarkName={benchmark}
                    lagMs={realLagMs}
                    feedMode={feedMode}
                    depthRatio={depthRatio}
                    side={executionSide}
                    size={executionSize}
                    onSideChange={setExecutionSide}
                    onSizeChange={setExecutionSize}
                  />
                </WidgetFrame>
              )}

              {!dashboardLayout.collapsed.has('market-health') && (
                <WidgetFrame
                  id="market-health" title="Quote Freshness / LP Health"
                  editMode={dashboardLayout.editMode}
                  onCollapse={() => dashboardLayout.collapseWidget('market-health')}
                  expandable
                  expanded={dashboardLayout.expandedWidget === 'market-health'}
                  onExpand={() => dashboardLayout.expandWidget(dashboardLayout.expandedWidget === 'market-health' ? null : 'market-health')}
                  noPad
                >
                  <MarketHealthPanel
                    truemarkets={truemarkets}
                    benchmark={bench}
                    side={executionSide}
                    size={executionSize}
                    spreadGap={spreadGap}
                    depthRatio={depthRatio}
                    lagMs={realLagMs}
                    feedMode={feedMode}
                  />
                </WidgetFrame>
              )}
            </div>

            {/* KPI Row */}
            <div className="grid auto-rows-[142px] grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {!dashboardLayout.collapsed.has('kpi-slippage') && (
                <WidgetFrame
                  id="kpi-slippage" title="Slippage Cost"
                  editMode={dashboardLayout.editMode}
                  onCollapse={() => dashboardLayout.collapseWidget('kpi-slippage')}
                  noPad
                >
                  <MetricCard
                    title="Slippage Cost Impact"
                    value={Math.abs(slipAdv).toFixed(2)}
                    unit="bps"
                    numericValue={slipAdv}
                    ok={slipAdv >= 0}
                    subtitle={slipAdv >= 0 ? 'Execution Savings' : 'Net Penalty'}
                    trend={computeTrend(metricHistory.slippage, true)}
                    series={metricHistory.slippage}
                    alertEnabled={alerts.rules.find(r => r.metricKey === 'slippage_bps')?.enabled}
                    onAlertToggle={() => alerts.toggleAlertRule('slippage_bps')}
                  />
                </WidgetFrame>
              )}
              {!dashboardLayout.collapsed.has('kpi-spread') && (
                <WidgetFrame
                  id="kpi-spread" title="Spread Delta"
                  editMode={dashboardLayout.editMode}
                  onCollapse={() => dashboardLayout.collapseWidget('kpi-spread')}
                  noPad
                >
                  <MetricCard
                    title="Spread Delta"
                    value={`${spreadGap > 0 ? '+' : ''}${spreadGap.toFixed(2)}`}
                    unit="bps"
                    numericValue={spreadGap}
                    ok={spreadGap <= 0}
                    subtitle={spreadGap <= 0 ? 'Tight Pricing' : 'Wider Spread'}
                    trend={computeTrend(metricHistory.spreadDelta)}
                    series={metricHistory.spreadDelta}
                    alertEnabled={alerts.rules.find(r => r.metricKey === 'spread_delta_bps')?.enabled}
                    onAlertToggle={() => alerts.toggleAlertRule('spread_delta_bps')}
                  />
                </WidgetFrame>
              )}
              {!dashboardLayout.collapsed.has('kpi-latency') && (
                <WidgetFrame
                  id="kpi-latency" title="Latency"
                  editMode={dashboardLayout.editMode}
                  onCollapse={() => dashboardLayout.collapseWidget('kpi-latency')}
                  noPad
                >
                  <MetricCard
                    title="Latency"
                    value={`${realLagMs}`}
                    unit="ms"
                    numericValue={realLagMs}
                    ok={realLagMs <= 100}
                    subtitle={realLagMs <= 50 ? 'Nominal' : realLagMs <= 100 ? 'Caution' : 'Severe'}
                    trend={computeTrend(metricHistory.latency)}
                    series={metricHistory.latency}
                    alertEnabled={alerts.rules.find(r => r.metricKey === 'latency_ms')?.enabled}
                    onAlertToggle={() => alerts.toggleAlertRule('latency_ms')}
                    secondaryMetrics={[
                      { label: 'Avg', value: `${metricHistory.latency.length > 0 ? Math.round(metricHistory.latency.reduce((a, b) => a + b, 0) / metricHistory.latency.length) : 0}ms` },
                    ]}
                  />
                </WidgetFrame>
              )}
              {!dashboardLayout.collapsed.has('kpi-routing-risk') && (
                <WidgetFrame
                  id="kpi-routing-risk" title="Routing Risk"
                  editMode={dashboardLayout.editMode}
                  onCollapse={() => dashboardLayout.collapseWidget('kpi-routing-risk')}
                  noPad
                >
                  <MetricCard
                    title="Routing Risk"
                    value={riskScore.toFixed(0)}
                    unit="/100"
                    numericValue={riskScore}
                    ok={riskScore < 30}
                    subtitle={flowRiskLevel}
                    trend={computeTrend(metricHistory.routingRisk)}
                    series={metricHistory.routingRisk}
                    alertEnabled={alerts.rules.find(r => r.metricKey === 'routing_risk_score')?.enabled}
                    onAlertToggle={() => alerts.toggleAlertRule('routing_risk_score')}
                    secondaryMetrics={[
                      { label: 'Depth', value: `${(depthRatio * 100).toFixed(0)}%`, ok: depthRatio >= 0.6 },
                    ]}
                  />
                </WidgetFrame>
              )}
            </div>

            <div className="grid flex-1 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(420px,500px)]">
              <div className="grid min-h-[540px] grid-rows-2 gap-4">
                {!dashboardLayout.collapsed.has('chart-spread') && (
                  <div className="min-h-[270px]">
                    <WidgetFrame
                      id="chart-spread" title="Spread Alignment"
                      editMode={dashboardLayout.editMode}
                      onCollapse={() => dashboardLayout.collapseWidget('chart-spread')}
                      expandable
                      expanded={dashboardLayout.expandedWidget === 'chart-spread'}
                      onExpand={() => dashboardLayout.expandWidget(dashboardLayout.expandedWidget === 'chart-spread' ? null : 'chart-spread')}
                      noPad
                    >
                      <ComparisonCharts history={history} chartType="spread" />
                    </WidgetFrame>
                  </div>
                )}
                {!dashboardLayout.collapsed.has('chart-slippage') && (
                  <div className="min-h-[270px]">
                    <WidgetFrame
                      id="chart-slippage" title="Slippage Trajectory"
                      editMode={dashboardLayout.editMode}
                      onCollapse={() => dashboardLayout.collapseWidget('chart-slippage')}
                      expandable
                      expanded={dashboardLayout.expandedWidget === 'chart-slippage'}
                      onExpand={() => dashboardLayout.expandWidget(dashboardLayout.expandedWidget === 'chart-slippage' ? null : 'chart-slippage')}
                      noPad
                    >
                      <ComparisonCharts history={history} chartType="slippage" />
                    </WidgetFrame>
                  </div>
                )}
              </div>

              <aside className="grid min-h-[540px] grid-rows-[minmax(270px,1fr)_minmax(270px,0.9fr)] gap-4">
                {!dashboardLayout.collapsed.has('table-liquidity') && (
                  <WidgetFrame
                    id="table-liquidity" title="Liquidity Profile"
                    editMode={dashboardLayout.editMode}
                    onCollapse={() => dashboardLayout.collapseWidget('table-liquidity')}
                    expandable
                    expanded={dashboardLayout.expandedWidget === 'table-liquidity'}
                    onExpand={() => dashboardLayout.expandWidget(dashboardLayout.expandedWidget === 'table-liquidity' ? null : 'table-liquidity')}
                    noPad
                  >
                    <VenueComparisonTable
                      truemarkets={truemarkets} benchmark={bench}
                      lagMs={realLagMs} benchName={benchmark}
                    />
                  </WidgetFrame>
                )}

                <div className="grid min-h-[270px] grid-cols-1 gap-4 2xl:grid-cols-2">
                  {!dashboardLayout.collapsed.has('orderbook-tm') && (
                    <WidgetFrame
                      id="orderbook-tm" title="True Markets Book"
                      editMode={dashboardLayout.editMode}
                      onCollapse={() => dashboardLayout.collapseWidget('orderbook-tm')}
                      expandable
                      expanded={dashboardLayout.expandedWidget === 'orderbook-tm'}
                      onExpand={() => dashboardLayout.expandWidget(dashboardLayout.expandedWidget === 'orderbook-tm' ? null : 'orderbook-tm')}
                      noPad
                    >
                      <OrderBookCard
                        snapshot={truemarkets}
                        title="True Markets"
                        isTrueMarkets
                        expanded={dashboardLayout.expandedWidget === 'orderbook-tm'}
                      />
                    </WidgetFrame>
                  )}
                  {!dashboardLayout.collapsed.has('orderbook-bench') && (
                    <WidgetFrame
                      id="orderbook-bench" title={`${bench.venue} Book`}
                      editMode={dashboardLayout.editMode}
                      onCollapse={() => dashboardLayout.collapseWidget('orderbook-bench')}
                      expandable
                      expanded={dashboardLayout.expandedWidget === 'orderbook-bench'}
                      onExpand={() => dashboardLayout.expandWidget(dashboardLayout.expandedWidget === 'orderbook-bench' ? null : 'orderbook-bench')}
                      noPad
                    >
                      <OrderBookCard
                        snapshot={bench}
                        title={bench.venue}
                        expanded={dashboardLayout.expandedWidget === 'orderbook-bench'}
                      />
                    </WidgetFrame>
                  )}
                </div>
              </aside>
            </div>
          </div>
        </main>

        <CollapsedRail
          side="right"
          collapsedWidgets={dashboardLayout.collapsed}
          onRestore={dashboardLayout.restoreWidget}
        />
        </div>
      </div>
    </div>
  );
}
