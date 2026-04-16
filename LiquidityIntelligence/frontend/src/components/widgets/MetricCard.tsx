import { useMemo } from 'react';
import { AreaChart, Area, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Bell, BellOff, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { MetricTrend } from '../../types';

interface MetricCardProps {
  title: string;
  value: string;
  unit: string;
  /** Raw numeric value for color logic */
  numericValue: number;
  /** Is this metric in a "good" state? */
  ok: boolean;
  /** Secondary descriptive label */
  subtitle?: string;
  /** Trend direction */
  trend?: MetricTrend;
  /** Sparkline data — array of numeric values */
  series: number[];
  /** Outlier severity */
  severity?: 'none' | 'mild' | 'moderate' | 'severe';
  /** Alert enabled state */
  alertEnabled?: boolean;
  /** Alert toggle callback */
  onAlertToggle?: () => void;
  /** Optional secondary metrics */
  secondaryMetrics?: Array<{ label: string; value: string; ok?: boolean }>;
}

const SEVERITY_BORDER: Record<string, string> = {
  none: 'border-[#2B294C]/80',
  mild: 'border-[#F28D3A]/35',
  moderate: 'border-[#FF6B7E]/35',
  severe: 'border-[#FF6B7E]/65',
};

export function MetricCard({
  title,
  value,
  unit,
  ok,
  subtitle,
  trend = 'stable',
  series,
  severity = 'none',
  alertEnabled = false,
  onAlertToggle,
  secondaryMetrics,
}: MetricCardProps) {
  const valueColor = ok ? 'text-[#7E99FF]' : 'text-[#F28D3A]';
  const sparkColor = ok ? '#5E7DFF' : '#F28D3A';
  const borderClass = SEVERITY_BORDER[severity] || SEVERITY_BORDER.none;

  const TrendIcon = trend === 'improving' ? TrendingUp : trend === 'worsening' ? TrendingDown : Minus;
  const trendColor = trend === 'improving' ? 'text-[#7E99FF]' : trend === 'worsening' ? 'text-[#F28D3A]' : 'text-[#6E7199]';

  // Transform series into chart data
  const chartData = useMemo(() => {
    return series.map((v, i) => ({ i, v }));
  }, [series]);

  // Compute reference line (average)
  const avg = useMemo(() => {
    if (series.length === 0) return 0;
    return series.reduce((a, b) => a + b, 0) / series.length;
  }, [series]);

  return (
    <div className={`flex h-full flex-col overflow-hidden border-l-2 ${borderClass}`}>
      {/* Header row */}
      <div className="flex flex-shrink-0 items-center justify-between px-4 pb-1.5 pt-3">
        <span className="font-ui truncate text-[11px] font-semibold uppercase tracking-wide text-txt-label">
          {title}
        </span>
        <div className="flex items-center gap-1.5">
          <TrendIcon className={`h-3.5 w-3.5 ${trendColor}`} />
          {onAlertToggle && (
            <button
              onClick={onAlertToggle}
              className="grid h-6 w-6 place-items-center rounded border border-transparent text-txt-muted transition-colors hover:border-divider hover:bg-panel-secondary"
              title={alertEnabled ? 'Disable alert' : 'Enable alert'}
            >
              {alertEnabled ? (
                <Bell className="h-3.5 w-3.5 text-info" />
              ) : (
                <BellOff className="h-3.5 w-3.5 text-txt-muted/60" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Primary value */}
      <div className="mt-0.5 flex items-baseline gap-1.5 px-4">
        <span className={`font-mono text-[32px] font-bold leading-none tabular-nums tracking-normal ${valueColor}`}>
          {value}
        </span>
        <span className="font-mono text-[12px] font-semibold tracking-normal text-txt-muted">{unit}</span>
      </div>

      {/* Subtitle / verdict */}
      {subtitle && (
        <div className="mt-1 px-4">
          <span className={`font-ui text-[11px] font-semibold uppercase tracking-wide ${ok ? 'text-[#7E99FF]/90' : 'text-[#F28D3A]/90'}`}>
            {subtitle}
          </span>
        </div>
      )}

      {/* Secondary metrics row */}
      {secondaryMetrics && secondaryMetrics.length > 0 && (
        <div className="mt-2 flex gap-4 px-4">
          {secondaryMetrics.map((m, i) => (
            <div key={i} className="flex items-baseline gap-1.5">
              <span className="font-ui text-[10px] font-semibold uppercase tracking-wide text-txt-muted">{m.label}</span>
              <span className={`font-mono text-[11px] font-semibold tabular-nums ${m.ok === false ? 'text-negative' : 'text-txt-primary'}`}>
                {m.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Severity badge */}
      {severity !== 'none' && (
        <div className="mt-1.5 px-3">
          <span className={`inline-block text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${
            severity === 'severe' ? 'bg-[#FF6B7E]/15 text-[#FF6B7E]' :
            severity === 'moderate' ? 'bg-[#F28D3A]/12 text-[#F28D3A]' :
            'bg-[#F3A14A]/10 text-[#F3A14A]'
          }`}>
            {severity}
          </span>
        </div>
      )}

      {/* Sparkline — fills remaining space, flush to bottom */}
      <div className="mt-auto min-h-[34px] flex-1">
        {chartData.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`spark-fill-${title.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={sparkColor} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={sparkColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <ReferenceLine y={avg} stroke="rgba(111, 124, 142, 0.3)" strokeDasharray="2 2" strokeWidth={1} />
              <Area
                type="monotone"
                dataKey="v"
                stroke={sparkColor}
                strokeWidth={1.5}
                fill={`url(#spark-fill-${title.replace(/\s/g, '')})`}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center">
            <span className="text-[9px] text-[#6E7199]/45 font-ui">Collecting data...</span>
          </div>
        )}
      </div>
    </div>
  );
}
