import { useMemo } from 'react';
import type { VenueSnapshot } from '../types';
import { formatPrice, formatQty } from '../utils/formatters';
import { getEffectiveSpread } from '../utils/metrics';
import { TrueMarketsIcon } from './TrueMarketsLogo';

interface OrderBookProps {
  snapshot: VenueSnapshot;
  title: string;
  isTrueMarkets?: boolean;
}

export function OrderBook({ snapshot, title, isTrueMarkets = false }: OrderBookProps) {
  const maxQty = useMemo(() => {
    return Math.max(
      ...snapshot.asks.map(a => a[1]),
      ...snapshot.bids.map(b => b[1]),
      0.001
    );
  }, [snapshot]);

  
  const { spreadBps, askMicro: askVwap, bidMicro: bidVwap } = getEffectiveSpread(snapshot);
  const effSpread = askVwap - bidVwap;
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
        {snapshot.asks.slice(0, 5).map((ask, i) => {
          const intensity = Math.min(0.6, ask[1] / maxQty * 0.8);
          return (
            <div key={`a${i}`} 
                 className="grid grid-cols-3 px-3 py-[3px] text-[13px] font-mono items-center hover:bg-[#161b22] transition-colors"
                 style={{ backgroundColor: `rgba(239, 68, 68, ${intensity})` }}>
              <div className="text-red-400 z-10 font-bold">{formatPrice(ask[0])}</div>
              <div className="text-right text-[#c9d1d9] z-10">{formatQty(ask[1])}</div>
              <div className="text-right text-[#8b949e] z-10">{formatPrice(ask[0] * ask[1])}</div>
            </div>
          );
        })}
      </div>

      {/* Spread row */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#161b22] border-y border-[#21262d] text-[11px] font-mono flex-shrink-0">
        <span className="text-blue-400 font-bold">Eff. Spread (VWAP)</span>
        <span className="text-white font-bold text-xs">{effSpread > 0 ? effSpread.toFixed(2) : '—'}</span>
        <span className="text-blue-400 font-bold">{spreadBps.toFixed(2)} bps</span>
      </div>

      {/* BIDS */}
      <div className="flex flex-col flex-shrink-0">
        {snapshot.bids.slice(0, 5).map((bid, i) => {
          const intensity = Math.min(0.6, bid[1] / maxQty * 0.8);
          return (
            <div key={`b${i}`} 
                 className="grid grid-cols-3 px-3 py-[3px] text-[13px] font-mono items-center hover:bg-[#161b22] transition-colors"
                 style={{ backgroundColor: `rgba(16, 185, 129, ${intensity})` }}>
              <div className="text-emerald-400 z-10 font-bold">{formatPrice(bid[0])}</div>
              <div className="text-right text-[#c9d1d9] z-10">{formatQty(bid[1])}</div>
              <div className="text-right text-[#8b949e] z-10">{formatPrice(bid[0] * bid[1])}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
