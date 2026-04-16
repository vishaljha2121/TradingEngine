import { X, AlertTriangle } from 'lucide-react';
import type { AlertEvent } from '../../types';

interface AlertToastProps {
  events: AlertEvent[];
  onDismiss: (id: string) => void;
}

export function AlertToast({ events, onDismiss }: AlertToastProps) {
  if (events.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {events.map((evt) => (
        <div 
          key={evt.id} 
          className="pointer-events-auto bg-panel border border-[#F28D3A]/50 shadow-lg shadow-black/40 rounded-lg p-3 flex gap-3 items-start animate-fade-in-up"
        >
          <div className="flex-shrink-0 mt-0.5">
             <AlertTriangle className={`w-4 h-4 ${evt.severity === 'severe' ? 'text-[#F28D3A]' : 'text-[#F3A14A]'}`} />
          </div>
          <div className="flex-1 min-w-0">
             <div className="flex justify-between items-start">
               <h4 className="text-[12px] font-bold text-[#E5EDF7] font-ui uppercase tracking-wider">{evt.label} Alert</h4>
               <span className="text-[10px] text-[#F28D3A] font-mono font-bold">{evt.value > 0 ? '+' : ''}{evt.value.toFixed(2)}</span>
             </div>
             <p className="text-[11px] text-[#A7A9D2] font-ui mt-0.5 leading-snug">{evt.message}</p>
          </div>
          <button 
             onClick={() => onDismiss(evt.id)}
             className="flex-shrink-0 p-1 rounded hover:bg-[#252343] transition-colors -mr-1 -mt-1"
          >
             <X className="w-3.5 h-3.5 text-[#6E7199]" />
          </button>
        </div>
      ))}
    </div>
  );
}
