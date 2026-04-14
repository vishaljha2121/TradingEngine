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
}

const statusAccentColor: Record<string, string> = {
  'Competitive': '#18C37E',
  'Advantageous': '#6EE7D2',
  'Pressured': '#F5B942',
  'Degraded': '#FF5C5C',
};

export function HeaderBar({
  asset, benchmark, feedMode, lastUpdate, statusInfo,
  onAssetChange, onBenchmarkChange
}: HeaderBarProps) {
  const feedColor = feedMode === 'Live' || feedMode === 'Live (Backend)' ? 'text-[#18C37E]' : feedMode === 'Fallback Mock' ? 'text-[#F5B942]' : 'text-[#6F7C8E]';
  const accentColor = statusAccentColor[statusInfo.status] || '#6F7C8E';

  return (
    <>
      {/* Status accent stripe */}
      <div className="h-[2px] flex-shrink-0 transition-colors" style={{ backgroundColor: accentColor }} />

      <header className="flex items-center h-14 px-4 bg-[#0B1220] border-b border-[#1F2A3A] flex-shrink-0 select-none z-50">
        {/* Left: Logo + subtitle */}
        <div className="flex items-center gap-3 min-w-[240px]">
          <TrueMarketsLogo size="sm" />
          <div className="flex flex-col">
            <span className="text-[14px] font-bold text-[#E5EDF7] tracking-tight font-ui">LiquidityConsole</span>
            <span className="text-[10px] text-[#6F7C8E] tracking-wide font-ui">True Markets Liquidity Intelligence</span>
          </div>
        </div>

        {/* Center: Controls */}
        <div className="flex-1 flex items-center justify-center gap-4">
          <select
            value={asset}
            onChange={(e) => onAssetChange(e.target.value)}
            className="bg-[#0E1728] border border-[#1F2A3A] text-[#E5EDF7] text-xs font-bold font-mono rounded-md px-3 py-1.5 cursor-pointer hover:border-[#39465A] transition-colors outline-none"
          >
            <option value="BTC">BTC-PYUSD</option>
          </select>

          <span className="text-[#6F7C8E] text-[11px] font-ui uppercase font-semibold">vs</span>

          <select
            value={benchmark}
            onChange={(e) => onBenchmarkChange(e.target.value)}
            className="bg-[#0E1728] border border-[#1F2A3A] text-[#E5EDF7] text-xs font-bold font-mono rounded-md px-3 py-1.5 cursor-pointer hover:border-[#39465A] transition-colors outline-none"
          >
            <option value="Kraken">Kraken</option>
            <option value="CryptoCom">Crypto.com</option>
          </select>

          <div className="w-px h-5 bg-[#1F2A3A]" />

          <span className={`text-[11px] uppercase font-mono font-bold tracking-widest ${feedColor}`}>{feedMode}</span>

          <div className="w-px h-5 bg-[#1F2A3A]" />

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#6F7C8E] font-ui uppercase tracking-wide font-semibold">System Time</span>
            <span className="text-[12px] font-mono font-bold text-[#A8B3C2] tabular-nums">{lastUpdate}</span>
          </div>
        </div>

        {/* Right: Status pill */}
        <div className="flex items-center gap-3 min-w-[200px] justify-end">
          <div className={`px-3 py-1.5 rounded text-[11px] font-bold uppercase tracking-widest font-ui transition-colors ${statusInfo.bgClass} ${statusInfo.textClass}`}>
            STATUS: {statusInfo.status}
          </div>
        </div>
      </header>
    </>
  );
}
