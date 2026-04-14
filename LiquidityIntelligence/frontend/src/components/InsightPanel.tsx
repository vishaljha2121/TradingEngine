import type { VenueSnapshot } from '../types';
import { computeSlippageAdvantage } from '../utils/metrics';
import type { StatusInfo } from '../utils/metrics';

interface InsightPanelProps {
  truemarkets: VenueSnapshot;
  benchmark: VenueSnapshot;
  spreadGap: number;
  lagMs: number;
  depthRatio: number;
  statusInfo: StatusInfo;
}

export function InsightPanel({ truemarkets, benchmark, spreadGap, lagMs, depthRatio, statusInfo }: InsightPanelProps) {
  const slippageAdv = computeSlippageAdvantage(truemarkets, benchmark);
  const askDepthRatio = benchmark.ask_depth_5 > 0 ? truemarkets.ask_depth_5 / benchmark.ask_depth_5 : 1;

  // Build headline
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
    headline = `True Markets is significantly behind — ${reasons.join(', ') || 'multiple metrics degraded'}. Flow likely routes away.`;
  }

  // Structured evidence rows
  const rows = [
    {
      signal: 'Spread',
      finding: spreadGap <= 0
        ? 'Competitive — TM spread matches or beats benchmark'
        : `TM spread wider by ${spreadGap.toFixed(2)} bps`,
      metric: `Gap: ${spreadGap > 0 ? '+' : ''}${spreadGap.toFixed(2)} bps`,
      ok: spreadGap <= 0,
    },
    {
      signal: 'Lag',
      finding: lagMs <= 50
        ? 'No lag event detected'
        : lagMs <= 100
          ? `Minor lag: ${lagMs}ms`
          : `Significant lag: ${lagMs}ms behind benchmark`,
      metric: `Lag: ${lagMs}ms`,
      ok: lagMs <= 50,
    },
    {
      signal: 'Depth',
      finding: depthRatio >= 0.8
        ? 'Top-5 depth comparable to benchmark'
        : `Ask depth ${((1 - askDepthRatio) * 100).toFixed(0)}% thinner than benchmark`,
      metric: `Ratio: ${depthRatio.toFixed(2)}× | Slip: ${slippageAdv >= 0 ? '+' : ''}${slippageAdv.toFixed(2)} bps`,
      ok: depthRatio >= 0.8,
    },
  ];

  return (
    <div className="bg-[#0B1220] border border-[#1F2A3A] rounded-lg flex flex-col overflow-hidden h-full">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 border-b border-[#1F2A3A]/50 flex items-center gap-2 flex-shrink-0">
        <div className="w-2 h-2 rounded-full bg-[#4DA3FF] animate-pulse" />
        <span className="text-[13px] font-semibold text-[#E5EDF7] font-ui">Liquidity Insight Engine</span>
      </div>

      {/* Headline */}
      <div className="px-4 pt-3 pb-2 flex-shrink-0">
        <p className={`text-[14px] font-medium font-ui leading-relaxed ${statusInfo.textClass}`}>
          {headline}
        </p>
      </div>

      {/* Evidence rows */}
      <div className="flex-1 flex flex-col px-4 pb-3">
        {rows.map((row, i) => (
          <div key={i} className="flex items-baseline justify-between py-1.5 border-b border-[#1F2A3A]/30 last:border-b-0">
            <div className="flex items-baseline gap-3 flex-1 min-w-0">
              <span className="text-[11px] font-bold text-[#8EA0B8] font-ui w-14 flex-shrink-0">{row.signal}</span>
              <span className={`text-[12px] font-ui ${row.ok ? 'text-[#18C37E]' : 'text-[#FF5C5C]'}`}>
                {row.finding}
              </span>
            </div>
            <span className="text-[11px] font-mono text-[#6F7C8E] flex-shrink-0 ml-4">{row.metric}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
