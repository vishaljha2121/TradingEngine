import { Download } from 'lucide-react';
import type { ReportWindow } from '../../utils/reporting';

interface ReportExportMenuProps {
  availableMs: number;
  onExport: (windowLabel: ReportWindow) => void;
}

function formatObserved(ms: number) {
  if (ms < 60000) return '<1m observed';
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}m observed`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return `${hours}h${rem ? ` ${rem}m` : ''} observed`;
}

export function ReportExportMenu({ availableMs, onExport }: ReportExportMenuProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded border border-divider/70 bg-[#09081D]/75 px-2 py-2">
      <div className="px-1">
        <div className="text-[9px] font-bold uppercase tracking-wide text-txt-muted">Markdown Reports</div>
        <div className="mt-0.5 font-mono text-[10px] text-txt-secondary">{formatObserved(availableMs)}</div>
      </div>
      {(['1h', '6h'] as ReportWindow[]).map((windowLabel) => (
        <button
          key={windowLabel}
          type="button"
          onClick={() => onExport(windowLabel)}
          className="inline-flex h-8 items-center gap-1.5 rounded border border-divider/80 bg-panel-secondary/50 px-2.5 text-[10px] font-bold uppercase tracking-wide text-txt-secondary transition-colors hover:border-info/45 hover:bg-info/10 hover:text-txt-primary"
          title={`Download last ${windowLabel} markdown report`}
        >
          <Download className="h-3.5 w-3.5 text-info" />
          Export {windowLabel}
        </button>
      ))}
    </div>
  );
}
