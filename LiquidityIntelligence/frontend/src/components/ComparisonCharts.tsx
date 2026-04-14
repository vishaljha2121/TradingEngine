import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, CartesianGrid } from 'recharts';
import type { ChartPoint } from '../types';
import { InfoTooltip } from './InfoTooltip';

interface ComparisonChartsProps {
  history: ChartPoint[];
}

function SpreadTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const isPenalty = p.value > 0;
  return (
    <div className="bg-[#0B1220] border border-[#1F2A3A] rounded shadow-xl font-ui overflow-hidden min-w-[140px]">
      <div className={`px-2 py-1 text-[10px] uppercase font-bold text-[#0B1220] ${isPenalty ? 'bg-[#FF5C5C]' : 'bg-[#18C37E]'}`}>
        {isPenalty ? 'Penalty Zone' : 'Advantage Zone'}
      </div>
      <div className="px-3 py-2 flex items-center justify-between relative">
        <span className="text-[#6F7C8E] text-[10px] font-mono">{label}</span>
        <span className="text-[#E5EDF7] font-mono font-bold text-[12px] tabular-nums">{p.value > 0 ? '+' : ''}{p.value?.toFixed(2)} bps</span>
      </div>
    </div>
  );
}

function SlipTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const isGood = p.value >= 0;
  return (
    <div className="bg-[#0B1220] border border-[#1F2A3A] rounded shadow-xl font-ui overflow-hidden min-w-[140px]">
      <div className={`px-2 py-1 text-[10px] uppercase font-bold text-[#0B1220] ${isGood ? 'bg-[#18C37E]' : 'bg-[#FF5C5C]'}`}>
        {isGood ? 'Execution Savings' : 'Execution Penalty'}
      </div>
      <div className="px-3 py-2 flex items-center justify-between relative">
        <span className="text-[#6F7C8E] text-[10px] font-mono">{label}</span>
        <span className="text-[#E5EDF7] font-mono font-bold text-[12px] tabular-nums">{p.value > 0 ? '+' : ''}{p.value?.toFixed(2)} bps</span>
      </div>
    </div>
  );
}

