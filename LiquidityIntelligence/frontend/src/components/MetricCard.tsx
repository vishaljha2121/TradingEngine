import React from 'react';

interface MetricCardProps {
  label: string;
  value: string;
  sublabel?: string;
  variant?: 'default' | 'hero' | 'status';
  statusColor?: 'green' | 'yellow' | 'red';
  children?: React.ReactNode;
}

export function MetricCard({ label, value, sublabel, variant = 'default', statusColor, children }: MetricCardProps) {
  const baseClass = 'rounded-xl flex flex-col justify-center shadow-lg transition-all duration-300';

  if (variant === 'hero') {
    return (
      <div className={`${baseClass} bg-slate-900/50 border border-slate-700/50 p-5 items-center relative group`}>
        <div className="text-[10px] tracking-[0.25em] text-slate-500 font-bold mb-2 uppercase">{label}</div>
        <div className="text-3xl font-mono text-white tracking-tight font-bold">{value}</div>
        {sublabel && <div className="text-[10px] text-slate-500 font-mono mt-2 border-t border-slate-800/60 pt-2 w-full text-center">{sublabel}</div>}
        {children}
      </div>
    );
  }

  if (variant === 'status') {
    const colorMap = {
      green: 'bg-emerald-950/60 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15)]',
      yellow: 'bg-yellow-950/60 border-yellow-500/40 shadow-[0_0_20px_rgba(234,179,8,0.15)]',
      red: 'bg-red-950/60 border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.15)]',
    };
    return (
      <div className={`${baseClass} border-2 p-4 ${colorMap[statusColor || 'green']}`}>
        <div className="text-[10px] font-extrabold tracking-[0.2em] opacity-80 mb-1">{label}</div>
        <div className="text-sm font-bold text-white leading-tight">{value}</div>
        {sublabel && <div className="text-[10px] text-white/60 mt-1">{sublabel}</div>}
        {children}
      </div>
    );
  }

  return (
    <div className={`${baseClass} bg-slate-900/30 border border-slate-800/60 p-4 items-center`}>
      <div className="text-[10px] tracking-[0.25em] text-slate-500 font-bold mb-2 uppercase">{label}</div>
      <div className="text-xl font-mono text-white tracking-tight">{value}</div>
      {sublabel && <div className="text-[10px] text-slate-500 font-mono mt-2 border-t border-slate-800/60 pt-2 w-full text-center">{sublabel}</div>}
      {children}
    </div>
  );
}
