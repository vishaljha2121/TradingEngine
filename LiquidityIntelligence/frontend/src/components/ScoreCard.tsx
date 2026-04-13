import React from 'react';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';
import { formatQty } from '../utils/formatters';
import type { ChartPoint } from '../types';

interface ScoreCardProps {
  flowRisk: { level: string; colorClass: string; description: string };
  lagMs: number;
  avgLag: number;
  depthRatio: number;
  tmDepth: number;
  benchDepth: number;
  benchName: string;
  lastLagEventMs: number;
  lagEventsCount: number;
  history: ChartPoint[];
}

export function ScoreCards({ 
  flowRisk, lagMs, avgLag, depthRatio, tmDepth, benchDepth, benchName,
  lastLagEventMs, lagEventsCount, history
}: ScoreCardProps) {
  const riskColor = flowRisk.level === 'LOW' ? 'text-emerald-400' : flowRisk.level === 'MEDIUM' ? 'text-yellow-400' : 'text-red-400';
  const depthColor = depthRatio >= 0.8 ? 'text-emerald-400' : depthRatio >= 0.5 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="flex flex-col lg:flex-row items-stretch gap-px bg-[#21262d] border-t border-[#21262d] flex-shrink-0">
      {/* Flow Risk */}
      <div className="flex-1 bg-[#0d1117] px-4 py-2.5 flex items-center gap-3 border-b lg:border-b-0 lg:border-r border-[#21262d]">
        <span className="text-[11px] text-[#8b949e] font-bold tracking-wide">FLOW RISK</span>
        <span className={`text-base font-mono font-bold ${riskColor}`}>{flowRisk.level}</span>
        <span className="text-[11px] text-[#8b949e] hidden xl:inline">{flowRisk.description}</span>
      </div>

      {/* Lag Indicator / Reaction Time */}
      <div className="flex-[2] bg-[#0d1117] px-4 py-2 flex items-center gap-4 lg:border-r border-[#21262d]">
        <div className="flex items-center gap-3 min-w-max">
          <span className="text-[11px] text-[#8b949e] font-bold tracking-wide">REACTION TIME</span>
          <span className={`text-base font-mono font-bold ${lagMs > 100 ? 'text-red-400' : 'text-white'}`}>{lagMs}ms</span>
        </div>
        
        {/* Lag Stats */}
        <div className="flex gap-4 text-[10px] items-center border-l border-[#30363d] pl-4">
          <div className="flex flex-col">
            <span className="text-[#8b949e]">Last Spike</span>
            <span className={`font-mono font-bold ${lastLagEventMs > 0 ? 'text-red-400' : 'text-white'}`}>{lastLagEventMs > 0 ? `${lastLagEventMs}ms` : '--'}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[#8b949e]">Avg Lag</span>
            <span className="text-white font-mono font-bold">{avgLag}ms</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[#8b949e]">Spikes (1m)</span>
            <span className={`font-mono font-bold ${lagEventsCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{lagEventsCount}</span>
          </div>
        </div>

        {/* Mini Sparkline Chart */}
        <div className="flex-1 h-8 ml-auto min-w-[80px]">
          <ResponsiveContainer width="100%" height="100%" minHeight={32}>
            <AreaChart data={history}>
              <YAxis domain={[0, 'dataMax']} hide />
              <Area 
                type="stepAfter" 
                dataKey="lagMs" 
                stroke={lagMs > 100 ? '#EF4444' : '#2563EB'} 
                fill={lagMs > 100 ? '#EF444433' : '#2563EB33'} 
                strokeWidth={1.5} 
                isAnimationActive={false} 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Depth Ratio */}
      <div className="flex-1 bg-[#0d1117] px-4 py-2.5 flex items-center gap-3">
        <span className="text-[11px] text-[#8b949e] font-bold tracking-wide">DEPTH</span>
        <span className={`text-base font-mono font-bold ${depthColor}`}>{(depthRatio * 100).toFixed(0)}%</span>
        <div className="flex-1 max-w-[120px] bg-[#21262d] h-2 rounded-full overflow-hidden">
          <div className="bg-blue-500 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, depthRatio * 100)}%` }} />
        </div>
        <span className="text-[11px] text-[#8b949e] font-mono hidden 2xl:inline">
          {formatQty(tmDepth)} / {formatQty(benchDepth)}
        </span>
      </div>
    </div>
  );
}
