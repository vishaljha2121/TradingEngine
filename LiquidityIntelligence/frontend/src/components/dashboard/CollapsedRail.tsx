import { RotateCcw } from 'lucide-react';
import type { WidgetId, CollapseSide } from '../../types';
import { WIDGET_REGISTRY } from '../../dashboard/widgetRegistry';

interface CollapsedRailProps {
  side: CollapseSide;
  collapsedWidgets: Set<WidgetId>;
  onRestore: (id: WidgetId) => void;
  /** Optional: show alert indicator dot */
  alertWidgets?: Set<WidgetId>;
}

export function CollapsedRail({ side, collapsedWidgets, onRestore, alertWidgets }: CollapsedRailProps) {
  // Filter to only widgets assigned to this rail side
  const items = [...collapsedWidgets].filter(id => {
    const def = WIDGET_REGISTRY[id];
    return def && def.defaultCollapseSide === side;
  });

  if (items.length === 0) return null;

  return (
    <div
      className={`flex flex-shrink-0 flex-col gap-2 border-divider/50 bg-panel-tertiary py-3 ${
        side === 'left' ? 'border-r px-1.5' : 'border-l px-1.5'
      }`}
      style={{ width: 42 }}
    >
      {items.map(id => {
        const def = WIDGET_REGISTRY[id];
        if (!def) return null;
        const hasAlert = alertWidgets?.has(id);

        return (
          <button
            key={id}
            onClick={() => onRestore(id)}
            className="group relative flex flex-col items-center gap-1 rounded border border-transparent px-1 py-2 transition-colors hover:border-divider hover:bg-panel-secondary"
            title={`Restore: ${def.title}`}
          >
            {/* Alert dot */}
            {hasAlert && (
              <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#F28D3A] animate-pulse" />
            )}

            {/* Restore icon */}
            <RotateCcw className="h-3.5 w-3.5 text-txt-muted transition-colors group-hover:text-txt-secondary" />

            {/* Short label (rotated) */}
            <span
              className="whitespace-nowrap text-[8px] font-semibold uppercase tracking-wide text-txt-muted transition-colors group-hover:text-txt-secondary"
              style={{ writingMode: 'vertical-lr', textOrientation: 'mixed' }}
            >
              {def.shortTitle}
            </span>
          </button>
        );
      })}
    </div>
  );
}
