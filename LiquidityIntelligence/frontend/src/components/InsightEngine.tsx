import React from 'react';
import { Activity } from 'lucide-react';
import type { VenueSnapshot, ChartPoint } from '../types';
import { detectPatterns } from '../utils/metrics';

interface InsightEngineProps {
  truemarkets: VenueSnapshot;
  benchmark: VenueSnapshot;
  spreadGap: number;
  lagMs: number;
  history: ChartPoint[];
}

export function InsightEngine({ truemarkets, benchmark, spreadGap, lagMs, history }: InsightEngineProps) {
  const patterns = detectPatterns(history);

  const insights = [
    {
      label: 'SPREAD',
      ok: spreadGap <= 0,
      text: spreadGap > 0
        ? `TrueMarkets is ${spreadGap.toFixed(2)} bps wider than benchmark — aggressive flow routes away.`
        : `Competitive match. Liquidity effectively replicates benchmark.`,
    },
    {
      label: 'LATENCY',
      ok: lagMs <= 100,
      text: lagMs > 100 ? `${lagMs}ms behind benchmark quote update.` : `Synchronized (${lagMs}ms).`,
    },
  ];

  return (
    <div className="flex items-start gap-px bg-[#21262d] border-t border-[#21262d] flex-shrink-0">
      <div className="flex-1 bg-[#0d1117] px-4 py-2.5">
        <div className="flex items-center gap-2 mb-1.5">
          <Activity className="w-3.5 h-3.5 text-blue-500" />
          <span className="text-[11px] font-bold tracking-wide text-[#8b949e]">INSIGHT ENGINE</span>
        </div>
        <div className="flex flex-col gap-1">
          {insights.map((ins, i) => (
            <div key={i} className="flex items-baseline gap-2 text-xs font-mono">
              <span className="text-[#8b949e] w-16 flex-shrink-0 font-bold">{ins.label}</span>
              <span className={ins.ok ? 'text-emerald-400' : 'text-red-400'}>{ins.text}</span>
            </div>
          ))}
        </div>
      </div>

      {patterns.length > 0 && (
        <div className="w-[320px] bg-[#0d1117] px-4 py-2.5">
          <div className="text-[11px] font-bold tracking-wide text-blue-500 mb-1">PATTERNS</div>
          {patterns.map((p, i) => (
            <div key={i} className="text-xs text-[#c9d1d9] font-mono pl-2 border-l-2 border-blue-500/30 mb-0.5">{p}</div>
          ))}
        </div>
      )}
    </div>
  );
}
