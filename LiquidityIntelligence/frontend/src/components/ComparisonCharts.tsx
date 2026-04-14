import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts';
import type { ChartPoint } from '../types';
import { InfoTooltip } from './InfoTooltip';

interface ComparisonChartsProps {
  history: ChartPoint[];
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#111827] border border-[#1F2A3A] rounded-md px-3 py-2 text-xs shadow-lg font-ui">
      <div className="text-[#6F7C8E] font-mono mb-1.5 text-[10px] border-b border-[#1F2A3A]/50 pb-1">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 mt-1">
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-[#8EA0B8] text-[11px] uppercase tracking-wide w-16">{p.name}</span>
          <span className="text-[#E5EDF7] font-mono font-semibold" style={{ color: p.color }}>{p.value > 0 && p.name !== 'Latency' ? '+' : ''}{p.value?.toFixed(p.name === 'Latency' ? 0 : 2)} {p.name === 'Latency' ? 'ms' : 'bps'}</span>
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
  flexWeight: string;
  children: React.ReactNode;
}

function ChartCard({ title, tooltipTitle, tooltipDesc, subtitle, currentValue, valueColor, flexWeight, children }: ChartCardProps) {
  return (
    <div className={`bg-[#0B1220] border border-[#1F2A3A]/60 rounded-xl flex flex-col min-h-0 overflow-hidden relative shadow-sm ${flexWeight}`}>
      <div className="px-5 pt-3 pb-2 flex items-center justify-between flex-shrink-0 border-b border-[#1F2A3A]/20">
        <div className="flex flex-col">
          <InfoTooltip title={tooltipTitle} description={tooltipDesc}>
            <span className="text-[14px] font-bold tracking-tight text-[#E5EDF7] font-ui group-hover:text-white transition-colors">{title}</span>
          </InfoTooltip>
          <span className="text-[11px] text-[#A8B3C2] font-ui mt-0.5">{subtitle}</span>
        </div>
        {currentValue && (
          <span className="text-[15px] font-mono font-bold" style={{ color: valueColor }}>{currentValue}</span>
        )}
      </div>
      <div className="flex-1 min-h-[50px] px-2 pb-2 mt-2">
        {children}
      </div>
    </div>
  );
}

export function ComparisonCharts({ history }: ComparisonChartsProps) {
  const latest = history.length > 0 ? history[history.length - 1] : null;

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      {/* Chart 1: Spread Gap (Dominant 60%) */}
      <ChartCard
        title="Bid-Ask Spread Gap"
        tooltipTitle="Spread Gap"
        tooltipDesc="Difference between True Markets and benchmark bid-ask spreads over time."
        subtitle="True Markets spread vs Benchmark"
        currentValue={latest ? `${latest.spreadGap > 0 ? '+' : ''}${latest.spreadGap.toFixed(2)} bps` : undefined}
        valueColor="#4DA3FF"
        flexWeight="flex-[6]"
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history} margin={{ top: 10, right: 12, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id="spreadFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4DA3FF" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#4DA3FF" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid horizontal vertical={false} stroke="#1F2A3A" strokeDasharray="4 4" opacity={0.5} />
            <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#6F7C8E', fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={{ stroke: '#1F2A3A', strokeWidth: 1 }} interval="preserveEnd" minTickGap={80} />
            <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#A8B3C2', fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} width={40} />
            <ReferenceLine y={0} stroke="#4DA3FF" strokeWidth={1} opacity={0.3} strokeDasharray="3 3" />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#39465A', strokeWidth: 1, strokeDasharray: '4 4' }} />
            <Area type="monotone" dataKey="spreadGap" stroke="#4DA3FF" strokeWidth={2} fill="url(#spreadFill)" dot={false} isAnimationActive={false} name="Spread" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Chart 2: Reaction Latency (Secondary 40%) */}
      <ChartCard
        title="Microstructure Latency"
        tooltipTitle="Reaction Latency"
        tooltipDesc="Time delay in milliseconds between benchmark price changes and TM quote updates."
        subtitle="Quote update delay detected"
        currentValue={latest ? `${latest.lagMs} ms` : undefined}
        valueColor="#FF5C5C"
        flexWeight="flex-[4]"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={history} margin={{ top: 10, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid horizontal vertical={false} stroke="#1F2A3A" strokeDasharray="4 4" opacity={0.5} />
            <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#6F7C8E', fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={{ stroke: '#1F2A3A', strokeWidth: 1 }} interval="preserveEnd" minTickGap={80} />
            <YAxis domain={[0, 'auto']} tick={{ fontSize: 10, fill: '#A8B3C2', fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} width={40} />
            <ReferenceLine y={100} stroke="#F5B942" strokeDasharray="3 3" strokeWidth={1} label={{ value: '100ms', position: 'insideTopRight', fill: '#F5B942', fontSize: 10, fontFamily: 'JetBrains Mono', dy: -10 }} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: '#1F2A3A', opacity: 0.2 }} />
            <Bar dataKey="lagMs" name="Latency" radius={[3, 3, 0, 0]} maxBarSize={12} isAnimationActive={false} fill="#FF5C5C" fillOpacity={0.7} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
