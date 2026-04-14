export interface Level {
  0: number; // price
  1: number; // qty
}

export interface VenueSnapshot {
  venue: string;
  mid: number;
  spread_bps: number;
  bid_depth_5: number;
  ask_depth_5: number;
  bids: Level[];
  asks: Level[];
}

export interface Insight {
  status: string;
  reason: string;
  color: string;
}

export interface IntelligencePayload {
  timestamp: number;
  benchmark: VenueSnapshot;
  truemarkets: VenueSnapshot;
  insights: Insight;
  lag_ms?: number;
}

export interface ChartPoint {
  time: string;
  spreadGap: number;
  midGap: number;
  lagMs: number;
  slipAdv?: number;
}
