import { AlertTriangle, CheckCircle2, ChevronDown, Clock3, RefreshCw, Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import type {
  OpsRecommendationSnapshot,
  RecommendationSeverity,
  RecommendationUrgency,
} from '../../utils/recommendations';

interface ActionCenterProps {
  snapshot: OpsRecommendationSnapshot | null;
  history: OpsRecommendationSnapshot[];
  onRefresh: () => void;
  autoRefreshMs: number;
}

const severityClass: Record<RecommendationSeverity, string> = {
  critical: 'border-[#FF6B7E]/45 bg-[#FF6B7E]/10 text-[#FF8795]',
  warning: 'border-[#F28D3A]/45 bg-[#F28D3A]/10 text-[#F3A14A]',
  info: 'border-[#5E7DFF]/40 bg-[#5E7DFF]/10 text-[#8DA2FF]',
};

const urgencyIcon: Record<RecommendationUrgency, ReactNode> = {
  'Immediate action': <AlertTriangle className="h-3.5 w-3.5" />,
  Monitor: <Clock3 className="h-3.5 w-3.5" />,
  'Investigate later': <Search className="h-3.5 w-3.5" />,
};

function evidenceToneClass(tone: string) {
  if (tone === 'good') return 'border-[#5E7DFF]/30 bg-[#5E7DFF]/10 text-[#9AAEFF]';
  if (tone === 'warn') return 'border-[#F28D3A]/35 bg-[#F28D3A]/10 text-[#F3A14A]';
  if (tone === 'bad') return 'border-[#FF6B7E]/35 bg-[#FF6B7E]/10 text-[#FF8795]';
  return 'border-divider/70 bg-[#09081D]/70 text-txt-secondary';
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatMinutes(ms: number) {
  return `${Math.max(1, Math.round(ms / 60000))}m`;
}

export function ActionCenter({ snapshot, history, onRefresh, autoRefreshMs }: ActionCenterProps) {
  const [selectedSnapshotId, setSelectedSnapshotId] = useState('current');
  const selectedSnapshot = useMemo(() => {
    if (selectedSnapshotId === 'current') return snapshot;
    return history.find((item) => item.id === selectedSnapshotId) ?? snapshot;
  }, [selectedSnapshotId, snapshot, history]);
  const recommendations = selectedSnapshot?.recommendations ?? [];
  const top = recommendations[0];

  if (!top) {
    return (
      <div className="grid h-full min-h-[220px] place-items-center p-5 text-center">
        <div>
          <CheckCircle2 className="mx-auto h-6 w-6 text-info" />
          <div className="mt-3 text-[13px] font-semibold text-txt-primary">No recommendations available</div>
          <div className="mt-1 text-[11px] text-txt-muted">Waiting for enough live market data to evaluate routing conditions.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="border-b border-divider/60 bg-panel-secondary/30 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${severityClass[top.severity]}`}>
                {urgencyIcon[top.urgency]}
                {top.urgency}
              </span>
              <span className="rounded border border-divider/60 bg-[#09081D]/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-txt-muted">
                Top Issue
              </span>
            </div>
            <h2 className="mt-2 text-[16px] font-semibold leading-tight text-txt-primary">{top.title}</h2>
            <p className="mt-1 max-w-[780px] text-[12px] leading-5 text-txt-secondary">{top.operationalImpact}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="rounded border border-divider/60 bg-[#09081D]/80 px-2 py-1.5 text-right">
              <div className="text-[9px] font-bold uppercase tracking-wide text-txt-muted">
                {selectedSnapshotId === 'current' ? 'Current Cards' : 'Archived Cards'}
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-txt-secondary">
                {selectedSnapshot ? `${formatTime(selectedSnapshot.capturedAt)} / ${selectedSnapshot.refreshReason}` : 'Not captured'}
              </div>
            </div>
            <label className="relative">
              <select
                value={selectedSnapshotId}
                onChange={(event) => setSelectedSnapshotId(event.target.value)}
                className="h-8 min-w-[150px] appearance-none rounded border border-divider/80 bg-[#09081D] px-2 pr-7 font-mono text-[10px] font-semibold text-txt-secondary outline-none transition-colors hover:border-info/40 focus:border-info/50"
                title="View current or previous recommendation cards"
              >
                <option value="current">Current cards</option>
                {history.slice(0, 5).map((item, index) => (
                  <option key={item.id} value={item.id}>
                    Previous {index + 1} / {formatTime(item.capturedAt)}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-txt-muted" />
            </label>
            <button
              type="button"
              onClick={() => {
                setSelectedSnapshotId('current');
                onRefresh();
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded border border-info/35 bg-info/10 px-2.5 text-[10px] font-bold uppercase tracking-wide text-[#9AAEFF] transition-colors hover:bg-info/15 hover:text-txt-primary"
              title="Refresh recommendation cards now"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
            <div className="basis-full text-right font-mono text-[9px] uppercase tracking-wide text-txt-muted">
              Auto refresh max {formatMinutes(autoRefreshMs)}
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          {recommendations.map((rec, index) => (
            <article key={rec.id} className="rounded border border-divider/75 bg-[#09081D]/65 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-wide text-txt-muted">Priority {index + 1}</div>
                  <h3 className="mt-1 text-[13px] font-semibold leading-snug text-txt-primary">{rec.title}</h3>
                </div>
                <span className={`shrink-0 rounded border px-2 py-1 text-[9px] font-bold uppercase tracking-wide ${severityClass[rec.severity]}`}>
                  {rec.severity}
                </span>
              </div>

              <div className="mt-3">
                <div className="text-[10px] font-bold uppercase tracking-wide text-txt-label">Recommended Actions</div>
                <ul className="mt-1.5 space-y-1.5">
                  {rec.recommendedActions.slice(0, 3).map((action) => (
                    <li key={action} className="flex gap-2 text-[11px] leading-4 text-txt-secondary">
                      <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-info" />
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-3 border-t border-divider/50 pt-2">
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-txt-label">Supporting Evidence</div>
                <div className="flex flex-wrap gap-1.5">
                  {rec.evidence.map((item) => (
                    <span key={`${rec.id}-${item.label}`} className={`rounded border px-2 py-1 text-[10px] font-semibold ${evidenceToneClass(item.tone)}`}>
                      {item.label}: <span className="font-mono tabular-nums">{item.value}</span>
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
