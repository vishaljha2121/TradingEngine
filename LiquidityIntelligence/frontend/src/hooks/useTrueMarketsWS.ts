import { useEffect, useState, useRef, useCallback } from 'react';
import type { VenueSnapshot } from '../types';

const TRUEX_WS_URL = 'wss://uat.truex.co/api/v1';

interface TrueMarketsWSReturn {
  snapshot: VenueSnapshot | null;
  connected: boolean;
  error: string | null;
  usingFallback: boolean;
}

type RawLevel = [number | string, number | string] | { price?: number | string; qty?: number | string };

interface DepthData {
  bids?: RawLevel[];
  asks?: RawLevel[];
}

interface EbboInfo {
  best_bid?: { price: number | string; qty: number | string };
  best_ask?: { price: number | string; qty: number | string };
}

interface TrueMarketsMessage {
  channel?: string;
  data?: DepthData | { info?: EbboInfo };
}

function levelValue(level: RawLevel, key: 'price' | 'qty', index: 0 | 1): number {
  const raw = Array.isArray(level) ? level[index] : level[key];
  return typeof raw === 'number' ? raw : parseFloat(raw ?? '0');
}

function buildSnapshot(depthData: DepthData): VenueSnapshot {
  const bids: [number, number][] = (depthData.bids || []).slice(0, 5).map((b) => [
    levelValue(b, 'price', 0),
    levelValue(b, 'qty', 1)
  ]);
  const asks: [number, number][] = (depthData.asks || []).slice(0, 5).map((a) => [
    levelValue(a, 'price', 0),
    levelValue(a, 'qty', 1)
  ]);

  const bestBid = bids[0]?.[0] || 0;
  const bestAsk = asks[0]?.[0] || 0;
  const mid = (bestBid + bestAsk) / 2;
  const spreadBps = mid > 0 ? ((bestAsk - bestBid) / mid) * 10000 : 0;
  const bidDepth = bids.reduce((s, b) => s + b[1], 0);
  const askDepth = asks.reduce((s, a) => s + a[1], 0);

  return {
    venue: 'TrueMarkets',
    mid,
    spread_bps: spreadBps,
    bid_depth_5: bidDepth,
    ask_depth_5: askDepth,
    bids,
    asks,
  };
}

export function useTrueMarketsWS(asset: string = 'BTC'): TrueMarketsWSReturn {
  const [snapshot, setSnapshot] = useState<VenueSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failCount = useRef(0);
  const connectRef = useRef<() => void>(() => {});

  const symbol = `${asset}-PYUSD`;

  const connect = useCallback(() => {
    // After 3 failed attempts, switch to fallback mode
    if (failCount.current >= 3) {
      setUsingFallback(true);
      setError('TrueMarkets WS unavailable — using simulated data');
      return;
    }
    setUsingFallback(false);

    try {
      const ws = new WebSocket(TRUEX_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setError(null);
        failCount.current = 0;

        // Subscribe unauthenticated to DEPTH + EBBO
        const ts = Math.floor(Date.now() / 1000).toString();
        ws.send(JSON.stringify({
          type: 'SUBSCRIBE_NO_AUTH',
          item_names: [symbol],
          channels: ['DEPTH', 'EBBO'],
          timestamp: ts
        }));
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data) as TrueMarketsMessage;

          if (msg.channel === 'DEPTH' && msg.data) {
            setSnapshot(buildSnapshot(msg.data as DepthData));
          }

          if (msg.channel === 'EBBO' && msg.data && 'info' in msg.data && msg.data.info) {
            const info = msg.data.info;
            if (info.best_bid && info.best_ask) {
              const bestBid = info.best_bid;
              const bestAsk = info.best_ask;
              // Update with EBBO best bid/ask if we don't have depth yet
              setSnapshot(prev => {
                if (prev && prev.bids.length > 0) return prev; // DEPTH takes priority
                const bid: [number, number] = [Number(bestBid.price), Number(bestBid.qty)];
                const ask: [number, number] = [Number(bestAsk.price), Number(bestAsk.qty)];
                const mid = (bid[0] + ask[0]) / 2;
                return {
                  venue: 'TrueMarkets',
                  mid,
                  spread_bps: mid > 0 ? ((ask[0] - bid[0]) / mid) * 10000 : 0,
                  bid_depth_5: bid[1],
                  ask_depth_5: ask[1],
                  bids: [bid],
                  asks: [ask],
                };
              });
            }
          }
        } catch {
          // Skip malformed
        }
      };

      ws.onclose = () => {
        setConnected(false);
        failCount.current++;
        const delay = Math.min(2000 * Math.pow(2, failCount.current), 15000);
        setError(`TrueMarkets WS disconnected. Retry ${failCount.current}/3...`);
        reconnectTimer.current = setTimeout(() => connectRef.current(), delay);
      };

      ws.onerror = () => {
        failCount.current++;
      };
    } catch {
      failCount.current++;
      setUsingFallback(true);
      setError('TrueMarkets WS unavailable — using simulated data');
    }
  }, [symbol]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    failCount.current = 0;
    const initialTimer = setTimeout(() => connectRef.current(), 0);
    return () => {
      clearTimeout(initialTimer);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { snapshot, connected, error, usingFallback };
}
