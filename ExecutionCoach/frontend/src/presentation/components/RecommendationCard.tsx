import React from 'react';
import type { RecommendationResult } from '../../domain/types';
import { CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

interface Props {
  evaluations: RecommendationResult[];
  recommended: RecommendationResult | null;
}

export const RecommendationCard: React.FC<Props> = ({ evaluations, recommended }) => {
  if (!recommended) return <div className="h-64 bg-slate-900 border border-slate-700 rounded-xl animate-pulse"></div>;

  const modeIcon = (mode: string) => {
     if (mode === 'Execute Now') return <CheckCircle2 className="text-emerald-400" size={24} />;
     if (mode === 'Slice') return <AlertTriangle className="text-amber-400" size={24} />;
     return <ShieldCheck className="text-tmaccent" size={24} />;
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-xl overflow-hidden flex flex-col h-full">
       <div className="bg-gradient-to-r from-tmblue to-[#1e293b] p-6 border-b border-slate-700">
           <h3 className="text-slate-400 text-sm font-bold tracking-widest uppercase mb-4">Recommended Posture</h3>
           <div className="flex items-center gap-4">
              {modeIcon(recommended.mode)}
              <div>
                  <h1 className="text-3xl font-extrabold text-white tracking-tight">{recommended.mode}</h1>
              </div>
           </div>
           <p className="mt-4 text-slate-300 text-sm leading-relaxed border-l-2 border-tmaccent pl-4 italic">
             "{recommended.reason}"
           </p>
       </div>
       
       <div className="p-6 flex-1 flex flex-col justify-center">
          <h4 className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-4">Execution Comparison</h4>
          <div className="space-y-3">
             {evaluations.map(e => (
                <div key={e.mode} className={`flex items-center justify-between p-3 rounded border ${e.mode === recommended.mode ? 'bg-slate-800 border-tmaccent' : 'bg-slate-800/50 border-slate-800 opacity-60'}`}>
                   <span className="font-semibold text-white">{e.mode}</span>
                   <div className="flex items-center gap-6 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 text-xs uppercase">Cost</span>
                        <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                           <div className="h-full bg-rose-500" style={{ width: `${Math.min(100, e.expectedCost * 2)}%` }}></div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 text-xs uppercase">Risk</span>
                        <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                           <div className="h-full bg-amber-500" style={{ width: `${e.riskScore}%` }}></div>
                        </div>
                      </div>
                   </div>
                </div>
             ))}
          </div>
       </div>
    </div>
  );
};
