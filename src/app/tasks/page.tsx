'use client';

import { KanbanBoard, type KanbanGroupBy } from '@/components/board/kanban-board';
import { TableView } from '@/components/board/table-view';
import { CalendarView } from '@/components/board/calendar-view';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { useState, useEffect, useCallback, Suspense, useMemo } from 'react';
import type { Task } from '@/lib/types';
import { TaskSheet } from '@/components/board/task-sheet';
import { Button } from '@/components/ui/button';
import { FilterProjectPopover } from '@/components/board/filter-project-popover';
import { FilterAssigneePopover } from '@/components/board/filter-assignee-popover';
import { FilterPriorityPopover } from '@/components/board/filter-priority-popover';
import { FilterStatusPopover } from '@/components/board/filter-status-popover';
import { FilterLabelPopover } from '@/components/board/filter-label-popover';
import { FilterServicePopover } from '@/components/board/filter-service-popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { LayoutGrid, Table2, Plus, Search, Eye, EyeOff, CalendarDays, X, ChevronDown, Check } from 'lucide-react';
import { TEAM_STYLES } from '@/lib/constants';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { SavedViews } from '@/components/board/saved-views';
import { toast } from 'sonner';
import { useSearchParams, useRouter } from 'next/navigation';
import { KanbanBoardSkeleton, TableViewSkeleton, CalendarViewSkeleton } from '@/components/ui/skeleton-loaders';
import { useBoardData } from '@/hooks/use-board-data';
import { useTaskFilters, presetToRange } from '@/hooks/use-task-filters';

type TaskWithProject = Task & { project_name?: string; project_color?: string; client_name?: string; client_color?: string; client_team?: string };

function BoardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // ── View state ────────────────────────────────────────────────────────────
  const [view, setView] = useState<'kanban' | 'table' | 'calendar'>(() => {
    if (typeof window === 'undefined') return 'kanban';
    return (localStorage.getItem('board-view') as 'kanban' | 'table' | 'calendar') ?? 'kanban';
  });
  const [kanbanGroupBy, setKanbanGroupBy] = useState<KanbanGroupBy>(() => {
    if (typeof window === 'undefined') return 'status';
    return (localStorage.getItem('kanban-group-by') as KanbanGroupBy) || 'status';
  });
  const [groupByOpen, setGroupByOpen] = useState(false);
  const [kanbanGroupByOpen, setKanbanGroupByOpen] = useState(false);
  const [filterService, setFilterService] = useState<string[]>([]);
  const [filterTeam, setFilterTeam] = useState<string[]>([]);

  // Persist kanban group-by
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('kanban-group-by', kanbanGroupBy);
  }, [kanbanGroupBy]);

  // ── Sheet state ───────────────────────────────────────────────────────────
  const [selectedTask, setSelectedTask] = useState<TaskWithProject | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isNew, setIsNew] = useState(false);

  // ── Data ──────────────────────────────────────────────────────────────────
  const {
    tasks, setTasks, projects, loading, fetchTasks,
    allLabels, handleStatusChange, handleFieldChange,
    handleLabelRename, handleLabelDelete, handleLabelCreate,
  } = useBoardData();

  // ── Filters ───────────────────────────────────────────────────────────────
  const {
    filterProject, setFilterProject,
    filterAssignee, setFilterAssignee,
    filterPriority, setFilterPriority,
    filterStatus, setFilterStatus,
    filterLabel, setFilterLabel,
    searchQuery, setSearchQuery,
    hideDone, setHideDone,
    filterDate, setFilterDate,
    groupBy, setGroupBy,
    customRange, setCustomRange,
    clearTrigger, customDateFrom, customDateTo,
    hasFilters, filteredTasks, dateFilterLabels,
    currentViewFilters, clearAllFilters, loadView, loadPersistedForView,
  } = useTaskFilters(view, tasks, kanbanGroupBy, allLabels);

  // Controlled state for the date filter popover so "Clear range" can close it (#32)
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);

  // Augment hasFilters/clearAll with service filter
  const hasAnyFilters = hasFilters || filterService.length > 0 || filterTeam.length > 0;
  const clearAll = useCallback(() => { clearAllFilters(); setFilterService([]); }, [clearAllFilters]);

  // ── View switching ────────────────────────────────────────────────────────
  const handleViewChange = useCallback((newView: string) => {
    if (newView && newView !== view) {
      setView(newView as 'kanban' | 'table' | 'calendar');
      localStorage.setItem('board-view', newView);
      // Restore persisted filters for the target view (instead of clearing)
      loadPersistedForView(newView);
    }
  }, [view, loadPersistedForView]);

  // ── Deep-linking: auto-open task from URL (?task=<id>) ────────────────────
  useEffect(() => {
    const taskId = searchParams.get('task');
    if (taskId && tasks.length > 0) {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        setSelectedTask(task);
        setIsNew(false);
        setSheetOpen(true);
        router.replace('/board', { scroll: false });
      }
    }
  }, [searchParams, tasks, router]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (isInput) return;

      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !sheetOpen) {
        e.preventDefault();
        setIsNew(true);
        setSelectedTask(null);
        setSheetOpen(true);
      }
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !sheetOpen) {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('input[aria-label="Filter tasks"]')?.focus();
      }
      if (e.key === 'Escape') {
        if (sheetOpen) {
          setSheetOpen(false);
          setSelectedTask(null);
        } else {
          (document.activeElement as HTMLElement)?.blur();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [sheetOpen]);

  // ── Task CRUD ─────────────────────────────────────────────────────────────
  const handleTaskClick = useCallback((task: TaskWithProject) => {
    setSelectedTask(task);
    setIsNew(false);
    setSheetOpen(true);
  }, []);

  const handleSave = useCallback(async (data: Partial<Task>, opts?: { optimistic?: boolean; taskId?: string }) => {
    if (opts?.optimistic && opts.taskId) {
      setTasks(prev => prev.map(t => t.id === opts.taskId ? { ...t, ...data } : t));
      return;
    }
    if (Object.keys(data).length === 0) {
      fetchTasks();
      return;
    }
    if (isNew) {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        toast.error('Failed to create task');
        return; // Don't close sheet — let the user retry
      }
    } else if (selectedTask) {
      setTasks(prev => prev.map(t => t.id === selectedTask.id ? { ...t, ...data } : t));
      const res = await fetch(`/api/tasks/${selectedTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        toast.error('Failed to save task');
        fetchTasks(); // Revert the optimistic update
        return;
      }
    }
    setSheetOpen(false);
    setSelectedTask(null);
    fetchTasks();
  }, [isNew, selectedTask, setTasks, fetchTasks]);

  const handleDelete = useCallback(async () => {
    if (!selectedTask) return;
    const deletedTask = selectedTask;
    const res = await fetch(`/api/tasks/${selectedTask.id}`, { method: 'DELETE' });
    if (!res.ok) {
      // Don't remove from local state — deletion failed
      toast.error('Failed to delete task');
      return;
    }
    setSheetOpen(false);
    setSelectedTask(null);
    fetchTasks();
    // Only offer Undo for leaf tasks — tasks with subtasks cannot be safely
    // restored because their subtasks (and their attachments) are also deleted.
    const hasSubtasks = (deletedTask.subtask_count || 0) > 0;
    toast.success('Task deleted', {
      description: hasSubtasks ? 'Subtasks and attachments were also deleted and cannot be restored.' : undefined,
      action: hasSubtasks ? undefined : {
        label: 'Undo',
        onClick: async () => {
          try {
            const res = await fetch('/api/tasks', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: deletedTask.id,
                title: deletedTask.title,
                status: deletedTask.status,
                priority: deletedTask.priority,
                assignee: deletedTask.assignee,
                client_id: deletedTask.client_id,
                service: deletedTask.service,
                due_date: deletedTask.due_date,
                description: deletedTask.description,
                parent_id: deletedTask.parent_id,
              }),
            });
            if (!res.ok) { toast.error('Failed to restore task'); return; }
            toast.success('Task restored');
            fetchTasks();
          } catch {
            toast.error('Failed to restore task');
          }
        },
      },
      duration: 5000,
    });
  }, [selectedTask, fetchTasks]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const openNewTask = useCallback((defaults?: Partial<TaskWithProject>) => {
    setIsNew(true);
    setSelectedTask(defaults as TaskWithProject | null ?? null);
    setSheetOpen(true);
  }, []);

  // Apply service filter on top of useTaskFilters results
  const serviceFilteredTasks = useMemo(() => {
    let result = filteredTasks;
    if (filterService.length > 0) {
      result = result.filter(t => t.service && filterService.includes(t.service));
    }
    if (filterTeam.length > 0) {
      result = result.filter(t => t.client_team && filterTeam.includes(t.client_team));
    }
    return result;
  }, [filteredTasks, filterService, filterTeam]);

  const totalTasks = serviceFilteredTasks.length;

  // Memoised label → task count map for the FilterLabelPopover
  const taskCounts = useMemo(() => {
    const c: Record<string, number> = {};
    tasks.forEach(t => (t.labels || []).forEach((l: string) => { c[l] = (c[l] || 0) + 1; }));
    return c;
  }, [tasks]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="animate-in fade-in duration-200">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
          <p className="text-[13px] text-muted-foreground/60 mt-1">
            {totalTasks} tasks
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ToggleGroup type="single" value={view} onValueChange={handleViewChange}>
            <ToggleGroupItem value="kanban" aria-label="Kanban view" className="focus-visible:ring-2 focus-visible:ring-primary/50">
              <LayoutGrid className="h-4 w-4 mr-1" aria-hidden="true" />
              <span className="text-[13px]">Kanban</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="table" aria-label="Table view" className="focus-visible:ring-2 focus-visible:ring-primary/50">
              <Table2 className="h-4 w-4 mr-1" aria-hidden="true" />
              <span className="text-[13px]">Table</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="calendar" aria-label="Calendar view" className="focus-visible:ring-2 focus-visible:ring-primary/50">
              <CalendarDays className="h-4 w-4 mr-1" aria-hidden="true" />
              <span className="text-[13px]">Calendar</span>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search..."
            aria-label="Filter tasks"
            className="h-8 w-full sm:w-[180px] pl-8 pr-3 text-[13px] bg-secondary border border-border/20 rounded-lg outline-none focus:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors duration-150 placeholder:text-muted-foreground/60"
          />
        </div>

        {!(view === 'kanban' && kanbanGroupBy === 'status') && !(view === 'table' && groupBy === 'status') && (
          <FilterStatusPopover value={filterStatus} onChange={setFilterStatus} />
        )}
        {!(view === 'kanban' && kanbanGroupBy === 'project') && !(view === 'table' && groupBy === 'project') && (
          <FilterProjectPopover value={filterProject} projects={projects} onChange={setFilterProject} />
        )}
        {!(view === 'kanban' && kanbanGroupBy === 'assignee') && !(view === 'table' && groupBy === 'assignee') && (
          <FilterAssigneePopover value={filterAssignee} onChange={setFilterAssignee} />
        )}
        {!(view === 'kanban' && kanbanGroupBy === 'priority') && !(view === 'table' && groupBy === 'priority') && (
          <FilterPriorityPopover value={filterPriority} onChange={setFilterPriority} />
        )}

        <FilterLabelPopover
          value={filterLabel}
          allLabels={allLabels}
          onChange={setFilterLabel}
          taskCounts={taskCounts}
          onRenameLabel={handleLabelRename}
          onDeleteLabel={handleLabelDelete}
          onCreateLabel={handleLabelCreate}
        />

        <FilterServicePopover value={filterService} onChange={setFilterService} />

        {view !== 'calendar' && (
          <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
            <PopoverTrigger asChild>
              <button
                aria-label="Filter by date"
                className={`h-8 px-3 text-[13px] bg-secondary border rounded-lg hover:border-primary/50 transition-colors duration-150 flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none ${filterDate !== 'all' ? 'border-primary text-primary' : 'border-border/20'}`}
              >
                <CalendarDays className="h-3 w-3" />
                {dateFilterLabels[filterDate]}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3" align="start">
              <div className="flex gap-3">
                <div className="flex flex-col gap-0.5 min-w-[120px]">
                  {['all', 'today', 'tomorrow', 'next7', 'next30', 'thisMonth', 'nextMonth', 'overdue', 'no-date'].map(option => (
                    <button
                      key={option}
                      onClick={() => {
                        setFilterDate(option);
                        setCustomRange(presetToRange(option));
                      }}
                      className={`px-2 py-1 text-[13px] rounded-md text-left transition-colors duration-150 ${
                        filterDate === option ? 'bg-primary/20 text-primary' : 'hover:bg-accent text-muted-foreground'
                      }`}
                    >
                      {dateFilterLabels[option]}
                    </button>
                  ))}
                </div>
                <div className="border-l border-border/20 pl-3">
                  <Calendar
                    mode="range"
                    selected={customRange}
                    onSelect={range => {
                      setCustomRange(range);
                      if (range?.from) setFilterDate('custom');
                    }}
                    numberOfMonths={1}
                    className="p-0"
                    classNames={{
                      range_start: 'rounded-l-md !bg-primary/50',
                      range_middle: 'rounded-none !bg-primary/30',
                      range_end: 'rounded-r-md !bg-primary/50',
                    }}
                  />
                  {filterDate !== 'all' && (
                    <button
                      onClick={() => { setCustomRange(undefined); setFilterDate('all'); setDatePopoverOpen(false); }}
                      className="w-full mt-2 px-2.5 py-1.5 text-[13px] rounded-md text-destructive hover:bg-destructive/10 transition-colors duration-150 text-center"
                    >
                      Clear range
                    </button>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {(view === 'table' || view === 'calendar' || (view === 'kanban' && kanbanGroupBy !== 'status')) && (
          <button
            onClick={() => setHideDone(!hideDone)}
            aria-label={hideDone ? 'Show completed tasks' : 'Hide completed tasks'}
            className="h-8 px-3 text-[13px] rounded-lg border border-border/20 bg-secondary text-muted-foreground hover:text-foreground transition-colors duration-150 flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
          >
            {hideDone ? <Eye className="h-3 w-3" aria-hidden="true" /> : <EyeOff className="h-3 w-3" aria-hidden="true" />}
            {hideDone ? 'Show completed' : 'Hide completed'}
          </button>
        )}

        {view === 'table' && (
          <Popover open={groupByOpen} onOpenChange={setGroupByOpen}>
            <PopoverTrigger asChild>
              <button className={`h-8 px-3 text-[13px] bg-secondary border rounded-lg transition-colors duration-150 flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none ${groupBy !== 'none' ? 'border-primary text-primary' : 'border-border/20 hover:border-primary/50 text-muted-foreground'}`}>
                <span>Group by:</span>
                <span className="font-medium">{{ none: 'None', project: 'Client', assignee: 'Assignee', status: 'Status', priority: 'Priority', service: 'Service', team: 'Team' }[groupBy] || groupBy}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1 bg-card border border-border/20 rounded-lg shadow-lg" align="start">
              <div className="flex flex-col">
                {(['none', 'project', 'assignee', 'status', 'priority', 'service', 'team'] as const).map(option => {
                  const labels: Record<string, string> = { none: 'None', project: 'Client', assignee: 'Assignee', status: 'Status', priority: 'Priority', service: 'Service', team: 'Team' };
                  return (
                    <button
                      key={option}
                      onClick={() => { setGroupBy(option); setGroupByOpen(false); }}
                      className={`px-3 py-2 text-left text-[13px] rounded-md transition-colors duration-150 ${groupBy === option ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/40 text-muted-foreground'}`}
                    >
                      {labels[option]}
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {view === 'kanban' && (
          <Popover open={kanbanGroupByOpen} onOpenChange={setKanbanGroupByOpen}>
            <PopoverTrigger asChild>
              <button className={`h-8 px-3 text-[13px] bg-secondary border rounded-lg transition-colors duration-150 flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none ${kanbanGroupBy !== 'status' ? 'border-primary text-primary' : 'border-border/20 hover:border-primary/50 text-muted-foreground'}`}>
                <span>Group by:</span>
                <span className="font-medium">{{ status: 'Status', priority: 'Priority', project: 'Client', assignee: 'Assignee', service: 'Service', team: 'Team' }[kanbanGroupBy] || kanbanGroupBy}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1 bg-card border border-border/20 rounded-lg shadow-lg" align="start">
              <div className="flex flex-col">
                {(['status', 'priority', 'project', 'assignee', 'service', 'team'] as const).map(option => {
                  const labels: Record<string, string> = { status: 'Status', priority: 'Priority', project: 'Client', assignee: 'Assignee', service: 'Service', team: 'Team' };
                  return (
                  <button
                    key={option}
                    onClick={() => { setKanbanGroupBy(option); setKanbanGroupByOpen(false); }}
                    className={`px-3 py-2 text-left text-[13px] rounded-md transition-colors duration-150 ${kanbanGroupBy === option ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/40 text-muted-foreground'}`}
                  >
                    {labels[option]}
                  </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        )}

        <SavedViews
          currentFilters={currentViewFilters}
          onLoadView={loadView}
          clearTrigger={clearTrigger}
          currentView={view}
        />

        {hasAnyFilters && (
          <button
            onClick={clearAll}
            aria-label="Clear all filters"
            className="h-8 px-3 text-[13px] rounded-lg border border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors duration-150 flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
          >
            <X className="h-3 w-3" aria-hidden="true" />
            Clear all
          </button>
        )}

        <div className="flex-1" />

        <TooltipProvider delayDuration={500}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" onClick={() => openNewTask()}>
                <Plus className="h-4 w-4 mr-1" /> New Task
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[13px]">New task (N)</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Board views */}
      {loading ? (
        view === 'kanban' ? <KanbanBoardSkeleton /> : view === 'calendar' ? <CalendarViewSkeleton /> : <TableViewSkeleton />
      ) : view === 'kanban' ? (
        <div className="animate-in fade-in duration-200">
          <ErrorBoundary fallbackTitle="Board failed to load" fallbackSubtitle="The kanban board encountered an error. Try again.">
            <KanbanBoard
              tasks={serviceFilteredTasks}
              onTaskClick={handleTaskClick}
              onStatusChange={handleStatusChange}
              onFieldChange={handleFieldChange}
              groupBy={kanbanGroupBy}
              projects={projects}
              onViewCompleted={() => {
                setFilterStatus(['done']);
                setHideDone(false);
                setView('table');
                document.getElementById('main-content')?.scrollTo({ top: 0 });
              }}
              onAddTask={columnId => {
                const base: TaskWithProject = {
                  id: '',
                  title: '',
                  description: null,
                  status: 'todo' as Task['status'],
                  priority: 'P3' as Task['priority'],
                  assignee: 'casper' as Task['assignee'],
                  project_id: null,
                  client_id: null,
                  service: null,
                  parent_id: null,
                  due_date: null,
                  completed_at: null,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                };
                if (kanbanGroupBy === 'status') base.status = columnId as Task['status'];
                else if (kanbanGroupBy === 'priority') base.priority = columnId as Task['priority'];
                else if (kanbanGroupBy === 'project') base.client_id = columnId === 'no-client' ? null : columnId;
                else if (kanbanGroupBy === 'assignee') base.assignee = (columnId === 'unassigned' ? '' : columnId) as Task['assignee'];
                openNewTask(base);
              }}
            />
          </ErrorBoundary>
        </div>
      ) : view === 'table' ? (
        <div className="animate-in fade-in duration-200">
          <ErrorBoundary fallbackTitle="Table failed to load" fallbackSubtitle="The table view encountered an error. Try again.">
            <TableView
              tasks={serviceFilteredTasks}
              allTasks={tasks}
              projects={projects}
              allLabels={allLabels}
              onTaskClick={handleTaskClick}
              onUpdate={(taskId?: string, patch?: Partial<Task>) => {
                if (taskId && patch) {
                  setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...patch } : t));
                } else {
                  fetchTasks();
                }
              }}
              groupBy={groupBy}
            />
          </ErrorBoundary>
        </div>
      ) : (
        <div className="animate-in fade-in duration-200">
          <ErrorBoundary fallbackTitle="Calendar failed to load" fallbackSubtitle="The calendar view encountered an error. Try again.">
            <CalendarView
              tasks={serviceFilteredTasks}
              hasFilters={hasAnyFilters}
              onTaskClick={handleTaskClick}
              onDateChange={(taskId, newDate) => {
                const task = tasks.find(t => t.id === taskId);
                setTasks(prev => prev.map(t => t.id === taskId ? { ...t, due_date: newDate } : t));
                const d = new Date(newDate);
                const dateStr = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
                const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
                const timeStr = hasTime ? ` at ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '';
                toast.success(`Moved to ${dateStr}${timeStr}`, { description: task?.title, duration: 2500 });
                fetch(`/api/tasks/${taskId}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ due_date: newDate }),
                }).then(res => {
                  if (!res.ok) toast.error('Failed to save date change');
                }).catch(() => toast.error('Failed to save date change'));
              }}
              onCreateTask={defaultDate => {
                openNewTask({
                  id: '',
                  title: '',
                  description: null,
                  status: 'todo' as Task['status'],
                  priority: 'P3' as Task['priority'],
                  assignee: 'casper' as Task['assignee'],
                  project_id: null,
                  client_id: null,
                  service: null,
                  parent_id: null,
                  due_date: defaultDate,
                  completed_at: null,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                } as TaskWithProject);
              }}
            />
          </ErrorBoundary>
        </div>
      )}

      <TaskSheet
        task={selectedTask}
        open={sheetOpen}
        onClose={() => { setSheetOpen(false); setSelectedTask(null); }}
        onSave={handleSave}
        onDelete={handleDelete}
        projects={projects}
        isNew={isNew}
        allTasks={tasks}
        onTaskClick={handleTaskClick}
        allLabels={allLabels}
      />
    </div>
  );
}

export default function BoardPage() {
  return (
    <Suspense fallback={<KanbanBoardSkeleton />}>
      <BoardContent />
    </Suspense>
  );
}
