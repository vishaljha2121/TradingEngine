import type { VenueSnapshot } from '../types';
import type { StatusInfo } from '../utils/metrics';
import { computeSlippageAdvantage } from '../utils/metrics';
import { InfoTooltip } from './InfoTooltip';

interface InsightHeroProps {
  truemarkets: VenueSnapshot;
  benchmark: VenueSnapshot;
  spreadGap: number;
  midDeviation: number;
  lagMs: number;
  avgLag: number;
  depthRatio: number;
  statusInfo: StatusInfo;
  flowRisk: { level: string; description: string };
}

export function InsightHero({
  truemarkets, benchmark, spreadGap, midDeviation, lagMs, avgLag, depthRatio, statusInfo, flowRisk
}: InsightHeroProps) {
  const slippageAdv = computeSlippageAdvantage(truemarkets, benchmark);
  const askDepthRatio = benchmark.ask_depth_5 > 0 ? truemarkets.ask_depth_5 / benchmark.ask_depth_5 : 1;
  const slippageOk = slippageAdv >= 0;

  // Build verdict headline — now includes slippage when material
  let headline = '';
  if (statusInfo.status === 'Competitive') {
    if (slippageAdv > 0.5) {
      headline = `True Markets is competitive with the benchmark and offers ${slippageAdv.toFixed(2)} bps better execution — flow advantage detected.`;
    } else {
      headline = 'True Markets is matching or outperforming the benchmark — competitive execution maintained.';
    }
  } else if (statusInfo.status === 'Advantageous') {
    headline = `True Markets is tighter, deeper, and offers ${slippageAdv.toFixed(2)} bps lower slippage than the benchmark.`;
  } else if (statusInfo.status === 'Slightly Behind') {
    const reasons: string[] = [];
    if (spreadGap > 0.3) reasons.push('its spread is wider');
    if (depthRatio < 0.6) reasons.push('its liquidity is thinner');
    if (lagMs > 100) reasons.push('its quotes are lagging');
    if (slippageAdv < -0.3) reasons.push(`execution costs ${Math.abs(slippageAdv).toFixed(2)} bps more`);
    headline = `True Markets is slightly behind the benchmark because ${reasons.join(' and ') || 'of minor dislocations'}.`;
  } else {
    const reasons: string[] = [];
    if (spreadGap > 1.0) reasons.push('its spread is significantly wider');
    if (depthRatio < 0.3) reasons.push('its depth is much thinner');
    if (lagMs > 200) reasons.push('it has severe quote lag');
    if (slippageAdv < -0.5) reasons.push(`estimated slippage penalty is ${Math.abs(slippageAdv).toFixed(2)} bps`);
    headline = `True Markets is significantly behind — ${reasons.join(', ') || 'multiple metrics degraded'}. Aggressive flow likely routes away.`;
  }

  // Evidence rows — slippage is now its own dedicated row
  const evidence = [
    {
      signal: 'Spread',
      finding: spreadGap <= 0
        ? 'Competitive — matches or beats benchmark'
        : `Wider by ${spreadGap.toFixed(2)} bps`,
      source: `TM: ${truemarkets.spread_bps.toFixed(2)} bps | Bench: ${benchmark.spread_bps.toFixed(2)} bps`,
      ok: spreadGap <= 0,
    },
    {
      signal: 'Slippage',
      finding: slippageOk
        ? slippageAdv > 0.5
          ? `Execution saves +${slippageAdv.toFixed(2)} bps vs benchmark`
          : `Comparable — within ${slippageAdv.toFixed(2)} bps of benchmark`
        : `Execution costs ${Math.abs(slippageAdv).toFixed(2)} bps more than benchmark`,
      source: `VWAP fill at L1 depth | Advantage: ${slippageAdv >= 0 ? '+' : ''}${slippageAdv.toFixed(2)} bps`,
      ok: slippageOk,
    },
    {
      signal: 'Latency',
      finding: lagMs <= 50
        ? 'No lag event detected'
        : lagMs <= 100
          ? `Minor lag: ${lagMs}ms`
          : `Significant lag: ${lagMs}ms behind benchmark`,
      source: `Current: ${lagMs}ms | Avg: ${avgLag}ms`,
      ok: lagMs <= 50,
    },
    {
      signal: 'Depth',
      finding: depthRatio >= 0.8
        ? 'Top-5 depth comparable to benchmark'
        : `Ask depth ${((1 - askDepthRatio) * 100).toFixed(0)}% thinner than benchmark`,
      source: `Ratio: ${depthRatio.toFixed(2)}×`,
      ok: depthRatio >= 0.8,
    },
  ];

  // KPI card colors
  const spreadColor = spreadGap <= 0 ? '#18C37E' : spreadGap > 1.0 ? '#FF5C5C' : '#F5B942';
  const slipColor = slippageOk ? '#18C37E' : '#FF5C5C';
  const lagColor = lagMs <= 50 ? '#18C37E' : lagMs > 100 ? '#FF5C5C' : '#F5B942';
  const midColor = Math.abs(midDeviation) < 1 ? '#A8B3C2' : '#FF5C5C';
  const riskColor = flowRisk.level === 'LOW' ? '#18C37E' : flowRisk.level === 'HIGH' ? '#FF5C5C' : '#F5B942';

  const accentColor = statusInfo.status === 'Competitive' ? '#18C37E' : statusInfo.status === 'Advantageous' ? '#6EE7D2' : statusInfo.status === 'Slightly Behind' ? '#F5B942' : '#FF5C5C';

  return (
    <div className="mx-4 mt-2 mb-1 flex-shrink-0">
      <div className="bg-[#0B1220] border border-[#1F2A3A] rounded-lg overflow-hidden flex" style={{ borderLeft: `4px solid ${accentColor}` }}>
        
        {/* Left: Verdict + Evidence (5/12) */}
        <div className="flex-[5] px-5 py-3 border-r border-[#1F2A3A]/50 flex flex-col">
          {/* Status + Headline */}
          <div className="flex items-start gap-3 mb-2.5">
            <div className={`px-2.5 py-0.5 rounded text-[11px] font-semibold font-ui flex-shrink-0 mt-0.5 ${statusInfo.bgClass} ${statusInfo.textClass}`}>
              {statusInfo.status}
            </div>
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#4DA3FF] animate-pulse flex-shrink-0 mt-1.5" />
              <p className={`text-[14px] font-medium font-ui leading-snug ${statusInfo.textClass}`}>
                {headline}
              </p>
            </div>
          </div>

          {/* Evidence rows */}
          <div className="flex flex-col flex-1">
            {evidence.map((row, i) => (
              <div key={i} className="flex items-baseline gap-3 py-1 border-t border-[#1F2A3A]/30">
                <span className="text-[10px] font-bold text-[#8EA0B8] font-ui w-16 flex-shrink-0 uppercase tracking-wide">{row.signal}</span>
                <span className={`text-[12px] font-ui flex-1 ${row.ok ? 'text-[#18C37E]' : 'text-[#FF5C5C]'}`}>
                  {row.finding}
                </span>
                <span className="text-[10px] font-mono text-[#6F7C8E] flex-shrink-0">{row.source}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: 5 KPI cards — top row of 3 (Spread, SLIPPAGE, Latency) + bottom row of 2 (Mid Dev, Flow Risk) */}
        <div className="flex-[7] flex flex-col">
          {/* Top row: 3 cards — Slippage gets center position with extra emphasis */}
          <div className="flex border-b border-[#1F2A3A]/30 flex-1">
            {/* Spread Gap */}
            <div className="flex-1 px-3.5 py-2.5 border-r border-[#1F2A3A]/30" style={{ borderLeft: `3px solid ${spreadColor}` }}>
              <InfoTooltip title="Spread Gap" description="Difference between True Markets and benchmark bid-ask spreads." formula="TM spread (bps) − Benchmark spread (bps)">
                <span className="text-[10px] font-semibold text-[#8EA0B8] uppercase tracking-wide font-ui">Spread Gap</span>
              </InfoTooltip>
              <div className="mt-1">
                <span className="text-[20px] font-mono font-bold tracking-tight" style={{ color: spreadColor }}>
                  {spreadGap > 0 ? '+' : ''}{spreadGap.toFixed(2)}
                </span>
                <span className="text-[11px] font-mono text-[#6F7C8E] ml-1">bps</span>
              </div>
              <div className="text-[9px] text-[#6F7C8E] font-ui mt-0.5">Positive = TM wider</div>
            </div>

            {/* ★ SLIPPAGE ADVANTAGE — center position, visually elevated */}
            <div className="flex-[1.3] px-4 py-2.5 border-r border-[#1F2A3A]/30 relative" style={{ borderLeft: `3px solid ${slipColor}`, background: slippageOk ? 'rgba(24, 195, 126, 0.04)' : 'rgba(255, 92, 92, 0.04)' }}>
              <InfoTooltip 
                title="Slippage Advantage" 
                description="Estimated execution cost savings when routing through True Markets instead of the benchmark. Calculated by comparing VWAP fill prices for an order sized at the benchmark's Level-1 total depth. Positive values mean True Markets is cheaper to execute on."
                formula="benchmarkSlippage(bps) − tmSlippage(bps)"
              >
                <span className="text-[10px] font-semibold text-[#8EA0B8] uppercase tracking-wide font-ui">Slippage Advantage</span>
              </InfoTooltip>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-[24px] font-mono font-bold tracking-tight" style={{ color: slipColor }}>
                  {slippageAdv >= 0 ? '+' : ''}{slippageAdv.toFixed(2)}
                </span>
                <span className="text-[12px] font-mono text-[#6F7C8E]">bps</span>
              </div>
              <div className="text-[9px] font-ui mt-0.5" style={{ color: slipColor }}>
                {slippageOk ? '✓ Cheaper to execute on TM' : '✗ More expensive on TM'}
              </div>
              {/* Subtle glow indicator */}
              <div className="absolute top-2 right-3 w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: slipColor, opacity: 0.6 }} />
            </div>

            {/* Reaction Latency */}
            <div className="flex-1 px-3.5 py-2.5" style={{ borderLeft: `3px solid ${lagColor}` }}>
              <InfoTooltip title="Reaction Latency" description="Time delay between a benchmark price move and the corresponding True Markets quote update." formula="timestamp(TM update) − timestamp(Benchmark move)">
                <span className="text-[10px] font-semibold text-[#8EA0B8] uppercase tracking-wide font-ui">Reaction Latency</span>
              </InfoTooltip>
              <div className="mt-1">
                <span className="text-[20px] font-mono font-bold tracking-tight" style={{ color: lagColor }}>
                  {lagMs}
                </span>
                <span className="text-[11px] font-mono text-[#6F7C8E] ml-1">ms</span>
              </div>
              <div className="text-[9px] text-[#6F7C8E] font-ui mt-0.5">Avg over 60s: {avgLag}ms</div>
            </div>
          </div>

          {/* Bottom row: 2 cards — Mid Deviation + Flow Risk */}
          <div className="flex flex-1">
            {/* Mid-Price Deviation */}
            <div className="flex-1 px-3.5 py-2 border-r border-[#1F2A3A]/30" style={{ borderLeft: `3px solid ${midColor}` }}>
              <InfoTooltip title="Mid-Price Deviation" description="How far True Markets mid-price diverges from the benchmark mid-price." formula="((TM mid − Bench mid) / Bench mid) × 10,000">
                <span className="text-[10px] font-semibold text-[#8EA0B8] uppercase tracking-wide font-ui">Mid-Price Deviation</span>
              </InfoTooltip>
              <div className="mt-0.5">
                <span className="text-[18px] font-mono font-bold tracking-tight" style={{ color: midColor }}>
                  {midDeviation > 0 ? '+' : ''}{midDeviation.toFixed(2)}
                </span>
                <span className="text-[11px] font-mono text-[#6F7C8E] ml-1">bps</span>
              </div>
            </div>

            {/* Flow Risk */}
            <div className="flex-1 px-3.5 py-2" style={{ borderLeft: `3px solid ${riskColor}` }}>
              <InfoTooltip title="Flow Risk" description="Estimated likelihood that order flow will route to the benchmark instead of True Markets." formula="f(spreadGap, depthRatio, lagMs)">
                <span className="text-[10px] font-semibold text-[#8EA0B8] uppercase tracking-wide font-ui">Flow Risk</span>
              </InfoTooltip>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="text-[18px] font-mono font-bold tracking-tight" style={{ color: riskColor }}>
                  {flowRisk.level}
                </span>
                <div className="h-1.5 w-8 rounded-full opacity-50" style={{ backgroundColor: riskColor }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
