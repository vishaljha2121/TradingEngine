export function TrueMarketsLogo({ size = 'sm', className = '' }: { size?: 'sm' | 'md'; className?: string }) {
  const h = size === 'md' ? 'h-5' : 'h-3.5';
  return (
    <div className={`flex items-center justify-center ml-1 opacity-80 mix-blend-screen transition-opacity hover:opacity-100 ${className}`}>
      <img src="/truemarkets-logo.png" alt="True Markets" className={`${h} w-auto object-contain`} />
    </div>
  );
}

export function TrueMarketsIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
      <rect x="1" y="2" width="22" height="4.5" rx="2" fill="#2563EB" />
      <rect x="8.5" y="2" width="5" height="20" rx="2" fill="#2563EB" />
    </svg>
  );
}