export function ComparisonCharts({ history }: ComparisonChartsProps) {
  const latest = history.length > 0 ? history[history.length - 1] : null;
  const spread = latest?.spreadGap || 0;
  const slip = latest?.slipAdv || 0;
  
  // Calculate max/min for domains
  const spreadMax = Math.max(...history.map(d => d.spreadGap), 1.5);
  const spreadMin = Math.min(...history.map(d => d.spreadGap), -0.5);
  
  const slipMax = Math.max(...history.map((d: any) => d.slipAdv || 0), 1.5);
  const slipMin = Math.min(...history.map((d: any) => d.slipAdv || 0), -0.5);

  const spreadOffset = spreadMax - spreadMin === 0 ? 0 : spreadMax / (spreadMax - spreadMin);
  const slipOffset = slipMax - slipMin === 0 ? 0 : slipMax / (slipMax - slipMin);

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      {/* 1. Spread Gap Chart (Top) */}
      <div className="flex-1 min-h-0 flex flex-col bg-[#0B1220] border border-[#1F2A3A]/70 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-[#1F2A3A]/40 flex items-center justify-between flex-shrink-0 bg-[#0E1728]/30">
          <div className="flex items-center gap-3">
            <InfoTooltip title="Spread Gap Trajectory" description="Difference between True Markets and benchmark bid-ask spreads. Background zones denote structural advantage vs penalty.">
              <h2 className="text-[13px] font-bold tracking-widest uppercase text-[#E5EDF7] font-ui">Spread Alignment Intelligence</h2>
            </InfoTooltip>
            <div className="h-4 w-px bg-[#1F2A3A]" />
            <div className="flex gap-2">
              <span className="flex items-center gap-1 text-[10px] text-[#A8B3C2] font-ui uppercase font-semibold">
                <div className="w-2 h-2 rounded-full bg-[#18C37E]/40 border border-[#18C37E]" /> Advantage Zone
              </span>
              <span className="flex items-center gap-1 text-[10px] text-[#A8B3C2] font-ui uppercase font-semibold">
                <div className="w-2 h-2 rounded-full bg-[#FF5C5C]/40 border border-[#FF5C5C]" /> Penalty Zone
              </span>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] uppercase font-ui font-semibold text-[#6F7C8E]">Current Delta</span>
            <span className={`text-[15px] font-mono font-black tabular-nums ${spread <= 0 ? 'text-[#18C37E]' : 'text-[#FF5C5C]'}`}>
              {spread > 0 ? '+' : ''}{spread.toFixed(2)} bps
            </span>
          </div>
        </div>

        <div className="flex-1 min-h-[50px] px-2 pt-4 pb-2 relative">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <ReferenceArea y1={0} y2={Math.max(spreadMax * 1.2, 2)} fill="#FF5C5C" fillOpacity={0.03} />
              <ReferenceArea y1={Math.min(spreadMin * 1.2, -1)} y2={0} fill="#18C37E" fillOpacity={0.03} />
              <CartesianGrid horizontal={true} vertical={false} stroke="#1F2A3A" strokeDasharray="4 4" opacity={0.4} />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#6F7C8E', fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={{ stroke: '#1F2A3A', strokeWidth: 1 }} interval="preserveEnd" minTickGap={80} />
              <YAxis domain={['dataMin - 0.5', 'dataMax + 0.5']} tick={{ fontSize: 10, fill: '#A8B3C2', fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} width={40} tickFormatter={(val) => val.toFixed(1)} />
              <ReferenceLine y={0} stroke="#E5EDF7" strokeWidth={1} strokeDasharray="6 6" opacity={0.5} label={{ value: 'Parity Baseline', position: 'insideTopLeft', fill: '#8EA0B8', fontSize: 10, fontFamily: 'ui-sans-serif', dy: -12 }} />
              <Tooltip content={<SpreadTooltip />} cursor={{ stroke: '#6F7C8E', strokeWidth: 1, strokeDasharray: '3 3' }} />
              <defs>
                <linearGradient id="splitColorSpread" x1="0" y1="0" x2="0" y2="1">
                  <stop offset={spreadOffset} stopColor="#FF5C5C" stopOpacity={1} />
                  <stop offset={spreadOffset} stopColor="#18C37E" stopOpacity={1} />
                </linearGradient>
                <linearGradient id="splitFillSpread" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF5C5C" stopOpacity={0.2} />
                  <stop offset={spreadOffset} stopColor="#FF5C5C" stopOpacity={0} />
                  <stop offset={spreadOffset} stopColor="#18C37E" stopOpacity={0} />
                  <stop offset="100%" stopColor="#18C37E" stopOpacity={0.2} />
                </linearGradient>
              </defs>
              <Area type="step" dataKey="spreadGap" stroke="url(#splitColorSpread)" strokeWidth={2} fill="url(#splitFillSpread)" dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. Slippage Impact Evolution (Bottom) */}
      <div className="flex-1 min-h-0 flex flex-col bg-[#0B1220] border border-[#1F2A3A]/70 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-[#1F2A3A]/40 flex items-center justify-between flex-shrink-0 bg-[#0E1728]/30">
          <div className="flex items-center gap-3">
            <InfoTooltip title="Slippage Cost Evolution" description="Tracks the effective execution cost vs benchmark. Positive numbers indicate True Markets saves execution cost.">
              <h2 className="text-[13px] font-bold tracking-widest uppercase text-[#E5EDF7] font-ui">Slippage Impact Trajectory</h2>
            </InfoTooltip>
            <div className="h-4 w-px bg-[#1F2A3A]" />
            <div className="flex gap-2">
              <span className="flex items-center gap-1 text-[10px] text-[#A8B3C2] font-ui uppercase font-semibold">
                <div className="w-2 h-2 rounded-full bg-[#18C37E]/40 border border-[#18C37E]" /> Savings Zone
              </span>
              <span className="flex items-center gap-1 text-[10px] text-[#A8B3C2] font-ui uppercase font-semibold">
                <div className="w-2 h-2 rounded-full bg-[#FF5C5C]/40 border border-[#FF5C5C]" /> Cost Penalty Zone
              </span>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] uppercase font-ui font-semibold text-[#6F7C8E]">Current Savings</span>
            <span className={`text-[15px] font-mono font-black tabular-nums ${slip >= 0 ? 'text-[#18C37E]' : 'text-[#FF5C5C]'}`}>
              {slip >= 0 ? '+' : ''}{slip.toFixed(2)} bps
            </span>
          </div>
        </div>

        <div className="flex-1 min-h-[50px] px-2 pt-4 pb-2 relative">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              {/* Note: For Slippage, Above 0 is Good (Green), Below 0 is Bad (Red) */}
              <ReferenceArea y1={0} y2={Math.max(slipMax * 1.2, 2)} fill="#18C37E" fillOpacity={0.03} />
              <ReferenceArea y1={Math.min(slipMin * 1.2, -1)} y2={0} fill="#FF5C5C" fillOpacity={0.03} />
              <CartesianGrid horizontal={true} vertical={false} stroke="#1F2A3A" strokeDasharray="4 4" opacity={0.4} />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#6F7C8E', fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={{ stroke: '#1F2A3A', strokeWidth: 1 }} interval="preserveEnd" minTickGap={80} />
              <YAxis domain={['dataMin - 0.5', 'dataMax + 0.5']} tick={{ fontSize: 10, fill: '#A8B3C2', fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} width={40} tickFormatter={(val) => val.toFixed(1)} />
              <ReferenceLine y={0} stroke="#E5EDF7" strokeWidth={1} strokeDasharray="6 6" opacity={0.5} label={{ value: 'Parity Baseline', position: 'insideTopLeft', fill: '#8EA0B8', fontSize: 10, fontFamily: 'ui-sans-serif', dy: -12 }} />
              <Tooltip content={<SlipTooltip />} cursor={{ stroke: '#6F7C8E', strokeWidth: 1, strokeDasharray: '3 3' }} />
              <defs>
                <linearGradient id="splitColorSlip" x1="0" y1="0" x2="0" y2="1">
                  <stop offset={slipOffset} stopColor="#18C37E" stopOpacity={1} />
                  <stop offset={slipOffset} stopColor="#FF5C5C" stopOpacity={1} />
                </linearGradient>
                <linearGradient id="splitFillSlip" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#18C37E" stopOpacity={0.2} />
                  <stop offset={slipOffset} stopColor="#18C37E" stopOpacity={0} />
                  <stop offset={slipOffset} stopColor="#FF5C5C" stopOpacity={0} />
                  <stop offset="100%" stopColor="#FF5C5C" stopOpacity={0.2} />
                </linearGradient>
              </defs>
              <Area type="step" dataKey="slipAdv" stroke="url(#splitColorSlip)" strokeWidth={2} fill="url(#splitFillSlip)" dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}
