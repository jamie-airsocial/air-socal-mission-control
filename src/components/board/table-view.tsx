'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { Task, Project } from '@/lib/types';

import { ArrowUpDown, ArrowUp, ArrowDown, CheckSquare, X, ChevronRight, ChevronLeft, Trash2 } from 'lucide-react';
import { formatDueDate, getDueDateColor } from '@/lib/date';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { EnhancedDatePicker } from '@/components/board/enhanced-date-picker';
import { SearchableStatusPopover } from '@/components/board/searchable-status-popover';
import { SearchablePriorityPopover } from '@/components/board/searchable-priority-popover';
import { SearchableAssigneePopover } from '@/components/board/searchable-assignee-popover';
import { SearchableProjectPopover } from '@/components/board/searchable-project-popover';
import { STATUS_STYLES, PRIORITY_STYLES, ASSIGNEE_COLORS, normalisePriority, toSlug, toDisplayName, getInitials } from '@/lib/constants';
import { LabelCombobox } from '@/components/board/label-combobox';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { toast } from 'sonner';

// Shared cell wrapper styles for editable cells
const CELL_BASE = 'rounded-md px-1.5 py-0.5 -mx-1.5 -my-0.5 border border-transparent cursor-pointer transition-colors duration-150';
const CELL_HOVER = 'hover:border-border/20 hover:bg-muted/40';
const CELL_ACTIVE = 'border-primary/30 bg-muted/40';

type GroupBy = 'none' | 'project' | 'assignee' | 'status' | 'priority' | 'service' | 'team';

type ExtTask = Task & { project_name?: string; project_color?: string };

/** Typed sort-value extractor — eliminates the need for any-typed sort comparators (#12) */
function getSortValue(task: ExtTask, field: string): string | number | null {
  if (field === 'project_name') return (task as ExtTask).project_name || '';
  if (field === 'due_date') return task.due_date ? new Date(task.due_date).getTime() : Infinity;
  if (field === 'priority') {
    const order: Record<string, number> = { P1: 1, P2: 2, P3: 3, P4: 4 };
    return order[normalisePriority(task.priority || '')] || 99;
  }
  if (field === 'status') {
    const order: Record<string, number> = { doing: 1, todo: 2, done: 3, backlog: 4 };
    return order[task.status] || 99;
  }
  if (field === 'assignee') return task.assignee || '';
  if (field === 'title') return task.title?.toLowerCase() || '';
  return null;
}

interface TableViewProps {
  tasks: (Task & { project_name?: string; project_color?: string })[];
  allTasks?: (Task & { project_name?: string; project_color?: string })[];
  projects: Project[];
  onTaskClick: (task: Task & { project_name?: string; project_color?: string }) => void;
  onUpdate: (taskId?: string, patch?: Partial<Task>) => void;
  groupBy?: GroupBy;
  allLabels?: string[];
}

type SortField = 'title' | 'status' | 'priority' | 'assignee' | 'project_name' | 'due_date';
type SortOrder = 'asc' | 'desc';

function InlineStatusCell({ task, onUpdate }: { task: Task; onUpdate: (taskId?: string, patch?: Partial<Task>) => void }) {
  const [open, setOpen] = useState(false);
  const update = async (status: string) => {
    const prevStatus = task.status;
    onUpdate(task.id, { status: status as Task['status'] });
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        if (res.status === 400) {
          const data = await res.json().catch(() => ({}));
          if (data?.code === 'INCOMPLETE_SUBTASKS') {
            toast.error('Complete all subtasks before marking as done');
          } else {
            toast.error('Failed to update status');
          }
        } else {
          toast.error('Failed to update status');
        }
        onUpdate(task.id, { status: prevStatus });
      }
    } catch {
      toast.error('Failed to update status');
      onUpdate(task.id, { status: prevStatus });
    }
  };
  const style = STATUS_STYLES[task.status];
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <SearchableStatusPopover
        value={task.status}
        onChange={update}
        open={open}
        onOpenChange={setOpen}
        trigger={
          <button className={`flex items-center gap-1.5 ${CELL_BASE} ${open ? CELL_ACTIVE : CELL_HOVER}`}>
            {style ? (
              <>
                <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: style.dot }} />
                <span className="text-[13px] text-muted-foreground whitespace-nowrap">{style.label}</span>
              </>
            ) : (
              <span className="text-[13px] text-muted-foreground/30">No status</span>
            )}
          </button>
        }
      />
    </div>
  );
}

