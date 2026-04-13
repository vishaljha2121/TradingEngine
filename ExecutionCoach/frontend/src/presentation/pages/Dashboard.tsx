import React from 'react';
import { useExecutionCoach } from '../../application/useExecutionCoach';
import { QuotePanel } from '../components/QuotePanel';
import { SettingsPanel } from '../components/SettingsPanel';
import { RecommendationCard } from '../components/RecommendationCard';

export const Dashboard: React.FC = () => {
   const coach = useExecutionCoach();

   return (
     <div className="min-h-screen p-8 bg-[#0b1120] text-slate-200 selection:bg-tmaccent selection:text-white">
        <header className="max-w-6xl mx-auto mb-8 flex justify-between items-end">
           <div>
               <h1 className="text-3xl font-black tracking-tighter text-white">Execution<span className="text-tmaccent">Coach</span></h1>
               <p className="text-slate-500 font-medium tracking-wide mt-1">Pre-trade decision support for True Markets</p>
           </div>
           
           <div className="flex gap-2">
              <button onClick={() => coach.triggerFeatureDemoMode('Nominal')} className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded border border-slate-700 transition">Demo: Nominal</button>
              <button onClick={() => coach.triggerFeatureDemoMode('StressedVolatility')} className="text-xs bg-rose-900/40 hover:bg-rose-900/60 text-rose-300 px-3 py-1.5 rounded border border-rose-800/50 transition">Demo: Stress Check</button>
           </div>
        </header>

        <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5 flex flex-col gap-8">
               <SettingsPanel 
                  context={coach.context} 
                  risk={coach.riskState}
                  onContextChange={coach.updateContext}
                  onRiskChange={coach.updateRisk}
               />
               <QuotePanel quote={coach.quote} />
            </div>
            
            <div className="lg:col-span-7">
               <RecommendationCard 
                  evaluations={coach.evaluations}
                  recommended={coach.recommended}
               />
            </div>
        </main>
     </div>
   );
};
