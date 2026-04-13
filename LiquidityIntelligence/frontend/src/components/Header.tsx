import React from 'react';
import { TrueMarketsLogo } from './TrueMarketsLogo';
import { Wifi, WifiOff, AlertTriangle } from 'lucide-react';

interface HeaderProps {
  asset: string;
  benchmark: string;
  backendConnected: boolean;
  tmConnected: boolean;
  tmFallback: boolean;
  tmError: string | null;
  backendError: string | null;
  midPrice: number;
  spreadVariance: number;
  insightStatus?: string;
  lagMs: number;
  onAssetChange: (asset: string) => void;
  onBenchmarkChange: (bench: string) => void;
}

export function Header({
  asset, benchmark, backendConnected, tmConnected, tmFallback, tmError, backendError,
  midPrice, spreadVariance, insightStatus, lagMs,
  onAssetChange, onBenchmarkChange
}: HeaderProps) {
  const priceStr = midPrice > 0 ? midPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
  const spreadColor = spreadVariance <= 0 ? 'text-emerald-400' : spreadVariance > 1.0 ? 'text-red-400' : 'text-yellow-400';
  const statusColor = insightStatus === 'Competitive' ? 'text-emerald-400' : insightStatus === 'Significantly Behind' ? 'text-red-400' : 'text-yellow-400';

  return (
    <header className="flex items-center w-full bg-[#0d1117] border-b border-[#21262d] h-11 px-4 flex-shrink-0 select-none overflow-hidden">
      {/* Logo — fixed size */}
      <div className="flex-shrink-0">
        <TrueMarketsLogo size="sm" />
      </div>
      <div className="w-px h-5 bg-[#30363d] mx-3 flex-shrink-0" />

      {/* Asset + benchmark selectors */}
      <select value={asset} onChange={(e) => onAssetChange(e.target.value)}
        className="border border-[#30363d] text-white text-xs font-bold rounded px-2 py-1 cursor-pointer hover:border-[#484f58] transition-colors mr-2 flex-shrink-0">
        <option value="BTC">BTC-PYUSD</option>
      </select>
      <select value={benchmark} onChange={(e) => onBenchmarkChange(e.target.value)}
        className="border border-[#30363d] text-white text-xs font-bold rounded px-2 py-1 cursor-pointer hover:border-[#484f58] transition-colors flex-shrink-0">
        <option value="Kraken">vs Kraken</option>
        <option value="CryptoCom">vs Crypto.com</option>
      </select>

      <div className="w-px h-5 bg-[#30363d] mx-3 flex-shrink-0" />

      {/* Inline metrics — readable sizes */}
      <div className="flex items-center gap-5 text-xs font-mono flex-shrink-0">
        <div><span className="text-[#8b949e] mr-1">Mark</span><span className="text-white font-bold">{priceStr}</span></div>
        <div><span className="text-[#8b949e] mr-1">Spread Δ</span><span className={`font-bold ${spreadColor}`}>{spreadVariance > 0 ? '+' : ''}{spreadVariance.toFixed(2)} bps</span></div>
        <div><span className="text-[#8b949e] mr-1">Lag</span><span className={`font-bold ${lagMs > 100 ? 'text-red-400' : 'text-white'}`}>{lagMs}ms</span></div>
        {insightStatus && (
          <div><span className="text-[#8b949e] mr-1">Status</span><span className={`font-bold ${statusColor}`}>{insightStatus}</span></div>
        )}
      </div>

      {/* Right side: connection dots */}
      <div className="ml-auto flex items-center gap-3 text-[11px] font-mono flex-shrink-0">
        <div className="flex items-center gap-1.5">
          {backendConnected
            ? <><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /><span className="text-[#8b949e]">ENGINE</span></>
            : <><WifiOff className="w-3.5 h-3.5 text-red-400" /><span className="text-red-400">OFFLINE</span></>
          }
        </div>
        <div className="flex items-center gap-1.5">
          {tmFallback
            ? <><AlertTriangle className="w-3.5 h-3.5 text-yellow-500" /><span className="text-yellow-500">SIM</span></>
            : tmConnected
              ? <><span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse inline-block" /><span className="text-[#8b949e]">TRUEX</span></>
              : <><span className="w-2 h-2 rounded-full bg-[#484f58] inline-block" /><span className="text-[#484f58]">TRUEX</span></>
          }
        </div>
      </div>
    </header>
  );
}
