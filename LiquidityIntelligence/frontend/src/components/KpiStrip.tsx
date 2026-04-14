import { formatPrice, formatLag } from '../utils/formatters';

interface KpiStripProps {
  tmMid: number;
  tmSpreadBps: number;
  benchMid: number;
  benchSpreadBps: number;
  spreadGap: number;
  midDeviation: number;
  lagMs: number;
  avgLag: number;
  flowRisk: { level: string; description: string };
}

function KpiCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#0B1220] border border-[#1F2A3A] rounded-lg px-3.5 py-3 flex flex-col justify-between min-h-[84px]">
      <span className="text-[11px] font-semibold text-[#8EA0B8] uppercase tracking-wide font-ui">{label}</span>
      {children}
    </div>
  );
}

export function KpiStrip({
  tmMid, tmSpreadBps, benchMid, benchSpreadBps,
  spreadGap, midDeviation, lagMs, avgLag, flowRisk
}: KpiStripProps) {
  const spreadColor = spreadGap <= 0 ? 'text-[#18C37E]' : spreadGap > 1.0 ? 'text-[#FF5C5C]' : 'text-[#F5B942]';
  const midColor = Math.abs(midDeviation) < 1 ? 'text-[#A8B3C2]' : midDeviation > 0 ? 'text-[#FF5C5C]' : 'text-[#F5B942]';
  const lagColor = lagMs <= 50 ? 'text-[#18C37E]' : lagMs > 100 ? 'text-[#FF5C5C]' : 'text-[#F5B942]';
  const riskColor = flowRisk.level === 'LOW' ? 'text-[#18C37E]' : flowRisk.level === 'HIGH' ? 'text-[#FF5C5C]' : 'text-[#F5B942]';
  const riskBand = flowRisk.level === 'LOW' ? 'bg-[#18C37E]' : flowRisk.level === 'HIGH' ? 'bg-[#FF5C5C]' : 'bg-[#F5B942]';

  return (
    <div className="grid grid-cols-6 gap-3 px-4 py-2 flex-shrink-0">
      {/* 1. TM Mid */}
      <KpiCard label="True Markets Mid">
        <span className="text-[22px] font-mono font-bold text-[#E5EDF7] tracking-tight">{formatPrice(tmMid)}</span>
        <span className="text-[11px] font-mono text-[#6F7C8E]">spread: {tmSpreadBps.toFixed(2)} bps</span>
      </KpiCard>

      {/* 2. Benchmark Mid */}
      <KpiCard label="Benchmark Mid">
        <span className="text-[22px] font-mono font-bold text-[#E5EDF7] tracking-tight">{formatPrice(benchMid)}</span>
        <span className="text-[11px] font-mono text-[#6F7C8E]">spread: {benchSpreadBps.toFixed(2)} bps</span>
      </KpiCard>

      {/* 3. Spread Gap */}
      <KpiCard label="Spread Gap">
        <div className="flex items-baseline gap-1.5">
          <span className={`text-[22px] font-mono font-bold ${spreadColor}`}>
            {spreadGap > 0 ? '+' : ''}{spreadGap.toFixed(2)}
          </span>
          <span className="text-[13px] text-[#6F7C8E] font-mono">bps</span>
        </div>
        <span className="text-[11px] text-[#6F7C8E] font-ui">TM − Benchmark</span>
      </KpiCard>

      {/* 4. Mid Deviation */}
      <KpiCard label="Mid Deviation">
        <div className="flex items-baseline gap-1.5">
          <span className={`text-[22px] font-mono font-bold ${midColor}`}>
            {midDeviation > 0 ? '+' : ''}{midDeviation.toFixed(2)}
          </span>
          <span className="text-[13px] text-[#6F7C8E] font-mono">bps</span>
        </div>
        <span className="text-[11px] text-[#6F7C8E] font-ui">signed deviation</span>
      </KpiCard>

      {/* 5. Reaction Lag */}
      <KpiCard label="Reaction Lag">
        <span className={`text-[22px] font-mono font-bold ${lagColor}`}>{formatLag(lagMs)}</span>
        <span className="text-[11px] text-[#6F7C8E] font-ui">Avg over last 60s: {avgLag}ms</span>
      </KpiCard>

      {/* 6. Flow Risk */}
      <KpiCard label="Flow Risk">
        <div className="flex items-center gap-2">
          <span className={`text-[22px] font-mono font-bold ${riskColor}`}>{flowRisk.level}</span>
          <div className={`h-2 w-12 rounded-full ${riskBand} opacity-60`} />
        </div>
        <span className="text-[11px] text-[#6F7C8E] font-ui">{flowRisk.description}</span>
      </KpiCard>
    </div>
  );
}
