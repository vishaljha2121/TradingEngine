import { useMemo, useState } from 'react';
import type React from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownUp, GitBranch, Target, TrendingUp } from 'lucide-react';
import type { VenueSnapshot } from '../../types';
import {
  analyzeExecution,
  buildImpactCurve,
  computeQuoteFreshness,
  computeRecommendation,
  type ExecutionSide,
  type ImpactPoint,
} from '../../utils/executionAnalytics';
import { formatPrice, formatQty } from '../../utils/formatters';

interface ExecutionSimulatorProps {
  truemarkets: VenueSnapshot;
  benchmark: VenueSnapshot;
  benchmarkName: string;
  lagMs: number;
  feedMode: string;
  depthRatio: number;
  side: ExecutionSide;
  size: number;
  onSideChange: (side: ExecutionSide) => void;
  onSizeChange: (size: number) => void;
}

const SIZE_PRESETS = [0.1, 0.5, 1, 2, 5];
const IMPACT_SIZES = [0.1, 0.25, 0.5, 1, 2, 5];

export function ExecutionSimulator({
  truemarkets,
  benchmark,
  benchmarkName,
  lagMs,
  feedMode,
  depthRatio,
  side,
  size,
  onSideChange,
  onSizeChange,
}: ExecutionSimulatorProps) {
  const [thresholdBps, setThresholdBps] = useState(5);

  const freshness = useMemo(() => computeQuoteFreshness(lagMs, feedMode), [lagMs, feedMode]);
  const analysis = useMemo(
    () => analyzeExecution(truemarkets, benchmark, side, size, thresholdBps),
    [truemarkets, benchmark, side, size, thresholdBps],
  );
  const recommendation = useMemo(
    () => computeRecommendation(analysis, freshness, depthRatio),
    [analysis, freshness, depthRatio],
  );
  const impactCurve = useMemo(
    () => buildImpactCurve(truemarkets, benchmark, side, IMPACT_SIZES),
    [truemarkets, benchmark, side],
  );

  const toneClass = recommendation.tone === 'good'
    ? 'text-[#7E99FF] border-[#5E7DFF]/30 bg-[#5E7DFF]/10'
    : recommendation.tone === 'warn'
      ? 'text-[#F3A14A] border-[#F3A14A]/30 bg-[#F3A14A]/10'
      : 'text-[#F28D3A] border-[#F28D3A]/35 bg-[#F28D3A]/10';

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="grid flex-shrink-0 grid-cols-1 border-b border-divider/50 bg-panel-secondary/30 md:grid-cols-[minmax(0,1fr)_340px]">
        <div className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedSide value={side} onChange={onSideChange} />
            <SizeControl size={size} onChange={onSizeChange} />
            <ThresholdControl thresholdBps={thresholdBps} onChange={setThresholdBps} />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
            <SimStat label="TM VWAP" value={formatPrice(analysis.tm.vwap)} helper={`${analysis.tm.fillPct.toFixed(0)}% fill`} good={analysis.tm.fillPct >= 85} />
            <SimStat label={`${benchmarkName} VWAP`} value={formatPrice(analysis.benchmark.vwap)} helper={`${analysis.benchmark.fillPct.toFixed(0)}% fill`} good={analysis.benchmark.fillPct >= 85} />
            <SimStat label="Net Edge" value={`${analysis.edgeBps > 0 ? '+' : ''}${analysis.edgeBps.toFixed(2)} bps`} helper={`${analysis.edgeUsd >= 0 ? '+' : '-'}$${Math.abs(analysis.edgeUsd).toFixed(2)}`} good={analysis.edgeBps >= 0} />
            <SimStat label={`Fillable @ ${thresholdBps}bps`} value={formatQty(analysis.fillableTmWithinThreshold)} helper={`${benchmarkName}: ${formatQty(analysis.fillableBenchmarkWithinThreshold)}`} good={analysis.fillableTmWithinThreshold >= size} />
          </div>
        </div>

        <div className="border-t border-divider/50 px-4 py-3 md:border-l md:border-t-0">
          <div className={`rounded border px-3 py-2 ${toneClass}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide opacity-80">Recommended Action</div>
                <div className="mt-1 text-[16px] font-semibold leading-tight text-txt-primary">{recommendation.label}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-[22px] font-bold leading-none tabular-nums">{recommendation.confidence}</div>
                <div className="mt-1 text-[9px] font-semibold uppercase tracking-wide opacity-80">Confidence</div>
              </div>
            </div>
          </div>

          <div className="mt-2 space-y-1.5">
            {recommendation.reasons.slice(0, 3).map((reason) => (
              <div key={reason} className="flex items-start gap-2 text-[11px] leading-4 text-txt-secondary">
                <span className="mt-[5px] h-1 w-1 flex-shrink-0 rounded-full bg-info" />
                <span>{reason}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 md:grid-cols-[260px_minmax(0,1fr)]">
        <div className="border-b border-divider/50 p-4 md:border-b-0 md:border-r">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
            <RouteMiniCard icon={<Target className="h-4 w-4" />} label="Order" value={`${side.toUpperCase()} ${size.toFixed(size >= 1 ? 1 : 2)} BTC`} />
            <RouteMiniCard icon={<ArrowDownUp className="h-4 w-4" />} label="Symmetric Model" value={side === 'buy' ? 'Ask VWAP' : 'Bid VWAP'} />
            <RouteMiniCard icon={<GitBranch className="h-4 w-4" />} label="Split Weight" value={`${recommendation.splitTmPct}% TM`} />
            <RouteMiniCard icon={<TrendingUp className="h-4 w-4" />} label="Impact Edge" value={`${(analysis.benchmark.impactBps - analysis.tm.impactBps).toFixed(2)} bps`} />
          </div>
        </div>

        <div className="min-h-[180px] p-3">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-txt-primary">Market Impact Curve</div>
              <div className="text-[10px] text-txt-muted">Expected VWAP impact as order size increases</div>
            </div>
            <div className="font-mono text-[10px] font-semibold uppercase text-txt-muted">bps</div>
          </div>
          <div className="h-[150px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <AreaChart data={impactCurve} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
                <CartesianGrid horizontal vertical={false} stroke="#252343" strokeDasharray="4 4" opacity={0.45} />
                <XAxis dataKey="size" tick={{ fontSize: 10, fill: '#6E7199', fontFamily: 'JetBrains Mono' }} tickFormatter={(value) => `${value}`} tickLine={false} axisLine={{ stroke: '#252343' }} />
                <YAxis tick={{ fontSize: 10, fill: '#A7A9D2', fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} width={42} />
                <Tooltip content={<ImpactTooltip benchmarkName={benchmarkName} />} />
                <Area type="monotone" dataKey="benchmarkImpactBps" stroke="#F28D3A" strokeWidth={1.8} fill="#F28D3A" fillOpacity={0.08} dot={false} isAnimationActive={false} />
                <Area type="monotone" dataKey="tmImpactBps" stroke="#5E7DFF" strokeWidth={1.8} fill="#5E7DFF" fillOpacity={0.1} dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function SegmentedSide({ value, onChange }: { value: ExecutionSide; onChange: (value: ExecutionSide) => void }) {
  return (
    <div className="inline-grid h-8 grid-cols-2 overflow-hidden rounded border border-divider bg-[#09081D]">
      {(['buy', 'sell'] as ExecutionSide[]).map((side) => (
        <button
          key={side}
          onClick={() => onChange(side)}
          className={`px-3 text-[11px] font-bold uppercase tracking-wide transition-colors ${
            value === side ? 'bg-info/15 text-[#7E99FF]' : 'text-txt-muted hover:bg-panel-secondary hover:text-txt-primary'
          }`}
        >
          {side}
        </button>
      ))}
    </div>
  );
}

function SizeControl({ size, onChange }: { size: number; onChange: (value: number) => void }) {
  return (
    <label className="flex h-8 items-center gap-2 rounded border border-divider bg-[#09081D] px-2">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-txt-muted">Size</span>
      <select
        value={size}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-6 appearance-none bg-transparent pr-1 font-mono text-[12px] font-semibold text-txt-primary outline-none"
      >
        {SIZE_PRESETS.map((preset) => (
          <option key={preset} value={preset}>{preset} BTC</option>
        ))}
      </select>
    </label>
  );
}

function ThresholdControl({ thresholdBps, onChange }: { thresholdBps: number; onChange: (value: number) => void }) {
  return (
    <label className="flex h-8 items-center gap-2 rounded border border-divider bg-[#09081D] px-2">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-txt-muted">Within</span>
      <select
        value={thresholdBps}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-6 appearance-none bg-transparent pr-1 font-mono text-[12px] font-semibold text-txt-primary outline-none"
      >
        {[2, 5, 10, 25].map((bps) => (
          <option key={bps} value={bps}>{bps} bps</option>
        ))}
      </select>
    </label>
  );
}

function SimStat({ label, value, helper, good }: { label: string; value: string; helper: string; good: boolean }) {
  return (
    <div className="rounded border border-divider/70 bg-[#09081D]/70 px-3 py-2">
      <div className="text-[9px] font-semibold uppercase tracking-wide text-txt-muted">{label}</div>
      <div className={`mt-1 truncate font-mono text-[14px] font-bold tabular-nums ${good ? 'text-[#7E99FF]' : 'text-[#F28D3A]'}`}>{value}</div>
      <div className="mt-0.5 truncate text-[10px] text-txt-muted">{helper}</div>
    </div>
  );
}

function RouteMiniCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded border border-divider/60 bg-panel-secondary/25 px-3 py-2">
      <div className="flex items-center gap-2 text-txt-muted">
        <span className="text-info">{icon}</span>
        <span className="text-[9px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-1.5 font-mono text-[13px] font-bold text-txt-primary">{value}</div>
    </div>
  );
}

function ImpactTooltip({ active, payload, label, benchmarkName }: { active?: boolean; payload?: Array<{ dataKey?: string; value?: number; payload?: ImpactPoint }>; label?: string; benchmarkName: string }) {
  if (!active || !payload?.length) return null;
  const tm = payload.find((item) => item.dataKey === 'tmImpactBps')?.value ?? 0;
  const bench = payload.find((item) => item.dataKey === 'benchmarkImpactBps')?.value ?? 0;
  return (
    <div className="min-w-[170px] rounded border border-divider bg-panel shadow-2xl">
      <div className="border-b border-divider px-3 py-1.5 font-mono text-[10px] font-semibold text-txt-secondary">{label} BTC</div>
      <div className="space-y-1.5 px-3 py-2 font-mono text-[11px]">
        <div className="flex justify-between gap-4"><span className="text-[#7E99FF]">True Markets</span><span className="font-bold text-txt-primary">{tm.toFixed(2)} bps</span></div>
        <div className="flex justify-between gap-4"><span className="text-[#F28D3A]">{benchmarkName}</span><span className="font-bold text-txt-primary">{bench.toFixed(2)} bps</span></div>
      </div>
    </div>
  );
}
