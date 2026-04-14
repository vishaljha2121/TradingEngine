const definitions = [
  { abbr: 'bps', full: 'Basis Points', desc: 'One hundredth of a percent (0.01%). Used to measure spreads and price deviations.' },
  { abbr: 'Mid', full: 'Mid Price', desc: '(Best Bid + Best Ask) / 2. The theoretical fair value between buyers and sellers.' },
  { abbr: 'Eff. Spread', full: 'Effective Spread', desc: 'Depth-adjusted spread proxy using VWAP across visible book levels. More realistic than top-of-book spread.' },
  { abbr: 'IMB', full: 'Imbalance', desc: 'Top-of-book volume imbalance. Positive = stronger bid pressure.', formula: '(bidQty − askQty) / (bidQty + askQty)' },
  { abbr: 'VWAP', full: 'Volume-Weighted Average Price', desc: 'Average price weighted by order size at each level. Used for estimating execution cost.' },
  { abbr: 'Lag', full: 'Reaction Lag', desc: 'Time delay between a benchmark mid-price move and the corresponding True Markets quote adjustment.' },
  { abbr: 'TM', full: 'True Markets', desc: 'The venue being analyzed for liquidity competitiveness.' },
];

export function LegendPanel() {
  return (
    <div className="bg-[#0B1220] border border-[#1F2A3A] rounded-lg flex flex-col overflow-hidden h-full">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 border-b border-[#1F2A3A]/50 flex-shrink-0">
        <span className="text-[13px] font-semibold text-[#E5EDF7] font-ui">Legend</span>
      </div>

      {/* Definitions */}
      <div className="flex-1 overflow-auto px-4 py-2">
        {definitions.map((def, i) => (
          <div key={i} className="py-1.5 border-b border-[#1F2A3A]/20 last:border-b-0">
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] font-mono font-bold text-[#4DA3FF]">{def.abbr}</span>
              <span className="text-[11px] text-[#A8B3C2] font-ui">{def.full}</span>
            </div>
            <p className="text-[10px] text-[#6F7C8E] font-ui mt-0.5 leading-relaxed">{def.desc}</p>
            {def.formula && (
              <code className="text-[10px] font-mono text-[#8EA0B8] mt-0.5 block">{def.formula}</code>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
