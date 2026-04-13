import React from 'react';
import type { Quote } from '../../domain/types';
import { Activity } from 'lucide-react';

export const QuotePanel: React.FC<{ quote: Quote | null }> = ({ quote }) => {
  if (!quote) return <div className="flex animate-pulse space-x-4 p-4 border border-tmgray rounded-lg justify-center"><Activity className="animate-spin" /></div>;

  const spread = (quote.ask - quote.bid).toFixed(2);

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 shadow-xl flex items-center justify-between">
       <div>
           <p className="text-slate-400 text-sm font-semibold tracking-wider uppercase">Current Quote</p>
           <div className="flex items-baseline gap-4 mt-2">
               <span className="text-3xl font-bold text-white">${quote.bid.toFixed(2)}</span>
               <span className="text-sm font-medium text-slate-500">BID</span>
               <span className="text-3xl font-bold text-white ml-2">${quote.ask.toFixed(2)}</span>
               <span className="text-sm font-medium text-slate-500">ASK</span>
           </div>
       </div>
       <div className="text-right flex flex-col items-end">
           <span className="bg-tmblue px-3 py-1 rounded-full text-xs font-semibold border border-slate-700 flex items-center gap-2">
             <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
             {quote.provider.toUpperCase()} FEED
           </span>
           <span className="text-sm text-slate-400 mt-3 font-mono">Spread: ${spread}</span>
       </div>
    </div>
  );
};
