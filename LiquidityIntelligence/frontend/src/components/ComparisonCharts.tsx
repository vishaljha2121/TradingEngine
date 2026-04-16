import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, CartesianGrid } from 'recharts';
import type { ChartPoint } from '../types';

interface ComparisonChartsProps {
  history: ChartPoint[];
  chartType?: 'spread' | 'slippage' | 'both';
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string;
}

function SpreadTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const value = p.value ?? 0;
  const isPenalty = value > 0;
  return (
    <div className="bg-panel border border-divider rounded shadow-2xl font-ui overflow-hidden min-w-[140px]">
      <div className={`px-3 py-1.5 text-[9px] uppercase font-bold text-panel ${isPenalty ? 'bg-negative' : 'bg-positive'}`}>
        {isPenalty ? 'Penalty Zone' : 'Advantage Zone'}
      </div>
      <div className="px-3 py-2 flex items-center justify-between gap-4">
        <span className="text-txt-muted text-[10px] font-mono">{label}</span>
        <span className="text-txt-primary font-mono font-bold text-[12px] tabular-nums">{value > 0 ? '+' : ''}{value.toFixed(2)} bps</span>
      </div>
    </div>
  );
}

function SlipTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const slipVal = p.value || 0;
  const isGood = slipVal >= 0;
  return (
    <div className="bg-panel border border-divider rounded shadow-2xl font-ui overflow-hidden min-w-[140px]">
      <div className={`px-3 py-1.5 text-[9px] uppercase font-bold text-panel ${isGood ? 'bg-positive' : 'bg-negative'}`}>
        {isGood ? 'Execution Savings' : 'Execution Penalty'}
      </div>
      <div className="px-3 py-2 flex items-center justify-between gap-4">
        <span className="text-txt-muted text-[10px] font-mono">{label}</span>
        <span className="text-txt-primary font-mono font-bold text-[12px] tabular-nums">{Math.abs(slipVal).toFixed(2)} bps</span>
      </div>
    </div>
  );
}