function InlinePriorityCell({ task, onUpdate }: { task: Task; onUpdate: (taskId?: string, patch?: Partial<Task>) => void }) {
  const [open, setOpen] = useState(false);
  const normalised = task.priority ? normalisePriority(task.priority) : '';
  const pStyle = normalised ? PRIORITY_STYLES[normalised] : null;
  const update = async (priority: string) => {
    const prevPriority = task.priority;
    onUpdate(task.id, { priority: priority as Task['priority'] });
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority }),
      });
      if (!res.ok) {
        toast.error('Failed to update priority');
        onUpdate(task.id, { priority: prevPriority });
      }
    } catch {
      toast.error('Failed to update priority');
      onUpdate(task.id, { priority: prevPriority });
    }
  };
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <SearchablePriorityPopover
        value={task.priority ?? ''}
        onChange={update}
        open={open}
        onOpenChange={setOpen}
        trigger={
          <button className={`inline-flex items-center gap-1 ${CELL_BASE} ${open ? CELL_ACTIVE : CELL_HOVER}`}>
            {pStyle ? (
              <span className={`px-2 py-0.5 rounded text-[13px] font-medium ${pStyle.bg} ${pStyle.text}`}>
                {normalised} · {pStyle.label}
              </span>
            ) : (
              <span className="text-[13px] text-muted-foreground/30">No priority</span>
            )}
          </button>
        }
      />
    </div>
  );
}

