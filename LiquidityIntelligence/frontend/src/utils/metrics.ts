import type { VenueSnapshot, ChartPoint } from '../types';

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

export function getEffectiveSpread(snap: VenueSnapshot): { spreadBps: number; bidMicro: number; askMicro: number } {
  const bidMicro = snap.bids.length > 1
    ? (snap.bids[0][0] * snap.bids[0][1] + snap.bids[1][0] * snap.bids[1][1]) / (snap.bids[0][1] + snap.bids[1][1])
    : (snap.bids[0] ? snap.bids[0][0] : snap.mid);
  const askMicro = snap.asks.length > 1
    ? (snap.asks[0][0] * snap.asks[0][1] + snap.asks[1][0] * snap.asks[1][1]) / (snap.asks[0][1] + snap.asks[1][1])
    : (snap.asks[0] ? snap.asks[0][0] : snap.mid);
  const spreadBps = snap.mid > 0 ? Math.abs((askMicro - bidMicro) / snap.mid) * 10000 : 0;
  return { spreadBps, bidMicro, askMicro };
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
