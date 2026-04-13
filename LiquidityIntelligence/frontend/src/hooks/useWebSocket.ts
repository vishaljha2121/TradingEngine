import { useEffect, useState, useRef, useCallback } from 'react';
import type { IntelligencePayload, VenueSnapshot } from '../types';

interface UseWebSocketReturn {
  data: IntelligencePayload | null;
  connected: boolean;
  error: string | null;
  changeSubscription: (asset: string, benchmark: string) => void;
}

export function useBackendWS(initialAsset: string, initialBenchmark: string): UseWebSocketReturn {
  const [data, setData] = useState<IntelligencePayload | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const configRef = useRef({ asset: initialAsset, benchmark: initialBenchmark });

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket("ws://localhost:9001/broadcast");
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setError(null);
      reconnectAttempts.current = 0;
      ws.send(JSON.stringify({
        action: "subscribe",
        asset: configRef.current.asset,
        benchmark: configRef.current.benchmark
      }));
    };

    ws.onclose = () => {
      setConnected(false);
      // Exponential backoff reconnection
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
      reconnectAttempts.current++;
      setError(`Disconnected. Reconnecting in ${Math.round(delay / 1000)}s...`);
      reconnectTimer.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      setError('Connection error — is the C++ backend running?');
    };

    ws.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        console.log('[WS] Received keys:', Object.keys(payload), 'benchmark mid:', payload.benchmark?.mid, 'tm mid:', payload.truemarkets?.mid);
        const benchPayload = payload.benchmark || payload.binance;
        if (!benchPayload) {
          console.warn('[WS] No benchmark payload in message');
          return;
        }

        const normalizedPayload: IntelligencePayload = {
          ...payload,
          benchmark: benchPayload,
          lag_ms: payload.lag_ms ?? 0,
        };
        setData(normalizedPayload);
      } catch (err) {
        console.error('[WS] Parse error:', err);
      }
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const changeSubscription = useCallback((asset: string, benchmark: string) => {
    configRef.current = { asset, benchmark };
    setData(null);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "subscribe", asset, benchmark }));
    }
  }, []);

  return { data, connected, error, changeSubscription };
}
