import React, { useMemo } from 'react';
import type { VenueSnapshot } from '../types';
import { formatPrice, formatQty } from '../utils/formatters';
import { TrueMarketsIcon } from './TrueMarketsLogo';

interface OrderBookProps {
  snapshot: VenueSnapshot;
  title: string;
  isTrueMarkets?: boolean;
}

export function OrderBook({ snapshot, title, isTrueMarkets = false }: OrderBookProps) {
  const cumBids = useMemo(() => {
    let cum = 0;
    return snapshot.bids.map(b => { cum += b[1]; return cum; });
  }, [snapshot.bids]);
  const cumAsks = useMemo(() => {
    let cum = 0;
    return snapshot.asks.map(a => { cum += a[1]; return cum; });
  }, [snapshot.asks]);

  const bestBid = snapshot.bids[0]?.[0] || 0;
  const bestAsk = snapshot.asks[0]?.[0] || 0;
  const spread = bestAsk - bestBid;
  const mid = (bestBid + bestAsk) / 2;
  const spreadBps = mid > 0 ? (spread / mid) * 10000 : 0;
  const imbalance = (snapshot.bid_depth_5 + snapshot.ask_depth_5) > 0
    ? ((snapshot.bid_depth_5 - snapshot.ask_depth_5) / (snapshot.bid_depth_5 + snapshot.ask_depth_5)) * 100
    : 0;

  return (
    <div className="flex flex-col h-full bg-[#0d1117] overflow-hidden">
      {/* Title bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#21262d] flex-shrink-0">
        <div className="flex items-center gap-2">
          {isTrueMarkets && <TrueMarketsIcon size={14} />}
          <span className="text-xs font-bold text-white tracking-wide uppercase">{title}</span>
        </div>
        <span className={`text-[11px] font-mono font-bold ${imbalance > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          IMB {imbalance > 0 ? '+' : ''}{imbalance.toFixed(0)}%
        </span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-3 text-[10px] tracking-wider font-bold text-[#484f58] px-3 py-1 border-b border-[#161b22] flex-shrink-0">
        <div>PRICE</div>
        <div className="text-right">SIZE</div>
        <div className="text-right">TOTAL</div>
      </div>

      {/* ASKS (reversed) */}
      <div className="flex flex-col-reverse flex-shrink-0">
        {snapshot.asks.slice(0, 5).map((ask, i) => (
          <div key={`a${i}`} className="grid grid-cols-3 px-3 py-[3px] text-[13px] font-mono relative items-center hover:bg-[#161b22]">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute right-0 top-0 bottom-0 bg-red-500/10 transition-all duration-300"
                style={{ width: `${Math.min(100, (cumAsks[i] / (cumAsks[cumAsks.length - 1] || 1)) * 100)}%` }} />
            </div>
            <div className="text-red-400 relative z-10">{formatPrice(ask[0])}</div>
            <div className="text-right text-[#c9d1d9] relative z-10">{formatQty(ask[1])}</div>
            <div className="text-right text-[#8b949e] relative z-10">{formatQty(cumAsks[i])}</div>
          </div>
        ))}
      </div>

      {/* Spread row */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#161b22] border-y border-[#21262d] text-[11px] font-mono flex-shrink-0">
        <span className="text-[#8b949e] font-bold">Spread</span>
        <span className="text-white font-bold text-xs">{spread.toFixed(2)}</span>
        <span className="text-[#8b949e]">{spreadBps.toFixed(3)}%</span>
      </div>

      {/* BIDS */}
      <div className="flex flex-col flex-shrink-0">
        {snapshot.bids.slice(0, 5).map((bid, i) => (
          <div key={`b${i}`} className="grid grid-cols-3 px-3 py-[3px] text-[13px] font-mono relative items-center hover:bg-[#161b22]">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute right-0 top-0 bottom-0 bg-emerald-500/10 transition-all duration-300"
                style={{ width: `${Math.min(100, (cumBids[i] / (cumBids[cumBids.length - 1] || 1)) * 100)}%` }} />
            </div>
            <div className="text-emerald-400 relative z-10">{formatPrice(bid[0])}</div>
            <div className="text-right text-[#c9d1d9] relative z-10">{formatQty(bid[1])}</div>
            <div className="text-right text-[#8b949e] relative z-10">{formatQty(cumBids[i])}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
