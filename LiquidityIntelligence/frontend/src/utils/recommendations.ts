export type RecommendationSeverity = 'info' | 'warning' | 'critical';
export type RecommendationUrgency = 'Immediate action' | 'Monitor' | 'Investigate later';
export type EvidenceTone = 'good' | 'warn' | 'bad' | 'neutral';

export interface RecommendationEvidence {
  label: string;
  value: string;
  tone: EvidenceTone;
}

export interface OpsRecommendation {
  id: string;
  title: string;
  severity: RecommendationSeverity;
  urgency: RecommendationUrgency;
  operationalImpact: string;
  recommendedActions: string[];
  evidence: RecommendationEvidence[];
  rankScore: number;
}

export type RecommendationRefreshReason = 'Initial' | 'Manual' | 'Auto';

export interface OpsRecommendationSnapshot {
  id: string;
  capturedAt: number;
  refreshReason: RecommendationRefreshReason;
  asset: string;
  benchmarkName: string;
  recommendations: OpsRecommendation[];
}

export interface RecommendationHistoryPoint {
  timestamp: number;
  spreadGap: number;
  routingRisk: number;
  depthRatio: number;
  lagMs: number;
}

export interface RecommendationInput {
  asset: string;
  benchmarkName: string;
  spreadGap: number;
  midGap: number;
  lagMs: number;
  slippageBps: number;
  depthRatio: number;
  routingRisk: number;
  executionEdgeBps: number;
  tmFillPct: number;
  quoteFreshnessScore: number;
  lpHealthScore: number;
  feedMode: string;
  history?: RecommendationHistoryPoint[];
}

const severityWeight: Record<RecommendationSeverity, number> = {
  critical: 300,
  warning: 200,
  info: 100,
};

const urgencyWeight: Record<RecommendationUrgency, number> = {
  'Immediate action': 30,
  Monitor: 20,
  'Investigate later': 10,
};

