import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import type { ChartPoint } from '../types';

interface LagTimelineCardProps {
  history: ChartPoint[];
  lagMs: number;
}

export function LagTimelineCard({ history, lagMs }: LagTimelineCardProps) {
  const lagEvents = history.filter(p => p.lagMs > 100);
  const avgLag = history.length > 0 ? Math.round(history.reduce((a, b) => a + b.lagMs, 0) / history.length) : 0;
  const maxLag = history.length > 0 ? Math.max(...history.map(p => p.lagMs)) : 0;

  return (
    <div className="bg-[#0B1220] border border-[#1F2A3A] rounded-lg flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-[#1F2A3A]/50 flex-shrink-0">
        <span className="text-[13px] font-semibold text-[#E5EDF7] font-ui">Lag Events</span>
        <span className={`text-xs font-mono font-bold ${lagMs > 100 ? 'text-[#FF5C5C]' : 'text-[#18C37E]'}`}>
          {lagMs}ms
        </span>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 px-4 py-2 text-[10px] border-b border-[#1F2A3A]/30 flex-shrink-0">
        <div className="flex flex-col">
          <span className="text-[#6F7C8E] font-ui">Avg Lag</span>
          <span className="font-mono font-bold text-[#A8B3C2]">{avgLag}ms</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[#6F7C8E] font-ui">Max Lag</span>
          <span className={`font-mono font-bold ${maxLag > 200 ? 'text-[#FF5C5C]' : 'text-[#A8B3C2]'}`}>{maxLag}ms</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[#6F7C8E] font-ui">Events (&gt;100ms)</span>
          <span className={`font-mono font-bold ${lagEvents.length > 0 ? 'text-[#F5B942]' : 'text-[#18C37E]'}`}>{lagEvents.length}</span>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-[60px] px-2 pb-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={history} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid horizontal vertical={false} stroke="#1F2A3A" strokeDasharray="3 3" />
            <XAxis dataKey="time" hide />
            <YAxis domain={[0, 'auto']} tick={{ fontSize: 9, fill: '#6F7C8E', fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} width={32} />
            <ReferenceLine y={100} stroke="#39465A" strokeDasharray="4 4" label={{ value: '100ms', position: 'right', fill: '#6F7C8E', fontSize: 9 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#111827', border: '1px solid #334155', borderRadius: '6px', fontSize: '11px' }}
              itemStyle={{ color: '#E5EDF7', fontFamily: 'JetBrains Mono' }}
              labelStyle={{ color: '#6F7C8E', fontSize: '9px' }}
            />
            <Bar
              dataKey="lagMs"
              name="Lag"
              radius={[2, 2, 0, 0]}
              maxBarSize={8}
              isAnimationActive={false}
              fill="#FF5C5C"
              fillOpacity={0.6}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
