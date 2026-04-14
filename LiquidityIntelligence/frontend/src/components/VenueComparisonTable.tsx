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
      metric: 'Bid-Ask Spread',
      tooltip: { title: 'Top-of-Book Spread', description: 'Bid-ask spread at the best price level, in basis points.', formula: '(bestAsk − bestBid) / mid × 10,000' },
      tm: `${truemarkets.spread_bps.toFixed(2)} bps`,
      bench: `${benchmark.spread_bps.toFixed(2)} bps`,
      ok: truemarkets.spread_bps <= benchmark.spread_bps,
      verdict: truemarkets.spread_bps <= benchmark.spread_bps ? 'Tighter' : 'Wider',
      highlight: true
    },
    {
      metric: 'Slippage Impact',
      tooltip: { title: 'Slippage Advantage', description: 'Estimated slippage cost difference for an order sized at benchmark Level-1 depth.', formula: 'benchSlippage − tmSlippage' },
      tm: `${slipAdv >= 0 ? '+' : ''}${slipAdv.toFixed(2)} bps`,
      bench: 'baseline',
      ok: slipAdv >= 0,
      verdict: slipAdv >= 0 ? 'Better' : 'Worse',
      highlight: true
    },
    {
      metric: 'Reaction Latency',
      tooltip: { title: 'Reaction Latency', description: 'Delay between a benchmark price move and TM quote update.' },
      tm: `${lagMs}ms`,
      bench: '—',
      ok: lagMs <= 100,
      verdict: lagMs <= 50 ? 'OK' : lagMs <= 100 ? 'Minor' : 'Slow',
      highlight: false
    },
    {
      metric: 'Effective Spread',
      tooltip: { title: 'Effective Spread', description: 'Depth-adjusted spread using VWAP across all visible book levels. More realistic than top-of-book spread.', formula: '(askVWAP − bidVWAP) / mid × 10,000' },
      tm: `${tmEff.toFixed(2)} bps`,
      bench: `${benchEff.toFixed(2)} bps`,
      ok: tmEff <= benchEff,
      verdict: tmEff <= benchEff ? 'Tighter' : 'Wider',
      highlight: false
    },
    {
      metric: 'Bid Side Depth',
      tooltip: { title: 'Bid-Side Depth', description: 'Total volume across the top 5 bid price levels.' },
      tm: formatQty(tmBidDepth),
      bench: formatQty(benchBidDepth),
      ok: tmBidDepth >= benchBidDepth * 0.8,
      verdict: tmBidDepth >= benchBidDepth * 0.8 ? 'OK' : 'Less',
      highlight: false
    },
    {
      metric: 'Ask Side Depth',
      tooltip: { title: 'Ask-Side Depth', description: 'Total volume across the top 5 ask price levels.' },
      tm: formatQty(tmAskDepth),
      bench: formatQty(benchAskDepth),
      ok: tmAskDepth >= benchAskDepth * 0.8,
      verdict: tmAskDepth >= benchAskDepth * 0.8 ? 'OK' : 'Less',
      highlight: false
    }
  ];

  const ratioColor = totalRatio >= 0.8 ? 'text-[#18C37E]' : totalRatio >= 0.5 ? 'text-[#F5B942]' : 'text-[#FF5C5C]';

  return (
    <div className="bg-[#0B1220] border border-[#1F2A3A]/70 rounded-xl flex flex-col overflow-hidden h-full shadow-sm">
      {/* Header */}
      <div className="px-5 py-3 border-b border-[#1F2A3A]/40 flex items-center justify-between bg-[#0E1728]/50 flex-shrink-0">
        <span className="text-[14px] font-bold tracking-tight text-[#E5EDF7] font-ui uppercase">Venue Comparison</span>
        <div className="flex gap-4">
           {/* Summary metric */}
           <div className="flex items-center gap-1.5 bg-[#0B1220] px-2 py-0.5 rounded border border-[#1F2A3A]/50">
             <span className="text-[10px] text-[#6F7C8E] uppercase tracking-wide font-ui">Venue Depth Ratio</span>
             <span className={`font-mono font-bold text-[12px] ${ratioColor}`}>{totalRatio.toFixed(2)}×</span>
           </div>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1.5fr_1fr_1fr_80px] px-5 py-2 text-[10px] uppercase tracking-widest font-bold text-[#6F7C8E] font-ui border-b border-[#1F2A3A]/30 flex-shrink-0">
        <div>Insight Metric</div>
        <div className="text-right">True Markets</div>
        <div className="text-right">{benchName}</div>
        <div className="text-right">Verdict</div>
      </div>

      {/* Rows */}
      <div className="flex-1 flex flex-col py-1">
        {rows.map((row, i) => (
          <div
            key={i}
            className={`grid grid-cols-[1.5fr_1fr_1fr_80px] px-5 py-2 text-[13px] items-center font-mono border-b border-[#1F2A3A]/10 last:border-b-0 hover:bg-[#0E1728]/40 transition-colors ${row.highlight ? 'bg-[#0E1728]/20' : ''}`}
          >
            <div className="font-ui font-semibold text-[#8EA0B8] text-[12px]">
              <InfoTooltip title={row.tooltip.title} description={row.tooltip.description} formula={row.tooltip.formula}>
                {row.metric}
              </InfoTooltip>
            </div>
            <div className={`text-right ${row.highlight ? 'text-[#E5EDF7] font-bold' : 'text-[#A8B3C2]'}`}>{row.tm}</div>
            <div className="text-right text-[#6F7C8E]">{row.bench}</div>
            <div className="text-right flex items-center justify-end gap-1.5">
              <span className={`text-[12px] font-bold font-ui uppercase tracking-wide ${row.ok ? 'text-[#18C37E]' : 'text-[#FF5C5C]'}`}>
                {row.verdict}
              </span>
              <Arrow ok={row.ok} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
