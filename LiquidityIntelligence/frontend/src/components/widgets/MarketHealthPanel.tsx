import { Activity, Radio, ShieldCheck, Users } from 'lucide-react';
import type React from 'react';
import type { VenueSnapshot } from '../../types';
import {
  analyzeExecution,
  computeLiquidityProviderHealth,
  computeQuoteFreshness,
  type ExecutionSide,
} from '../../utils/executionAnalytics';

interface MarketHealthPanelProps {
  truemarkets: VenueSnapshot;
  benchmark: VenueSnapshot;
  side: ExecutionSide;
  size: number;
  spreadGap: number;
  depthRatio: number;
  lagMs: number;
  feedMode: string;
}

export function MarketHealthPanel({
  truemarkets,
  benchmark,
  side,
  size,
  spreadGap,
  depthRatio,
  lagMs,
  feedMode,
}: MarketHealthPanelProps) {
  const freshness = computeQuoteFreshness(lagMs, feedMode);
  const execution = analyzeExecution(truemarkets, benchmark, side, size, 5);
  const health = computeLiquidityProviderHealth(spreadGap, execution.edgeBps, depthRatio, freshness);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="grid flex-shrink-0 grid-cols-2 border-b border-divider/50">
        <ScoreBlock
          icon={<Radio className="h-4 w-4" />}
          label="Quote Freshness"
          score={freshness.score}
          status={freshness.label}
          description={freshness.reason}
          tone={freshness.score >= 75 ? 'good' : freshness.score >= 45 ? 'warn' : 'bad'}
        />
        <ScoreBlock
          icon={<Users className="h-4 w-4" />}
          label="LP Health"
          score={health.score}
          status={health.label}
          description="Composite maker quality from spread, depth, edge, and freshness."
          tone={health.score >= 75 ? 'good' : health.score >= 50 ? 'warn' : 'bad'}
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[1fr_1fr]">
        <div className="border-b border-divider/50 p-4 md:border-b-0 md:border-r">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-info" />
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-txt-primary">Liquidity Provider Health</div>
              <div className="text-[10px] text-txt-muted">Operational view of maker reliability</div>
            </div>
          </div>
          <div className="space-y-3">
            {health.factors.map((factor) => (
              <FactorRow key={factor.label} {...factor} />
            ))}
          </div>
        </div>

        <div className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#F28D3A]" />
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-txt-primary">Execution Reliability</div>
              <div className="text-[10px] text-txt-muted">Freshness and fill quality under selected assumptions</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <ReliabilityTile label="Lag" value={`${Math.round(lagMs)} ms`} tone={freshness.score >= 75 ? 'good' : freshness.score >= 45 ? 'warn' : 'bad'} />
            <ReliabilityTile label="Feed" value={feedMode === 'Live (Backend)' ? 'Live' : feedMode} tone={feedMode === 'Fallback Mock' ? 'warn' : 'good'} />
            <ReliabilityTile label="TM Fill" value={`${execution.tm.fillPct.toFixed(0)}%`} tone={execution.tm.fillPct >= 85 ? 'good' : execution.tm.fillPct >= 55 ? 'warn' : 'bad'} />
            <ReliabilityTile label="Depth" value={`${Math.round(depthRatio * 100)}%`} tone={depthRatio >= 0.8 ? 'good' : depthRatio >= 0.5 ? 'warn' : 'bad'} />
          </div>

          <div className="mt-3 rounded border border-divider/60 bg-[#09081D]/60 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-txt-muted">Interpretation</div>
            <div className="mt-1 text-[12px] leading-5 text-txt-secondary">
              {health.score >= 75
                ? 'Maker quality is strong enough to support confident flow capture.'
                : health.score >= 50
                  ? 'Maker quality is usable, but routing should account for current pressure.'
                  : 'Maker quality is weak; aggressive flow should be paused, split, or routed elsewhere.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreBlock({
  icon,
  label,
  score,
  status,
  description,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  score: number;
  status: string;
  description: string;
  tone: 'good' | 'warn' | 'bad';
}) {
  const toneClass = tone === 'good' ? 'text-[#7E99FF]' : tone === 'warn' ? 'text-[#F3A14A]' : 'text-[#F28D3A]';

  return (
    <div className="border-r border-divider/50 p-4 last:border-r-0">
      <div className="mb-2 flex items-center gap-2 text-txt-muted">
        <span className={toneClass}>{icon}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`font-mono text-[30px] font-bold leading-none tabular-nums ${toneClass}`}>{score}</span>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-txt-muted">{status}</span>
      </div>
      <p className="mt-2 text-[11px] leading-4 text-txt-secondary">{description}</p>
    </div>
  );
}

function FactorRow({ label, score, value, tone }: { label: string; score: number; value: string; tone: 'good' | 'warn' | 'bad' }) {
  const color = tone === 'good' ? 'bg-[#5E7DFF]' : tone === 'warn' ? 'bg-[#F3A14A]' : 'bg-[#F28D3A]';
  const text = tone === 'good' ? 'text-[#7E99FF]' : tone === 'warn' ? 'text-[#F3A14A]' : 'text-[#F28D3A]';

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="truncate text-[11px] font-medium text-txt-secondary">{label}</span>
        <span className={`font-mono text-[11px] font-bold tabular-nums ${text}`}>{value}</span>
      </div>
      <div className="h-[5px] overflow-hidden rounded-full bg-divider/70">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function ReliabilityTile({ label, value, tone }: { label: string; value: string; tone: 'good' | 'warn' | 'bad' }) {
  const color = tone === 'good' ? 'text-[#7E99FF]' : tone === 'warn' ? 'text-[#F3A14A]' : 'text-[#F28D3A]';
  return (
    <div className="rounded border border-divider/60 bg-panel-secondary/25 px-3 py-2">
      <div className="text-[9px] font-semibold uppercase tracking-wide text-txt-muted">{label}</div>
      <div className={`mt-1 truncate font-mono text-[12px] font-bold ${color}`}>{value}</div>
    </div>
  );
}
