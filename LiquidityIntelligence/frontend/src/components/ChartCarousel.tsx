import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { ChartPoint } from '../types';

interface ChartCarouselProps {
  history: ChartPoint[];
}

const charts = [
  { key: 'spreadGap', label: 'Spread Gap (bps)', color: '#2563EB' },
  { key: 'midGap', label: 'Price Deviation (bps)', color: '#F59E0B' },
  { key: 'lagMs', label: 'Latency (ms)', color: '#EF4444' },
];

export function ChartCarousel({ history }: ChartCarouselProps) {
  return (
    <div className="flex flex-col h-full bg-[#0d1117] overflow-hidden">
      {charts.map((chart, idx) => (
        <div key={chart.key} className={`flex-1 min-h-0 flex flex-col ${idx > 0 ? 'border-t border-[#21262d]' : ''}`}>
          {/* Label */}
          <div className="flex items-center justify-between px-3 py-1 flex-shrink-0">
            <span className="text-[11px] font-bold text-[#8b949e] tracking-wide">{chart.label}</span>
            {history.length > 0 && (
              <span className="text-[11px] font-mono text-white">
                {(history[history.length - 1] as any)[chart.key]?.toFixed(chart.key === 'lagMs' ? 0 : 2)}
              </span>
            )}
          </div>
          {/* Chart */}
          <div className="flex-1 min-h-[60px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 2, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id={`g-${chart.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chart.color} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={chart.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" hide />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 9, fill: '#484f58' }} tickLine={false} axisLine={false} width={38} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#161b22', border: '1px solid #21262d', borderRadius: '6px', fontSize: '11px', padding: '4px 8px' }}
                  itemStyle={{ fontFamily: 'ui-monospace, monospace', color: '#c9d1d9' }}
                  labelStyle={{ color: '#484f58', fontSize: '9px' }}
                />
                <Area
                  type={chart.key === 'lagMs' ? 'stepAfter' : 'monotone'}
                  dataKey={chart.key}
                  stroke={chart.color}
                  strokeWidth={1.5}
                  fill={`url(#g-${chart.key})`}
                  dot={false}
                  name={chart.label}
                  animationDuration={200}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      ))}
    </div>
  );
}
