import type { MarketHistoryPoint } from '../hooks/useMarketHistoryBuffer';
import type { OpsRecommendation } from './recommendations';

export type ReportWindow = '1h' | '6h';

interface MarkdownReportInput {
  windowLabel: ReportWindow;
  windowMs: number;
  generatedAt: Date;
  assetPair: string;
  benchmarkName: string;
  points: MarketHistoryPoint[];
  recommendations: OpsRecommendation[];
}

interface StatSummary {
  avg: number;
  min: number;
  max: number;
  latest: number;
}

function signed(value: number, digits = 2) {
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}`;
}

function formatDuration(ms: number) {
  if (ms <= 0) return 'less than 1 minute';
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return `${hours} hour${hours === 1 ? '' : 's'}${rem ? ` ${rem} minutes` : ''}`;
}

function stat(points: MarketHistoryPoint[], selector: (point: MarketHistoryPoint) => number): StatSummary {
  const values = points.map(selector).filter((value) => Number.isFinite(value));
  if (values.length === 0) return { avg: 0, min: 0, max: 0, latest: 0 };
  const sum = values.reduce((acc, value) => acc + value, 0);
  return {
    avg: sum / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    latest: values[values.length - 1],
  };
}

function tableRow(label: string, summary: StatSummary, unit: string, digits = 2) {
  return `| ${label} | ${signed(summary.latest, digits)} ${unit} | ${signed(summary.avg, digits)} ${unit} | ${signed(summary.min, digits)} ${unit} | ${signed(summary.max, digits)} ${unit} |`;
}

function plainRow(label: string, summary: StatSummary, unit: string, digits = 2) {
  return `| ${label} | ${summary.latest.toFixed(digits)} ${unit} | ${summary.avg.toFixed(digits)} ${unit} | ${summary.min.toFixed(digits)} ${unit} | ${summary.max.toFixed(digits)} ${unit} |`;
}

function eventSummary(points: MarketHistoryPoint[]) {
  const events = [
    {
      label: 'Spread wider than benchmark',
      threshold: 'spread gap > +0.30 bps',
      count: points.filter((point) => point.spreadGap > 0.3).length,
    },
    {
      label: 'Mid-price dislocation',
      threshold: '|mid deviation| > 2.00 bps',
      count: points.filter((point) => Math.abs(point.midGap) > 2).length,
    },
    {
      label: 'Quote lag elevated',
      threshold: 'lag > 100 ms',
      count: points.filter((point) => point.lagMs > 100).length,
    },
    {
      label: 'Top-5 depth thin',
      threshold: 'depth ratio < 80%',
      count: points.filter((point) => point.depthRatio < 0.8).length,
    },
    {
      label: 'Routing risk elevated',
      threshold: 'risk score > 35',
      count: points.filter((point) => point.routingRisk > 35).length,
    },
  ];

  const activeEvents = events.filter((event) => event.count > 0);
  if (activeEvents.length === 0) return 'No threshold events were observed in the selected data window.';

  return [
    '| Event | Threshold | Observed Samples |',
    '| --- | --- | ---: |',
    ...activeEvents.map((event) => `| ${event.label} | ${event.threshold} | ${event.count} |`),
  ].join('\n');
}

function headlineVerdict(points: MarketHistoryPoint[], recommendations: OpsRecommendation[], benchmarkName: string) {
  const spread = stat(points, (point) => point.spreadGap);
  const depth = stat(points, (point) => point.depthRatio);
  const edge = stat(points, (point) => point.executionEdgeBps);
  const top = recommendations[0];

  if (!points.length) {
    return 'No reportable verdict is available because the dashboard has not collected observed market samples yet.';
  }

  if (top?.severity === 'critical') {
    return `TrueMarkets requires immediate review versus ${benchmarkName}. The top issue is: ${top.title}.`;
  }

  if (spread.avg > 0.3 || edge.avg < -0.35 || depth.avg < 0.8) {
    const causes: string[] = [];
    if (spread.avg > 0.3) causes.push('persistent spread widening');
    if (edge.avg < -0.35) causes.push('negative executable edge');
    if (depth.avg < 0.8) causes.push('thinner displayed depth');
    return `TrueMarkets was behind ${benchmarkName} over the observed window, primarily due to ${causes.join(', ')}.`;
  }

  return `TrueMarkets was broadly competitive versus ${benchmarkName} over the observed window, with no immediate routing action required.`;
}

function recommendationMarkdown(recommendations: OpsRecommendation[]) {
  if (!recommendations.length) return 'No recommendations were generated for this window.';
  return recommendations.map((rec, index) => {
    const actions = rec.recommendedActions.map((action) => `  - ${action}`).join('\n');
    const evidence = rec.evidence.map((item) => `${item.label}: ${item.value}`).join('; ');
    return `${index + 1}. **${rec.title}** (${rec.severity}, ${rec.urgency})\n   - Operational impact: ${rec.operationalImpact}\n   - Evidence: ${evidence}\n${actions}`;
  }).join('\n\n');
}

export function generateMarkdownReport(input: MarkdownReportInput) {
  const points = input.points;
  const first = points[0];
  const last = points[points.length - 1];
  const availableMs = first && last ? last.timestamp - first.timestamp : 0;
  const partial = availableMs < input.windowMs;
  const spread = stat(points, (point) => point.spreadGap);
  const mid = stat(points, (point) => point.midGap);
  const lag = stat(points, (point) => point.lagMs);
  const slippage = stat(points, (point) => point.slippageBps);
  const depth = stat(points, (point) => point.depthRatio * 100);
  const risk = stat(points, (point) => point.routingRisk);
  const edge = stat(points, (point) => point.executionEdgeBps);
  const freshness = stat(points, (point) => point.quoteFreshnessScore);
  const lpHealth = stat(points, (point) => point.lpHealthScore);
  const verdict = headlineVerdict(points, input.recommendations, input.benchmarkName);

  if (!points.length) {
    return [
      `# Liquidity Intelligence Report - ${input.assetPair}`,
      '',
      `Generated: ${input.generatedAt.toLocaleString()}`,
      `Benchmark: ${input.benchmarkName}`,
      `Requested window: last ${input.windowLabel}`,
      '',
      '## Headline Verdict',
      verdict,
      '',
      '## Data Availability',
      'No observed streaming data exists in the selected window. Keep the dashboard running, then export again.',
      '',
      '## Disclaimer',
      'This report is based only on observed streaming data captured by the local dashboard during the selected period.',
    ].join('\n');
  }

  return [
    `# Liquidity Intelligence Report - ${input.assetPair}`,
    '',
    `Generated: ${input.generatedAt.toLocaleString()}`,
    `Selected pair: ${input.assetPair}`,
    `Benchmark: ${input.benchmarkName}`,
    `Requested window: last ${input.windowLabel}`,
    `Available observed data: ${formatDuration(availableMs)}${partial ? ` (partial window; requested ${formatDuration(input.windowMs)})` : ''}`,
    `Sample count: ${points.length}`,
    '',
    '## Headline Verdict',
    verdict,
    '',
    '## Executive Summary',
    `The dashboard observed ${points.length} samples over ${formatDuration(availableMs)}. Current routing posture is driven by spread competitiveness, executable edge, top-5 depth, quote freshness, and composite routing risk.`,
    '',
    '## Key Metrics Summary',
    '| Metric | Latest | Average | Min | Max |',
    '| --- | ---: | ---: | ---: | ---: |',
    tableRow('Spread delta', spread, 'bps'),
    tableRow('Mid deviation', mid, 'bps'),
    plainRow('Quote lag', lag, 'ms', 0),
    tableRow('Slippage advantage', slippage, 'bps'),
    plainRow('Top-5 depth ratio', depth, '%', 0),
    plainRow('Routing risk', risk, '/100', 0),
    tableRow('Executable edge', edge, 'bps'),
    plainRow('Quote freshness', freshness, '/100', 0),
    plainRow('LP health', lpHealth, '/100', 0),
    '',
    '## Spread Competitiveness Analysis',
    `Average spread delta was ${signed(spread.avg)} bps. Positive values mean TrueMarkets was wider than ${input.benchmarkName}; negative values mean TrueMarkets was tighter.`,
    '',
    '## Mid Deviation / Dislocation Analysis',
    `Average mid deviation was ${signed(mid.avg)} bps with a maximum absolute observed deviation of ${Math.max(Math.abs(mid.min), Math.abs(mid.max)).toFixed(2)} bps.`,
    '',
    '## Lag / Reaction Analysis',
    `Average quote lag was ${lag.avg.toFixed(0)} ms. Quote freshness averaged ${freshness.avg.toFixed(0)}/100.`,
    '',
    '## Depth / Liquidity Analysis',
    `Top-5 displayed depth averaged ${depth.avg.toFixed(0)}% of the benchmark. Latest executable edge was ${signed(edge.latest)} bps.`,
    '',
    '## Top Alerts / Events',
    eventSummary(points),
    '',
    '## Recommended Next Actions',
    recommendationMarkdown(input.recommendations),
    '',
    '## Raw Snapshot Summary',
    `Latest snapshot at ${new Date(last.timestamp).toLocaleString()}: spread delta ${signed(last.spreadGap)} bps, mid deviation ${signed(last.midGap)} bps, lag ${Math.round(last.lagMs)} ms, depth ratio ${Math.round(last.depthRatio * 100)}%, routing risk ${Math.round(last.routingRisk)}/100, top recommendation ${last.topRecommendationId ?? 'n/a'}.`,
    '',
    '## Disclaimer',
    'This report is based only on observed streaming data captured by the local dashboard during the selected period. It should not be treated as a complete market-data audit or production routing record.',
  ].join('\n');
}

function pad(value: number) {
  return value.toString().padStart(2, '0');
}

export function buildReportFilename(windowLabel: ReportWindow, assetPair: string, generatedAt: Date) {
  const safePair = assetPair.replace(/[^A-Za-z0-9-]+/g, '_');
  const stamp = [
    generatedAt.getFullYear(),
    pad(generatedAt.getMonth() + 1),
    pad(generatedAt.getDate()),
  ].join('-');
  const time = `${pad(generatedAt.getHours())}${pad(generatedAt.getMinutes())}`;
  return `liquidity_report_${windowLabel}_${safePair}_${stamp}_${time}.md`;
}

export function downloadMarkdownReport(markdown: string, filename: string) {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
