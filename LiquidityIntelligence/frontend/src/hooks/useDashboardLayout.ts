import { useState, useCallback, useEffect } from 'react';
import type { WidgetId } from '../types';
import {
  loadCollapsedWidgets,
  saveCollapsedWidgets,
} from '../dashboard/storage';

export interface DashboardLayoutState {
  collapsed: Set<WidgetId>;
  expandedWidget: WidgetId | null;
  editMode: boolean;
}

export interface DashboardLayoutActions {
  setEditMode: (on: boolean) => void;
  toggleEditMode: () => void;
  collapseWidget: (id: WidgetId) => void;
  restoreWidget: (id: WidgetId) => void;
  expandWidget: (id: WidgetId | null) => void;
  resetLayout: () => void;
}

export function useDashboardLayout(): DashboardLayoutState & DashboardLayoutActions {
  const [editMode, setEditMode] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<WidgetId>>(() => {
    return loadCollapsedWidgets();
  });
  const [expandedWidget, setExpandedWidget] = useState<WidgetId | null>(null);

  // Persist collapsed changes immediately
  useEffect(() => {
    saveCollapsedWidgets(collapsed);
  }, [collapsed]);

  const toggleEditMode = useCallback(() => setEditMode(prev => !prev), []);

  const collapseWidget = useCallback((id: WidgetId) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const restoreWidget = useCallback((id: WidgetId) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const expandWidget = useCallback((id: WidgetId | null) => {
    setExpandedWidget(id);
  }, []);

  const resetLayout = useCallback(() => {
    setCollapsed(new Set());
    setExpandedWidget(null);
    setEditMode(false);
  }, []);

  return {
    collapsed,
    expandedWidget,
    editMode,
    setEditMode,
    toggleEditMode,
    collapseWidget,
    restoreWidget,
    expandWidget,
    resetLayout,
  };
}
