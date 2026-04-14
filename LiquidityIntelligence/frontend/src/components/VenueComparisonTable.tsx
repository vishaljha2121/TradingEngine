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

function InCellBar({ tm, bench, ok }: { tm: number, bench: number, ok: boolean }) {
  const total = tm + bench;
  if (total === 0) return null;
  const tmPct = (tm / total) * 100;
  return (
    <div className="w-[60px] h-[3px] bg-[#1F2A3A] rounded-full overflow-hidden flex ml-auto">
      <div className={`h-full ${ok ? 'bg-[#18C37E]' : 'bg-[#F5B942]'}`} style={{ width: `${tmPct}%` }} />
    </div>
  );
}

export function VenueComparisonTable({ truemarkets, benchmark, lagMs, benchName }: VenueComparisonTableProps) {
  const tmEff = getEffectiveSpread(truemarkets).spreadBps;
  const benchEff = getEffectiveSpread(benchmark).spreadBps;
  const slipAdv = computeSlippageAdvantage(truemarkets, benchmark);
  const spreadGap = truemarkets.spread_bps - benchmark.spread_bps;

  const tmBidDepth = truemarkets.bids.reduce((s, b) => s + b[1], 0);
  const tmAskDepth = truemarkets.asks.reduce((s, a) => s + a[1], 0);
  const benchBidDepth = benchmark.bids.reduce((s, b) => s + b[1], 0);
  const benchAskDepth = benchmark.asks.reduce((s, a) => s + a[1], 0);

  const totalRatio = (benchBidDepth + benchAskDepth) > 0
    ? (tmBidDepth + tmAskDepth) / (benchBidDepth + benchAskDepth)
    : 1;

  const rows = [
    {
      metric: 'Slippage Impact',
      tooltip: { title: 'Slippage Advantage', description: 'Execution cost difference.' },
      tm: `${slipAdv >= 0 ? '+' : ''}${slipAdv.toFixed(2)} bps`,
      bench: 'baseline',
      delta: `${slipAdv >= 0 ? '+' : ''}${slipAdv.toFixed(2)} bps`,
      ok: slipAdv >= 0,
      verdict: slipAdv >= 0 ? 'Favorable' : 'Penalty',
      bar: null,
      urgent: true
    },
    {
      metric: 'Bid-Ask Spread',
      tooltip: { title: 'Top-of-Book Spread', description: 'Spread at the best price level.' },
      tm: `${truemarkets.spread_bps.toFixed(2)} bps`,
      bench: `${benchmark.spread_bps.toFixed(2)} bps`,
      delta: `${spreadGap > 0 ? '+' : ''}${spreadGap.toFixed(2)} bps`,
      ok: spreadGap <= 0,
      verdict: spreadGap <= 0 ? 'Tighter' : 'Wider',
      bar: null,
      urgent: true
    },
    {
      metric: 'Reaction Latency',
      tooltip: { title: 'Reaction Latency', description: 'Delay between benchmark move and TM update.' },
      tm: `${lagMs} ms`,
      bench: '0 ms',
      delta: `+${lagMs} ms`,
      ok: lagMs <= 100,
      verdict: lagMs <= 50 ? 'Nominal' : lagMs <= 100 ? 'Caution' : 'Severe Lag',
      bar: null,
      urgent: false
    },
    {
      metric: 'Bid Depth (L1-5)',
      tooltip: { title: 'Bid-Side Depth', description: 'Total volume across top 5 bid levels.' },
      tm: formatQty(tmBidDepth),
      bench: formatQty(benchBidDepth),
      delta: `${((tmBidDepth/benchBidDepth)*100).toFixed(0)}%`,
      ok: tmBidDepth >= benchBidDepth * 0.8,
      verdict: tmBidDepth >= benchBidDepth * 0.8 ? 'Solid' : 'Thin',
      bar: <InCellBar tm={tmBidDepth} bench={benchBidDepth} ok={tmBidDepth >= benchBidDepth * 0.8} />,
      urgent: false
    },
    {
      metric: 'Ask Depth (L1-5)',
      tooltip: { title: 'Ask-Side Depth', description: 'Total volume across top 5 ask levels.' },
      tm: formatQty(tmAskDepth),
      bench: formatQty(benchAskDepth),
      delta: `${((tmAskDepth/benchAskDepth)*100).toFixed(0)}%`,
      ok: tmAskDepth >= benchAskDepth * 0.8,
      verdict: tmAskDepth >= benchAskDepth * 0.8 ? 'Solid' : 'Thin',
      bar: <InCellBar tm={tmAskDepth} bench={benchAskDepth} ok={tmAskDepth >= benchAskDepth * 0.8} />,
      urgent: false
    }
  ];

  const ratioColor = totalRatio >= 0.8 ? 'text-[#18C37E]' : totalRatio >= 0.5 ? 'text-[#F5B942]' : 'text-[#FF5C5C]';

  return (
    <div className="bg-[#0B1220] border border-[#1F2A3A]/70 rounded-xl flex flex-col overflow-hidden h-full shadow-sm">
      <div className="px-5 py-3 border-b border-[#1F2A3A]/40 flex items-center justify-between flex-shrink-0 bg-[#0E1728]/20">
        <span className="text-[14px] font-bold tracking-widest text-[#E5EDF7] font-ui uppercase">Core Analytics Engine</span>
        <div className="flex gap-4">
           <div className="flex items-center gap-1.5 bg-[#0B1220] px-2 py-0.5 rounded border border-[#1F2A3A]/50 shadow-inner">
             <span className="text-[10px] text-[#6F7C8E] uppercase tracking-wider font-ui font-semibold">Total Depth Ratio</span>
             <span className={`font-mono font-bold text-[12px] ${ratioColor}`}>{totalRatio.toFixed(2)}×</span>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-[1.5fr_1fr_1fr_0.8fr_0.8fr] px-5 py-2 text-[10px] uppercase tracking-widest font-bold text-[#6F7C8E] font-ui border-b border-[#1F2A3A]/30 flex-shrink-0 bg-[#0A101C]">
        <div>Insight Metric</div>
        <div className="text-right">True Markets</div>
        <div className="text-right uppercase">{benchName}</div>
        <div className="text-right text-[#8EA0B8]">Delta</div>
        <div className="text-right">Verdict</div>
      </div>

      <div className="flex-1 flex flex-col py-1 overflow-auto">
        {rows.map((row, i) => (
          <div
            key={i}
            className={`grid grid-cols-[1.5fr_1fr_1fr_0.8fr_0.8fr] px-5 py-2.5 text-[13px] items-center font-mono border-b border-[#1F2A3A]/10 last:border-b-0 group transition-colors ${row.urgent ? 'bg-[#0E1728]/10 hover:bg-[#0E1728]/30' : 'hover:bg-[#0E1728]/30'}`}
          >
            <div className="font-ui font-bold text-[#8EA0B8] text-[11px] uppercase tracking-wide group-hover:text-[#A8B3C2]">
              <InfoTooltip title={row.tooltip.title} description={row.tooltip.description}>
                {row.metric}
              </InfoTooltip>
            </div>
            
            <div className="flex flex-col items-end">
              <span className={`text-right ${row.urgent ? 'text-[#E5EDF7] font-bold' : 'text-[#A8B3C2]'}`}>{row.tm}</span>
              {row.bar}
            </div>
            
            <div className="text-right text-[#6F7C8E]">{row.bench}</div>
            
            <div className={`text-right font-bold ${row.ok ? 'text-[#18C37E]/80' : 'text-[#FF5C5C]/80'}`}>
              {row.delta}
            </div>

            <div className="text-right flex items-center justify-end gap-1.5">
              <span className={`text-[11px] font-black font-ui uppercase tracking-widest ${row.ok ? 'text-[#18C37E]' : 'text-[#FF5C5C]'}`}>
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
