import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts';
import type { ChartPoint } from '../types';
import { InfoTooltip } from './InfoTooltip';

interface ComparisonChartsProps {
  history: ChartPoint[];
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#111827] border border-[#1F2A3A] rounded-md px-3 py-2 text-xs shadow-lg">
      <div className="text-[#6F7C8E] font-mono mb-1 text-[10px]">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-[#E5EDF7] font-mono font-semibold">{p.value?.toFixed(2)} {p.name === 'Latency' ? 'ms' : 'bps'}</span>
        </div>
      ))}
    </div>
  );
}

interface ChartCardProps {
  title: string;
  tooltipTitle: string;
  tooltipDesc: string;
  subtitle: string;
  currentValue?: string;
  valueColor: string;
  children: React.ReactNode;
}

function ChartCard({ title, tooltipTitle, tooltipDesc, subtitle, currentValue, valueColor, children }: ChartCardProps) {
  return (
    <div className="flex-1 bg-[#0B1220] border border-[#1F2A3A] rounded-lg flex flex-col min-h-0 overflow-hidden">
      <div className="px-4 pt-2.5 pb-1 flex items-center justify-between flex-shrink-0">
        <div className="flex flex-col">
          <InfoTooltip title={tooltipTitle} description={tooltipDesc}>
            <span className="text-[13px] font-semibold text-[#E5EDF7] font-ui">{title}</span>
          </InfoTooltip>
          <span className="text-[10px] text-[#6F7C8E] font-ui mt-0.5">{subtitle}</span>
        </div>
        {currentValue && (
          <span className="text-xs font-mono font-bold" style={{ color: valueColor }}>{currentValue}</span>
        )}
      </div>
      <div className="flex-1 min-h-[50px] px-1 pb-1">
        {children}
      </div>
    </div>
  );
}

export function ComparisonCharts({ history }: ComparisonChartsProps) {
  const latest = history.length > 0 ? history[history.length - 1] : null;

  return (
    <div className="flex flex-col gap-2 h-full min-h-0">
      {/* Chart 1: Spread Gap */}
      <ChartCard
        title="Spread Gap"
        tooltipTitle="Spread Gap"
        tooltipDesc="Difference between True Markets and benchmark bid-ask spreads over time. Positive means TM is wider."
        subtitle="True Markets spread minus benchmark spread"
        currentValue={latest ? `${latest.spreadGap > 0 ? '+' : ''}${latest.spreadGap.toFixed(2)} bps` : undefined}
        valueColor="#4DA3FF"
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="spreadFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4DA3FF" stopOpacity={0.12} />
                <stop offset="95%" stopColor="#4DA3FF" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid horizontal vertical={false} stroke="#1F2A3A" strokeDasharray="3 3" />
            <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#6F7C8E', fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} interval="preserveEnd" minTickGap={80} />
            <YAxis domain={['auto', 'auto']} tick={{ fontSize: 9, fill: '#6F7C8E', fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} width={36} />
            <ReferenceLine y={0} stroke="#39465A" strokeWidth={1} strokeDasharray="4 4" />
            <Tooltip content={<ChartTooltip />} />
            <Area type="monotone" dataKey="spreadGap" stroke="#4DA3FF" strokeWidth={1.5} fill="url(#spreadFill)" dot={false} isAnimationActive={false} name="Spread" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Chart 2: Mid-Price Deviation */}
      <ChartCard
        title="Mid-Price Deviation"
        tooltipTitle="Mid-Price Deviation"
        tooltipDesc="How far True Markets mid-price diverges from the benchmark, measured in basis points over time."
        subtitle="Absolute divergence from benchmark mid"
        currentValue={latest ? `${latest.midGap.toFixed(2)} bps` : undefined}
        valueColor="#F5B942"
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="midFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F5B942" stopOpacity={0.12} />
                <stop offset="95%" stopColor="#F5B942" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid horizontal vertical={false} stroke="#1F2A3A" strokeDasharray="3 3" />
            <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#6F7C8E', fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} interval="preserveEnd" minTickGap={80} />
            <YAxis domain={['auto', 'auto']} tick={{ fontSize: 9, fill: '#6F7C8E', fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} width={36} />
            <ReferenceLine y={0} stroke="#39465A" strokeWidth={1} strokeDasharray="4 4" />
            <Tooltip content={<ChartTooltip />} />
            <Area type="monotone" dataKey="midGap" stroke="#F5B942" strokeWidth={1.5} fill="url(#midFill)" dot={false} isAnimationActive={false} name="Mid Dev" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Chart 3: Reaction Latency */}
      <ChartCard
        title="Reaction Latency"
        tooltipTitle="Reaction Latency"
        tooltipDesc="Time delay in milliseconds between benchmark price changes and True Markets quote updates."
        subtitle="Quote update delay after benchmark move"
        currentValue={latest ? `${latest.lagMs}ms` : undefined}
        valueColor="#FF5C5C"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={history} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid horizontal vertical={false} stroke="#1F2A3A" strokeDasharray="3 3" />
            <XAxis dataKey="time" hide />
            <YAxis domain={[0, 'auto']} tick={{ fontSize: 9, fill: '#6F7C8E', fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} width={36} />
            <ReferenceLine y={100} stroke="#39465A" strokeDasharray="4 4" label={{ value: '100ms', position: 'right', fill: '#6F7C8E', fontSize: 8, fontFamily: 'JetBrains Mono' }} />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="lagMs" name="Latency" radius={[2, 2, 0, 0]} maxBarSize={6} isAnimationActive={false} fill="#FF5C5C" fillOpacity={0.55} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