export function ComparisonCharts({ history, chartType = 'both' }: ComparisonChartsProps) {
  // Calculate max/min for domains
  const spreadMax = Math.max(...history.map(d => d.spreadGap), 1.5);
  const spreadMin = Math.min(...history.map(d => d.spreadGap), -0.5);
  
  const slipMax = Math.max(...history.map((d) => d.slipAdv || 0), 1.5);
  const slipMin = Math.min(...history.map((d) => d.slipAdv || 0), -0.5);

  const spreadOffset = spreadMax - spreadMin === 0 ? 0 : spreadMax / (spreadMax - spreadMin);
  const slipOffset = slipMax - slipMin === 0 ? 0 : slipMax / (slipMax - slipMin);
  const last = history[history.length - 1];

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3 p-3">
      {/* 1. Spread Gap Chart */}
      {(chartType === 'spread' || chartType === 'both') && (
        <div className="flex min-h-0 flex-1 flex-col">
          <ChartHeader
            label="Spread Delta"
            value={last ? `${last.spreadGap > 0 ? '+' : ''}${last.spreadGap.toFixed(2)} bps` : '--'}
            good={(last?.spreadGap ?? 0) <= 0}
            description="True Markets spread versus benchmark"
          />
          <div className="relative mt-2 h-[190px] min-h-[120px] flex-1">
            {history.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <AreaChart data={history} margin={{ top: 12, right: 18, left: 0, bottom: 0 }}>
                <ReferenceArea y1={0} y2={Math.max(spreadMax * 1.2, 2)} fill="#F28D3A" fillOpacity={0.03} />
                <ReferenceArea y1={Math.min(spreadMin * 1.2, -1)} y2={0} fill="#5E7DFF" fillOpacity={0.03} />
                <CartesianGrid horizontal={true} vertical={false} stroke="#252343" strokeDasharray="4 4" opacity={0.4} />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#6E7199', fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={{ stroke: '#252343', strokeWidth: 1 }} interval="preserveEnd" minTickGap={80} />
                <YAxis domain={['dataMin - 0.5', 'dataMax + 0.5']} tick={{ fontSize: 10, fill: '#A7A9D2', fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} width={40} tickFormatter={(val) => val.toFixed(1)} />
                <ReferenceLine y={0} stroke="#E5EDF7" strokeWidth={1} strokeDasharray="6 6" opacity={0.5} label={{ value: 'Parity Baseline', position: 'insideTopLeft', fill: '#8EA0B8', fontSize: 10, fontFamily: 'ui-sans-serif', dy: -12 }} />
                <Tooltip content={<SpreadTooltip />} cursor={{ stroke: '#6E7199', strokeWidth: 1, strokeDasharray: '3 3' }} />
                <defs>
                  <linearGradient id="splitColorSpread" x1="0" y1="0" x2="0" y2="1">
                    <stop offset={spreadOffset} stopColor="#F28D3A" stopOpacity={1} />
                    <stop offset={spreadOffset} stopColor="#5E7DFF" stopOpacity={1} />
                  </linearGradient>
                  <linearGradient id="splitFillSpread" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F28D3A" stopOpacity={0.2} />
                    <stop offset={spreadOffset} stopColor="#F28D3A" stopOpacity={0} />
                    <stop offset={spreadOffset} stopColor="#5E7DFF" stopOpacity={0} />
                    <stop offset="100%" stopColor="#5E7DFF" stopOpacity={0.2} />
                  </linearGradient>
                </defs>
                <Area type="step" dataKey="spreadGap" stroke="url(#splitColorSpread)" strokeWidth={2} fill="url(#splitFillSpread)" dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
            ) : (
              <EmptyChartState />
            )}
          </div>
        </div>
      )}

      {/* 2. Slippage Impact Evolution */}
      {(chartType === 'slippage' || chartType === 'both') && (
        <div className="flex min-h-0 flex-1 flex-col">
          <ChartHeader
            label="Slippage Advantage"
            value={last?.slipAdv != null ? `${last.slipAdv > 0 ? '+' : ''}${last.slipAdv.toFixed(2)} bps` : '--'}
            good={(last?.slipAdv ?? 0) >= 0}
            description="Ask-side VWAP savings versus benchmark"
          />
          <div className="relative mt-2 h-[190px] min-h-[120px] flex-1">
            {history.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <AreaChart data={history} margin={{ top: 12, right: 18, left: 0, bottom: 0 }}>
                {/* Note: For Slippage, Above 0 is Good (Green), Below 0 is Bad (Red) */}
                <ReferenceArea y1={0} y2={Math.max(slipMax * 1.2, 2)} fill="#5E7DFF" fillOpacity={0.03} />
                <ReferenceArea y1={Math.min(slipMin * 1.2, -1)} y2={0} fill="#F28D3A" fillOpacity={0.03} />
                <CartesianGrid horizontal={true} vertical={false} stroke="#252343" strokeDasharray="4 4" opacity={0.4} />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#6E7199', fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={{ stroke: '#252343', strokeWidth: 1 }} interval="preserveEnd" minTickGap={80} />
                <YAxis domain={['dataMin - 0.5', 'dataMax + 0.5']} tick={{ fontSize: 10, fill: '#A7A9D2', fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} width={40} tickFormatter={(val) => Math.abs(val).toFixed(1)} />
                <ReferenceLine y={0} stroke="#E5EDF7" strokeWidth={1} strokeDasharray="6 6" opacity={0.5} label={{ value: 'Parity Baseline', position: 'insideTopLeft', fill: '#8EA0B8', fontSize: 10, fontFamily: 'ui-sans-serif', dy: -12 }} />
                <Tooltip content={<SlipTooltip />} cursor={{ stroke: '#6E7199', strokeWidth: 1, strokeDasharray: '3 3' }} />
                <defs>
                  <linearGradient id="splitColorSlip" x1="0" y1="0" x2="0" y2="1">
                    <stop offset={slipOffset} stopColor="#5E7DFF" stopOpacity={1} />
                    <stop offset={slipOffset} stopColor="#F28D3A" stopOpacity={1} />
                  </linearGradient>
                  <linearGradient id="splitFillSlip" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5E7DFF" stopOpacity={0.2} />
                    <stop offset={slipOffset} stopColor="#5E7DFF" stopOpacity={0} />
                    <stop offset={slipOffset} stopColor="#F28D3A" stopOpacity={0} />
                    <stop offset="100%" stopColor="#F28D3A" stopOpacity={0.2} />
                  </linearGradient>
                </defs>
                <Area type="step" dataKey="slipAdv" stroke="url(#splitColorSlip)" strokeWidth={2} fill="url(#splitFillSlip)" dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
            ) : (
              <EmptyChartState />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ChartHeader({
  label,
  value,
  description,
  good,
}: {
  label: string;
  value: string;
  description: string;
  good: boolean;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-divider/40 pb-2">
      <div>
        <div className="text-[12px] font-semibold uppercase tracking-wide text-txt-primary">{label}</div>
        <div className="mt-0.5 text-[11px] text-txt-muted">{description}</div>
      </div>
      <div className={`font-mono text-[15px] font-bold tabular-nums ${good ? 'text-positive' : 'text-negative'}`}>
        {value}
      </div>
    </div>
  );
}

function EmptyChartState() {
  return (
    <div className="grid h-full min-h-[120px] place-items-center rounded border border-dashed border-divider/80 bg-panel-secondary/20">
      <span className="text-[12px] font-medium text-txt-muted">Collecting market history...</span>
    </div>
  );
}
