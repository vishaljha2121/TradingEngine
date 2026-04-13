import React from 'react';
import type { TradeContext, RiskState } from '../../domain/types';
import { Settings, ShieldAlert, Zap } from 'lucide-react';

interface Props {
  context: TradeContext;
  risk: RiskState;
  onContextChange: (ctx: Partial<TradeContext>) => void;
  onRiskChange: (risk: Partial<RiskState>) => void;
}

export const SettingsPanel: React.FC<Props> = ({ context, risk, onContextChange, onRiskChange }) => {
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 shadow-xl space-y-6">
       <div className="flex items-center gap-2 text-slate-300 font-semibold border-b border-slate-800 pb-3">
          <Settings size={18} className="text-tmaccent" /> Order Settings
       </div>
       
       <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">Pair</label>
            <div className="bg-slate-800 px-4 py-2 border border-slate-700 rounded font-mono text-white select-none">
              {context.asset}
            </div>
          </div>
          <div>
             <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">Side</label>
             <div className="flex border border-slate-700 rounded overflow-hidden">
                <button 
                  className={`flex-1 py-2 font-bold text-sm ${context.side === 'BUY' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                  onClick={() => onContextChange({ side: 'BUY'})}
                >BUY</button>
                <button 
                  className={`flex-1 py-2 font-bold text-sm ${context.side === 'SELL' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                  onClick={() => onContextChange({ side: 'SELL'})}
                >SELL</button>
             </div>
          </div>
       </div>

       <div>
          <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 flex justify-between">
            <span>Order Size (USD)</span>
            <span className="text-tmaccent">${context.sizeUsd.toLocaleString()}</span>
          </label>
          <input 
            type="range" 
            min="1000" max="250000" step="1000" 
            className="w-full accent-tmaccent h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
            value={context.sizeUsd}
            onChange={(e) => onContextChange({ sizeUsd: Number(e.target.value) })}
          />
       </div>

       <div>
          <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
            <Zap size={14} className={context.latency === 'Stressed' ? 'text-amber-500' : 'text-slate-400'} /> Latency Regime
          </label>
          <div className="flex border border-slate-700 rounded overflow-hidden bg-slate-800">
             {['Nominal', 'Medium', 'Stressed'].map(l => (
                <button 
                  key={l}
                  className={`flex-1 py-2 text-xs font-semibold ${context.latency === l ? 'bg-tmaccent text-white' : 'text-slate-400 hover:bg-slate-700'}`}
                  onClick={() => onContextChange({ latency: l as any })}
                >
                  {l}
                </button>
             ))}
          </div>
       </div>

       <div className="pt-4 border-t border-slate-800">
          <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
            <ShieldAlert size={14} className="text-rose-400" /> Current Inventory Risk
          </label>
          <input 
            type="range" 
            min="0" max="150000" step="5000" 
            className="w-full accent-rose-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
            value={risk.currentInventoryUsd}
            onChange={(e) => onRiskChange({ currentInventoryUsd: Number(e.target.value) })}
          />
          <div className="text-right text-xs text-slate-500 mt-1">${risk.currentInventoryUsd.toLocaleString()} / $100k CAP</div>
       </div>
    </div>
  );
};