function InlineAssigneeCell({ task, onUpdate }: { task: Task; onUpdate: (taskId?: string, patch?: Partial<Task>) => void }) {
  const [open, setOpen] = useState(false);
  const update = async (assignee: string) => {
    const slug = toSlug(assignee);
    const prevAssignee = task.assignee;
    onUpdate(task.id, { assignee: slug as Task['assignee'] });
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignee: slug }),
      });
      if (!res.ok) {
        toast.error('Failed to update assignee');
        onUpdate(task.id, { assignee: prevAssignee });
      }
    } catch {
      toast.error('Failed to update assignee');
      onUpdate(task.id, { assignee: prevAssignee });
    }
  };
  const displayName = toDisplayName(task.assignee || '');
  const colorClass = ASSIGNEE_COLORS[displayName] || 'bg-muted/40 text-muted-foreground';
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <SearchableAssigneePopover
        value={displayName}
        onChange={update}
        open={open}
        onOpenChange={setOpen}
        trigger={
          <button className={`flex items-center gap-1.5 ${CELL_BASE} ${open ? CELL_ACTIVE : CELL_HOVER}`}>
            {displayName ? (
              <>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] leading-none font-medium shrink-0 ${colorClass}`}>
                  {getInitials(displayName)}
                </span>
                <span className="text-[13px] text-muted-foreground whitespace-nowrap truncate max-w-[120px]">{displayName}</span>
              </>
            ) : (
              <span className="text-[13px] text-muted-foreground/30">No assignee</span>
            )}
          </button>
        }
      />
    </div>
  );
}

function InlineProjectCell({ task, projects, onUpdate }: { task: Task & { project_name?: string; project_color?: string }; projects: Project[]; onUpdate: (taskId?: string, patch?: Partial<Task>) => void }) {
  const [open, setOpen] = useState(false);
  const update = async (val: { id: string; name: string; color: string } | null) => {
    const prevProjectId = task.project_id;
    const prevProjectName = task.project_name;
    const prevProjectColor = task.project_color;
    onUpdate(task.id, { project_id: val?.id || null, project_name: val?.name, project_color: val?.color } as Partial<Task>);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: val?.id || null }),
      });
      if (!res.ok) {
        toast.error('Failed to update project');
        onUpdate(task.id, { project_id: prevProjectId, project_name: prevProjectName, project_color: prevProjectColor } as Partial<Task>);
      }
    } catch {
      toast.error('Failed to update project');
      onUpdate(task.id, { project_id: prevProjectId, project_name: prevProjectName, project_color: prevProjectColor } as Partial<Task>);
    }
  };
  const currentProject = task.project_id && task.project_name
    ? { id: task.project_id, name: task.project_name, color: task.project_color || 'var(--muted-foreground)' }
    : null;
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <SearchableProjectPopover
        value={currentProject}
        projects={projects}
        onChange={update}
        open={open}
        onOpenChange={setOpen}
        trigger={
          <button className={`flex items-center gap-1 ${CELL_BASE} ${open ? CELL_ACTIVE : CELL_HOVER}`}>
            {task.project_name ? (
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: task.project_color || 'var(--muted-foreground)' }} />
                <span className="text-[13px] text-muted-foreground truncate max-w-[140px]">{task.project_name}</span>
              </div>
            ) : (
              <span className="text-[13px] text-muted-foreground/30">No project</span>
            )}
          </button>
        }
      />
    </div>
  );
}

function InlineDueDateCell({ task, onUpdate }: { task: Task; onUpdate: (taskId?: string, patch?: Partial<Task>) => void }) {
  const [open, setOpen] = useState(false);
  const taskDate = task.due_date ? new Date(task.due_date) : null;
  const taskTime = task.due_date ? (() => { const d = new Date(task.due_date!); const h = d.getHours(); const m = d.getMinutes(); return (h || m) ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}` : ''; })() : '';

  const update = async (date: Date | null, time?: string) => {
    const prevDueDate = task.due_date;
    if (date && time) {
      const [h, m] = time.split(':').map(Number);
      date.setHours(h, m, 0, 0);
    }
    const due_date = date ? date.toISOString() : null;
    onUpdate(task.id, { due_date } as Partial<Task>);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ due_date }),
      });
      if (!res.ok) {
        toast.error('Failed to update due date');
        onUpdate(task.id, { due_date: prevDueDate } as Partial<Task>);
      }
    } catch {
      toast.error('Failed to update due date');
      onUpdate(task.id, { due_date: prevDueDate } as Partial<Task>);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-0.5 group/date">
        <PopoverTrigger asChild>
          <button className={`flex items-center gap-1 ${CELL_BASE} ${open ? CELL_ACTIVE : CELL_HOVER}`} onClick={(e) => e.stopPropagation()}>
            <span className={`text-[13px] whitespace-nowrap ${getDueDateColor(task.due_date, task.status)}`}>{formatDueDate(task.due_date, task.status)}</span>
          </button>
        </PopoverTrigger>
        {task.due_date && (
          <TooltipProvider><Tooltip><TooltipTrigger asChild>
            <button
              onClick={(e) => { e.stopPropagation(); update(null); }}
              className="p-0.5 flex items-center justify-center text-muted-foreground/30 hover:text-destructive transition-colors duration-150 opacity-0 group-hover/date:opacity-100"
            >
              <X size={11} />
            </button>
          </TooltipTrigger><TooltipContent side="top">Clear date</TooltipContent></Tooltip></TooltipProvider>
        )}
      </div>
      <PopoverContent className="w-auto p-0 bg-card border border-border/20 rounded-lg shadow-lg" align="start" onClick={(e) => e.stopPropagation()}>
        <EnhancedDatePicker
          date={taskDate}
          time={taskTime}
          onDateChange={(d) => update(d, taskTime)}
          onTimeChange={(t) => { if (taskDate) update(new Date(taskDate), t); }}
          onClear={() => { update(null); setOpen(false); }}
          onOpenChange={setOpen}
        />
      </PopoverContent>
    </Popover>
  );
}

