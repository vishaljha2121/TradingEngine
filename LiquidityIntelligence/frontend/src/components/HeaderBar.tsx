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
  'Slightly Behind': '#F5B942',
  'Significantly Behind': '#FF5C5C',
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
      <div className="h-[2px] flex-shrink-0" style={{ backgroundColor: accentColor }} />

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
            className="bg-[#0E1728] border border-[#1F2A3A] text-[#E5EDF7] text-xs font-bold font-mono rounded-md px-3 py-1.5 cursor-pointer hover:border-[#39465A] transition-colors"
          >
            <option value="BTC">BTC-PYUSD</option>
          </select>

          <span className="text-[#6F7C8E] text-xs font-ui">vs</span>

          <select
            value={benchmark}
            onChange={(e) => onBenchmarkChange(e.target.value)}
            className="bg-[#0E1728] border border-[#1F2A3A] text-[#E5EDF7] text-xs font-bold font-mono rounded-md px-3 py-1.5 cursor-pointer hover:border-[#39465A] transition-colors"
          >
            <option value="Kraken">Kraken</option>
            <option value="CryptoCom">Crypto.com</option>
          </select>

          <div className="w-px h-5 bg-[#1F2A3A]" />

          <span className={`text-xs font-mono font-semibold ${feedColor}`}>{feedMode}</span>

          <div className="w-px h-5 bg-[#1F2A3A]" />

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[#6F7C8E] font-ui">Last Update</span>
            <span className="text-xs font-mono text-[#A8B3C2]">{lastUpdate}</span>
          </div>
        </div>

        {/* Right: Status pill */}
        <div className="flex items-center gap-3 min-w-[180px] justify-end">
          <div className={`px-3 py-1 rounded-md text-xs font-semibold font-ui ${statusInfo.bgClass} ${statusInfo.textClass}`}>
            {statusInfo.status}
          </div>
        </div>
      </header>
    </>
  );
}
