import type { VenueSnapshot, ChartPoint, Level } from '../types';

export function getImbalance(snap: VenueSnapshot): number {
  const sum = snap.bid_depth_5 + snap.ask_depth_5;
  if (sum === 0) return 0;
  return ((snap.bid_depth_5 - snap.ask_depth_5) / sum) * 100;
}

export function getMicroprice(snap: VenueSnapshot): number {
  if (snap.bids.length > 0 && snap.asks.length > 0) {
    const topBidP = snap.bids[0][0], topBidQ = snap.bids[0][1];
    const topAskP = snap.asks[0][0], topAskQ = snap.asks[0][1];
    if (topBidQ + topAskQ > 0) {
      return (topBidP * topAskQ + topAskP * topBidQ) / (topBidQ + topAskQ);
    }
  }
  return snap.mid;
}

export function computeVWAP(levels: Level[], targetSize: number): number {
  if (levels.length === 0 || targetSize <= 0) return 0;
  let remaining = targetSize;
  let totalValue = 0;
  let totalExecuted = 0;

  for (const level of levels) {
    const price = level[0];
    const qty = level[1];
    const fillQty = Math.min(qty, remaining);
    totalValue += price * fillQty;
    totalExecuted += fillQty;
    remaining -= fillQty;
    if (remaining <= 0) break;
  }
  
  if (totalExecuted === 0) return 0;
  return totalValue / totalExecuted;
}

export function computeSlippageBps(levels: Level[], mid: number, targetSize: number, side: 'buy' | 'sell'): number {
  const vwap = computeVWAP(levels, targetSize);
  if (vwap === 0 || mid === 0) return 0;
  return side === 'buy' ? ((vwap - mid) / mid) * 10000 : ((mid - vwap) / mid) * 10000;
}

export function getEffectiveSpread(snap: VenueSnapshot): { spreadBps: number; bidMicro: number; askMicro: number } {
  // Use sum of top 5 levels for a realistic deep VWAP spread
  const totalBidQty = snap.bids.reduce((sum, b) => sum + b[1], 0);
  const totalAskQty = snap.asks.reduce((sum, a) => sum + a[1], 0);
  
  const bidMicro = computeVWAP(snap.bids, totalBidQty);
  const askMicro = computeVWAP(snap.asks, totalAskQty);
  
  const spreadBps = snap.mid > 0 ? Math.abs((askMicro - bidMicro) / snap.mid) * 10000 : 0;
  return { spreadBps, bidMicro: bidMicro || snap.mid, askMicro: askMicro || snap.mid };
}

export function computeSlippageAdvantage(tm: VenueSnapshot, bench: VenueSnapshot): number {
  if (bench.bids.length === 0 || bench.asks.length === 0 || tm.bids.length === 0 || tm.asks.length === 0) return 0;
  
  // Use total depth of level 1 for standard slippage order size
  const targetSize = bench.bids[0][1] + bench.asks[0][1];
  
  const tmSlippageBuy = computeSlippageBps(tm.asks, tm.mid, targetSize, 'buy');
  const benchSlippageBuy = computeSlippageBps(bench.asks, bench.mid, targetSize, 'buy');
  
  return benchSlippageBuy - tmSlippageBuy;
}

export function computeFlowRisk(spreadGap: number, depthRatio: number, lagMs: number): {
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  colorClass: string;
  description: string;
} {
  if (spreadGap > 1.0 || depthRatio < 0.3 || lagMs > 100) {
    return { level: 'HIGH', colorClass: 'text-red-400 bg-red-950/40 border-red-500/50', description: 'Aggressive flow routes away.' };
  }
  if (spreadGap > 0.4 || depthRatio < 0.6) {
    return { level: 'MEDIUM', colorClass: 'text-yellow-400 bg-yellow-950/40 border-yellow-500/50', description: 'Minor spread dislocation detected.' };
  }
  return { level: 'LOW', colorClass: 'text-emerald-400 bg-emerald-950/40 border-emerald-500/50', description: 'Competitive execution maintained.' };
}

export function detectPatterns(history: ChartPoint[]): string[] {
  if (history.length < 5) return [];
  const insights: string[] = [];
  const recent = history.slice(-10);
  const older = history.slice(-20, -10);

  // Spread trend detection
  const recentAvgSpread = recent.reduce((a, b) => a + b.spreadGap, 0) / recent.length;
  if (older.length > 0) {
    const olderAvgSpread = older.reduce((a, b) => a + b.spreadGap, 0) / older.length;
    if (recentAvgSpread > olderAvgSpread * 2 && recentAvgSpread > 0.3) {
      insights.push(`Spread gap widened ${(recentAvgSpread / Math.max(olderAvgSpread, 0.01)).toFixed(1)}× in the last ${recent.length} ticks.`);
    }
    if (recentAvgSpread < olderAvgSpread * 0.5 && olderAvgSpread > 0.3) {
      insights.push(`Spread convergence: gap narrowed ${((1 - recentAvgSpread / olderAvgSpread) * 100).toFixed(0)}% recently.`);
    }
  }

  // Lag spike detection
  const maxRecentLag = Math.max(...recent.map(p => p.lagMs));
  const avgLag = recent.reduce((a, b) => a + b.lagMs, 0) / recent.length;
  if (maxRecentLag > 200 && avgLag > 100) {
    insights.push(`Sustained latency: avg ${avgLag.toFixed(0)}ms over last ${recent.length} ticks.`);
  }

  // Price deviation detection
  const maxMidGap = Math.max(...recent.map(p => p.midGap));
  if (maxMidGap > 5) {
    insights.push(`Mid-price divergence peaked at ${maxMidGap.toFixed(1)} bps — potential arbitrage window.`);
  }

  return insights;
}
