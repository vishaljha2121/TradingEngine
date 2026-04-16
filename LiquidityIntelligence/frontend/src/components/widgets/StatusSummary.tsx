import type { StatusInfo } from '../../utils/metrics';
import { TrueMarketsIcon } from '../TrueMarketsLogo';

interface StatusSummaryProps {
  statusInfo: StatusInfo;
  spreadGap: number;
  slipAdv: number;
  depthRatio: number;
  lagMs: number;
  feedMode: string;
  asset: string;
  benchmarkName: string;
}

export function StatusSummary({
  statusInfo,
  spreadGap,
  slipAdv,
  depthRatio,
  lagMs,
  feedMode,
  asset,
  benchmarkName,
}: StatusSummaryProps) {
  const slipOk = slipAdv >= 0;
  const spreadOk = spreadGap <= 0;

  // Concise headline
  const headline =
    statusInfo.status === 'Advantageous'
      ? 'Venue execution superior to benchmark'
      : statusInfo.status === 'Competitive'
        ? 'Venue execution aligned with benchmark'
        : statusInfo.status === 'Pressured'
          ? 'Venue competitiveness pressured'
          : 'Severe execution quality degradation';

  return (
    <div className="flex items-center gap-4 h-full px-5 py-1">
      {/* Status badge + headline */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <TrueMarketsIcon size={14} />
        <div className={`px-2 py-0.5 rounded text-[9px] uppercase tracking-widest font-bold font-ui flex-shrink-0 ${statusInfo.bgClass} ${statusInfo.textClass}`}>
          {statusInfo.status}
        </div>
        <span className="text-[12px] font-bold text-txt-primary font-ui truncate tracking-wide">
          {headline}
        </span>
      </div>

      {/* Compact metric badges */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <MetricBadge
          label="Spread Δ"
          value={spreadOk ? 'Tight' : `+${spreadGap.toFixed(1)}`}
          unit={spreadOk ? '' : 'bps'}
          ok={spreadOk}
        />
        <MetricBadge
          label="Slip"
          value={`${Math.abs(slipAdv).toFixed(1)}`}
          unit="bps"
          ok={slipOk}
        />
        <MetricBadge
          label="Depth"
          value={`${(depthRatio * 100).toFixed(0)}%`}
          ok={depthRatio >= 0.6}
        />
        <MetricBadge
          label="Lag"
          value={`${lagMs}`}
          unit="ms"
          ok={lagMs <= 100}
        />
      </div>

      {/* Feed context */}
      <div className="flex items-center gap-1.5 flex-shrink-0 border-l border-divider pl-4">
        <span className="text-[9px] uppercase tracking-wider text-txt-muted font-ui font-semibold">{asset}</span>
        <span className="text-[9px] text-txt-muted/70">vs</span>
        <span className="text-[9px] uppercase tracking-wider text-txt-muted font-ui font-semibold">{benchmarkName}</span>
        <div className={`ml-1 w-1.5 h-1.5 rounded-full ${feedMode === 'Live' || feedMode === 'Live (Backend)' ? 'bg-positive' : 'bg-warning'}`} />
      </div>
    </div>
  );
}

function MetricBadge({ label, value, unit, ok }: { label: string; value: string; unit?: string; ok: boolean }) {
  const color = ok ? 'text-positive' : 'text-negative';
  const bg = ok ? 'bg-positive/5 border-positive/10' : 'bg-negative/5 border-negative/10';
  return (
    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] ${bg}`}>
      <span className="text-txt-label font-ui font-semibold uppercase tracking-widest text-[8px]">{label}</span>
      <span className={`font-mono font-bold tabular-nums tracking-tight ${color}`}>{value}</span>
      {unit && <span className="text-txt-muted text-[8px] font-mono font-semibold ml-[-2px]">{unit}</span>}
    </div>
  );
}
