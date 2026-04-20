import { useCallback, useMemo, useRef, useState } from 'react';

export interface MarketHistoryPoint {
  timestamp: number;
  asset: string;
  benchmarkName: string;
  spreadGap: number;
  midGap: number;
  lagMs: number;
  slippageBps: number;
  depthRatio: number;
  routingRisk: number;
  executionEdgeBps: number;
  quoteFreshnessScore: number;
  lpHealthScore: number;
  topRecommendationId?: string;
  topRecommendationSeverity?: string;
}

const MAX_BUFFER_MS = 6 * 60 * 60 * 1000;
const SAMPLE_INTERVAL_MS = 1000;

export function useMarketHistoryBuffer(resetKey: string) {
  const [state, setState] = useState<{ resetKey: string; points: MarketHistoryPoint[] }>({
    resetKey,
    points: [],
  });
  const lastSampleRef = useRef(0);
  const points = useMemo(() => state.resetKey === resetKey ? state.points : [], [state, resetKey]);

  const recordPoint = useCallback((point: Omit<MarketHistoryPoint, 'timestamp'>) => {
    const now = Date.now();
    if (now - lastSampleRef.current < SAMPLE_INTERVAL_MS) return;
    lastSampleRef.current = now;

    setState((prev) => {
      const cutoff = now - MAX_BUFFER_MS;
      const previousPoints = prev.resetKey === resetKey ? prev.points : [];
      return {
        resetKey,
        points: [...previousPoints.filter((item) => item.timestamp >= cutoff), { ...point, timestamp: now }],
      };
    });
  }, [resetKey]);

  const getWindowPoints = useCallback((windowMs: number) => {
    const cutoff = Date.now() - windowMs;
    return points.filter((point) => point.timestamp >= cutoff);
  }, [points]);

  const availableMs = points.length >= 2
    ? points[points.length - 1].timestamp - points[0].timestamp
    : 0;

  return {
    points,
    availableMs,
    recordPoint,
    getWindowPoints,
  };
}