function InlineTitleCell({ task, onUpdate }: { task: Task; onUpdate: (taskId?: string, patch?: Partial<Task>) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(task.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setValue(task.title); }, [task.title]);
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  const save = async () => {
    setEditing(false);
    const trimmed = value.trim();
    if (trimmed && trimmed !== task.title) {
      // Optimistic update
      onUpdate(task.id, { title: trimmed });
      try {
        const res = await fetch(`/api/tasks/${task.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: trimmed }),
        });
        if (!res.ok) {
          toast.error('Failed to save title');
          onUpdate(task.id, { title: task.title }); // rollback
        }
      } catch {
        toast.error('Failed to save title');
        onUpdate(task.id, { title: task.title }); // rollback
      }
    } else {
      setValue(task.title);
    }
  };

  if (editing) {
    return (
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setValue(task.title); setEditing(false); } }}
        className="w-full max-w-[300px] text-[13px] font-medium h-7 py-0 bg-secondary border-primary/50 -mx-1"
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <button
      className={`text-[13px] font-medium truncate block max-w-[300px] text-left ${CELL_BASE} ${CELL_HOVER} hover:text-primary`}
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
    >
      {task.title}
    </button>
  );
}

function InlineLabelCell({ task, allLabels, onUpdate }: { task: Task; allLabels: string[]; onUpdate: (taskId?: string, patch?: Partial<Task>) => void }) {
  const handleChange = async (labels: string[]) => {
    const prevLabels = task.labels;
    onUpdate(task.id, { labels } as Partial<Task>);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labels }),
      });
      if (!res.ok) {
        toast.error('Failed to update labels');
        onUpdate(task.id, { labels: prevLabels } as Partial<Task>);
      }
    } catch {
      toast.error('Failed to update labels');
      onUpdate(task.id, { labels: prevLabels } as Partial<Task>);
    }
  };

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <LabelCombobox
        selectedLabels={task.labels || []}
        allLabels={allLabels}
        onChange={handleChange}
      />
    </div>
  );
}

function SortHeader({ field, sortField, sortOrder, onSort, children, className = '' }: { field: SortField; sortField: SortField; sortOrder: SortOrder; onSort: (field: SortField) => void; children: React.ReactNode; className?: string }) {
  const isActive = sortField === field;
  return (
    <th
      className={`py-3 px-5 text-left text-[11px] uppercase tracking-widest font-medium cursor-pointer select-none transition-colors duration-150 ${isActive ? 'text-foreground' : 'text-muted-foreground/30 hover:text-muted-foreground/60'} ${className}`}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {isActive ? (
          sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
        ) : (
          <ArrowUpDown size={12} className="opacity-30" />
        )}
      </span>
    </th>
  );
}

export function TableView({ tasks, allTasks = [], projects, onTaskClick, onUpdate, groupBy = 'none', allLabels = [] }: TableViewProps) {
  const [sortField, setSortField] = useState<SortField>('due_date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const lastSelectedIndex = useRef<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Bulk action popover state
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [bulkPriorityOpen, setBulkPriorityOpen] = useState(false);
  const [bulkAssigneeOpen, setBulkAssigneeOpen] = useState(false);

  // Group by state
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Reset to page 1 when sort/groupBy changes
  useEffect(() => {
    setCurrentPage(1);
  }, [sortField, sortOrder, groupBy]);

  // Reset shift-select anchor when page/sort/group changes
  useEffect(() => {
    lastSelectedIndex.current = null;
  }, [currentPage, sortField, sortOrder, groupBy]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleGroupCollapse = useCallback((groupKey: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey); else next.add(groupKey);
      return next;
    });
  }, []);

  const getSubtasks = useCallback((parentId: string) =>
    allTasks.filter((t) => t.parent_id === parentId), [allTasks]);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  }, [sortField, sortOrder]);

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const aVal = getSortValue(a, sortField);
      const bVal = getSortValue(b, sortField);
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const c = aVal.localeCompare(bVal);
        return sortOrder === 'asc' ? c : -c;
      }
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [tasks, sortField, sortOrder]);

  // Pagination
  const TASKS_PER_PAGE = 25;
  const totalTasks = sortedTasks.length;
  const totalPages = Math.ceil(totalTasks / TASKS_PER_PAGE);
  const startIndex = (currentPage - 1) * TASKS_PER_PAGE;
  const endIndex = startIndex + TASKS_PER_PAGE;
  const paginatedTasks = useMemo(() => sortedTasks.slice(startIndex, endIndex), [sortedTasks, startIndex, endIndex]);

  // H5: Auto-jump to page 1 when current page has no results (e.g. after filtering)
  useEffect(() => {
    if (currentPage > 1 && paginatedTasks.length === 0) setCurrentPage(1);
  }, [currentPage, paginatedTasks.length]);

  // Group tasks if groupBy is active
  type TaskGroup = {
    key: string;
    label: string;
    tasks: (Task & { project_name?: string; project_color?: string })[];
    metadata?: { color?: string; avatar?: string; dot?: string; badge?: string };
  };

  const groupedTasks: TaskGroup[] = useMemo(() => {
    if (groupBy === 'none') return [{ key: 'all', label: '', tasks: paginatedTasks }];

    const groups = new Map<string, TaskGroup>();
    
    paginatedTasks.forEach((task) => {
      let key = '';
      let label = '';
      const metadata: TaskGroup['metadata'] = {};

      if (groupBy === 'project') {
        key = task.project_id || 'no-project';
        label = task.project_name || 'No Project';
        if (task.project_color) metadata.color = task.project_color;
      } else if (groupBy === 'assignee') {
        key = task.assignee || 'no-assignee';
        label = task.assignee ? toDisplayName(task.assignee) : 'No Assignee';
        if (task.assignee) metadata.avatar = getInitials(task.assignee);
      } else if (groupBy === 'status') {
        key = task.status || 'no-status';
        const style = STATUS_STYLES[task.status];
        label = style?.label || task.status || 'No Status';
        if (style) metadata.dot = style.dot;
      } else if (groupBy === 'priority') {
        const normalised = task.priority ? normalisePriority(task.priority) : '';
        key = normalised || 'no-priority';
        const pStyle = normalised ? PRIORITY_STYLES[normalised] : null;
        label = pStyle ? `${normalised} · ${pStyle.label}` : 'No Priority';
        if (pStyle) metadata.badge = normalised;
      }

      if (!groups.has(key)) {
        groups.set(key, { key, label, tasks: [], metadata });
      }
      groups.get(key)!.tasks.push(task);
    });

    // Sort groups: named groups first, then "No X" groups at the end
    return Array.from(groups.values()).sort((a, b) => {
      const aIsEmpty = a.key.startsWith('no-');
      const bIsEmpty = b.key.startsWith('no-');
      if (aIsEmpty && !bIsEmpty) return 1;
      if (!aIsEmpty && bIsEmpty) return -1;
      return a.label.localeCompare(b.label);
    });
  }, [paginatedTasks, groupBy]);

  // Flat render order for shift-select (respects grouping + collapsed state)
  const renderedTaskOrder = useMemo(() => groupedTasks.flatMap((group) => {
    if (groupBy !== 'none' && collapsedGroups.has(group.key)) return [];
    return group.tasks;
  }), [groupedTasks, groupBy, collapsedGroups]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === paginatedTasks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedTasks.map((t) => t.id)));
    }
  }, [selectedIds.size, paginatedTasks]);

  const bulkUpdate = useCallback(async (field: string, value: string) => {
    const count = selectedIds.size;
    try {
      const results = await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/tasks/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [field]: value }),
          })
        )
      );
      const failed = results.filter((r) => !r.ok).length;
      if (failed > 0) {
        toast.error(`Failed to update ${failed} of ${count} tasks`);
      } else {
        toast.success(`Updated ${count} task${count > 1 ? 's' : ''}`);
      }
    } catch {
      toast.error('Failed to update tasks');
    }
    setSelectedIds(new Set());
    onUpdate();
  }, [selectedIds, onUpdate]);

  const bulkDelete = useCallback(async () => {
    const count = selectedIds.size;
    try {
      const results = await Promise.all(Array.from(selectedIds).map((id) => fetch(`/api/tasks/${id}`, { method: 'DELETE' })));
      const failed = results.filter((r) => !r.ok).length;
      if (failed > 0) {
        toast.error(`Failed to delete ${failed} of ${count} tasks`);
      } else {
        toast.success(`${count} task${count > 1 ? 's' : ''} deleted`);
      }
    } catch {
      toast.error('Failed to delete tasks');
    }
    setSelectedIds(new Set());
    setBulkDeleting(false);
    onUpdate();
  }, [selectedIds, onUpdate]);

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);
  const selectedBg = 'bg-primary/5';

  return (
    <div>
      {/* Bulk Actions Toolbar */}
      {selectedIds.size > 0 && (
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 mb-3 flex items-center gap-3 flex-wrap animate-in fade-in duration-200">
          <span className="text-[13px] font-medium text-primary">{selectedIds.size} task{selectedIds.size > 1 ? 's' : ''} selected</span>
          <div className="h-4 w-px bg-primary/20" />
          {/* Bulk Status — uses SearchableStatusPopover */}
          <SearchableStatusPopover
            value=""
            onChange={(status) => { bulkUpdate('status', status); setBulkStatusOpen(false); }}
            open={bulkStatusOpen}
            onOpenChange={setBulkStatusOpen}
            trigger={
              <button className="text-[13px] px-2.5 py-1.5 rounded-md hover:bg-muted/40 transition-colors duration-150 text-muted-foreground hover:text-foreground">Status</button>
            }
          />
          {/* Bulk Priority — uses SearchablePriorityPopover */}
          <SearchablePriorityPopover
            value=""
            onChange={(priority) => { bulkUpdate('priority', priority); setBulkPriorityOpen(false); }}
            open={bulkPriorityOpen}
            onOpenChange={setBulkPriorityOpen}
            trigger={
              <button className="text-[13px] px-2.5 py-1.5 rounded-md hover:bg-muted/40 transition-colors duration-150 text-muted-foreground hover:text-foreground">Priority</button>
            }
          />
          {/* Bulk Assignee — uses SearchableAssigneePopover */}
          <SearchableAssigneePopover
            value=""
            onChange={(assignee) => { bulkUpdate('assignee', assignee); setBulkAssigneeOpen(false); }}
            open={bulkAssigneeOpen}
            onOpenChange={setBulkAssigneeOpen}
            trigger={
              <button className="text-[13px] px-2.5 py-1.5 rounded-md hover:bg-muted/40 transition-colors duration-150 text-muted-foreground hover:text-foreground">Assignee</button>
            }
          />
          <div className="h-4 w-px bg-primary/20" />
          {/* Bulk Delete */}
          {bulkDeleting ? (
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-destructive">Delete {selectedIds.size} tasks?</span>
              <button onClick={bulkDelete} className="text-[13px] px-2 py-1 rounded-md bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors duration-150">Confirm</button>
              <button onClick={() => setBulkDeleting(false)} className="text-[13px] px-2 py-1 rounded-md hover:bg-muted/40 text-muted-foreground transition-colors duration-150">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setBulkDeleting(true)} className="text-[13px] px-2.5 py-1.5 rounded-md hover:bg-destructive/10 transition-colors duration-150 text-destructive/70 hover:text-destructive flex items-center gap-1">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          )}
          <div className="flex-1" />
          <button onClick={() => setSelectedIds(new Set())} className="text-[13px] px-2.5 py-1.5 rounded-md hover:bg-muted/40 transition-colors duration-150 text-muted-foreground hover:text-foreground flex items-center gap-1">
            <X className="h-3 w-3" /> Clear
          </button>
          </div>
      )}

      <div className="rounded-lg border border-border/20 bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" aria-label="Tasks table">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="border-b border-border/20">
                <th className="w-10 py-3 px-5 sticky left-0 z-20 bg-card">
                  <Checkbox
                    checked={paginatedTasks.length > 0 && selectedIds.size === paginatedTasks.length}
                    onCheckedChange={toggleSelectAll}
                    className="h-3.5 w-3.5"
                    aria-label="Select all tasks on this page"
                  />
                </th>
                <SortHeader field="title" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} className="min-w-[200px] sticky left-[58px] z-20 bg-card">Title</SortHeader>
                <SortHeader field="status" sortField={sortField} sortOrder={sortOrder} onSort={handleSort}>Status</SortHeader>
                <SortHeader field="priority" sortField={sortField} sortOrder={sortOrder} onSort={handleSort}>Priority</SortHeader>
                <SortHeader field="project_name" sortField={sortField} sortOrder={sortOrder} onSort={handleSort}>Project</SortHeader>
                <SortHeader field="due_date" sortField={sortField} sortOrder={sortOrder} onSort={handleSort}>Due Date</SortHeader>
                <th className="py-3 px-5 text-left text-[11px] uppercase tracking-widest font-medium text-muted-foreground/30 w-[140px]">Labels</th>
                <SortHeader field="assignee" sortField={sortField} sortOrder={sortOrder} onSort={handleSort}>Assignee</SortHeader>
              </tr>
            </thead>
            <tbody>
              {paginatedTasks.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <CheckSquare className="h-8 w-8 text-muted-foreground/30 mb-3" />
                      <p className="text-[13px] font-medium text-muted-foreground">No tasks found</p>
                      <p className="text-[13px] text-muted-foreground/60 mt-1">Adjust your filters or create a new task</p>
                    </div>
                  </td>
                </tr>
              ) : (
                groupedTasks.flatMap((group) => {
                  const groupCollapsed = collapsedGroups.has(group.key);
                  const groupRows: React.ReactElement[] = [];

                  // Add group header row if not 'none'
                  if (groupBy !== 'none') {
                    groupRows.push(
                      <tr key={`group-${group.key}`} className="border-b border-border/20">
                        <td colSpan={8} className="py-2.5 px-5 bg-muted/20">
                          <button
                            onClick={() => toggleGroupCollapse(group.key)}
                            aria-expanded={!groupCollapsed}
                            aria-label={`${groupCollapsed ? 'Expand' : 'Collapse'} ${group.label} group`}
                            className="flex items-center gap-2 w-full text-left hover:opacity-80 transition-opacity"
                          >
                            <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${groupCollapsed ? '' : 'rotate-90'}`} />
                            <div className="flex items-center gap-2">
                              {/* Group icon/badge */}
                              {groupBy === 'project' && group.metadata?.color && (
                                <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: group.metadata.color }} />
                              )}
                              {groupBy === 'assignee' && group.metadata?.avatar && (
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] leading-none font-medium shrink-0 ${ASSIGNEE_COLORS[group.label] || 'bg-muted/40 text-muted-foreground'}`}>
                                  {group.metadata.avatar}
                                </span>
                              )}
                              {groupBy === 'status' && group.metadata?.dot && (
                                <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: group.metadata.dot }} />
                              )}
                              {groupBy === 'priority' && group.metadata?.badge && PRIORITY_STYLES[group.metadata.badge] && (
                                <span className={`px-2 py-0.5 rounded text-[13px] font-medium ${PRIORITY_STYLES[group.metadata.badge].bg} ${PRIORITY_STYLES[group.metadata.badge].text}`}>
                                  {group.metadata.badge} · {PRIORITY_STYLES[group.metadata.badge].label}
                                </span>
                              )}
                              {/* Group label */}
                              <span className="text-[13px] font-medium text-foreground">
                                {groupBy === 'priority' && group.metadata?.badge ? '' : group.label}
                              </span>
                            </div>
                            <span className="text-[11px] text-muted-foreground/60">({group.tasks.length} task{group.tasks.length !== 1 ? 's' : ''})</span>
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  // Add task rows if group is not collapsed
                  if (!groupCollapsed || groupBy === 'none') {
                    group.tasks.forEach((task) => {
                      const hasSubtasks = (task.subtask_count || 0) > 0;
                      const isExpanded = expandedIds.has(task.id);
                      const subtasks = isExpanded ? getSubtasks(task.id) : [];
                      const rowSelected = isSelected(task.id);
                      
                      groupRows.push(
                        <tr
                          key={task.id}
                          className={`border-b border-border/20 hover:bg-muted/40 transition-colors duration-150 group/row cursor-pointer ${rowSelected ? selectedBg : ''}`}
                          onClick={() => onTaskClick(task)}
                        >
                          <td className={`py-2.5 px-5 sticky left-0 z-10 ${rowSelected ? 'bg-primary/5' : 'bg-card group-hover/row:bg-muted/40'} transition-colors duration-150`} style={rowSelected ? { backgroundColor: 'color-mix(in srgb, hsl(var(--primary)) 5%, hsl(var(--card)))' } : undefined}>
                            <div className="flex items-center gap-1">
                              {hasSubtasks ? (
                                <button
                                  onClick={(e) => { e.stopPropagation(); toggleExpand(task.id); }}
                                  className="h-4 w-4 flex items-center justify-center rounded hover:bg-accent transition-colors duration-150"
                                  aria-expanded={isExpanded}
                                  aria-label={isExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
                                >
                                  <ChevronRight className={`h-3 w-3 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                </button>
                              ) : <span className="w-4" />}
                              <Checkbox
                                checked={rowSelected}
                                onCheckedChange={() => {
                                  toggleSelect(task.id);
                                }}
                                onClick={(e: React.MouseEvent) => {
                                  e.stopPropagation();
                                  const currentIndex = renderedTaskOrder.findIndex(t => t.id === task.id);
                                  if (e.shiftKey && lastSelectedIndex.current !== null) {
                                    const start = Math.min(lastSelectedIndex.current, currentIndex);
                                    const end = Math.max(lastSelectedIndex.current, currentIndex);
                                    const rangeIds = renderedTaskOrder.slice(start, end + 1).map(t => t.id);
                                    setSelectedIds(prev => {
                                      const next = new Set(prev);
                                      rangeIds.forEach(id => next.add(id));
                                      return next;
                                    });
                                  }
                                  lastSelectedIndex.current = currentIndex;
                                }}
                                className="h-3.5 w-3.5"
                              />
                            </div>
                          </td>
                          <td className={`py-2.5 px-5 sticky left-[58px] z-10 ${rowSelected ? '' : 'bg-card group-hover/row:bg-muted/40'} transition-colors duration-150`} style={rowSelected ? { backgroundColor: 'color-mix(in srgb, hsl(var(--primary)) 5%, hsl(var(--card)))' } : undefined}>
                            <InlineTitleCell task={task} onUpdate={onUpdate} />
                          </td>
                          <td className="py-2.5 px-5">
                            <InlineStatusCell task={task} onUpdate={onUpdate} />
                          </td>
                          <td className="py-2.5 px-5">
                            <InlinePriorityCell task={task} onUpdate={onUpdate} />
                          </td>
                          <td className="py-2.5 px-5">
                            <InlineProjectCell task={task} projects={projects} onUpdate={onUpdate} />
                          </td>
                          <td className="py-2.5 px-5">
                            <InlineDueDateCell task={task} onUpdate={onUpdate} />
                          </td>
                          <td className="py-2.5 px-5">
                            <InlineLabelCell task={task} allLabels={allLabels} onUpdate={onUpdate} />
                          </td>
                          <td className="py-2.5 px-5">
                            <InlineAssigneeCell task={task} onUpdate={onUpdate} />
                          </td>
                        </tr>
                      );

                      // Add subtask rows
                      subtasks.forEach((sub) => {
                        groupRows.push(
                          <tr
                            key={sub.id}
                            className="border-b border-border/20 hover:bg-muted/40 transition-colors duration-150 cursor-pointer"
                            onClick={() => onTaskClick(sub)}
                            tabIndex={0}
                            aria-label={`Subtask: ${sub.title}`}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTaskClick(sub); } }}
                          >
                            <td className="py-2.5 px-5">
                              <span className="text-muted-foreground/30" aria-hidden="true">↳</span>
                            </td>
                            <td className="py-2.5 px-5 sticky left-[58px] z-10 bg-card group-hover/row:bg-muted/40 transition-colors duration-150">
                              <div className="pl-4 border-l-2 border-primary/20 ml-1">
                                <span className="text-[13px] text-muted-foreground truncate">{sub.title}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-5">
                              <InlineStatusCell task={sub} onUpdate={onUpdate} />
                            </td>
                            <td className="py-2.5 px-5">
                              <InlinePriorityCell task={sub} onUpdate={onUpdate} />
                            </td>
                            <td className="py-2.5 px-5">
                              <InlineProjectCell task={sub} projects={projects} onUpdate={onUpdate} />
                            </td>
                            <td className="py-2.5 px-5">
                              <InlineDueDateCell task={sub} onUpdate={onUpdate} />
                            </td>
                            <td className="py-2.5 px-5">
                              <InlineLabelCell task={sub} allLabels={allLabels} onUpdate={onUpdate} />
                            </td>
                            <td className="py-2.5 px-5">
                              <InlineAssigneeCell task={sub} onUpdate={onUpdate} />
                            </td>
                          </tr>
                        );
                      });
                    });
                  }

                  return groupRows;
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between rounded-lg border border-border/20 bg-card px-4 py-2.5">
          <span className="text-[13px] text-muted-foreground">
            Showing {startIndex + 1}-{Math.min(endIndex, totalTasks)} of {totalTasks} tasks
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="text-[13px] text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-150 px-2 py-1 rounded hover:bg-muted/40"
            >
              First
            </button>
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-150 p-1 rounded hover:bg-muted/40 flex items-center"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-[13px] text-muted-foreground px-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-150 p-1 rounded hover:bg-muted/40 flex items-center"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="text-[13px] text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-150 px-2 py-1 rounded hover:bg-muted/40"
            >
              Last
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
