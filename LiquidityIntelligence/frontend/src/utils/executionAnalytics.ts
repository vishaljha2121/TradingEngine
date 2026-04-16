import type { Level, VenueSnapshot } from '../types';

export type ExecutionSide = 'buy' | 'sell';
export type RouteAction = 'ROUTE_TRUE_MARKETS' | 'ROUTE_BENCHMARK' | 'SPLIT_ORDER' | 'WAIT';

export interface FillResult {
  vwap: number;
  filledQty: number;
  fillPct: number;
  notional: number;
  impactBps: number;
  exhausted: boolean;
}

export interface ExecutionAnalysis {
  side: ExecutionSide;
  size: number;
  tm: FillResult;
  benchmark: FillResult;
  edgeBps: number;
  edgeUsd: number;
  fillableTmWithinThreshold: number;
  fillableBenchmarkWithinThreshold: number;
  thresholdBps: number;
}

export interface ImpactPoint {
  size: number;
  tmImpactBps: number;
  benchmarkImpactBps: number;
  tmVwap: number;
  benchmarkVwap: number;
}

export interface Recommendation {
  action: RouteAction;
  label: string;
  confidence: number;
  splitTmPct: number;
  reasons: string[];
  tone: 'good' | 'warn' | 'bad';
}

export interface QuoteFreshness {
  score: number;
  label: 'Fresh' | 'Watch' | 'Stale';
  staleMs: number;
  reason: string;
}

