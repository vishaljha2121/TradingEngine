export type Asset = 'BTC/USD' | 'ETH/USD';
export type TradeSide = 'BUY' | 'SELL';
export type ExecutionMode = 'Execute Now' | 'Slice' | 'Defensive';
export type LatencyRegime = 'Nominal' | 'Medium' | 'Stressed';

export interface Quote {
  bid: number;
  ask: number;
  provider: 'Gemini' | 'Mock';
}

export interface TradeContext {
  asset: Asset;
  side: TradeSide;
  sizeUsd: number;
  latency: LatencyRegime;
}

export interface RiskState {
  currentInventoryUsd: number;
}

export interface RecommendationResult {
  mode: ExecutionMode;
  reason: string;
  expectedCost: number; // Rough generic heuristic score for demo
  riskScore: number;     // Rough generic heuristic score for demo
}
