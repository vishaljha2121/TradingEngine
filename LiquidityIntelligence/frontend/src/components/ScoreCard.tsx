import React from 'react';
import { formatQty } from '../utils/formatters';

interface ScoreCardProps {
  flowRisk: { level: string; colorClass: string; description: string };
  lagMs: number;
  avgLag: number;
  depthRatio: number;
  tmDepth: number;
  benchDepth: number;
  benchName: string;
}

export function ScoreCards({ flowRisk, lagMs, avgLag, depthRatio, tmDepth, benchDepth, benchName }: ScoreCardProps) {
  const riskColor = flowRisk.level === 'LOW' ? 'text-emerald-400' : flowRisk.level === 'MEDIUM' ? 'text-yellow-400' : 'text-red-400';
  const depthColor = depthRatio >= 0.8 ? 'text-emerald-400' : depthRatio >= 0.5 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="flex items-stretch gap-px bg-[#21262d] border-t border-[#21262d] flex-shrink-0">
      {/* Flow Risk */}
      <div className="flex-1 bg-[#0d1117] px-4 py-2.5 flex items-center gap-3">
        <span className="text-[11px] text-[#8b949e] font-bold tracking-wide">FLOW RISK</span>
        <span className={`text-base font-mono font-bold ${riskColor}`}>{flowRisk.level}</span>
        <span className="text-[11px] text-[#8b949e] hidden lg:inline">{flowRisk.description}</span>
      </div>

      {/* Latency */}
      <div className="flex-1 bg-[#0d1117] px-4 py-2.5 flex items-center gap-3">
        <span className="text-[11px] text-[#8b949e] font-bold tracking-wide">LATENCY</span>
        <span className={`text-base font-mono font-bold ${lagMs > 100 ? 'text-red-400' : 'text-white'}`}>{lagMs}ms</span>
        <span className="text-[11px] text-[#8b949e]">avg {avgLag}ms</span>
      </div>

      {/* Depth Ratio */}
      <div className="flex-1 bg-[#0d1117] px-4 py-2.5 flex items-center gap-3">
        <span className="text-[11px] text-[#8b949e] font-bold tracking-wide">DEPTH</span>
        <span className={`text-base font-mono font-bold ${depthColor}`}>{(depthRatio * 100).toFixed(0)}%</span>
        <div className="flex-1 max-w-[120px] bg-[#21262d] h-2 rounded-full overflow-hidden">
          <div className="bg-blue-500 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, depthRatio * 100)}%` }} />
        </div>
        <span className="text-[11px] text-[#8b949e] font-mono hidden xl:inline">
          {formatQty(tmDepth)} / {formatQty(benchDepth)}
        </span>
      </div>
    </div>
  );
}
