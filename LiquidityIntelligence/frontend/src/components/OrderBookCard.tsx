import { useMemo } from 'react';
import type { VenueSnapshot } from '../types';
import { formatPrice, formatQty } from '../utils/formatters';
import { TrueMarketsIcon } from './TrueMarketsLogo';

interface OrderBookCardProps {
  snapshot: VenueSnapshot;
  title: string;
  isTrueMarkets?: boolean;
}

export function OrderBookCard({ snapshot, title, isTrueMarkets = false }: OrderBookCardProps) {
  // Only show top 3 levels to reduce visual footprint
  const DEPTH_LEVELS = 3;

  const maxQty = useMemo(() => {
    return Math.max(
      ...snapshot.asks.slice(0, DEPTH_LEVELS).map(a => a[1]),
      ...snapshot.bids.slice(0, DEPTH_LEVELS).map(b => b[1]),
      0.001
    );
  }, [snapshot]);

  const bestBid = snapshot.bids[0]?.[0] ?? 0;
  const bestAsk = snapshot.asks[0]?.[0] ?? 0;
  const rawSpread = bestAsk - bestBid;

  const cumBids = useMemo(() => {
    let c = 0;
    return snapshot.bids.slice(0, DEPTH_LEVELS).map(b => { c += b[1]; return c; });
  }, [snapshot.bids]);
  const cumAsks = useMemo(() => {
    let c = 0;
    return snapshot.asks.slice(0, DEPTH_LEVELS).map(a => { c += a[1]; return c; });
  }, [snapshot.asks]);
  const maxCum = Math.max(cumBids[cumBids.length - 1] ?? 1, cumAsks[cumAsks.length - 1] ?? 1, 0.001);

  const accentColor = isTrueMarkets ? '#4DA3FF' : '#39465A';

  return (
    <div className="flex flex-col h-full bg-[#0B1220] rounded relative overflow-hidden transition-all hover:bg-[#0E1728]/30">
      {/* Accent Line instead of thick border block */}
      <div className="absolute top-0 left-0 bottom-0 w-[3px]" style={{ backgroundColor: accentColor }} />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-1.5 flex-shrink-0 relative z-10 pl-5">
        <div className="flex items-center gap-2">
          {isTrueMarkets && <TrueMarketsIcon size={12} />}
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#E5EDF7] font-ui">{title}</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono text-[#6F7C8E]">
          <span>Mid: <span className="text-[#A8B3C2] font-semibold">{formatPrice(snapshot.mid)}</span></span>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_1fr_1fr_40px] text-[9px] tracking-widest font-bold text-[#6F7C8E] px-4 pl-5 pb-1 flex-shrink-0 font-ui uppercase">
        <div>Price</div>
        <div className="text-right">Size</div>
        <div className="text-right">Cumul</div>
        <div />
      </div>

      {/* ASKS (reversed) */}
      <div className="flex flex-col-reverse flex-shrink-0 pb-0.5">
        {snapshot.asks.slice(0, DEPTH_LEVELS).map((ask, i) => {
          const intensity = Math.min(0.7, (ask[1] / maxQty) * 0.8);
          const isTop = i === 0;
          const bgColor = isTop
            ? `rgba(179, 58, 58, ${Math.max(intensity, 0.25)})`
            : `transparent`; // Remove heavy background bars for cleaner look
          const depthPct = maxCum > 0 ? (cumAsks[i] / maxCum) * 100 : 0;

          return (
            <div key={`a${i}`}
              className="grid grid-cols-[1fr_1fr_1fr_40px] px-4 pl-5 py-[1px] text-[11px] font-mono items-center group"
              style={{ backgroundColor: bgColor }}
            >
              <div className={isTop ? 'text-[#B33A3A] font-bold' : 'text-[#FF5C5C]/80'}>{formatPrice(ask[0])}</div>
              <div className="text-right text-[#A8B3C2]">{formatQty(ask[1])}</div>
              <div className="text-right text-[#6F7C8E] opacity-70 group-hover:opacity-100">{formatQty(cumAsks[i])}</div>
              {/* Subtle Depth Bar */}
              <div className="h-[2px] rounded-full bg-transparent overflow-hidden mt-[1px]">
                <div className="h-full bg-[#B33A3A] transition-all duration-300 opacity-40 group-hover:opacity-80" style={{ width: `${depthPct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Spread separator (Minimal) */}
      <div className="flex items-center justify-between px-4 pl-5 py-0.5 my-0.5 bg-[#1F2A3A]/20 border-y border-[#1F2A3A]/30 text-[9px] font-mono flex-shrink-0 relative z-10">
        <span className="text-[#6F7C8E] font-semibold uppercase tracking-wider font-ui">Spread</span>
        <span className="text-[#A8B3C2]">{rawSpread.toFixed(2)}</span>
      </div>

      {/* BIDS */}
      <div className="flex flex-col flex-shrink-0 pt-0.5 pb-1 relative z-10">
        {snapshot.bids.slice(0, DEPTH_LEVELS).map((bid, i) => {
          const intensity = Math.min(0.7, (bid[1] / maxQty) * 0.8);
          const isTop = i === 0;
          const bgColor = isTop
            ? `rgba(31, 174, 104, ${Math.max(intensity, 0.25)})`
            : `transparent`;
          const depthPct = maxCum > 0 ? (cumBids[i] / maxCum) * 100 : 0;

          return (
            <div key={`b${i}`}
              className="grid grid-cols-[1fr_1fr_1fr_40px] px-4 pl-5 py-[1px] text-[11px] font-mono items-center group"
              style={{ backgroundColor: bgColor }}
            >
              <div className={isTop ? 'text-[#1FAE68] font-bold' : 'text-[#18C37E]/80'}>{formatPrice(bid[0])}</div>
              <div className="text-right text-[#A8B3C2]">{formatQty(bid[1])}</div>
              <div className="text-right text-[#6F7C8E] opacity-70 group-hover:opacity-100">{formatQty(cumBids[i])}</div>
              {/* Subtle Depth Bar */}
              <div className="h-[2px] rounded-full bg-transparent overflow-hidden mt-[1px]">
                <div className="h-full bg-[#1FAE68] transition-all duration-300 opacity-40 group-hover:opacity-80" style={{ width: `${depthPct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
