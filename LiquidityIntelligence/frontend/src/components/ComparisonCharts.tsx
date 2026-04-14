import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts';
import type { ChartPoint } from '../types';

interface ComparisonChartsProps {
  history: ChartPoint[];
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#111827] border border-[#334155] rounded-md px-3 py-2 text-xs">
      <div className="text-[#6F7C8E] font-mono mb-1">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-[#E5EDF7] font-mono font-semibold">{p.value?.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

export function ComparisonCharts({ history }: ComparisonChartsProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Chart A: Spread Gap */}
      <div className="flex-1 flex flex-col min-h-0 border-b border-[#1F2A3A]">
        <div className="px-4 pt-3 pb-1 flex items-center justify-between flex-shrink-0">
          <span className="text-[13px] font-semibold text-[#E5EDF7] font-ui">Spread Gap (bps)</span>
          {history.length > 0 && (
            <span className="text-xs font-mono text-[#4DA3FF] font-semibold">
              {history[history.length - 1].spreadGap > 0 ? '+' : ''}{history[history.length - 1].spreadGap.toFixed(2)}
            </span>
          )}
        </div>
        <div className="flex-1 min-h-[80px] px-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id="spreadFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4DA3FF" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#4DA3FF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid horizontal vertical={false} stroke="#1F2A3A" strokeDasharray="3 3" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#6F7C8E', fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} interval="preserveEnd" minTickGap={60} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#6F7C8E', fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} width={40} />
              <ReferenceLine y={0} stroke="#39465A" strokeWidth={1.5} strokeDasharray="4 4" />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="spreadGap" stroke="#4DA3FF" strokeWidth={1.5} fill="url(#spreadFill)" dot={false} animationDuration={150} name="Spread Gap" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart B: Mid Deviation */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-4 pt-3 pb-1 flex items-center justify-between flex-shrink-0">
          <span className="text-[13px] font-semibold text-[#E5EDF7] font-ui">Mid Deviation (bps)</span>
          {history.length > 0 && (
            <span className="text-xs font-mono text-[#F5B942] font-semibold">
              {history[history.length - 1].midGap.toFixed(2)}
            </span>
          )}
        </div>
        <div className="flex-1 min-h-[80px] px-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id="midFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F5B942" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#F5B942" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid horizontal vertical={false} stroke="#1F2A3A" strokeDasharray="3 3" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#6F7C8E', fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} interval="preserveEnd" minTickGap={60} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#6F7C8E', fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} width={40} />
              <ReferenceLine y={0} stroke="#39465A" strokeWidth={1.5} strokeDasharray="4 4" />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="midGap" stroke="#F5B942" strokeWidth={1.5} fill="url(#midFill)" dot={false} animationDuration={150} name="Mid Deviation" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
