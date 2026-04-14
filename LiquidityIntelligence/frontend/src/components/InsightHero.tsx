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
  latencyHistory?: number[]; // Added for sparkline
}

function MiniSparkline({ data, max = 200, color = "#FF5C5C" }: { data: number[], max?: number, color?: string }) {
  if (!data || data.length === 0) return null;
  const pts = data.slice(-30); // Last 30 points
  const points = pts.map((val, i) => {
    const x = (i / (pts.length - 1)) * 100;
    const y = 100 - (Math.min(val, max) / max) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg className="w-full h-[18px] opacity-70" viewBox="0 0 100 100" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="6" strokeLinejoin="round" />
      <line x1="0" y1="50" x2="100" y2="50" stroke="#F5B942" strokeDasharray="4 4" strokeWidth="2" opacity="0.5" />
    </svg>
  );
}

export function InsightHero({
  truemarkets, benchmark, spreadGap, lagMs, avgLag, depthRatio, statusInfo, flowRisk, latencyHistory = []
}: InsightHeroProps) {
  const slippageAdv = computeSlippageAdvantage(truemarkets, benchmark);
  const askDepthRatio = benchmark.ask_depth_5 > 0 ? truemarkets.ask_depth_5 / benchmark.ask_depth_5 : 1;

  // Direct, authoritative titles replacing abstract terms
  let title = '';
  let subtext = '';
  if (statusInfo.status === 'Competitive') {
    title = 'Execution Quality Standard Aligned';
    subtext = 'System pricing matches institutional benchmark. Flow leakage risk is minimal.';
  } else if (statusInfo.status === 'Advantageous') {
    title = 'Execution Quality High Advantage';
    subtext = 'System aggressively capturing flow via tighter spreads and deeper books.';
  } else if (statusInfo.status === 'Slightly Behind') {
    title = 'Market Quality Slightly Degraded';
    subtext = 'Marginal dislocations observed. Routing advantage currently favoring benchmark.';
  } else {
    title = 'Severe Microstructure Degradation';
    subtext = 'Multiple core liquidity parameters failing. Aggressive flow actively routing away.';
  }

  // Ranked Drivers vertically stacked
  const spreadOk = spreadGap <= 0;
  const slipOk = slippageAdv >= 0;
  
  const drivers = [
    { 
      label: 'SLIPPAGE', 
      val: `${slippageAdv >= 0 ? '+' : ''}${slippageAdv.toFixed(2)} bps`, 
      desc: slipOk ? 'Execution Advantage' : 'Execution Penalty',
      color: slipOk ? 'text-[#18C37E]' : 'text-[#FF5C5C]',
      bg: slipOk ? 'bg-[#18C37E]/10 border-[#18C37E]/20' : 'bg-[#FF5C5C]/10 border-[#FF5C5C]/20'
    },
    { 
      label: 'SPREAD', 
      val: spreadOk ? 'Tighter' : `+${spreadGap.toFixed(2)} bps`, 
      desc: spreadOk ? 'Matching Benchmark' : 'Wider than Benchmark',
      color: spreadOk ? 'text-[#18C37E]' : 'text-[#FF5C5C]',
      bg: spreadOk ? 'bg-[#18C37E]/10 border-[#18C37E]/20' : 'bg-[#FF5C5C]/10 border-[#FF5C5C]/20'
    },
    { 
      label: 'LATENCY', 
      val: `${lagMs}ms`, 
      desc: lagMs <= 100 ? 'Nominal' : 'Spiking',
      color: lagMs <= 50 ? 'text-[#18C37E]' : lagMs > 100 ? 'text-[#FF5C5C]' : 'text-[#F5B942]',
      bg: lagMs <= 50 ? 'bg-[#18C37E]/10 border-[#18C37E]/20' : lagMs > 100 ? 'bg-[#FF5C5C]/10 border-[#FF5C5C]/20' : 'bg-[#F5B942]/10 border-[#F5B942]/20'
    },
  ];

  // Strong Semantic colors for entire KPI cards
  const slipTheme = slippageAdv >= 0 ? { border: '#18C37E', bg: 'rgba(24, 195, 126, 0.04)', text: '#18C37E' } : { border: '#FF5C5C', bg: 'rgba(255, 92, 92, 0.05)', text: '#FF5C5C' };
  const spreadTheme = spreadGap <= 0 ? { border: '#18C37E', bg: 'rgba(24, 195, 126, 0.04)', text: '#18C37E' } : { border: '#FF5C5C', bg: 'rgba(255, 92, 92, 0.05)', text: '#FF5C5C' };
  const heroColor = statusInfo.status === 'Competitive' ? '#18C37E' : statusInfo.status === 'Advantageous' ? '#6EE7D2' : statusInfo.status === 'Slightly Behind' ? '#F5B942' : '#FF5C5C';

  return (
    <div className="mx-4 mt-3 mb-2 flex-shrink-0">
      <div className="bg-[#0B1220] border border-[#1F2A3A]/80 rounded-xl overflow-hidden flex relative shadow-sm">
        
        {/* Left: Command Center Verdict (4/12) */}
        <div className="flex-[4] flex flex-col justify-center px-6 py-4 border-r border-[#1F2A3A]/40 relative z-10 bg-[#0E1728]/30">
          <div className="absolute top-0 left-0 bottom-0 w-[4px]" style={{ backgroundColor: heroColor }} />
          
          <div className="mb-4">
            <span className={`px-2.5 py-0.5 rounded text-[10px] uppercase tracking-widest font-bold font-ui mb-2 inline-block ${statusInfo.bgClass} ${statusInfo.textClass}`}>
              {statusInfo.status}
            </span>
            <h1 className="text-[17px] font-bold font-ui text-[#E5EDF7] tracking-tight leading-snug">
              {title}
            </h1>
            <p className="text-[12px] font-ui text-[#8EA0B8] leading-snug mt-1">
              {subtext}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            {drivers.map((drv, i) => (
              <div key={i} className={`flex items-center justify-between px-3 py-1.5 rounded border ${drv.bg}`}>
                <span className={`text-[10px] uppercase font-bold font-ui tracking-wider ${drv.color}`}>{drv.label}</span>
                <span className="text-[10px] font-ui text-[#A8B3C2] flex-1 text-center">{drv.desc}</span>
                <span className={`text-[12px] font-mono font-bold ${drv.color}`}>{drv.val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Premium KPIs (8/12) */}
        <div className="flex-[8] flex">
          {/* 1. SLIPPAGE */}
          <div className="flex-1 px-5 pt-3 pb-4 border-r border-[#1F2A3A]/40 flex flex-col relative" style={{ backgroundColor: slipTheme.bg }}>
            <div className="absolute inset-y-0 left-0 w-[3px]" style={{ backgroundColor: slipTheme.border }} />
            <InfoTooltip title="Net Slippage Advantage" description="Hard execution cost execution difference vs the benchmark." formula="benchSlippage − tmSlippage">
              <span className="text-[11px] font-bold text-[#8EA0B8] uppercase tracking-widest font-ui">Slippage Impact</span>
            </InfoTooltip>
            <div className="mt-auto mb-1">
              <div className="flex items-baseline">
                <span className="text-[32px] font-mono font-black tracking-tight" style={{ color: slipTheme.text }}>
                  {slippageAdv > 0 ? '+' : ''}{slippageAdv.toFixed(2)}
                </span>
                <span className="text-[13px] font-mono text-[#8EA0B8] ml-1.5 font-semibold">bps</span>
              </div>
              <div className="text-[11px] text-[#A8B3C2] font-ui font-semibold mt-0.5">
                {slippageAdv >= 0 ? 'Cost Savings' : 'Cost Penalty'}
              </div>
            </div>
          </div>

          {/* 2. SPREAD */}
          <div className="flex-1 px-5 pt-3 pb-4 border-r border-[#1F2A3A]/40 flex flex-col relative" style={{ backgroundColor: spreadTheme.bg }}>
            <div className="absolute inset-y-0 left-0 w-[3px]" style={{ backgroundColor: spreadTheme.border }} />
            <InfoTooltip title="Spread Gap" description="Difference between True Markets and benchmark bid-ask spreads.">
              <span className="text-[11px] font-bold text-[#8EA0B8] uppercase tracking-widest font-ui">Spread Delta</span>
            </InfoTooltip>
            <div className="mt-auto mb-1">
              <div className="flex items-baseline">
                <span className="text-[32px] font-mono font-black tracking-tight" style={{ color: spreadTheme.text }}>
                  {spreadGap > 0 ? '+' : ''}{spreadGap.toFixed(2)}
                </span>
                <span className="text-[13px] font-mono text-[#8EA0B8] ml-1.5 font-semibold">bps</span>
              </div>
              <div className="text-[11px] text-[#A8B3C2] font-ui font-semibold mt-0.5">
                {spreadGap <= 0 ? 'Tighter or Equal' : 'Wider than Bench'}
              </div>
            </div>
          </div>

          {/* 3. LATENCY */}
          <div className="flex-[0.8] px-5 pt-3 pb-4 border-r border-[#1F2A3A]/40 flex flex-col relative bg-[#0B1220]">
            <InfoTooltip title="Microstructure Latency" description="Quote update delay. Includes latest history sparkline.">
              <span className="text-[11px] font-bold text-[#8EA0B8] uppercase tracking-widest font-ui">Latency</span>
            </InfoTooltip>
            <div className="mt-auto">
              <div className="flex items-baseline mb-1">
                <span className={`text-[24px] font-mono font-bold tracking-tight ${lagMs <= 50 ? 'text-[#18C37E]' : lagMs > 100 ? 'text-[#FF5C5C]' : 'text-[#F5B942]'}`}>
                  {lagMs}
                </span>
                <span className="text-[12px] font-mono text-[#6F7C8E] ml-1">ms</span>
              </div>
              <MiniSparkline data={latencyHistory} max={200} color={lagMs <= 50 ? '#18C37E' : lagMs > 100 ? '#FF5C5C' : '#F5B942'} />
            </div>
          </div>

          {/* 4. ROUTING RISK */}
          <div className="flex-1 px-5 pt-3 pb-4 flex flex-col relative bg-[#0B1220]">
            <InfoTooltip title="Routing Risk Analytics" description="Probability of execution routing away.">
              <span className="text-[11px] font-bold text-[#8EA0B8] uppercase tracking-widest font-ui">Routing Risk</span>
            </InfoTooltip>
            <div className="mt-auto mb-1">
              <div className={`text-[20px] font-mono font-black tracking-widest ${flowRisk.level === 'LOW' ? 'text-[#18C37E]' : flowRisk.level === 'HIGH' ? 'text-[#FF5C5C]' : 'text-[#F5B942]'}`}>
                {flowRisk.level}
              </div>
              <div className="text-[11px] text-[#A8B3C2] font-ui mt-1 leading-snug">
                {flowRisk.description}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
