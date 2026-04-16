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
  latencyHistory?: number[]; 
}

function MiniSparkline({ data, max = 200, color = "#F28D3A" }: { data: number[], max?: number, color?: string }) {
  if (!data || data.length === 0) return null;
  const pts = data.slice(-30); 
  const points = pts.map((val, i) => {
    const x = (i / (pts.length - 1)) * 100;
    const y = 100 - (Math.min(val, max) / max) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg className="w-full h-[22px] opacity-80 mt-1 drop-shadow-md" viewBox="0 0 100 100" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="5" strokeLinejoin="round" />
      <line x1="0" y1="50" x2="100" y2="50" stroke="#F3A14A" strokeDasharray="3 3" strokeWidth="2" opacity="0.4" />
    </svg>
  );
}

export function InsightHero({
  truemarkets, benchmark, spreadGap, lagMs, statusInfo, flowRisk, latencyHistory = []
}: InsightHeroProps) {
  const slippageAdv = computeSlippageAdvantage(truemarkets, benchmark);
  const absSlip = Math.abs(slippageAdv);
  const slipOk = slippageAdv >= 0;
  const spreadOk = spreadGap <= 0;

  let executiveSummary = '';
  if (statusInfo.status === 'Advantageous') {
    executiveSummary = 'True Markets maintains tighter execution pricing and deeper liquidity, capturing maximum flow routing.';
  } else if (statusInfo.status === 'Competitive') {
    executiveSummary = 'True Markets execution quality is strictly aligned with the benchmark, maintaining parity across core metrics.';
  } else if (statusInfo.status === 'Pressured') {
    executiveSummary = 'True Markets is currently less competitive than the benchmark on spread and execution cost. Routing attractiveness is pressured.';
  } else {
    executiveSummary = 'Severe spread dislocation and execution penalties are neutralizing execution quality, driving flow away from True Markets.';
  }

  const drivers = [
    { 
      label: slipOk ? 'EXECUTION SAVINGS' : 'EXECUTION PENALTY', 
      val: `${absSlip.toFixed(2)} bps`, 
      desc: slipOk ? 'Favorable versus benchmark' : 'Worse than benchmark',
      color: slipOk ? 'text-[#5E7DFF]' : 'text-[#F28D3A]',
      bg: slipOk ? 'bg-[#5E7DFF]/10 border-[#5E7DFF]/20' : 'bg-[#F28D3A]/10 border-[#F28D3A]/20'
    },
    { 
      label: 'SPREAD DELTA', 
      val: spreadOk ? 'Tighter' : `+${spreadGap.toFixed(2)} bps`, 
      desc: spreadOk ? 'Matching Benchmark' : 'Wider than Benchmark',
      color: spreadOk ? 'text-[#5E7DFF]' : 'text-[#F28D3A]',
      bg: spreadOk ? 'bg-[#5E7DFF]/10 border-[#5E7DFF]/20' : 'bg-[#F28D3A]/10 border-[#F28D3A]/20'
    },
    { 
      label: 'LATENCY', 
      val: `${lagMs}ms`, 
      desc: lagMs <= 100 ? 'Nominal Delay' : 'Spiking Delay',
      color: lagMs <= 50 ? 'text-[#5E7DFF]' : lagMs > 100 ? 'text-[#F28D3A]' : 'text-[#F3A14A]',
      bg: lagMs <= 50 ? 'bg-[#5E7DFF]/10 border-[#5E7DFF]/20' : lagMs > 100 ? 'bg-[#F28D3A]/10 border-[#F28D3A]/20' : 'bg-[#F3A14A]/10 border-[#F3A14A]/20'
    },
  ];

  const slipTheme = slipOk ? { border: '#5E7DFF', bg: 'rgba(94, 125, 255, 0.055)', text: '#5E7DFF' } : { border: '#F28D3A', bg: 'rgba(242, 141, 58, 0.07)', text: '#F28D3A' };
  const spreadTheme = spreadOk ? { border: '#5E7DFF', bg: 'rgba(94, 125, 255, 0.055)', text: '#5E7DFF' } : { border: '#F28D3A', bg: 'rgba(242, 141, 58, 0.07)', text: '#F28D3A' };
  const heroColor = statusInfo.status === 'Competitive' ? '#5E7DFF' : statusInfo.status === 'Advantageous' ? '#6EE7D2' : statusInfo.status === 'Pressured' ? '#F3A14A' : '#F28D3A';

  return (
    <div className="mx-4 mt-3 mb-2 flex-shrink-0">
      <div className="bg-[#111027] border border-[#252343]/80 rounded-xl overflow-hidden flex relative shadow-sm">
        
        {/* Left: Command Center Verdict (4/12) */}
        <div className="flex-[4] flex flex-col justify-center px-8 py-6 border-r border-[#252343]/40 relative z-10 bg-[#0E1728]/30">
          <div className="absolute top-0 left-0 bottom-0 w-[4px]" style={{ backgroundColor: heroColor }} />
          
          <div className="mb-6">
            <span className={`px-2.5 py-1 rounded text-[11px] uppercase tracking-widest font-bold font-ui mb-3 inline-block ${statusInfo.bgClass} ${statusInfo.textClass}`}>
              {statusInfo.status}
            </span>
            <h1 className="text-[19px] font-bold font-ui text-[#E5EDF7] tracking-tight leading-snug">
              Venue Competitiveness {statusInfo.status}
            </h1>
            <p className="text-[14px] font-ui text-[#A8B3C2] leading-relaxed mt-2 font-medium">
              {executiveSummary}
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            {drivers.map((drv, i) => (
              <div key={i} className={`flex items-center justify-between h-[42px] px-4 rounded-lg border shadow-sm ${drv.bg}`}>
                <span className={`text-[11px] uppercase font-bold font-ui tracking-wider ${drv.color}`}>{drv.label}</span>
                <span className="text-[12px] font-ui text-[#8EA0B8] flex-1 text-center font-medium mx-2 truncate">{drv.desc}</span>
                <span className={`text-[14px] font-mono font-bold tabular-nums flex-shrink-0 text-right min-w-[65px] whitespace-nowrap ${drv.color}`}>{drv.val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Premium KPIs (8/12) */}
        <div className="flex-[8] flex">
          {/* 1. SLIPPAGE */}
          <div className="flex-1 px-9 pt-7 pb-6 border-r border-[#252343]/40 flex flex-col relative" style={{ backgroundColor: slipTheme.bg }}>
            <div className="absolute inset-y-0 left-0 w-[4px]" style={{ backgroundColor: slipTheme.border }} />
            <InfoTooltip title="Net Slippage Analysis" description="Absolute magnitude of execution cost or savings against the benchmark.">
              <span className="text-[13px] font-bold text-[#A8B3C2] uppercase tracking-widest font-ui">Slippage Cost Impact</span>
            </InfoTooltip>
            <div className="mt-auto mb-1">
              <div className="flex items-baseline mb-3">
                <span className="text-[40px] font-mono font-black tracking-tighter tabular-nums" style={{ color: slipTheme.text, textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                  {absSlip.toFixed(2)}
                </span>
                <span className="text-[16px] font-mono text-[#A8B3C2] ml-2 font-bold">bps</span>
              </div>
              <div className={`text-[12px] font-ui font-semibold inline-flex items-center px-3.5 py-1.5 rounded-full border shadow-sm ${slipOk ? 'bg-[#5E7DFF]/10 text-[#5E7DFF] border-[#5E7DFF]/30' : 'bg-[#F28D3A]/10 text-[#F28D3A] border-[#F28D3A]/30'}`}>
                {slipOk ? 'Execution Cost Savings' : 'Net Execution Penalty'}
              </div>
            </div>
          </div>

          {/* 2. SPREAD */}
          <div className="flex-1 px-9 pt-7 pb-6 border-r border-[#252343]/40 flex flex-col relative" style={{ backgroundColor: spreadTheme.bg }}>
            <div className="absolute inset-y-0 left-0 w-[4px]" style={{ backgroundColor: spreadTheme.border }} />
            <InfoTooltip title="Spread Gap" description="Real-time absolute difference between True Markets and benchmark bid-ask spreads.">
              <span className="text-[13px] font-bold text-[#A8B3C2] uppercase tracking-widest font-ui">Spread Delta</span>
            </InfoTooltip>
            <div className="mt-auto mb-1">
              <div className="flex items-baseline mb-3">
                <span className="text-[40px] font-mono font-black tracking-tighter tabular-nums" style={{ color: spreadTheme.text, textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                  {spreadGap > 0 ? '+' : ''}{spreadGap.toFixed(2)}
                </span>
                <span className="text-[16px] font-mono text-[#A8B3C2] ml-2 font-bold">bps</span>
              </div>
              <div className={`text-[12px] font-ui font-semibold inline-flex items-center px-3.5 py-1.5 rounded-full border shadow-sm ${spreadOk ? 'bg-[#5E7DFF]/10 text-[#5E7DFF] border-[#5E7DFF]/30' : 'bg-[#F28D3A]/10 text-[#F28D3A] border-[#F28D3A]/30'}`}>
                {spreadOk ? 'Matching Benchmark' : 'Wider Pricing Detected'}
              </div>
            </div>
          </div>

          {/* 3. LATENCY */}
          <div className="flex-[0.9] px-8 pt-7 pb-6 border-r border-[#252343]/40 flex flex-col relative bg-[#111027]">
            <InfoTooltip title="Reaction Latency Profile" description="Microstructure quotation execution delay with historical trend visualization.">
              <span className="text-[14px] font-bold text-[#A8B3C2] uppercase tracking-widest font-ui">Latency</span>
            </InfoTooltip>
            <div className="mt-auto">
              <div className="flex items-baseline mb-3">
                <span className={`text-[32px] font-mono font-black tracking-tight tabular-nums ${lagMs <= 50 ? 'text-[#5E7DFF]' : lagMs > 100 ? 'text-[#F28D3A]' : 'text-[#F3A14A]'}`}>
                  {lagMs}
                </span>
                <span className="text-[15px] font-mono text-[#8EA0B8] ml-1.5 font-semibold">ms</span>
              </div>
              <MiniSparkline data={latencyHistory} max={200} color={lagMs <= 50 ? '#5E7DFF' : lagMs > 100 ? '#F28D3A' : '#F3A14A'} />
            </div>
          </div>

          {/* 4. ROUTING RISK */}
          <div className="flex-[1.1] px-8 pt-7 pb-6 flex flex-col relative bg-[#111027]">
            <InfoTooltip title="Routing Deflection Risk" description="Analytical probability model determining if aggressive flow will route to the benchmark.">
              <span className="text-[14px] font-bold text-[#A8B3C2] uppercase tracking-widest font-ui">Routing Risk</span>
            </InfoTooltip>
            <div className="mt-auto mb-1">
              <div className={`text-[26px] font-mono font-black tracking-widest tabular-nums ${flowRisk.level === 'LOW' ? 'text-[#5E7DFF]' : flowRisk.level === 'HIGH' ? 'text-[#F28D3A]' : 'text-[#F3A14A]'}`}>
                {flowRisk.level}
              </div>
              <div className="text-[14px] text-[#A8B3C2] font-ui mt-3 leading-relaxed font-medium">
                {flowRisk.description}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