export interface LiquidityProviderHealth {
  score: number;
  label: 'Strong' | 'Watch' | 'Weak';
  factors: Array<{ label: string; score: number; value: string; tone: 'good' | 'warn' | 'bad' }>;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sideLevels(snapshot: VenueSnapshot, side: ExecutionSide): Level[] {
  return side === 'buy' ? snapshot.asks : snapshot.bids;
}

function bestPrice(snapshot: VenueSnapshot, side: ExecutionSide): number {
  const levels = sideLevels(snapshot, side);
  return levels[0]?.[0] ?? snapshot.mid;
}

export function computeSideVwap(snapshot: VenueSnapshot, side: ExecutionSide, size: number): FillResult {
  const levels = sideLevels(snapshot, side);
  const best = bestPrice(snapshot, side);
  if (size <= 0 || levels.length === 0 || best <= 0) {
    return { vwap: 0, filledQty: 0, fillPct: 0, notional: 0, impactBps: 0, exhausted: true };
  }

  let remaining = size;
  let notional = 0;
  let filledQty = 0;

  for (const level of levels) {
    const price = level[0];
    const qty = level[1];
    const fillQty = Math.min(qty, remaining);
    notional += price * fillQty;
    filledQty += fillQty;
    remaining -= fillQty;
    if (remaining <= 0) break;
  }

  const vwap = filledQty > 0 ? notional / filledQty : 0;
  const impactBps = vwap > 0
    ? side === 'buy'
      ? ((vwap - best) / best) * 10000
      : ((best - vwap) / best) * 10000
    : 0;

  return {
    vwap,
    filledQty,
    fillPct: clamp((filledQty / size) * 100, 0, 100),
    notional,
    impactBps,
    exhausted: filledQty < size,
  };
}

export function computeFillableWithinBps(snapshot: VenueSnapshot, side: ExecutionSide, thresholdBps: number): number {
  const levels = sideLevels(snapshot, side);
  const best = bestPrice(snapshot, side);
  if (best <= 0 || levels.length === 0) return 0;

  return levels.reduce((sum, level) => {
    const price = level[0];
    const qty = level[1];
    const distanceBps = side === 'buy'
      ? ((price - best) / best) * 10000
      : ((best - price) / best) * 10000;
    return distanceBps <= thresholdBps ? sum + qty : sum;
  }, 0);
}

export function analyzeExecution(
  tm: VenueSnapshot,
  benchmark: VenueSnapshot,
  side: ExecutionSide,
  size: number,
  thresholdBps: number,
): ExecutionAnalysis {
  const tmFill = computeSideVwap(tm, side, size);
  const benchFill = computeSideVwap(benchmark, side, size);
  const comparableQty = Math.min(tmFill.filledQty, benchFill.filledQty, size);
  const denominator = benchFill.vwap > 0 ? benchFill.vwap : benchmark.mid;
  const rawEdge = side === 'buy'
    ? benchFill.vwap - tmFill.vwap
    : tmFill.vwap - benchFill.vwap;

  return {
    side,
    size,
    tm: tmFill,
    benchmark: benchFill,
    edgeBps: denominator > 0 ? (rawEdge / denominator) * 10000 : 0,
    edgeUsd: rawEdge * comparableQty,
    fillableTmWithinThreshold: computeFillableWithinBps(tm, side, thresholdBps),
    fillableBenchmarkWithinThreshold: computeFillableWithinBps(benchmark, side, thresholdBps),
    thresholdBps,
  };
}

export function buildImpactCurve(
  tm: VenueSnapshot,
  benchmark: VenueSnapshot,
  side: ExecutionSide,
  sizes: number[],
): ImpactPoint[] {
  return sizes.map((size) => {
    const tmFill = computeSideVwap(tm, side, size);
    const benchmarkFill = computeSideVwap(benchmark, side, size);
    return {
      size,
      tmImpactBps: tmFill.impactBps,
      benchmarkImpactBps: benchmarkFill.impactBps,
      tmVwap: tmFill.vwap,
      benchmarkVwap: benchmarkFill.vwap,
    };
  });
}

export function computeQuoteFreshness(lagMs: number, feedMode: string): QuoteFreshness {
  const feedPenalty = feedMode === 'Fallback Mock' ? 18 : feedMode === 'Connecting...' ? 45 : 0;
  const score = Math.round(clamp(100 - lagMs / 2.4 - feedPenalty, 0, 100));
  const label = score >= 75 ? 'Fresh' : score >= 45 ? 'Watch' : 'Stale';
  const reason = label === 'Fresh'
    ? 'Quote updates are inside the acceptable routing window.'
    : label === 'Watch'
      ? 'Quote lag is high enough to reduce route confidence.'
      : 'Quotes are stale enough to pause or reroute aggressive flow.';

  return { score, label, staleMs: lagMs, reason };
}

export function computeRecommendation(
  analysis: ExecutionAnalysis,
  freshness: QuoteFreshness,
  depthRatio: number,
): Recommendation {
  const tmFill = analysis.tm.fillPct;
  const benchFill = analysis.benchmark.fillPct;
  const edge = analysis.edgeBps;
  const reasons: string[] = [];

  if (edge >= 0) reasons.push(`True Markets has a ${edge.toFixed(2)} bps executable edge.`);
  else reasons.push(`Benchmark is cheaper by ${Math.abs(edge).toFixed(2)} bps.`);

  reasons.push(`True Markets fills ${tmFill.toFixed(0)}% of selected size.`);
  reasons.push(`Quote freshness score is ${freshness.score}/100.`);

  if (freshness.score < 45 || tmFill < 45) {
    return {
      action: 'WAIT',
      label: 'Wait / Do Not Route',
      confidence: Math.round(clamp(100 - freshness.score + (100 - tmFill) * 0.4, 45, 92)),
      splitTmPct: 0,
      reasons,
      tone: 'bad',
    };
  }

  if (edge > 0.35 && tmFill >= 85 && freshness.score >= 65) {
    return {
      action: 'ROUTE_TRUE_MARKETS',
      label: 'Route to True Markets',
      confidence: Math.round(clamp(58 + edge * 8 + tmFill * 0.18 + freshness.score * 0.12, 55, 96)),
      splitTmPct: 100,
      reasons,
      tone: 'good',
    };
  }

  if (edge < -0.35 && benchFill >= 80) {
    return {
      action: 'ROUTE_BENCHMARK',
      label: 'Route to Benchmark',
      confidence: Math.round(clamp(58 + Math.abs(edge) * 8 + benchFill * 0.15, 55, 94)),
      splitTmPct: 0,
      reasons,
      tone: 'bad',
    };
  }

  const splitTmPct = Math.round(clamp(50 + edge * 10 + (tmFill - benchFill) * 0.22 + (depthRatio - 1) * 18, 20, 80));
  return {
    action: 'SPLIT_ORDER',
    label: `Split Order ${splitTmPct}/${100 - splitTmPct}`,
    confidence: Math.round(clamp(56 + freshness.score * 0.18 + Math.min(tmFill, benchFill) * 0.12, 52, 86)),
    splitTmPct,
    reasons,
    tone: 'warn',
  };
}

export function computeLiquidityProviderHealth(
  spreadGap: number,
  edgeBps: number,
  depthRatio: number,
  freshness: QuoteFreshness,
): LiquidityProviderHealth {
  const spreadScore = Math.round(clamp(95 - Math.max(0, spreadGap) * 34 + Math.max(0, -spreadGap) * 10, 0, 100));
  const depthScore = Math.round(clamp(depthRatio * 100, 0, 100));
  const edgeScore = Math.round(clamp(55 + edgeBps * 12, 0, 100));
  const overall = Math.round(spreadScore * 0.28 + depthScore * 0.26 + edgeScore * 0.24 + freshness.score * 0.22);
  const label = overall >= 75 ? 'Strong' : overall >= 50 ? 'Watch' : 'Weak';

  const toneFor = (score: number): 'good' | 'warn' | 'bad' => score >= 75 ? 'good' : score >= 50 ? 'warn' : 'bad';
  return {
    score: overall,
    label,
    factors: [
      { label: 'Spread competitiveness', score: spreadScore, value: `${spreadGap > 0 ? '+' : ''}${spreadGap.toFixed(2)} bps`, tone: toneFor(spreadScore) },
      { label: 'Displayed depth', score: depthScore, value: `${Math.round(depthRatio * 100)}% of benchmark`, tone: toneFor(depthScore) },
      { label: 'Executable edge', score: edgeScore, value: `${edgeBps > 0 ? '+' : ''}${edgeBps.toFixed(2)} bps`, tone: toneFor(edgeScore) },
      { label: 'Quote freshness', score: freshness.score, value: `${Math.round(freshness.staleMs)} ms lag`, tone: toneFor(freshness.score) },
    ],
  };
}
