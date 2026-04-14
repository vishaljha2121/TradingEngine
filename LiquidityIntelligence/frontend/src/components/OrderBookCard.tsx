import { useMemo } from 'react';
import type { VenueSnapshot } from '../types';
import { formatPrice, formatQty } from '../utils/formatters';
import { getEffectiveSpread, getImbalance } from '../utils/metrics';
import { TrueMarketsIcon } from './TrueMarketsLogo';

interface OrderBookCardProps {
  snapshot: VenueSnapshot;
  title: string;
  isTrueMarkets?: boolean;
}

export function OrderBookCard({ snapshot, title, isTrueMarkets = false }: OrderBookCardProps) {
  const maxQty = useMemo(() => {
    return Math.max(
      ...snapshot.asks.slice(0, 5).map(a => a[1]),
      ...snapshot.bids.slice(0, 5).map(b => b[1]),
      0.001
    );
  }, [snapshot]);

  const { spreadBps } = getEffectiveSpread(snapshot);
  const imbalance = getImbalance(snapshot);
  const bestBid = snapshot.bids[0]?.[0] ?? 0;
  const bestAsk = snapshot.asks[0]?.[0] ?? 0;
  const rawSpread = bestAsk - bestBid;

  const cumBids = useMemo(() => {
    let c = 0;
    return snapshot.bids.slice(0, 5).map(b => { c += b[1]; return c; });
  }, [snapshot.bids]);
  const cumAsks = useMemo(() => {
    let c = 0;
    return snapshot.asks.slice(0, 5).map(a => { c += a[1]; return c; });
  }, [snapshot.asks]);
  const maxCum = Math.max(cumBids[cumBids.length - 1] ?? 1, cumAsks[cumAsks.length - 1] ?? 1, 0.001);

  return (
    <div className="flex flex-col h-full bg-[#0B1220] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1F2A3A] flex-shrink-0">
        <div className="flex items-center gap-2">
          {isTrueMarkets && <TrueMarketsIcon size={14} />}
          <span className="text-[13px] font-bold text-[#E5EDF7] font-ui">{title}</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono text-[#6F7C8E]">
          <span>Mid: <span className="text-[#A8B3C2] font-semibold">{formatPrice(snapshot.mid)}</span></span>
          <span>Sprd: <span className="text-[#A8B3C2] font-semibold">{rawSpread.toFixed(2)}</span></span>
          <span>Eff: <span className="text-[#4DA3FF] font-semibold">{spreadBps.toFixed(2)}bps</span></span>
          <span className={imbalance > 0 ? 'text-[#18C37E]' : 'text-[#FF5C5C]'}>
            IMB {imbalance > 0 ? '+' : ''}{imbalance.toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_1fr_1fr_60px] text-[10px] tracking-wider font-semibold text-[#6F7C8E] px-3 py-1 border-b border-[#1F2A3A]/50 flex-shrink-0 font-ui">
        <div>PRICE</div>
        <div className="text-right">SIZE</div>
        <div className="text-right">CUM</div>
        <div />
      </div>

      {/* ASKS (reversed — furthest from mid at top) */}
      <div className="flex flex-col-reverse flex-shrink-0">
        {snapshot.asks.slice(0, 5).map((ask, i) => {
          const intensity = Math.min(0.7, (ask[1] / maxQty) * 0.8);
          const isTop = i === 0;
          const bgColor = isTop
            ? `rgba(179, 58, 58, ${Math.max(intensity, 0.25)})`
            : `rgba(94, 31, 31, ${intensity})`;
          const depthPct = maxCum > 0 ? (cumAsks[i] / maxCum) * 100 : 0;

          return (
            <div key={`a${i}`}
              className="grid grid-cols-[1fr_1fr_1fr_60px] px-3 py-[3px] text-[12px] font-mono items-center transition-colors hover:brightness-125"
              style={{ backgroundColor: bgColor }}
            >
              <div className={isTop ? 'text-[#B33A3A] font-bold' : 'text-[#FF5C5C]'}>{formatPrice(ask[0])}</div>
              <div className="text-right text-[#A8B3C2]">{formatQty(ask[1])}</div>
              <div className="text-right text-[#6F7C8E]">{formatQty(cumAsks[i])}</div>
              <div className="h-[3px] rounded-full bg-[#1F2A3A] overflow-hidden">
                <div className="h-full bg-[#B33A3A]/50 transition-all duration-300" style={{ width: `${depthPct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Spread separator */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#0A1322] border-y border-[#1F2A3A] text-[11px] font-mono flex-shrink-0">
        <span className="text-[#6F7C8E] font-semibold font-ui">Spread</span>
        <span className="text-[#E5EDF7] font-bold">{rawSpread.toFixed(2)}</span>
        <span className="text-[#4DA3FF] font-semibold">{(snapshot.spread_bps).toFixed(2)} bps</span>
      </div>

      {/* BIDS */}
      <div className="flex flex-col flex-shrink-0">
        {snapshot.bids.slice(0, 5).map((bid, i) => {
          const intensity = Math.min(0.7, (bid[1] / maxQty) * 0.8);
          const isTop = i === 0;
          const bgColor = isTop
            ? `rgba(31, 174, 104, ${Math.max(intensity, 0.25)})`
            : `rgba(29, 106, 67, ${intensity})`;
          const depthPct = maxCum > 0 ? (cumBids[i] / maxCum) * 100 : 0;

          return (
            <div key={`b${i}`}
              className="grid grid-cols-[1fr_1fr_1fr_60px] px-3 py-[3px] text-[12px] font-mono items-center transition-colors hover:brightness-125"
              style={{ backgroundColor: bgColor }}
            >
              <div className={isTop ? 'text-[#1FAE68] font-bold' : 'text-[#18C37E]'}>{formatPrice(bid[0])}</div>
              <div className="text-right text-[#A8B3C2]">{formatQty(bid[1])}</div>
              <div className="text-right text-[#6F7C8E]">{formatQty(cumBids[i])}</div>
              <div className="h-[3px] rounded-full bg-[#1F2A3A] overflow-hidden">
                <div className="h-full bg-[#1FAE68]/50 transition-all duration-300" style={{ width: `${depthPct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
