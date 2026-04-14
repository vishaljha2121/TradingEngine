import type { VenueSnapshot } from '../types';
import { computeSlippageAdvantage } from '../utils/metrics';

interface CompetitiveSnapshotCardProps {
  truemarkets: VenueSnapshot;
  benchmark: VenueSnapshot;
  spreadGap: number;
  lagMs: number;
}

function MiniMetric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#1F2A3A]/30 last:border-b-0">
      <span className="text-[11px] text-[#8EA0B8] font-ui font-semibold">{label}</span>
      <span className={`text-[13px] font-mono font-bold ${color}`}>{value}</span>
    </div>
  );
}

export function CompetitiveSnapshotCard({ truemarkets, benchmark, spreadGap, lagMs }: CompetitiveSnapshotCardProps) {
  const slippageAdv = computeSlippageAdvantage(truemarkets, benchmark);
  
  const tmDepth = truemarkets.bid_depth_5 + truemarkets.ask_depth_5;
  const benchDepth = benchmark.bid_depth_5 + benchmark.ask_depth_5;
  const depthRatio = benchDepth > 0 ? tmDepth / benchDepth : 1;

  // Spread competitiveness
  const spreadOk = spreadGap <= 0;
  const spreadLabel = spreadOk ? 'Tighter' : spreadGap > 1 ? 'Much Wider' : 'Wider';
  const spreadColor = spreadOk ? 'text-[#18C37E]' : spreadGap > 1 ? 'text-[#FF5C5C]' : 'text-[#F5B942]';

  // Depth competitiveness
  const depthOk = depthRatio >= 0.8;
  const depthLabel = depthOk ? 'Comparable' : depthRatio >= 0.5 ? 'Thinner' : 'Much Thinner';
  const depthColor = depthOk ? 'text-[#18C37E]' : depthRatio >= 0.5 ? 'text-[#F5B942]' : 'text-[#FF5C5C]';

  // Lag
  const lagOk = lagMs <= 50;
  const lagLabel = lagOk ? 'No Lag' : lagMs <= 100 ? `${lagMs}ms` : `${lagMs}ms (slow)`;
  const lagColor = lagOk ? 'text-[#18C37E]' : lagMs <= 100 ? 'text-[#F5B942]' : 'text-[#FF5C5C]';

  // Slippage
  const slipLabel = slippageAdv >= 0 ? `+${slippageAdv.toFixed(2)} bps saved` : `${slippageAdv.toFixed(2)} bps penalty`;
  const slipColor = slippageAdv >= 0 ? 'text-[#18C37E]' : 'text-[#FF5C5C]';

  return (
    <div className="bg-[#0B1220] border border-[#1F2A3A] rounded-lg flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 border-b border-[#1F2A3A]/50 flex-shrink-0">
        <span className="text-[13px] font-semibold text-[#E5EDF7] font-ui">Competitive Snapshot</span>
      </div>

      {/* Mini metrics */}
      <div className="flex-1 flex flex-col justify-center px-4 py-2">
        <MiniMetric label="Spread" value={spreadLabel} color={spreadColor} />
        <MiniMetric label="Top-of-Book Depth" value={depthLabel} color={depthColor} />
        <MiniMetric label="Reaction Lag" value={lagLabel} color={lagColor} />
        <MiniMetric label="Slippage Estimate" value={slipLabel} color={slipColor} />
      </div>
    </div>
  );
}
