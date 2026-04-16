import { Minimize2, Maximize2, X } from 'lucide-react';
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

  return (
    <>
      {expanded && <div className="fixed inset-0 bg-black/60 z-[90] backdrop-blur-sm transition-all" onClick={onExpand} />}
      <div className={containerClass}>
      <div className={`flex h-8 flex-shrink-0 select-none items-center gap-2 border-b px-3 ${editMode ? 'border-info/20 bg-[#1A1936]' : 'border-divider/45 bg-[#12112A]/95'}`}>
        {/* Title */}
        <h3 className={`font-ui flex-1 truncate text-[11px] font-semibold uppercase tracking-wide ${editMode ? 'text-txt-primary' : 'text-txt-label'}`}>
          {title}
        </h3>

        {/* Optional header-right slot */}
        {headerRight}

        {/* Action buttons - Expansion is allowed in normal mode, but Collapse is strictly Edit Mode ONLY */}
        <div className={`ml-1 flex items-center gap-1 transition-opacity ${editMode ? 'opacity-100' : 'opacity-0 group-hover:opacity-80 hover:opacity-100'}`}>
          {expandable && onExpand && (
            <button
              onClick={onExpand}
              className="grid h-6 w-6 place-items-center rounded border border-transparent bg-transparent text-txt-muted transition-colors hover:border-divider hover:bg-panel-secondary hover:text-txt-primary"
              title={expanded ? 'Collapse view' : 'Expand view'}
            >
              {expanded ? (
                <Minimize2 className="h-3.5 w-3.5" />
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
    </div>
    </>
  );
}
