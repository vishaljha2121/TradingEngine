import { useState, useCallback, useEffect, useRef } from 'react';
import type { MetricAlertRule, MetricKey, MetricSnapshot, AlertEvent } from '../types';
import { loadAlertRules, saveAlertRules } from '../dashboard/storage';

interface AlertState {
  rules: MetricAlertRule[];
  activeEvents: AlertEvent[];
}

interface AlertActions {
  toggleAlertRule: (key: MetricKey) => void;
  dismissEvent: (id: string) => void;
  checkSnapshots: (snapshots: MetricSnapshot[]) => void;
}

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export function useMetricAlerts(): AlertState & AlertActions {
  const [rules, setRules] = useState<MetricAlertRule[]>(() => loadAlertRules());
  const [activeEvents, setActiveEvents] = useState<AlertEvent[]>([]);
  
  // Track last fired time per rule to enforce cooldown
  const lastFiredRef = useRef<Partial<Record<MetricKey, number>>>({});

  // Persist rules when they change
  useEffect(() => {
    saveAlertRules(rules);
  }, [rules]);

  // Request browser notification permission if any rules are active and we don't have it
  useEffect(() => {
    if (rules.some(r => r.enabled) && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [rules]);

  const toggleAlertRule = useCallback((key: MetricKey) => {
    setRules(prev => {
      const existingIdx = prev.findIndex(r => r.metricKey === key);
      const next = [...prev];
      if (existingIdx >= 0) {
        next[existingIdx] = { ...next[existingIdx], enabled: !next[existingIdx].enabled };
      } else {
        next.push({
          metricKey: key,
          enabled: true,
          mode: 'outlier',
          minDurationMs: 1500, // wait for 3 ticks worth of outlier
          cooldownMs: 30000,   // silence for 30s after firing
          browserNotification: true,
        });
      }
      return next;
    });
  }, []);

  const dismissEvent = useCallback((id: string) => {
    setActiveEvents(prev => prev.filter(e => e.id !== id));
  }, []);

  const triggerNotification = useCallback((event: AlertEvent) => {
    // Local state toast
    setActiveEvents(prev => {
        // Prevent duplicate concurrent alerts for same metric
        if (prev.some(e => e.metricKey === event.metricKey)) return prev;
        return [...prev, event];
    });

    // Browser Notification
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(`Liquidity Alert: ${event.label}`, {
          body: event.message,
          icon: '/favicon.ico', 
          tag: event.metricKey // Prevent spamming
        });
      } catch {
        // ignore
      }
    }
  }, []);

  const checkSnapshots = useCallback((snapshots: MetricSnapshot[]) => {
    const now = Date.now();
    for (const snap of snapshots) {
      const rule = rules.find(r => r.metricKey === snap.key);
      if (!rule || !rule.enabled) continue;

      const lastFired = lastFiredRef.current[snap.key] || 0;
      if (now - lastFired < rule.cooldownMs) continue; // In cooldown

      // Check condition
      if (rule.mode === 'outlier') {
        const o = snap.outlier;
        if (o.isOutlier && o.sustainedMs >= rule.minDurationMs) {
          lastFiredRef.current[snap.key] = now;
          triggerNotification({
            id: generateId(),
            metricKey: snap.key,
            label: snap.label,
            value: snap.value,
            severity: o.severity,
            message: `Sustained ${o.severity} outlier condition detected.`,
            firedAt: now,
            dismissed: false,
          });
        }
      }
    }
  }, [rules, triggerNotification]);

  // Clean up old active events automatically after 10s
  useEffect(() => {
    if (activeEvents.length === 0) return;
    const timer = setTimeout(() => {
      const now = Date.now();
      setActiveEvents(prev => prev.filter(e => now - e.firedAt < 10000));
    }, 2000);
    return () => clearTimeout(timer);
  }, [activeEvents]);

  return {
    rules,
    activeEvents,
    toggleAlertRule,
    dismissEvent,
    checkSnapshots,
  };
}
