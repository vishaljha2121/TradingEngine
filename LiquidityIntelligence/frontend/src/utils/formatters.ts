export function formatPrice(p: number | undefined): string {
  if (!p) return "0.00";
  const digits = p > 1000 ? 2 : p > 10 ? 3 : 5;
  return p.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatQty(q: number | undefined): string {
  if (!q) return "0.000";
  return q > 1000 ? Math.round(q).toLocaleString('en-US') : q.toFixed(3);
}

export function formatBps(bps: number): string {
  return `${bps > 0 ? '+' : ''}${bps.toFixed(2)} bps`;
}

export function formatSignedBps(bps: number): string {
  return `${bps > 0 ? '+' : ''}${bps.toFixed(2)}`;
}

export function formatLag(ms: number): string {
  return `${Math.round(ms)}ms`;
}

export function formatNotional(price: number, qty: number): string {
  const notional = price * qty;
  if (notional > 1_000_000) return `$${(notional / 1_000_000).toFixed(2)}M`;
  if (notional > 1_000) return `$${(notional / 1_000).toFixed(1)}K`;
  return `$${notional.toFixed(2)}`;
}

export function formatPct(val: number): string {
  return `${val > 0 ? '+' : ''}${val.toFixed(1)}%`;
}
