import { useMemo } from 'react';
import type { VenueSnapshot } from '../types';
import { formatBps, formatPrice, formatQty } from '../utils/formatters';
import { TrueMarketsIcon } from './TrueMarketsLogo';

interface OrderBookCardProps {
  snapshot: VenueSnapshot;
  title: string;
  isTrueMarkets?: boolean;
  expanded?: boolean;
}

export function OrderBookCard({ snapshot, title, isTrueMarkets = false, expanded = false }: OrderBookCardProps) {
  const isExpanded = expanded ?? false;
  // Show 5 levels when expanded (or max available from backend), 3 when compact
  const DEPTH_LEVELS = isExpanded ? 7 : 4;



  const bestBid = snapshot.bids[0]?.[0] ?? 0;
  const bestAsk = snapshot.asks[0]?.[0] ?? 0;
  const rawSpread = bestAsk - bestBid;
  const rowGrid = isExpanded ? 'grid-cols-[1fr_1fr_1fr_52px]' : 'grid-cols-[1fr_0.9fr_52px]';

  const cumBids = useMemo(() => {
    let cumulative = 0;
    const values: number[] = [];
    for (const bid of snapshot.bids.slice(0, DEPTH_LEVELS)) {
      cumulative += bid[1];
      values.push(cumulative);
    }
    return values;
  }, [snapshot.bids, DEPTH_LEVELS]);
  const cumAsks = useMemo(() => {
    let cumulative = 0;
    const values: number[] = [];
    for (const ask of snapshot.asks.slice(0, DEPTH_LEVELS)) {
      cumulative += ask[1];
      values.push(cumulative);
    }
    return values;
  }, [snapshot.asks, DEPTH_LEVELS]);
  const maxCum = Math.max(cumBids[cumBids.length - 1] ?? 1, cumAsks[cumAsks.length - 1] ?? 1, 0.001);

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-panel">
      {/* Accent Line instead of thick border block */}
      <div className={`absolute top-0 left-0 bottom-0 w-[4px] ${isTrueMarkets ? 'bg-info' : 'bg-divider'}`} />

      {/* Header */}
      <div className="relative z-10 flex flex-shrink-0 items-center justify-between border-b border-divider/40 bg-panel-secondary/30 py-2 pl-6 pr-4">
        <div className="flex min-w-0 items-center gap-2">
          {isTrueMarkets && <TrueMarketsIcon size={12} />}
          <span className="font-ui truncate text-[12px] font-semibold uppercase tracking-wide text-txt-primary">{title}</span>
        </div>
        <div className="flex flex-shrink-0 items-center gap-3 font-mono text-[11px] text-txt-muted">
          <span className="font-semibold uppercase tracking-normal">Mid <span className="ml-1 text-txt-primary">{formatPrice(snapshot.mid)}</span></span>
        </div>
      </div>

      {/* Column headers */}
      <div className={`grid ${rowGrid} flex-shrink-0 border-b border-divider/20 bg-app/50 px-4 py-1.5 pl-6 font-ui text-[10px] font-semibold uppercase tracking-wide text-txt-muted`}>
        <div>Price</div>
        <div className="text-right">Size</div>
        {isExpanded && <div className="text-right">Cumul</div>}
        <div />
      </div>

      {/* ASKS (reversed) */}
      <div className="flex flex-col-reverse flex-shrink-0 pb-1">
        {snapshot.asks.slice(0, DEPTH_LEVELS).map((ask, i) => {
          const depthPct = maxCum > 0 ? (cumAsks[i] / maxCum) * 100 : 0;
          return (
            <div key={`a${i}`}
              className={`grid ${rowGrid} group items-center px-4 py-[3px] pl-6 font-mono text-[11px] transition-colors ${i === 0 ? 'bg-ask-dark/30' : 'hover:bg-panel-secondary/50'}`}
            >
              <div className={i === 0 ? 'text-ask-best font-bold' : 'text-negative/80'}>{formatPrice(ask[0])}</div>
              <div className="text-right text-txt-primary font-semibold">{formatQty(ask[1])}</div>
              {isExpanded && <div className="text-right text-txt-muted opacity-80 group-hover:opacity-100">{formatQty(cumAsks[i])}</div>}
              {/* Subtle Depth Bar */}
              <div className="ml-2 mt-[1px] h-[4px] overflow-hidden rounded-full bg-divider/20">
                <div className="h-full bg-ask-best transition-all duration-300 opacity-60 group-hover:opacity-100" style={{ width: `${depthPct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Spread separator (Minimal) */}
      <div className="relative z-10 my-0.5 flex flex-shrink-0 items-center justify-between border-y border-divider/50 bg-panel-secondary/50 py-1.5 pl-6 pr-4 font-mono text-[11px]">
        <span className="font-ui font-semibold uppercase tracking-wide text-txt-muted">Spread</span>
        <span className="font-bold text-txt-primary">{formatBps(snapshot.spread_bps)} <span className="text-txt-muted">({rawSpread.toFixed(2)})</span></span>
      </div>

      {/* BIDS */}
      <div className="flex flex-col flex-shrink-0 pt-1 pb-1 relative z-10">
        {snapshot.bids.slice(0, DEPTH_LEVELS).map((bid, i) => {
          const depthPct = maxCum > 0 ? (cumBids[i] / maxCum) * 100 : 0;
          return (
            <div key={`b${i}`}
              className={`grid ${rowGrid} group items-center px-4 py-[3px] pl-6 font-mono text-[11px] transition-colors ${i === 0 ? 'bg-bid-dark/40' : 'hover:bg-panel-secondary/50'}`}
            >
              <div className={i === 0 ? 'text-bid-best font-bold' : 'text-positive/80'}>{formatPrice(bid[0])}</div>
              <div className="text-right text-txt-primary font-semibold">{formatQty(bid[1])}</div>
              {isExpanded && <div className="text-right text-txt-muted opacity-80 group-hover:opacity-100">{formatQty(cumBids[i])}</div>}
              {/* Subtle Depth Bar */}
              <div className="ml-2 mt-[1px] h-[4px] overflow-hidden rounded-full bg-divider/20">
                <div className="h-full bg-bid-best transition-all duration-300 opacity-60 group-hover:opacity-100" style={{ width: `${depthPct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