function signed(value: number, digits = 2) {
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}`;
}

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

function classifyCritical(value: number, warningThreshold: number, criticalThreshold: number): RecommendationSeverity | null {
  if (value >= criticalThreshold) return 'critical';
  if (value >= warningThreshold) return 'warning';
  return null;
}

function pushRecommendation(items: OpsRecommendation[], item: OpsRecommendation | null) {
  if (item) items.push(item);
}

export function generateOpsRecommendations(input: RecommendationInput): OpsRecommendation[] {
  const recs: OpsRecommendation[] = [];
  const spreadSeverity = classifyCritical(input.spreadGap, 0.3, 1.0);
  const depthDeficit = Math.max(0, 0.8 - input.depthRatio);
  const lagSeverity = input.lagMs >= 200 || input.quoteFreshnessScore < 45
    ? 'critical'
    : input.lagMs >= 100 || input.quoteFreshnessScore < 65
      ? 'warning'
      : null;
  const executionPenalty = Math.max(0, -input.executionEdgeBps);
  const flowSeverity = classifyCritical(input.routingRisk, 35, 65);
  const midSeverity = classifyCritical(Math.abs(input.midGap), 2, 5);

  pushRecommendation(recs, spreadSeverity ? {
    id: 'spread-uncompetitive',
    title: `TrueMarkets spread is ${signed(input.spreadGap)} bps wider than ${input.benchmarkName}`,
    severity: spreadSeverity,
    urgency: spreadSeverity === 'critical' ? 'Immediate action' : 'Monitor',
    operationalImpact: 'Aggressive flow is more likely to route away when displayed spread is consistently wider than the benchmark.',
    recommendedActions: [
      'Review quoting width and inventory skew parameters on both sides of the book.',
      'Compare maker coverage during this regime against the last hour before changing routing defaults.',
      'If the wider spread persists, reduce preferred routing weight until competitiveness recovers.',
    ],
    evidence: [
      { label: 'Spread delta', value: `${signed(input.spreadGap)} bps`, tone: spreadSeverity === 'critical' ? 'bad' : 'warn' },
      { label: 'Execution edge', value: `${signed(input.executionEdgeBps)} bps`, tone: input.executionEdgeBps >= 0 ? 'good' : 'bad' },
      { label: 'Depth ratio', value: pct(input.depthRatio), tone: input.depthRatio >= 0.8 ? 'good' : input.depthRatio >= 0.5 ? 'warn' : 'bad' },
    ],
    rankScore: severityWeight[spreadSeverity] + urgencyWeight[spreadSeverity === 'critical' ? 'Immediate action' : 'Monitor'] + input.spreadGap * 18,
  } : null);

  pushRecommendation(recs, input.depthRatio < 0.8 ? {
    id: 'top-depth-thin',
    title: `Top-5 displayed depth is ${pct(input.depthRatio)} of ${input.benchmarkName}`,
    severity: input.depthRatio < 0.45 ? 'critical' : 'warning',
    urgency: input.depthRatio < 0.45 ? 'Immediate action' : 'Monitor',
    operationalImpact: 'Thin displayed depth increases partial-fill risk and makes larger child orders more expensive to execute.',
    recommendedActions: [
      'Inspect maker participation and stale level removal for the top five levels.',
      'Verify whether ask-side or bid-side depth is driving the deficit before changing incentives.',
      'Use smaller child order sizes until fillable quantity inside the selected bps band improves.',
    ],
    evidence: [
      { label: 'Depth ratio', value: pct(input.depthRatio), tone: input.depthRatio < 0.45 ? 'bad' : 'warn' },
      { label: 'TM fill', value: `${input.tmFillPct.toFixed(0)}%`, tone: input.tmFillPct >= 85 ? 'good' : input.tmFillPct >= 55 ? 'warn' : 'bad' },
      { label: 'Routing risk', value: `${Math.round(input.routingRisk)}/100`, tone: input.routingRisk >= 65 ? 'bad' : input.routingRisk >= 35 ? 'warn' : 'neutral' },
    ],
    rankScore: severityWeight[input.depthRatio < 0.45 ? 'critical' : 'warning'] + urgencyWeight[input.depthRatio < 0.45 ? 'Immediate action' : 'Monitor'] + depthDeficit * 90,
  } : null);

  pushRecommendation(recs, lagSeverity ? {
    id: 'quote-lag',
    title: `Quote freshness is degraded at ${Math.round(input.lagMs)} ms observed lag`,
    severity: lagSeverity,
    urgency: lagSeverity === 'critical' ? 'Immediate action' : 'Monitor',
    operationalImpact: 'Stale quotes reduce route confidence because the displayed edge may disappear before an order reaches the venue.',
    recommendedActions: [
      'Check benchmark feed timestamps, WebSocket reconnects, and local processing delay.',
      'Avoid increasing preferred routing weight while quote freshness is below the acceptable window.',
      'Confirm whether lag is isolated to this venue comparison or present across all pairs.',
    ],
    evidence: [
      { label: 'Quote lag', value: `${Math.round(input.lagMs)} ms`, tone: lagSeverity === 'critical' ? 'bad' : 'warn' },
      { label: 'Freshness score', value: `${input.quoteFreshnessScore}/100`, tone: input.quoteFreshnessScore >= 75 ? 'good' : input.quoteFreshnessScore >= 45 ? 'warn' : 'bad' },
      { label: 'Feed mode', value: input.feedMode, tone: input.feedMode === 'Fallback Mock' || input.feedMode === 'Connecting...' ? 'warn' : 'neutral' },
    ],
    rankScore: severityWeight[lagSeverity] + urgencyWeight[lagSeverity === 'critical' ? 'Immediate action' : 'Monitor'] + Math.min(80, input.lagMs / 3),
  } : null);

  pushRecommendation(recs, executionPenalty >= 0.35 ? {
    id: 'execution-cost-disadvantage',
    title: `${input.benchmarkName} is cheaper by ${executionPenalty.toFixed(2)} bps for the selected execution scenario`,
    severity: executionPenalty >= 1 ? 'critical' : 'warning',
    urgency: executionPenalty >= 1 ? 'Immediate action' : 'Monitor',
    operationalImpact: 'The current executable book implies adverse execution cost versus the benchmark for the selected order side and size.',
    recommendedActions: [
      'Route conservatively or split flow until TrueMarkets executable edge returns positive.',
      'Inspect market-impact curve and fillable quantity inside the selected bps threshold.',
      'Compare this scenario against smaller child sizes before deciding whether to pause flow.',
    ],
    evidence: [
      { label: 'Execution edge', value: `${signed(input.executionEdgeBps)} bps`, tone: 'bad' },
      { label: 'Slippage advantage', value: `${signed(input.slippageBps)} bps`, tone: input.slippageBps >= 0 ? 'good' : 'bad' },
      { label: 'TM fill', value: `${input.tmFillPct.toFixed(0)}%`, tone: input.tmFillPct >= 85 ? 'good' : input.tmFillPct >= 55 ? 'warn' : 'bad' },
    ],
    rankScore: severityWeight[executionPenalty >= 1 ? 'critical' : 'warning'] + urgencyWeight[executionPenalty >= 1 ? 'Immediate action' : 'Monitor'] + executionPenalty * 24,
  } : null);

  pushRecommendation(recs, flowSeverity ? {
    id: 'elevated-flow-risk',
    title: `Routing risk is ${Math.round(input.routingRisk)}/100`,
    severity: flowSeverity,
    urgency: flowSeverity === 'critical' ? 'Immediate action' : 'Monitor',
    operationalImpact: 'Composite routing pressure is elevated across spread, executable edge, displayed depth, and quote freshness.',
    recommendedActions: [
      'Use the simulator to test whether smaller order slices reduce expected impact.',
      'Check whether pressure is concentrated in spread, depth, lag, or execution edge before escalating.',
      'Keep a time-window report for evidence if the regime persists through the next review cycle.',
    ],
    evidence: [
      { label: 'Routing risk', value: `${Math.round(input.routingRisk)}/100`, tone: flowSeverity === 'critical' ? 'bad' : 'warn' },
      { label: 'Spread delta', value: `${signed(input.spreadGap)} bps`, tone: input.spreadGap <= 0 ? 'good' : input.spreadGap >= 1 ? 'bad' : 'warn' },
      { label: 'Quote freshness', value: `${input.quoteFreshnessScore}/100`, tone: input.quoteFreshnessScore >= 75 ? 'good' : input.quoteFreshnessScore >= 45 ? 'warn' : 'bad' },
    ],
    rankScore: severityWeight[flowSeverity] + urgencyWeight[flowSeverity === 'critical' ? 'Immediate action' : 'Monitor'] + input.routingRisk / 2,
  } : null);

  pushRecommendation(recs, midSeverity ? {
    id: 'mid-dislocation',
    title: `Mid-price deviation is ${signed(input.midGap)} bps versus ${input.benchmarkName}`,
    severity: midSeverity,
    urgency: midSeverity === 'critical' ? 'Immediate action' : 'Investigate later',
    operationalImpact: 'Mid-price dislocation can indicate feed skew, inventory skew, or stale reference pricing behind apparently competitive quotes.',
    recommendedActions: [
      'Check timestamp alignment between TrueMarkets and benchmark books.',
      'Inspect whether dislocation is one-sided or paired with wider spread.',
      'Avoid using spread-only competitiveness as the sole routing signal until mid alignment normalizes.',
    ],
    evidence: [
      { label: 'Mid deviation', value: `${signed(input.midGap)} bps`, tone: midSeverity === 'critical' ? 'bad' : 'warn' },
      { label: 'Spread delta', value: `${signed(input.spreadGap)} bps`, tone: input.spreadGap <= 0 ? 'good' : 'warn' },
      { label: 'Feed mode', value: input.feedMode, tone: input.feedMode === 'Fallback Mock' || input.feedMode === 'Connecting...' ? 'warn' : 'neutral' },
    ],
    rankScore: severityWeight[midSeverity] + urgencyWeight[midSeverity === 'critical' ? 'Immediate action' : 'Investigate later'] + Math.abs(input.midGap) * 8,
  } : null);

  const recent = input.history?.slice(-60) ?? [];
  if (recent.length >= 20) {
    const stressed = recent.filter((pt) => pt.spreadGap > 0.3 || pt.routingRisk > 35 || pt.depthRatio < 0.8 || pt.lagMs > 100).length;
    const stressRatio = stressed / recent.length;
    if (stressRatio >= 0.6) {
      pushRecommendation(recs, {
        id: 'unstable-regime',
        title: `Competitiveness pressure persisted across ${Math.round(stressRatio * 100)}% of recent samples`,
        severity: stressRatio >= 0.8 ? 'warning' : 'info',
        urgency: 'Investigate later',
        operationalImpact: 'Persistent pressure is more important than a single tick because it can affect routing policy and maker performance review.',
        recommendedActions: [
          'Export the one-hour report after the dashboard has observed enough data.',
          'Compare pressure periods against maker coverage and benchmark volatility.',
          'Escalate only if the same pressure persists across multiple assets or venues.',
        ],
        evidence: [
          { label: 'Recent stressed samples', value: `${Math.round(stressRatio * 100)}%`, tone: stressRatio >= 0.8 ? 'warn' : 'neutral' },
          { label: 'Samples observed', value: `${recent.length}`, tone: 'neutral' },
          { label: 'LP health', value: `${input.lpHealthScore}/100`, tone: input.lpHealthScore >= 75 ? 'good' : input.lpHealthScore >= 50 ? 'warn' : 'bad' },
        ],
        rankScore: severityWeight[stressRatio >= 0.8 ? 'warning' : 'info'] + urgencyWeight['Investigate later'] + stressRatio * 20,
      });
    }
  }

  if (recs.length === 0) {
    recs.push({
      id: 'healthy-monitoring',
      title: 'No immediate liquidity action required',
      severity: 'info',
      urgency: 'Monitor',
      operationalImpact: 'TrueMarkets is broadly aligned with the benchmark on spread, executable edge, depth, and quote freshness.',
      recommendedActions: [
        'Continue monitoring spread delta, executable edge, and depth ratio for regime change.',
        'Use the one-hour report once enough observations are collected to document stability.',
      ],
      evidence: [
        { label: 'Spread delta', value: `${signed(input.spreadGap)} bps`, tone: input.spreadGap <= 0 ? 'good' : 'neutral' },
        { label: 'Execution edge', value: `${signed(input.executionEdgeBps)} bps`, tone: input.executionEdgeBps >= 0 ? 'good' : 'neutral' },
        { label: 'LP health', value: `${input.lpHealthScore}/100`, tone: input.lpHealthScore >= 75 ? 'good' : input.lpHealthScore >= 50 ? 'warn' : 'bad' },
      ],
      rankScore: severityWeight.info + urgencyWeight.Monitor,
    });
  }

  return recs
    .sort((a, b) => b.rankScore - a.rankScore)
    .slice(0, 3);
}
