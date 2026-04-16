// ─── Core venue data (PRESERVED from original) ───
export interface Level {
  0: number; // price
  1: number; // qty
}

export interface VenueSnapshot {
  venue: string;
  mid: number;
  spread_bps: number;
  bid_depth_5: number;
  ask_depth_5: number;
  bids: Level[];
  asks: Level[];
}

export interface Insight {
  status: string;
  reason: string;
  color: string;
}

export interface IntelligencePayload {
  timestamp: number;
  benchmark: VenueSnapshot;
  truemarkets: VenueSnapshot;
  insights: Insight;
  lag_ms?: number;
  // Extended fields from backend (Phase 6+)
  metric_snapshots?: MetricSnapshot[];
  dashboard_meta?: DashboardMeta;
}

export interface ChartPoint {
  time: string;
  spreadGap: number;
  midGap: number;
  lagMs: number;
  slipAdv?: number;
}

// ─── Extended Metric Types (Phase 1) ───

/** Canonical metric keys used across KPIs, alerts, and history */
export type MetricKey =
  | 'slippage_bps'
  | 'spread_delta_bps'
  | 'latency_ms'
  | 'depth_ratio'
  | 'routing_risk_score';

/** A single time-series data point for sparklines */
export interface MetricSeriesPoint {
  ts: number;      // epoch ms
  value: number;
}

/** Rolling statistical summary for a metric window */
export interface MetricSummaryStats {
  avg: number;
  min: number;
  max: number;
  stddev: number;
  count: number;
}

/** Outlier detection result attached to a metric */
export interface OutlierSummary {
  isOutlier: boolean;
  severity: 'none' | 'mild' | 'moderate' | 'severe';
  sustainedMs: number;
  zScore: number;
  percentileBand: 'normal' | 'p90' | 'p95' | 'p99';
}

/** Trend direction for a metric */
export type MetricTrend = 'improving' | 'stable' | 'worsening';

/** Complete metric snapshot — one per MetricKey per broadcast cycle */
export interface MetricSnapshot {
  key: MetricKey;
  label: string;
  value: number;
  displayValue: string;
  unit: string;
  trend: MetricTrend;
  series: MetricSeriesPoint[];
  summary: MetricSummaryStats;
  outlier: OutlierSummary;
}

/** Dashboard-level metadata */
export interface DashboardMeta {
  feedMode: 'live' | 'fallback' | 'stale';
  isStale: boolean;
  staleMs: number;
  benchmarkName: string;
  asset: string;
}

// ─── Dashboard Layout Types (Phase 2) ───

/** Enumerated widget identifiers — not generic strings */
export type WidgetId =
  | 'status-summary'
  | 'kpi-slippage'
  | 'kpi-spread'
  | 'kpi-latency'
  | 'kpi-routing-risk'
  | 'execution-simulator'
  | 'market-health'
  | 'chart-spread'
  | 'chart-slippage'
  | 'table-liquidity'
  | 'orderbook-tm'
  | 'orderbook-bench'
  | 'alert-center';

/** Grid layout item for react-grid-layout */
export interface DashboardLayoutItem {
  i: WidgetId;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

/** Which side collapsed widgets snap to */
export type CollapseSide = 'left' | 'right';

// ─── Alert Types (Phase 8) ───

/** Alert trigger mode */
export type AlertMode = 'outlier' | 'threshold';

/** Per-metric alert rule, persisted locally */
export interface MetricAlertRule {
  metricKey: MetricKey;
  enabled: boolean;
  mode: AlertMode;
  threshold?: number;       // only used in threshold mode
  minDurationMs: number;    // sustained before firing
  cooldownMs: number;       // minimum gap between alerts
  browserNotification: boolean;
}

/** Fired alert event for in-app display */
export interface AlertEvent {
  id: string;
  metricKey: MetricKey;
  label: string;
  value: number;
  severity: OutlierSummary['severity'];
  message: string;
  firedAt: number;  // epoch ms
  dismissed: boolean;
}
