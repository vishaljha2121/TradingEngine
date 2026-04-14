import type { VenueSnapshot } from '../types';
import type { StatusInfo } from '../utils/metrics';
import { computeSlippageAdvantage } from '../utils/metrics';
import { formatPrice } from '../utils/formatters';
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

  // Build verdict headline
  let headline = '';
  if (statusInfo.status === 'Competitive') {
    headline = 'True Markets is matching or outperforming the benchmark — competitive execution maintained.';
  } else if (statusInfo.status === 'Advantageous') {
    headline = 'True Markets is currently tighter and deeper than the benchmark — flow advantage detected.';
  } else if (statusInfo.status === 'Slightly Behind') {
    const reasons: string[] = [];
    if (spreadGap > 0.3) reasons.push('its spread is wider');
    if (depthRatio < 0.6) reasons.push('its liquidity is thinner');
    if (lagMs > 100) reasons.push('its quotes are lagging');
    headline = `True Markets is slightly behind the benchmark because ${reasons.join(' and ') || 'of minor dislocations'}.`;
  } else {
    const reasons: string[] = [];
    if (spreadGap > 1.0) reasons.push('its spread is significantly wider');
    if (depthRatio < 0.3) reasons.push('its depth is much thinner');
    if (lagMs > 200) reasons.push('it has severe quote lag');
    headline = `True Markets is significantly behind — ${reasons.join(', ') || 'multiple metrics degraded'}. Aggressive flow likely routes away.`;
  }

  // Evidence rows
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
      source: `Ratio: ${depthRatio.toFixed(2)}× | Slippage: ${slippageAdv >= 0 ? '+' : ''}${slippageAdv.toFixed(2)} bps`,
      ok: depthRatio >= 0.8,
    },
  ];

  // KPI cards
  const spreadColor = spreadGap <= 0 ? '#18C37E' : spreadGap > 1.0 ? '#FF5C5C' : '#F5B942';
  const midColor = Math.abs(midDeviation) < 1 ? '#A8B3C2' : '#FF5C5C';
  const lagColor = lagMs <= 50 ? '#18C37E' : lagMs > 100 ? '#FF5C5C' : '#F5B942';
  const riskColor = flowRisk.level === 'LOW' ? '#18C37E' : flowRisk.level === 'HIGH' ? '#FF5C5C' : '#F5B942';

  return (
    <div className="mx-4 mt-2 mb-1 flex-shrink-0">
      <div className="bg-[#0B1220] border border-[#1F2A3A] rounded-lg overflow-hidden flex" style={{ borderLeft: `4px solid ${statusInfo.status === 'Competitive' ? '#18C37E' : statusInfo.status === 'Advantageous' ? '#6EE7D2' : statusInfo.status === 'Slightly Behind' ? '#F5B942' : '#FF5C5C'}` }}>
        
        {/* Left: Verdict + Evidence (6/12) */}
        <div className="flex-[6] px-5 py-3.5 border-r border-[#1F2A3A]/50">
          {/* Status + Headline */}
          <div className="flex items-start gap-3 mb-3">
            <div className={`px-2.5 py-0.5 rounded text-[11px] font-semibold font-ui flex-shrink-0 mt-0.5 ${statusInfo.bgClass} ${statusInfo.textClass}`}>
              {statusInfo.status}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#4DA3FF] animate-pulse flex-shrink-0 mt-1" />
              <p className={`text-[15px] font-medium font-ui leading-snug ${statusInfo.textClass}`}>
                {headline}
              </p>
            </div>
          </div>

          {/* Evidence rows */}
          <div className="flex flex-col">
            {evidence.map((row, i) => (
              <div key={i} className="flex items-baseline gap-3 py-1.5 border-t border-[#1F2A3A]/30">
                <span className="text-[11px] font-bold text-[#8EA0B8] font-ui w-16 flex-shrink-0 uppercase tracking-wide">{row.signal}</span>
                <span className={`text-[13px] font-ui flex-1 ${row.ok ? 'text-[#18C37E]' : 'text-[#FF5C5C]'}`}>
                  {row.finding}
                </span>
                <span className="text-[11px] font-mono text-[#6F7C8E] flex-shrink-0">{row.source}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: 4 KPI cards in 2×2 grid (6/12) */}
        <div className="flex-[6] grid grid-cols-2 gap-0">
          {/* Spread Gap */}
          <div className="px-4 py-3 border-b border-r border-[#1F2A3A]/30" style={{ borderLeft: `3px solid ${spreadColor}` }}>
            <InfoTooltip title="Spread Gap" description="Difference between True Markets and benchmark bid-ask spreads, in basis points." formula="TM spread (bps) − Benchmark spread (bps)">
              <span className="text-[11px] font-semibold text-[#8EA0B8] uppercase tracking-wide font-ui">Spread Gap</span>
            </InfoTooltip>
            <div className="mt-1">
              <span className="text-[22px] font-mono font-bold tracking-tight" style={{ color: spreadColor }}>
                {spreadGap > 0 ? '+' : ''}{spreadGap.toFixed(2)}
              </span>
              <span className="text-[12px] font-mono text-[#6F7C8E] ml-1">bps</span>
            </div>
            <div className="text-[10px] text-[#6F7C8E] font-ui mt-0.5">Positive = TM wider</div>
          </div>

          {/* Mid-Price Deviation */}
          <div className="px-4 py-3 border-b border-[#1F2A3A]/30" style={{ borderLeft: `3px solid ${midColor}` }}>
            <InfoTooltip title="Mid-Price Deviation" description="How far True Markets mid-price diverges from the benchmark mid-price, in basis points." formula="((TM mid − Bench mid) / Bench mid) × 10,000">
              <span className="text-[11px] font-semibold text-[#8EA0B8] uppercase tracking-wide font-ui">Mid-Price Deviation</span>
            </InfoTooltip>
            <div className="mt-1">
              <span className="text-[22px] font-mono font-bold tracking-tight" style={{ color: midColor }}>
                {midDeviation > 0 ? '+' : ''}{midDeviation.toFixed(2)}
              </span>
              <span className="text-[12px] font-mono text-[#6F7C8E] ml-1">bps</span>
            </div>
            <div className="text-[10px] text-[#6F7C8E] font-ui mt-0.5">TM mid vs benchmark mid</div>
          </div>

          {/* Reaction Latency */}
          <div className="px-4 py-3 border-r border-[#1F2A3A]/30" style={{ borderLeft: `3px solid ${lagColor}` }}>
            <InfoTooltip title="Reaction Latency" description="Time delay between a benchmark price move and the corresponding True Markets quote update." formula="timestamp(TM update) − timestamp(Benchmark move)">
              <span className="text-[11px] font-semibold text-[#8EA0B8] uppercase tracking-wide font-ui">Reaction Latency</span>
            </InfoTooltip>
            <div className="mt-1">
              <span className="text-[22px] font-mono font-bold tracking-tight" style={{ color: lagColor }}>
                {lagMs}
              </span>
              <span className="text-[12px] font-mono text-[#6F7C8E] ml-1">ms</span>
            </div>
            <div className="text-[10px] text-[#6F7C8E] font-ui mt-0.5">Avg over 60s: {avgLag}ms</div>
          </div>

          {/* Flow Risk */}
          <div className="px-4 py-3" style={{ borderLeft: `3px solid ${riskColor}` }}>
            <InfoTooltip title="Flow Risk" description="Estimated likelihood that order flow will route to the benchmark instead of True Markets, based on spread, depth, and latency." formula="f(spreadGap, depthRatio, lagMs)">
              <span className="text-[11px] font-semibold text-[#8EA0B8] uppercase tracking-wide font-ui">Flow Risk</span>
            </InfoTooltip>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-[22px] font-mono font-bold tracking-tight" style={{ color: riskColor }}>
                {flowRisk.level}
              </span>
              <div className="h-2 w-10 rounded-full opacity-50" style={{ backgroundColor: riskColor }} />
            </div>
            <div className="text-[10px] text-[#6F7C8E] font-ui mt-0.5">{flowRisk.description}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
