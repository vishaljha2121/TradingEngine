import { Bell, ChevronDown, Globe2, Mail, RotateCcw, Search, Settings } from 'lucide-react';
import type React from 'react';
import type { StatusInfo } from '../utils/metrics';
import { TrueMarketsLogo } from './TrueMarketsLogo';

interface HeaderBarProps {
  asset: string;
  benchmark: string;
  feedMode: 'Live' | 'Fallback Mock' | 'Live (Backend)' | 'Connecting...';
  lastUpdate: string;
  statusInfo: StatusInfo;
  onAssetChange: (a: string) => void;
  onBenchmarkChange: (b: string) => void;
  editMode?: boolean;
  onToggleEditMode?: () => void;
  onResetLayout?: () => void;
}

export function HeaderBar({
  asset, benchmark, feedMode, lastUpdate,
  onAssetChange, onBenchmarkChange,
  editMode = false, onToggleEditMode, onResetLayout
}: HeaderBarProps) {
  const feedColor = feedMode === 'Live' || feedMode === 'Live (Backend)' ? 'text-[#5E7DFF]' : feedMode === 'Fallback Mock' ? 'text-[#F28D3A]' : 'text-[#6E7199]';

  return (
    <>
      <header className="z-50 flex h-14 flex-shrink-0 select-none items-center border-b border-divider/70 bg-[#0D0B22]/95 px-4 shadow-[0_10px_30px_rgba(0,0,0,0.18)] lg:px-5">
        <div className="mr-4 flex min-w-[220px] items-center gap-3">
          <TrueMarketsLogo size="sm" />
          <div className="hidden leading-tight sm:block">
            <div className="text-[13px] font-semibold text-txt-primary">Liquidity Intelligence</div>
            <div className="text-[9px] font-semibold uppercase tracking-wide text-txt-muted">True Markets</div>
          </div>
        </div>

        <div className="relative mr-4 hidden h-8 min-w-[260px] max-w-[520px] flex-1 items-center lg:flex">
          <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-txt-muted" />
          <input
            aria-label="Search"
            className="h-full w-full rounded bg-[#09081D] pl-9 pr-3 text-[12px] text-txt-secondary outline-none ring-1 ring-divider/60 transition placeholder:text-txt-muted/75 focus:ring-info/50"
            placeholder="Search venues, symbols, alerts"
          />
        </div>

        <div className="flex flex-1 items-center justify-start gap-2 lg:flex-none">
          <MarketSelect value={asset} onChange={onAssetChange} options={[['BTC', 'BTC-PYUSD']]} />

          <span className="font-ui text-[10px] font-semibold uppercase tracking-wide text-txt-muted">vs</span>

          <MarketSelect value={benchmark} onChange={onBenchmarkChange} options={[['Kraken', 'Kraken'], ['CryptoCom', 'Crypto.com']]} />
        </div>

        <div className="flex flex-1 items-center justify-end gap-2.5">
          <div className="hidden items-center gap-2 rounded bg-[#09081D] px-2.5 py-1.5 ring-1 ring-divider/60 md:flex">
             <div className={`h-1.5 w-1.5 rounded-full ${feedColor.replace('text-', 'bg-')}`} />
             <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-txt-secondary">{feedMode === 'Live (Backend)' ? 'Live' : feedMode}</span>
          </div>

          <div className="hidden items-center gap-1.5 border-l border-divider pl-3 lg:flex">
            <span className="font-ui text-[10px] font-semibold uppercase tracking-wide text-txt-muted">Time</span>
            <span className="mt-px font-mono text-[11px] font-semibold tabular-nums text-txt-secondary">{lastUpdate}</span>
          </div>

          <HeaderIcon icon={<Mail className="h-3.5 w-3.5" />} label="Messages" />
          <HeaderIcon icon={<Bell className="h-3.5 w-3.5" />} label="Alerts" />

          <div className="hidden items-center gap-2 pl-1 md:flex">
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[#F28D3A] to-[#E84056]" />
            <div className="hidden leading-tight xl:block">
              <div className="text-[11px] font-semibold text-txt-primary">Vishal Jha</div>
              <div className="text-[9px] text-txt-muted">Superday Demo</div>
            </div>
            <Globe2 className="h-3.5 w-3.5 text-txt-muted" />
          </div>

          {onToggleEditMode && (
            <button
              onClick={onToggleEditMode}
              className={`grid h-8 w-8 place-items-center rounded border transition-colors ${
                editMode
                  ? 'border-info/25 bg-info/10 text-info'
                  : 'border-transparent text-txt-muted hover:border-divider hover:bg-panel-secondary hover:text-txt-primary'
              }`}
              title={editMode ? 'Edit mode active' : 'Configure dashboard'}
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Reset Layout */}
          {editMode && onResetLayout && (
            <button
              onClick={onResetLayout}
              className="grid h-8 w-8 place-items-center rounded border border-transparent text-txt-muted transition-colors hover:border-divider hover:bg-panel-secondary hover:text-txt-primary"
              title="Reset layout to default"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </header>
    </>
  );
}

function HeaderIcon({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button
      title={label}
      className="hidden h-8 w-8 place-items-center rounded text-txt-muted transition hover:bg-panel-secondary hover:text-txt-primary md:grid"
    >
      {icon}
    </button>
  );
}

function MarketSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 min-w-[122px] appearance-none rounded border border-divider/90 bg-panel-secondary px-3 pr-8 font-mono text-[12px] font-semibold text-txt-primary outline-none transition-colors hover:border-[#38365B] focus:border-info/50"
      >
        {options.map(([optionValue, label]) => (
          <option key={optionValue} value={optionValue}>{label}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-txt-muted" />
    </label>
  );
}
