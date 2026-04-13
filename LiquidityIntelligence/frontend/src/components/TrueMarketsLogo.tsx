import React from 'react';

export function TrueMarketsLogo({ size = 'sm' }: { size?: 'sm' | 'md'; className?: string }) {
  const h = size === 'md' ? 24 : 16;
  const w = size === 'md' ? 160 : 120;
  return (
    <svg width={w} height={h} viewBox="0 0 180 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="2" width="24" height="5" rx="2" fill="#2563EB" />
      <rect x="9" y="2" width="5" height="26" rx="2" fill="#2563EB" />
      <text x="30" y="23" fontFamily="Inter, system-ui, sans-serif" fontWeight="800" fontSize="18" fill="#F8FAFC" letterSpacing="-0.5">true</text>
      <text x="73" y="23" fontFamily="Inter, system-ui, sans-serif" fontWeight="400" fontSize="18" fill="#94A3B8" letterSpacing="-0.5">markets</text>
    </svg>
  );
}

export function TrueMarketsIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="1" y="2" width="22" height="4.5" rx="2" fill="#2563EB" />
      <rect x="8.5" y="2" width="5" height="20" rx="2" fill="#2563EB" />
    </svg>
  );
}
