import type { VenueSnapshot } from '../types';
import { formatQty } from '../utils/formatters';

interface DepthComparisonCardProps {
  truemarkets: VenueSnapshot;
  benchmark: VenueSnapshot;
  benchName: string;
}

function DepthBar({ label, tmVal, benchVal }: { label: string; tmVal: number; benchVal: number }) {
  const max = Math.max(tmVal, benchVal, 0.001);
  const tmPct = (tmVal / max) * 100;
  const benchPct = (benchVal / max) * 100;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-[#8EA0B8] font-ui font-semibold">{label}</span>
        <div className="flex gap-3 font-mono text-[10px]">
          <span className="text-[#4DA3FF]">{formatQty(tmVal)}</span>
          <span className="text-[#6F7C8E]">vs</span>
          <span className="text-[#A8B3C2]">{formatQty(benchVal)}</span>
        </div>
      </div>
      <div className="flex gap-1 h-[6px]">
        <div className="flex-1 bg-[#1F2A3A] rounded-full overflow-hidden">
          <div className="h-full bg-[#4DA3FF] rounded-full transition-all duration-500" style={{ width: `${tmPct}%` }} />
        </div>
        <div className="flex-1 bg-[#1F2A3A] rounded-full overflow-hidden">
          <div className="h-full bg-[#6F7C8E] rounded-full transition-all duration-500" style={{ width: `${benchPct}%` }} />
        </div>
      </div>
    </div>
  );
}

export function DepthComparisonCard({ truemarkets, benchmark, benchName }: DepthComparisonCardProps) {
  const tmBidDepth = truemarkets.bids.reduce((s, b) => s + b[1], 0);
  const tmAskDepth = truemarkets.asks.reduce((s, a) => s + a[1], 0);
  const benchBidDepth = benchmark.bids.reduce((s, b) => s + b[1], 0);
  const benchAskDepth = benchmark.asks.reduce((s, a) => s + a[1], 0);

  return (
    <div className="bg-[#0B1220] border border-[#1F2A3A] rounded-lg flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-[#1F2A3A]/50 flex-shrink-0">
        <span className="text-[13px] font-semibold text-[#E5EDF7] font-ui">Top-5 Depth Comparison</span>
        <div className="flex items-center gap-3 text-[10px] font-ui">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#4DA3FF]" />TM</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#6F7C8E]" />{benchName}</span>
        </div>
      </div>

      {/* Depth bars */}
      <div className="flex-1 flex flex-col gap-3 px-4 py-3 justify-center">
        <DepthBar label="Bid Depth" tmVal={tmBidDepth} benchVal={benchBidDepth} />
        <DepthBar label="Ask Depth" tmVal={tmAskDepth} benchVal={benchAskDepth} />
        <DepthBar label="Total Depth" tmVal={tmBidDepth + tmAskDepth} benchVal={benchBidDepth + benchAskDepth} />

        {/* Ratio summary */}
        <div className="flex items-center justify-between pt-2 border-t border-[#1F2A3A]/50 mt-1">
          <span className="text-[10px] text-[#6F7C8E] font-ui">Depth Ratio (TM / Bench)</span>
          {(() => {
            const ratio = (benchBidDepth + benchAskDepth) > 0 
              ? (tmBidDepth + tmAskDepth) / (benchBidDepth + benchAskDepth) 
              : 1;
            const color = ratio >= 0.8 ? 'text-[#18C37E]' : ratio >= 0.5 ? 'text-[#F5B942]' : 'text-[#FF5C5C]';
            return <span className={`text-sm font-mono font-bold ${color}`}>{ratio.toFixed(2)}×</span>;
          })()}
        </div>
      </div>
    </div>
  );
}
