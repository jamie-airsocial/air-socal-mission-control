'use client';

/**
 * useTaskFilters — manages all filter state for the board (search, project, assignee,
 * priority, status, label, date range, group-by, hide-done) plus the derived
 * filteredTasks list (memoised to avoid re-computing on every render).
 *
 * Extracted from board/page.tsx so that component can focus on rendering.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { startOfDay, endOfDay, addDays, startOfMonth, endOfMonth, addMonths, format } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import type { Task } from '@/lib/types';
import type { KanbanGroupBy } from '@/components/board/kanban-board';
import type { ViewFilters } from '@/components/board/saved-views';

type ViewType = 'kanban' | 'table' | 'calendar';
type GroupByType = 'none' | 'project' | 'assignee' | 'status' | 'priority' | 'service' | 'team';
type TaskWithProject = Task & { project_name?: string; project_color?: string };

export type { ViewFilters };

function loadPersistedFilters(v: string) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`board-filters-${v}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function presetToRange(option: string): DateRange | undefined {
  const now = new Date();
  const today = startOfDay(now);
  switch (option) {
    case 'today': return { from: today, to: endOfDay(now) };
    case 'tomorrow': return { from: addDays(today, 1), to: endOfDay(addDays(today, 1)) };
    case 'next7': return { from: today, to: endOfDay(addDays(today, 6)) };
    case 'next30': return { from: today, to: endOfDay(addDays(today, 29)) };
    case 'thisMonth': return { from: startOfMonth(now), to: endOfMonth(now) };
    case 'nextMonth': return { from: startOfMonth(addMonths(now, 1)), to: endOfMonth(addMonths(now, 1)) };
    default: return undefined;
  }
}

export function useTaskFilters(
  view: ViewType,
  tasks: TaskWithProject[],
  kanbanGroupBy: KanbanGroupBy,
  allLabels: string[]
) {
  const initialFilters = loadPersistedFilters(view);

  const [filterProject, setFilterProject] = useState<string[]>(initialFilters?.filterProject || []);
  const [filterAssignee, setFilterAssignee] = useState<string[]>(initialFilters?.filterAssignee || []);
  const [filterPriority, setFilterPriority] = useState<string[]>(initialFilters?.filterPriority || []);
  const [filterStatus, setFilterStatus] = useState<string[]>(initialFilters?.filterStatus || []);
  const [filterLabel, setFilterLabel] = useState<string[]>(initialFilters?.filterLabel || []);
  const [searchQuery, setSearchQuery] = useState<string>(initialFilters?.searchQuery || '');
  // hideDone is persisted per-view so each view remembers its own setting
  const [hideDone, setHideDone] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    // Simple: one global key, no per-view complexity
    const saved = localStorage.getItem('board-hide-done');
    return saved !== null ? saved === 'true' : true;
  });
  // If 'custom' was persisted but no customRange was saved, fall back to 'all'
  const [filterDate, setFilterDate] = useState<string>(
    initialFilters?.filterDate === 'custom' ? 'all' : (initialFilters?.filterDate || 'all')
  );
  const [groupBy, setGroupBy] = useState<GroupByType>(initialFilters?.groupBy || 'none');
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined);
  const [clearTrigger, setClearTrigger] = useState(0);

  // Track the current view in a ref so we can detect view switches
  const viewRef = useRef(view);
  const isViewSwitching = useRef(false);

  // When view changes, flag that we're switching so the persist effect doesn't
  // overwrite the NEW view's stored filters with the OLD view's state
  useEffect(() => {
    if (viewRef.current !== view) {
      isViewSwitching.current = true;
      viewRef.current = view;
    }
  }, [view]);

  // Persist filters per-view whenever they change (skip during view switch)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isViewSwitching.current) {
      isViewSwitching.current = false;
      return;
    }
    const data = { filterProject, filterAssignee, filterPriority, filterStatus, filterLabel, searchQuery, filterDate, groupBy };
    localStorage.setItem(`board-filters-${view}`, JSON.stringify(data));
  }, [view, filterProject, filterAssignee, filterPriority, filterStatus, filterLabel, searchQuery, filterDate, groupBy]);

  // Auto-clear filter labels that no longer exist in any task
  const allLabelsKey = allLabels.join(',');
  useEffect(() => {
    if (filterLabel.length > 0) {
      const valid = filterLabel.filter(l => allLabels.includes(l));
      if (valid.length !== filterLabel.length) setFilterLabel(valid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allLabelsKey]);

  const hasFilters = Boolean(
    searchQuery ||
    filterProject.length > 0 ||
    filterAssignee.length > 0 ||
    filterPriority.length > 0 ||
    filterStatus.length > 0 ||
    filterLabel.length > 0 ||
    filterDate !== 'all'
  );

  const clearAllFilters = useCallback(() => {
    setSearchQuery('');
    setFilterProject([]);
    setFilterAssignee([]);
    setFilterPriority([]);
    setFilterStatus([]);
    setFilterLabel([]);
    setFilterDate('all');
    setCustomRange(undefined);
    setClearTrigger(prev => prev + 1);
  }, []);

  const setHideDonePersisted = useCallback((value: boolean) => {
    setHideDone(value);
    localStorage.setItem('board-hide-done', String(value));
  }, []);

  // Load persisted filters for a specific view (used when switching views)
  const loadPersistedForView = useCallback((targetView: string) => {
    const saved = loadPersistedFilters(targetView);
    if (saved) {
      setFilterProject(saved.filterProject || []);
      setFilterAssignee(saved.filterAssignee || []);
      setFilterPriority(saved.filterPriority || []);
      setFilterStatus(saved.filterStatus || []);
      setFilterLabel(saved.filterLabel || []);
      setSearchQuery(saved.searchQuery || '');
      setFilterDate(saved.filterDate === 'custom' ? 'all' : (saved.filterDate || 'all'));
      setGroupBy(saved.groupBy || 'none');
      setCustomRange(undefined);
    } else {
      clearAllFilters();
    }
  }, [clearAllFilters]);

  const currentViewFilters: ViewFilters = {
    filterProject: filterProject.join(','),
    filterAssignee: filterAssignee.join(','),
    filterPriority: filterPriority.join(','),
    filterStatus: filterStatus.join(','),
    filterLabel: filterLabel.join(','),
    filterDate,
    hideDone,
    groupBy,
    view,
  };

  const loadView = useCallback((filters: ViewFilters) => {
    setFilterProject(filters.filterProject?.split(',').filter(Boolean) || []);
    setFilterAssignee(filters.filterAssignee?.split(',').filter(Boolean) || []);
    setFilterPriority(filters.filterPriority?.split(',').filter(Boolean) || []);
    setFilterStatus(filters.filterStatus?.split(',').filter(Boolean) || []);
    setFilterLabel(filters.filterLabel?.split(',').filter(Boolean) || []);
    setFilterDate(filters.filterDate);
    setHideDonePersisted(filters.hideDone);
    setGroupBy(filters.groupBy);
    if (filters.filterDate !== 'all' && filters.filterDate !== 'overdue' && filters.filterDate !== 'no-date') {
      setCustomRange(presetToRange(filters.filterDate));
    } else {
      setCustomRange(undefined);
    }
  }, [setHideDonePersisted]);

  const customDateFrom = customRange?.from;
  const customDateTo = customRange?.to;

  const dateFilterLabels: Record<string, string> = useMemo(() => ({
    all: 'All time',
    today: 'Today',
    tomorrow: 'Tomorrow',
    next7: 'Next 7 days',
    next30: 'Next 30 days',
    thisMonth: 'This month',
    nextMonth: 'Next month',
    overdue: 'Overdue',
    'no-date': 'No date',
    custom: customDateFrom || customDateTo
      ? `${customDateFrom ? format(customDateFrom, 'd MMM') : '...'} – ${customDateTo ? format(customDateTo, 'd MMM') : '...'}`
      : 'Custom range',
  }), [customDateFrom, customDateTo]);

  // Top-level tasks only (no subtasks shown in board views)
  const topLevelTasks = useMemo(() => tasks.filter(t => !t.parent_id), [tasks]);

  // Memoised filtered task list — only recomputes when filter values or tasks change.
  // Previously this was inlined in board/page.tsx and ran on EVERY render
  // (including unrelated state changes like sheetOpen, popover states, etc).
  const filteredTasks = useMemo(() => {
    return topLevelTasks.filter(t => {
      if (
        hideDone &&
        (view === 'table' || view === 'calendar' || (view === 'kanban' && kanbanGroupBy !== 'status')) &&
        t.status === 'done'
      ) return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !t.title.toLowerCase().includes(q) &&
          !(t.assignee && t.assignee.toLowerCase().includes(q)) &&
          !(t.project_name && t.project_name.toLowerCase().includes(q)) &&
          !(t.labels && t.labels.some((l: string) => l.toLowerCase().includes(q)))
        ) return false;
      }

      if (filterProject.length > 0) {
        if (!t.project_id || !filterProject.includes(t.project_id)) return false;
      }
      if (filterAssignee.length > 0) {
        if (!t.assignee || !filterAssignee.includes(t.assignee)) return false;
      }
      if (filterPriority.length > 0) {
        if (!t.priority || !filterPriority.includes(t.priority)) return false;
      }
      if (filterStatus.length > 0) {
        if (!filterStatus.includes(t.status)) return false;
      }
      if (filterLabel.length > 0) {
        const taskLabels = t.labels || [];
        if (taskLabels.length === 0 || !filterLabel.some((l: string) => taskLabels.includes(l))) return false;
      }

      if (filterDate !== 'all') {
        const dueDate = t.due_date ? new Date(t.due_date) : null;
        if (filterDate === 'no-date') return !dueDate;
        if (!dueDate) return false;

        if (filterDate === 'overdue') {
          // Done tasks are never "overdue" — they are already completed
          if (t.status === 'done') return false;
          const startOfToday = startOfDay(new Date());
          if (dueDate >= startOfToday) return false;
        } else if (filterDate === 'custom') {
          if (customDateFrom && dueDate < customDateFrom) return false;
          if (customDateTo) {
            const endOfTo = endOfDay(customDateTo);
            if (dueDate > endOfTo) return false;
          }
        } else {
          const range = presetToRange(filterDate);
          if (range) {
            if (range.from && dueDate < range.from) return false;
            if (range.to && dueDate > range.to) return false;
          }
        }
      }

      return true;
    });
  }, [
    topLevelTasks, hideDone, view, kanbanGroupBy,
    searchQuery, filterProject, filterAssignee, filterPriority,
    filterStatus, filterLabel, filterDate, customDateFrom, customDateTo,
  ]);

  return {
    // Filter values
    filterProject, setFilterProject,
    filterAssignee, setFilterAssignee,
    filterPriority, setFilterPriority,
    filterStatus, setFilterStatus,
    filterLabel, setFilterLabel,
    searchQuery, setSearchQuery,
    hideDone, setHideDone: setHideDonePersisted,
    filterDate, setFilterDate,
    groupBy, setGroupBy,
    customRange, setCustomRange,
    clearTrigger,
    customDateFrom,
    customDateTo,
    // Derived
    hasFilters,
    filteredTasks,
    dateFilterLabels,
    currentViewFilters,
    // Actions
    clearAllFilters,
    loadView,
    loadPersistedForView,
  };
}
