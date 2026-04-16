import { Activity, Gauge, Route, Zap } from 'lucide-react';
import type React from 'react';
import type { StatusInfo } from '../../utils/metrics';

interface DecisionBandProps {
  statusInfo: StatusInfo;
  spreadGap: number;
  slipAdv: number;
  depthRatio: number;
  lagMs: number;
  riskScore: number;
  flowRiskLevel: string;
  asset: string;
  benchmarkName: string;
  feedMode: string;
}

function formatSigned(value: number, digits = 2) {
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}`;
}

function getDecision(status: string, riskScore: number) {
  if (status === 'Advantageous') return 'Capture Flow';
  if (status === 'Degraded' || riskScore >= 60) return 'Route With Caution';
  if (status === 'Pressured' || riskScore >= 30) return 'Monitor Pressure';
  return 'Competitive';
}

function getPrimaryDriver(spreadGap: number, slipAdv: number, depthRatio: number, lagMs: number) {
  const drivers = [
    { label: 'spread', score: Math.max(0, spreadGap), text: `${formatSigned(spreadGap)} bps spread delta` },
    { label: 'slippage', score: Math.max(0, -slipAdv), text: `${formatSigned(slipAdv)} bps execution edge` },
    { label: 'depth', score: Math.max(0, 0.8 - depthRatio), text: `${Math.round(depthRatio * 100)}% displayed depth` },
    { label: 'lag', score: Math.max(0, lagMs / 200), text: `${Math.round(lagMs)} ms quote lag` },
  ];
  return drivers.sort((a, b) => b.score - a.score)[0]?.text ?? 'venue aligned with benchmark';
}

export function DecisionBand({
  statusInfo,
  spreadGap,
  slipAdv,
  depthRatio,
  lagMs,
  riskScore,
  flowRiskLevel,
  asset,
  benchmarkName,
  feedMode,
}: DecisionBandProps) {
  const decision = getDecision(statusInfo.status, riskScore);
  const driver = getPrimaryDriver(spreadGap, slipAdv, depthRatio, lagMs);
  const isLive = feedMode === 'Live' || feedMode === 'Live (Backend)';

  return (
    <section className="panel-surface overflow-hidden">
      <div className="grid min-h-[120px] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="relative flex min-w-0 flex-col justify-center gap-2.5 px-5 py-4 lg:px-6">
          <div className="absolute inset-y-0 left-0 w-[3px]" style={{ backgroundColor: statusInfo.status === 'Degraded' ? '#FF6B7E' : statusInfo.status === 'Pressured' ? '#F28D3A' : '#5E7DFF' }} />
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-[#4F7DFF]/15 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-[#7E99FF]">
              {statusInfo.status}
            </span>
            <span className="rounded bg-[#0B0A20] px-2 py-1 font-mono text-[11px] font-semibold text-txt-secondary ring-1 ring-divider/50">
              {asset}-PYUSD vs {benchmarkName}
            </span>
            <span className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-[11px] font-semibold ring-1 ${isLive ? 'text-[#7E99FF] ring-[#4F7DFF]/30' : 'text-[#F3A14A] ring-[#F3A14A]/30'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${isLive ? 'bg-[#5E7DFF]' : 'bg-[#F28D3A]'}`} />
              {feedMode === 'Live (Backend)' ? 'Live' : feedMode}
            </span>
          </div>
          <div>
            <h1 className="text-[20px] font-semibold leading-tight tracking-normal text-txt-primary lg:text-[22px]">
              {decision}: {driver}
            </h1>
            <p className="mt-1 max-w-[860px] text-[13px] leading-5 text-txt-secondary">
              Execution quality is evaluated from spread, ask-side VWAP slippage, top-5 displayed depth, and quote lag.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 border-t border-divider/70 bg-[#14132D]/72 lg:border-l lg:border-t-0">
          <DecisionStat icon={<Route className="h-4 w-4" />} label="Routing Risk" value={`${Math.round(riskScore)}`} unit="/100" tone={riskScore >= 60 ? 'bad' : riskScore >= 30 ? 'warn' : 'good'} helper={flowRiskLevel} />
          <DecisionStat icon={<Zap className="h-4 w-4" />} label="Cost Edge" value={formatSigned(slipAdv)} unit="bps" tone={slipAdv >= 0 ? 'good' : 'bad'} helper={slipAdv >= 0 ? 'Savings' : 'Penalty'} />
          <DecisionStat icon={<Gauge className="h-4 w-4" />} label="Depth Ratio" value={`${Math.round(depthRatio * 100)}`} unit="%" tone={depthRatio >= 0.8 ? 'good' : depthRatio >= 0.5 ? 'warn' : 'bad'} helper="Top 5 levels" />
          <DecisionStat icon={<Activity className="h-4 w-4" />} label="Quote Lag" value={`${Math.round(lagMs)}`} unit="ms" tone={lagMs <= 50 ? 'good' : lagMs <= 100 ? 'warn' : 'bad'} helper="Observed" />
        </div>
      </div>
    </section>
  );
}

function DecisionStat({
  icon,
  label,
  value,
  unit,
  helper,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  helper: string;
  tone: 'good' | 'warn' | 'bad';
}) {
  const toneClass = tone === 'good' ? 'text-[#6F8DFF]' : tone === 'warn' ? 'text-[#F28D3A]' : 'text-[#FF6B7E]';

  return (
    <div className="border-b border-r border-divider/70 px-4 py-2.5 last:border-r-0 [&:nth-child(2n)]:border-r-0 [&:nth-last-child(-n+2)]:border-b-0">
      <div className="mb-2 flex items-center gap-2 text-txt-label">
        <span className={toneClass}>{icon}</span>
        <span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`font-mono text-[22px] font-bold leading-none tabular-nums ${toneClass}`}>{value}</span>
        <span className="font-mono text-[11px] font-semibold text-txt-muted">{unit}</span>
      </div>
      <div className="mt-1 text-[11px] font-medium text-txt-muted">{helper}</div>
    </div>
  );
}
