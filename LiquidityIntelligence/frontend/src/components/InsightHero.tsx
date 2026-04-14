import type { VenueSnapshot } from '../types';
import type { StatusInfo } from '../utils/metrics';
import { computeSlippageAdvantage } from '../utils/metrics';
import { InfoTooltip } from './InfoTooltip';

interface InsightHeroProps {
  truemarkets: VenueSnapshot;
  benchmark: VenueSnapshot;
  spreadGap: number;
  lagMs: number;
  avgLag: number;
  depthRatio: number;
  statusInfo: StatusInfo;
  flowRisk: { level: string; description: string };
}

export function InsightHero({
  truemarkets, benchmark, spreadGap, lagMs, avgLag, depthRatio, statusInfo, flowRisk
}: InsightHeroProps) {
  const slippageAdv = computeSlippageAdvantage(truemarkets, benchmark);
  const askDepthRatio = benchmark.ask_depth_5 > 0 ? truemarkets.ask_depth_5 / benchmark.ask_depth_5 : 1;

  // Build premium verbiage
  let headline = '';
  let subtext = '';
  if (statusInfo.status === 'Competitive') {
    headline = 'Competitive Flow Alignment Maintained';
    subtext = 'True Markets pricing matches the institutional baseline with no significant microstructure penalty.';
  } else if (statusInfo.status === 'Advantageous') {
    headline = 'Liquidity Advantage Detected';
    subtext = 'True Markets is capturing flow via tighter pricing and superior top-of-book depth.';
  } else if (statusInfo.status === 'Slightly Behind') {
    headline = 'Marginal Competitiveness Gap';
    subtext = 'Minor dislocations in pricing or latency are putting top-tier routing at risk.';
  } else {
    headline = 'Severe Microstructure Degradation';
    subtext = 'Multiple core liquidity parameters have failed benchmark standards. Aggressive flow is routing away.';
  }

  // Key Driver Chips
  const chips = [
    { label: 'Spread', val: spreadGap <= 0 ? 'Tighter' : `+${spreadGap.toFixed(2)} bps`, ok: spreadGap <= 0 },
    { label: 'Slippage', val: `${slippageAdv >= 0 ? '+' : ''}${slippageAdv.toFixed(2)} bps`, ok: slippageAdv >= 0 },
    { label: 'Latency', val: `${lagMs}ms`, ok: lagMs <= 100 },
  ];

  // KPI cards metrics
  const spreadColor = spreadGap <= 0 ? '#18C37E' : spreadGap > 1.0 ? '#FF5C5C' : '#F5B942';
  const slipColor = slippageAdv >= 0 ? '#18C37E' : slippageAdv < -0.5 ? '#FF5C5C' : '#F5B942';
  const lagColor = lagMs <= 50 ? '#18C37E' : lagMs > 100 ? '#FF5C5C' : '#F5B942';
  const riskColor = flowRisk.level === 'LOW' ? '#18C37E' : flowRisk.level === 'HIGH' ? '#FF5C5C' : '#F5B942';
  const heroColor = statusInfo.status === 'Competitive' ? '#18C37E' : statusInfo.status === 'Advantageous' ? '#6EE7D2' : statusInfo.status === 'Slightly Behind' ? '#F5B942' : '#FF5C5C';

  return (
    <div className="mx-4 mt-4 mb-2 flex-shrink-0">
      <div className="bg-[#0B1220] border border-[#1F2A3A]/70 rounded-xl overflow-hidden flex relative" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
        
        {/* Subtle background gradient on left side for premium feel */}
        <div className="absolute inset-y-0 left-0 w-1/2 opacity-[0.03] pointer-events-none" style={{ background: `linear-gradient(90deg, ${heroColor}, transparent)` }} />

        {/* Left: Verdict, Summary, Drivers (5/12) */}
        <div className="flex-[5] flex flex-col justify-center px-6 py-5 border-r border-[#1F2A3A]/40 relative z-10" style={{ borderLeft: `4px solid ${heroColor}` }}>
          {/* Status + Headline */}
          <div className="flex flex-col items-start gap-2 mb-3">
            <div className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-widest font-bold font-ui ${statusInfo.bgClass} ${statusInfo.textClass}`}>
              {statusInfo.status}
            </div>
            <h1 className="text-[18px] font-semibold font-ui text-[#E5EDF7] tracking-tight leading-none mt-1">
              {headline}
            </h1>
            <p className="text-[12px] font-ui text-[#A8B3C2] leading-snug max-w-[90%]">
              {subtext}
            </p>
          </div>

          {/* Key Driver Chips */}
          <div className="flex gap-2 mt-2">
            {chips.map((chip, i) => (
              <div key={i} className={`flex items-center gap-1.5 px-2 py-1 rounded bg-[#0E1728] border ${chip.ok ? 'border-[#18C37E]/20' : 'border-[#FF5C5C]/20'} shadow-sm`}>
                <span className="text-[10px] uppercase tracking-wide font-ui text-[#6F7C8E]">{chip.label}</span>
                <span className={`text-[12px] font-mono font-bold ${chip.ok ? 'text-[#18C37E]' : 'text-[#FF5C5C]'}`}>{chip.val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: 4 KPI cards in 1x4 horizontal layout (7/12) */}
        <div className="flex-[7] flex z-10 bg-[#0B1220]/80">
          {/* Slippage Advantage (Promoted KPI) */}
          <div className="flex-1 px-5 py-4 border-r border-[#1F2A3A]/40 flex flex-col justify-center relative overflow-hidden group">
            <div className="absolute inset-y-0 left-0 w-[2px]" style={{ backgroundColor: slipColor }} />
            <InfoTooltip title="Slippage Advantage" description="Estimated slippage cost difference vs benchmark. Positive number = True Markets executes tighter size." formula="benchSlippage − tmSlippage">
              <span className="text-[11px] font-semibold text-[#8EA0B8] uppercase tracking-wider font-ui group-hover:text-[#A8B3C2] transition-colors duration-200">Slippage</span>
            </InfoTooltip>
            <div className="mt-1 flex items-baseline">
              <span className="text-[26px] font-mono font-bold tracking-tight" style={{ color: slipColor }}>
                {slippageAdv > 0 ? '+' : ''}{slippageAdv.toFixed(2)}
              </span>
              <span className="text-[12px] font-mono text-[#6F7C8E] ml-1.5">bps</span>
            </div>
            <div className="text-[10px] text-[#6F7C8E] font-ui mt-0.5">Execution savings vs baseline</div>
          </div>

          {/* Spread Gap */}
          <div className="flex-1 px-5 py-4 border-r border-[#1F2A3A]/40 flex flex-col justify-center relative overflow-hidden group">
            <div className="absolute inset-y-0 left-0 w-[2px]" style={{ backgroundColor: spreadColor }} />
            <InfoTooltip title="Spread Gap" description="Difference between True Markets and benchmark bid-ask spreads." formula="TM spread (bps) − Benchmark spread (bps)">
              <span className="text-[11px] font-semibold text-[#8EA0B8] uppercase tracking-wider font-ui group-hover:text-[#A8B3C2] transition-colors duration-200">Spread Gap</span>
            </InfoTooltip>
            <div className="mt-1 flex items-baseline">
              <span className="text-[26px] font-mono font-bold tracking-tight" style={{ color: spreadColor }}>
                {spreadGap > 0 ? '+' : ''}{spreadGap.toFixed(2)}
              </span>
              <span className="text-[12px] font-mono text-[#6F7C8E] ml-1.5">bps</span>
            </div>
            <div className="text-[10px] text-[#6F7C8E] font-ui mt-0.5">Positive = TM wider</div>
          </div>

          {/* Reaction Latency */}
          <div className="flex-1 px-5 py-4 border-r border-[#1F2A3A]/40 flex flex-col justify-center relative overflow-hidden group">
             <div className="absolute inset-y-0 left-0 w-[2px]" style={{ backgroundColor: lagColor }} />
            <InfoTooltip title="Reaction Latency" description="Time delay between a benchmark price move and the corresponding True Markets quote update.">
              <span className="text-[11px] font-semibold text-[#8EA0B8] uppercase tracking-wider font-ui group-hover:text-[#A8B3C2] transition-colors duration-200">Latency</span>
            </InfoTooltip>
            <div className="mt-1 flex items-baseline">
              <span className="text-[26px] font-mono font-bold tracking-tight" style={{ color: lagColor }}>
                {lagMs}
              </span>
              <span className="text-[12px] font-mono text-[#6F7C8E] ml-1.5">ms</span>
            </div>
            <div className="text-[10px] text-[#6F7C8E] font-ui mt-0.5">Avg over 60s: {avgLag}ms</div>
          </div>

          {/* Flow Risk */}
          <div className="flex-1 px-5 py-4 flex flex-col justify-center relative overflow-hidden group">
             <div className="absolute inset-y-0 left-0 w-[2px]" style={{ backgroundColor: riskColor }} />
            <InfoTooltip title="Flow Risk" description="Estimated likelihood that order flow will route to the benchmark instead of True Markets.">
              <span className="text-[11px] font-semibold text-[#8EA0B8] uppercase tracking-wider font-ui group-hover:text-[#A8B3C2] transition-colors duration-200">Flow Risk</span>
            </InfoTooltip>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-[22px] font-mono font-bold tracking-tight" style={{ color: riskColor }}>
                {flowRisk.level}
              </span>
              <div className="flex-1 flex gap-0.5 max-w-[40px]">
                 {/* Risk bars */}
                 <div className={`h-[12px] flex-1 rounded-sm ${riskColor === '#18C37E' ? 'bg-[#18C37E]' : 'bg-[#18C37E]/20'}`} />
                 <div className={`h-[12px] flex-1 rounded-sm ${riskColor === '#F5B942' ? 'bg-[#F5B942]' : riskColor === '#FF5C5C' ? 'bg-[#F5B942]' : 'bg-[#F5B942]/20'}`} />
                 <div className={`h-[12px] flex-1 rounded-sm ${riskColor === '#FF5C5C' ? 'bg-[#FF5C5C]' : 'bg-[#FF5C5C]/20'}`} />
              </div>
            </div>
            <div className="text-[10px] text-[#6F7C8E] font-ui mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">{flowRisk.description}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
