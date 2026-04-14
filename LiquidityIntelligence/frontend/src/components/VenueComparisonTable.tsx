import type { VenueSnapshot } from '../types';
import { getEffectiveSpread, computeSlippageAdvantage } from '../utils/metrics';
import { formatQty } from '../utils/formatters';
import { InfoTooltip } from './InfoTooltip';

interface VenueComparisonTableProps {
  truemarkets: VenueSnapshot;
  benchmark: VenueSnapshot;
  lagMs: number;
  benchName: string;
}

function Arrow({ ok }: { ok: boolean }) {
  return ok
    ? <span className="text-[#18C37E]">▲</span>
    : <span className="text-[#FF5C5C]">▼</span>;
}

export function VenueComparisonTable({ truemarkets, benchmark, lagMs, benchName }: VenueComparisonTableProps) {
  const tmEff = getEffectiveSpread(truemarkets).spreadBps;
  const benchEff = getEffectiveSpread(benchmark).spreadBps;
  const slipAdv = computeSlippageAdvantage(truemarkets, benchmark);

  const tmBidDepth = truemarkets.bids.reduce((s, b) => s + b[1], 0);
  const tmAskDepth = truemarkets.asks.reduce((s, a) => s + a[1], 0);
  const benchBidDepth = benchmark.bids.reduce((s, b) => s + b[1], 0);
  const benchAskDepth = benchmark.asks.reduce((s, a) => s + a[1], 0);
  const totalRatio = (benchBidDepth + benchAskDepth) > 0
    ? (tmBidDepth + tmAskDepth) / (benchBidDepth + benchAskDepth)
    : 1;

  const rows = [
    {
      metric: 'Spread',
      tooltip: { title: 'Top-of-Book Spread', description: 'Bid-ask spread at the best price level, in basis points.', formula: '(bestAsk − bestBid) / mid × 10,000' },
      tm: `${truemarkets.spread_bps.toFixed(2)} bps`,
      bench: `${benchmark.spread_bps.toFixed(2)} bps`,
      ok: truemarkets.spread_bps <= benchmark.spread_bps,
      verdict: truemarkets.spread_bps <= benchmark.spread_bps ? 'Tighter' : 'Wider',
    },
    {
      metric: 'Eff. Spread',
      tooltip: { title: 'Effective Spread', description: 'Depth-adjusted spread using VWAP across all visible book levels. More realistic than top-of-book spread.', formula: '(askVWAP − bidVWAP) / mid × 10,000' },
      tm: `${tmEff.toFixed(2)} bps`,
      bench: `${benchEff.toFixed(2)} bps`,
      ok: tmEff <= benchEff,
      verdict: tmEff <= benchEff ? 'Tighter' : 'Wider',
    },
    {
      metric: 'Bid Depth',
      tooltip: { title: 'Bid-Side Depth', description: 'Total volume across the top 5 bid price levels.' },
      tm: formatQty(tmBidDepth),
      bench: formatQty(benchBidDepth),
      ok: tmBidDepth >= benchBidDepth * 0.8,
      verdict: tmBidDepth >= benchBidDepth * 0.8 ? 'OK' : 'Less',
    },
    {
      metric: 'Ask Depth',
      tooltip: { title: 'Ask-Side Depth', description: 'Total volume across the top 5 ask price levels.' },
      tm: formatQty(tmAskDepth),
      bench: formatQty(benchAskDepth),
      ok: tmAskDepth >= benchAskDepth * 0.8,
      verdict: tmAskDepth >= benchAskDepth * 0.8 ? 'OK' : 'Less',
    },
    {
      metric: 'Latency',
      tooltip: { title: 'Reaction Latency', description: 'Delay between a benchmark price move and TM quote update.' },
      tm: `${lagMs}ms`,
      bench: '—',
      ok: lagMs <= 100,
      verdict: lagMs <= 50 ? 'OK' : lagMs <= 100 ? 'Minor' : 'Slow',
    },
    {
      metric: 'Slippage',
      tooltip: { title: 'Slippage Advantage', description: 'Estimated slippage cost difference for an order sized at benchmark Level-1 depth.', formula: 'benchSlippage − tmSlippage' },
      tm: `${slipAdv >= 0 ? '+' : ''}${slipAdv.toFixed(2)} bps`,
      bench: 'baseline',
      ok: slipAdv >= 0,
      verdict: slipAdv >= 0 ? 'Better' : 'Worse',
    },
  ];

  const ratioColor = totalRatio >= 0.8 ? 'text-[#18C37E]' : totalRatio >= 0.5 ? 'text-[#F5B942]' : 'text-[#FF5C5C]';

  return (
    <div className="bg-[#0B1220] border border-[#1F2A3A] rounded-lg flex flex-col overflow-hidden h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[#1F2A3A] flex-shrink-0">
        <span className="text-[13px] font-semibold text-[#E5EDF7] font-ui">Venue Comparison</span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_1fr_1fr_70px] px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-[#6F7C8E] font-ui border-b border-[#1F2A3A]/50 flex-shrink-0">
        <div>Metric</div>
        <div className="text-right">True Markets</div>
        <div className="text-right">{benchName}</div>
        <div className="text-right">Verdict</div>
      </div>

      {/* Rows */}
      <div className="flex-1 flex flex-col overflow-auto">
        {rows.map((row, i) => (
          <div
            key={i}
            className={`grid grid-cols-[1fr_1fr_1fr_70px] px-3 py-1.5 text-[12px] items-center font-mono border-b border-[#1F2A3A]/20 last:border-b-0 ${i % 2 === 0 ? 'bg-[#0B1220]' : 'bg-[#0E1728]'}`}
          >
            <div className="font-ui font-semibold text-[#8EA0B8] text-[11px]">
              <InfoTooltip title={row.tooltip.title} description={row.tooltip.description} formula={row.tooltip.formula}>
                {row.metric}
              </InfoTooltip>
            </div>
            <div className="text-right text-[#E5EDF7]">{row.tm}</div>
            <div className="text-right text-[#A8B3C2]">{row.bench}</div>
            <div className="text-right flex items-center justify-end gap-1">
              <Arrow ok={row.ok} />
              <span className={`text-[11px] font-semibold font-ui ${row.ok ? 'text-[#18C37E]' : 'text-[#FF5C5C]'}`}>
                {row.verdict}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer: depth ratio */}
      <div className="px-3 py-1.5 border-t border-[#1F2A3A] flex items-center justify-between text-[10px] flex-shrink-0">
        <span className="text-[#6F7C8E] font-ui">Overall Depth Ratio</span>
        <span className={`font-mono font-bold text-[12px] ${ratioColor}`}>{totalRatio.toFixed(2)}×</span>
      </div>
    </div>
  );
}
