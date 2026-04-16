import type { VenueSnapshot } from '../types';
import { computeSlippageAdvantage } from '../utils/metrics';
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
    ? <span className="ml-2 text-[10px] text-positive">▲</span>
    : <span className="ml-2 text-[10px] text-negative">▼</span>;
}

function ratioPct(numerator: number, denominator: number): string {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return '--';
  return `${((numerator / denominator) * 100).toFixed(0)}%`;
}

function RatioBar({ ratio, ok }: { ratio: number, ok: boolean }) {
  if (!Number.isFinite(ratio)) return null;
  const width = Math.max(4, Math.min(100, ratio * 100));
  return (
    <div className="mt-1.5 h-[4px] w-full overflow-hidden rounded-full bg-divider/70">
      <div className={`h-full ${ok ? 'bg-positive' : 'bg-warning'}`} style={{ width: `${width}%` }} />
    </div>
  );
}

export function VenueComparisonTable({ truemarkets, benchmark, lagMs, benchName }: VenueComparisonTableProps) {
  const slipAdv = computeSlippageAdvantage(truemarkets, benchmark);
  const spreadGap = truemarkets.spread_bps - benchmark.spread_bps;

  const tmBidDepth = truemarkets.bids.reduce((s, b) => s + b[1], 0);
  const tmAskDepth = truemarkets.asks.reduce((s, a) => s + a[1], 0);
  const benchBidDepth = benchmark.bids.reduce((s, b) => s + b[1], 0);
  const benchAskDepth = benchmark.asks.reduce((s, a) => s + a[1], 0);

  const totalRatio = (benchBidDepth + benchAskDepth) > 0
    ? (tmBidDepth + tmAskDepth) / (benchBidDepth + benchAskDepth)
    : 1;
  const bidRatio = benchBidDepth > 0 ? tmBidDepth / benchBidDepth : Number.NaN;
  const askRatio = benchAskDepth > 0 ? tmAskDepth / benchAskDepth : Number.NaN;
  const bidOk = Number.isFinite(bidRatio) && bidRatio >= 0.8;
  const askOk = Number.isFinite(askRatio) && askRatio >= 0.8;

  const rows = [
    {
      metric: 'Slippage Advantage',
      tooltip: { title: 'Net Execution Cost', description: 'Execution premium or penalty against the benchmark volume.' },
      tm: `${Math.abs(slipAdv).toFixed(2)} bps`,
      bench: 'VWAP baseline',
      comparison: slipAdv >= 0 ? 'Savings' : 'Penalty',
      ok: slipAdv >= 0,
      verdict: slipAdv >= 0 ? 'Healthy' : 'Penalty',
      bar: null,
      urgent: true
    },
    {
      metric: 'Top-of-Book Spread',
      tooltip: { title: 'L1 Spread Delta', description: 'Spread delta at the absolute best price level.' },
      tm: `${truemarkets.spread_bps.toFixed(2)} bps`,
      bench: `${benchmark.spread_bps.toFixed(2)} bps`,
      comparison: `${spreadGap > 0 ? '+' : ''}${spreadGap.toFixed(2)} bps`,
      ok: spreadGap <= 0,
      verdict: spreadGap <= 0 ? 'Healthy' : 'Wider',
      bar: null,
      urgent: true
    },
    {
      metric: 'Quotation Latency',
      tooltip: { title: 'Update Latency Profile', description: 'Reaction delay between benchmark move and TM update.' },
      tm: `${lagMs} ms`,
      bench: '0 ms',
      comparison: `+${lagMs} ms`,
      ok: lagMs <= 100,
      verdict: lagMs <= 50 ? 'Nominal' : lagMs <= 100 ? 'Wider' : 'Penalty',
      bar: null,
      urgent: false
    },
    {
      metric: 'Aggregate Bid Depth',
      tooltip: { title: 'Bid-Side Liquidity', description: 'Total liquidity density across top 5 bid levels.' },
      tm: formatQty(tmBidDepth),
      bench: formatQty(benchBidDepth),
      comparison: ratioPct(tmBidDepth, benchBidDepth),
      ok: bidOk,
      verdict: bidOk ? 'Healthy' : 'Thin',
      bar: <RatioBar ratio={bidRatio} ok={bidOk} />,
      urgent: false
    },
    {
      metric: 'Aggregate Ask Depth',
      tooltip: { title: 'Ask-Side Liquidity', description: 'Total liquidity density across top 5 ask levels.' },
      tm: formatQty(tmAskDepth),
      bench: formatQty(benchAskDepth),
      comparison: ratioPct(tmAskDepth, benchAskDepth),
      ok: askOk,
      verdict: askOk ? 'Healthy' : 'Thin',
      bar: <RatioBar ratio={askRatio} ok={askOk} />,
      urgent: false
    }
  ];

  const ratioColor = totalRatio >= 0.8 ? 'text-positive' : totalRatio >= 0.5 ? 'text-warning' : 'text-negative';

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <div className="flex flex-shrink-0 items-center justify-between border-b border-divider bg-panel-secondary/50 px-4 py-3">
        <span className="font-ui text-[12px] font-semibold uppercase tracking-wide text-txt-primary">Liquidity Profile Engine</span>
        <div className="flex items-baseline gap-2">
           <span className="font-ui text-[11px] font-medium uppercase tracking-wide text-txt-muted">Depth Ratio</span>
           <span className={`font-mono text-[14px] font-bold tabular-nums ${ratioColor}`}>{totalRatio.toFixed(2)}×</span>
        </div>
      </div>

      <div className="grid grid-cols-[1.35fr_0.9fr_0.9fr_0.9fr] border-b border-divider/50 bg-panel-secondary/30 px-4 py-2 font-ui text-[11px] font-semibold uppercase tracking-wide text-txt-muted">
        <div className="text-left">Metric</div>
        <div className="text-right">True Markets</div>
        <div className="text-right uppercase">{benchName}</div>
        <div className="text-right">Verdict</div>
      </div>

      <div className="flex-1 flex flex-col overflow-auto">
        {rows.map((row, i) => (
          <div
            key={i}
            className={`grid min-h-[52px] grid-cols-[1.35fr_0.9fr_0.9fr_0.9fr] items-center border-b border-divider/40 px-4 py-2 last:border-b-0 transition-colors ${row.urgent ? 'bg-panel-secondary/20 hover:bg-panel-secondary/55' : 'hover:bg-panel-secondary/35'}`}
          >
            <div className="font-ui text-[12px] font-semibold text-txt-label transition-colors">
              <InfoTooltip title={row.tooltip.title} description={row.tooltip.description}>
                {row.metric}
              </InfoTooltip>
            </div>
            
            <div className="flex min-w-0 flex-col text-right">
              <span className={`font-mono tabular-nums tracking-normal ${row.urgent ? 'text-txt-primary text-[13px] font-bold' : 'text-txt-label text-[12px] font-semibold'}`}>{row.tm}</span>
              {row.bar}
            </div>
            
            <div className="text-right font-mono text-[12px] font-semibold tabular-nums tracking-normal text-txt-muted">{row.bench}</div>

            <div className="flex flex-col items-end text-right">
              <span className={`font-ui text-[11px] font-bold uppercase tracking-wide ${row.ok ? 'text-positive' : 'text-negative'}`}>
                {row.verdict}
              </span>
              <span className={`mt-0.5 flex items-center font-mono text-[11px] font-semibold tabular-nums ${row.ok ? 'text-positive/80' : 'text-negative/80'}`}>
                {row.comparison}
                <Arrow ok={row.ok} />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
