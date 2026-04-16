import type { DashboardLayoutItem, WidgetId, MetricAlertRule } from '../types';

const STORAGE_KEYS = {
  LAYOUT: 'liq-console:layout',
  COLLAPSED: 'liq-console:collapsed',
  ALERTS: 'liq-console:alerts',
} as const;

// ─── Layout Persistence ───

export function loadDashboardLayout(): DashboardLayoutItem[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LAYOUT);
    if (!raw) return null;
    return JSON.parse(raw) as DashboardLayoutItem[];
  } catch {
    return null;
  }
}

export function saveDashboardLayout(layout: DashboardLayoutItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.LAYOUT, JSON.stringify(layout));
  } catch {
    // Storage full or unavailable — fail silently
  }
}

// ─── Collapsed Widget Persistence ───

export function loadCollapsedWidgets(): Set<WidgetId> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.COLLAPSED);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as WidgetId[]);
  } catch {
    return new Set();
  }
}

export function saveCollapsedWidgets(collapsed: Set<WidgetId>): void {
  try {
    localStorage.setItem(STORAGE_KEYS.COLLAPSED, JSON.stringify([...collapsed]));
  } catch {
    // fail silently
  }
}

// ─── Alert Rule Persistence ───

export function loadAlertRules(): MetricAlertRule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ALERTS);
    if (!raw) return [];
    return JSON.parse(raw) as MetricAlertRule[];
  } catch {
    return [];
  }
}

export function saveAlertRules(rules: MetricAlertRule[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify(rules));
  } catch {
    // fail silently
  }
}

// ─── Full Reset ───

export function clearAllDashboardStorage(): void {
  Object.values(STORAGE_KEYS).forEach(key => {
    try { localStorage.removeItem(key); } catch { /* noop */ }
  });
}
