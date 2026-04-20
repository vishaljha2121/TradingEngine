import { Minimize2, Maximize2, X } from 'lucide-react';
import type React from 'react';
import type { WidgetId } from '../../types';

interface WidgetFrameProps {
  id: WidgetId;
  title: string;
  editMode: boolean;
  onCollapse?: () => void;
  onExpand?: () => void;
  expandable?: boolean;
  expanded?: boolean;
  children: React.ReactNode;
  /** Additional header-right controls */
  headerRight?: React.ReactNode;
  /** No inner padding — widget handles its own */
  noPad?: boolean;
}

export function WidgetFrame({
  title,
  editMode,
  onCollapse,
  onExpand,
  expandable = false,
  expanded = false,
  children,
  headerRight,
  noPad = false,
}: WidgetFrameProps) {
  const baseClass = "group panel-surface flex h-full min-h-full flex-col overflow-hidden transition-all duration-200";
  const editClass = "border-info/30 shadow-md ring-1 ring-info/10";
  const normalClass = "";

  const containerClass = expanded
    ? "fixed inset-4 z-[100] flex flex-col panel-surface overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] transition-all duration-200"
    : `${baseClass} ${editMode ? editClass : normalClass}`;
  const restore = () => onExpand?.();

  return (
    <>
      {expanded && (
        <button
          aria-label="Restore expanded panel"
          className="fixed inset-0 z-[90] cursor-default bg-black/65 backdrop-blur-sm transition-all"
          onClick={restore}
        />
      )}
      <section
        className={containerClass}
        aria-label={title}
        aria-expanded={expanded}
        onClick={(event) => event.stopPropagation()}
      >
      <div className={`flex flex-shrink-0 select-none items-center gap-2 border-b px-3 ${expanded ? 'h-11 border-info/25 bg-[#111027]' : editMode ? 'h-8 border-info/20 bg-[#1A1936]' : 'h-8 border-divider/45 bg-[#12112A]/95'}`}>
        {/* Title */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h3 className={`font-ui truncate font-semibold uppercase tracking-wide ${expanded ? 'text-[12px] text-txt-primary' : editMode ? 'text-[11px] text-txt-primary' : 'text-[11px] text-txt-label'}`}>
            {title}
          </h3>
          {expanded && (
            <span className="hidden rounded bg-info/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-info md:inline">
              Expanded Workspace
            </span>
          )}
        </div>

        {/* Optional header-right slot */}
        {headerRight}

        {/* Action buttons - Expansion is allowed in normal mode, but Collapse is strictly Edit Mode ONLY */}
        <div className={`ml-1 flex items-center gap-1 transition-opacity ${expanded || editMode ? 'opacity-100' : 'opacity-0 group-hover:opacity-80 hover:opacity-100'}`}>
          {expandable && onExpand && (
            <button
              onClick={onExpand}
              aria-label={expanded ? `Restore ${title}` : `Maximize ${title}`}
              className={`${expanded ? 'h-8 gap-2 px-3' : 'h-6 w-6'} inline-grid place-items-center rounded border border-divider/70 bg-panel-secondary/50 text-txt-secondary transition-colors hover:border-info/40 hover:bg-info/10 hover:text-txt-primary`}
              title={expanded ? 'Restore panel to dashboard' : 'Maximize panel'}
            >
              {expanded ? (
                <span className="inline-flex items-center gap-2">
                  <Minimize2 className="h-3.5 w-3.5" />
                  <span className="hidden text-[11px] font-semibold uppercase tracking-wide sm:inline">Restore</span>
                </span>
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </button>
          )}
          {editMode && onCollapse && (
            <button
              onClick={onCollapse}
              className="grid h-6 w-6 place-items-center rounded border border-transparent text-negative/80 transition-colors hover:border-negative/20 hover:bg-negative/10 hover:text-negative"
              title="Hide Widget"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Widget body */}
      <div className={`flex-1 min-h-0 overflow-hidden flex flex-col ${noPad ? '' : 'p-3'}`}>
        {children}
      </div>
    </section>
    </>
  );
}
