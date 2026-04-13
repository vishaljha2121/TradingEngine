import type { TradeContext, Quote, RiskState, RecommendationResult } from './types';

const INVENTORY_CAP = 100000;
// const HIGH_VOL_SPREAD_BPS = 20;

export class ExecutionCoachDomainService {
  
  static evaluatePostures(
    context: TradeContext, 
    quote: Quote, 
    risk: RiskState
  ): RecommendationResult[] {
    // Generate evaluations for all 3 modes to display
    return [
      this.evaluateMode('Execute Now', context, quote, risk),
      this.evaluateMode('Slice', context, quote, risk),
      this.evaluateMode('Defensive', context, quote, risk)
    ];
  }

  static getRecommendedPosture(
    evaluations: RecommendationResult[],
    risk: RiskState,
    context: TradeContext
  ): RecommendationResult {
    // Risk Guard #1: If inventory exceeds cap, force defensive mode
    if (risk.currentInventoryUsd + context.sizeUsd > INVENTORY_CAP) {
      const defensive = evaluations.find(e => e.mode === 'Defensive')!;
      return {
        ...defensive,
        reason: 'Risk Guard: Inventory cap threshold breached. Defensive execution mandatory.'
      };
    }

    // Default heuristic: pick the mode that minimizes a hybrid cost-risk score
    // In reality, this would be our C# Local Simulation engine matching layer.
    let best = evaluations[0];
    let minScore = best.expectedCost + best.riskScore;

    for (const e of evaluations) {
      const score = e.expectedCost + e.riskScore;
      if (score < minScore) {
        minScore = score;
        best = e;
      }
    }

    return best;
  }

  private static evaluateMode(mode: 'Execute Now' | 'Slice' | 'Defensive', context: TradeContext, quote: Quote, _risk: RiskState): RecommendationResult {
    let expectedCost = 0;
    let riskScore = 0;
    let baselineSpread = Math.abs(quote.ask - quote.bid);

    // Simulated Latency Penetration factor
    const latencyPenalty = context.latency === 'Stressed' ? 3.5 : (context.latency === 'Medium' ? 1.8 : 1.0);
    
    // Size Penetration factor
    const sizeMultiplier = context.sizeUsd / 10000;

    switch (mode) {
      case 'Execute Now':
        expectedCost = (sizeMultiplier * baselineSpread) * latencyPenalty;
        riskScore = context.latency !== 'Nominal' ? 80 : 30; // High risk if latency exists
        return {
          mode,
          expectedCost,
          riskScore,
          reason: latencyPenalty > 1 
            ? 'Immediate execution under stressed latency risks massive slippage.'
            : 'Aggressive execution acceptable under nominal conditions.'
        };

      case 'Slice':
        // Slicing reduces size penalty but extends time exposure
        expectedCost = ((sizeMultiplier * 0.4) * baselineSpread) + (latencyPenalty * 5);
        riskScore = 20 + (latencyPenalty * 10);
        return {
          mode,
          expectedCost,
          riskScore,
          reason: sizeMultiplier > 2
            ? 'Slicing recommended because trade size is large relative to generic local depth.'
            : 'Standard smart-routing enabled.'
        };

      case 'Defensive':
        // Defensive takes no fast actions, reducing impact but possibly missing the price
        expectedCost = baselineSpread + (latencyPenalty * 15);
        riskScore = 5;
        return {
          mode,
          expectedCost,
          riskScore,
          reason: 'Protects against adverse selection, recommended when risk is elevated.'
        };
    }
  }
}
