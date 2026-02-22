'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { Task } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { STATUS_STYLES, PRIORITY_STYLES, ASSIGNEE_COLORS, toDisplayName, getInitials } from '@/lib/constants';
import { useStatuses } from '@/hooks/use-statuses';

interface CalendarViewProps {
  tasks: (Task & { project_name?: string; project_color?: string })[];
  onTaskClick: (task: Task & { project_name?: string; project_color?: string }) => void;
  onDateChange?: (taskId: string, newDate: string) => void;
  onCreateTask?: (defaultDate: string) => void;
  hasFilters?: boolean;
}

type ExtTask = Task & { project_name?: string; project_color?: string };

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function hasSpecificTime(task: ExtTask): boolean {
  if (!task.due_date) return false;
  const d = new Date(task.due_date);
  return d.getHours() !== 0 || d.getMinutes() !== 0;
}

function getTaskHour(task: ExtTask): number {
  if (!task.due_date) return 0;
  const d = new Date(task.due_date);
  return d.getHours() + d.getMinutes() / 60;
}

function formatTaskTime(task: ExtTask): string {
  if (!task.due_date) return '';
  const d = new Date(task.due_date);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// --- Duration helpers (visual planning, localStorage only) ---
const DURATION_STORAGE_KEY = 'calendar-task-durations';
type TaskDuration = { durationMinutes: number };

function loadDurations(): Record<string, TaskDuration> {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(DURATION_STORAGE_KEY) || '{}'); } catch { return {}; }
}

function saveDurations(durations: Record<string, TaskDuration>) {
  if (typeof window !== 'undefined') localStorage.setItem(DURATION_STORAGE_KEY, JSON.stringify(durations));
}

function getTaskDuration(taskId: string, durations: Record<string, TaskDuration>): number {
  return durations[taskId]?.durationMinutes || 60;
}

function formatTimeFromMinutes(hour: number, minute: number): string {
  return `${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.round(minute)).padStart(2, '0')}`;
}

const MIN_DURATION = 15;
const MAX_DURATION = 480;
const SNAP_MINUTES = 15;

/** Calculate column layout for overlapping tasks (side-by-side) */
function layoutOverlappingTasks(
  tasks: { id: string; startMin: number; endMin: number }[]
): Map<string, { col: number; totalCols: number }> {
  const result = new Map<string, { col: number; totalCols: number }>();
  if (!tasks.length) return result;
  const sorted = [...tasks].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const columns: { endMin: number }[] = [];
  const taskCols = new Map<string, number>();
  for (const t of sorted) {
    let placed = false;
    for (let c = 0; c < columns.length; c++) {
      if (columns[c].endMin <= t.startMin) {
        columns[c].endMin = t.endMin;
        taskCols.set(t.id, c);
        placed = true;
        break;
      }
    }
    if (!placed) {
      taskCols.set(t.id, columns.length);
      columns.push({ endMin: t.endMin });
    }
  }
  for (const t of sorted) {
    const col = taskCols.get(t.id) || 0;
    let maxCol = col;
    for (const other of sorted) {
      if (other.id === t.id) continue;
      if (other.startMin < t.endMin && other.endMin > t.startMin) {
        maxCol = Math.max(maxCol, taskCols.get(other.id) || 0);
      }
    }
    result.set(t.id, { col, totalCols: maxCol + 1 });
  }
  return result;
}

function TaskPill({ task, onTaskClick, showTime = false, draggable = false, onDragStart: onDragStartCb, onDragEnd: onDragEndCb, isBeingDragged = false }: { task: ExtTask; onTaskClick: (t: ExtTask) => void; showTime?: boolean; draggable?: boolean; onDragStart?: (taskId: string) => void; onDragEnd?: () => void; isBeingDragged?: boolean }) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
    // Small delay so the drag image captures the pill before we show ghost
    setTimeout(() => onDragStartCb?.(task.id), 0);
  };
  const handleDragEnd = () => { onDragEndCb?.(); };
  const statusStyle = STATUS_STYLES[task.status];
  const { statuses: dynamicStatuses } = useStatuses();
  const dynStatus = !statusStyle ? dynamicStatuses.find(s => s.slug === task.status) : null;
  const statusDotColor = statusStyle?.dot || dynStatus?.dot_colour || dynStatus?.colour || 'var(--muted-foreground)';
  const statusLabel = statusStyle?.label || dynStatus?.label || task.status;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={(e) => { e.stopPropagation(); if (!isBeingDragged) onTaskClick(task); }}
          draggable={draggable}
          onDragStart={draggable ? handleDragStart : undefined}
          onDragEnd={draggable ? handleDragEnd : undefined}
          className={`w-full text-left px-1.5 py-0.5 rounded text-[11px] transition-colors duration-150 flex items-center gap-1.5 group overflow-hidden ${
            isBeingDragged ? 'opacity-30 pointer-events-none' : 'hover:bg-muted/60 cursor-grab active:cursor-grabbing'
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: task.project_color || 'var(--muted-foreground)' }} />
          {showTime && <span className="text-muted-foreground/60 shrink-0 tabular-nums">{formatTaskTime(task)}</span>}
          <span className="text-foreground truncate group-hover:text-foreground">{task.title}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={12} className="max-w-[260px] p-2">
        <div className="text-[11px] space-y-1">
          <p className="text-[13px] font-medium leading-snug text-foreground">
            {hasSpecificTime(task) && <span className="text-muted-foreground font-normal tabular-nums mr-1">{formatTaskTime(task)}</span>}
            {task.title}
          </p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {task.project_name && (
              <>
                <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: task.project_color || 'var(--muted-foreground)' }} />
                <span className="text-muted-foreground">{task.project_name}</span>
              </>
            )}
            {task.priority && PRIORITY_STYLES[task.priority] && (
              <span className={`px-1 py-0 rounded text-[10px] font-medium ${PRIORITY_STYLES[task.priority].bg} ${PRIORITY_STYLES[task.priority].text}`}>
                {task.priority}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {task.assignee && (
              <>
                <span className={`inline-flex items-center justify-center h-5 w-5 rounded-full text-[9px] leading-none font-semibold shrink-0 ${ASSIGNEE_COLORS[task.assignee] || 'bg-muted/40 text-muted-foreground'}`}>
                  {toDisplayName(task.assignee).charAt(0)}
                </span>
                <span className="text-muted-foreground">{toDisplayName(task.assignee)}</span>
              </>
            )}
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusDotColor }} />
              <span className="text-muted-foreground">{statusLabel}</span>
            </span>
          </div>
          {task.labels && task.labels.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {task.labels.map((l: string) => (
                <span key={l} className="px-1.5 py-0 rounded-full text-[10px] bg-muted/60 text-muted-foreground border border-border/20">{l}</span>
              ))}
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// Month view day cell
function MonthDayCell({
  date, isCurrentMonth, isToday, tasks, onTaskClick, onDrop, draggedTaskId, isSource, isDragOver, onDragOverCell, onPillDragStart, onPillDragEnd, onCreateTask,
}: {
  date: Date; isCurrentMonth: boolean; isToday: boolean;
  tasks: ExtTask[]; onTaskClick: (t: ExtTask) => void;
  onDrop?: (taskId: string, date: Date) => void;
  draggedTaskId: string | null; isSource: boolean; isDragOver: boolean;
  onDragOverCell: (key: string | null) => void;
  onPillDragStart: (id: string) => void; onPillDragEnd: () => void;
  onCreateTask?: (defaultDate: string) => void;
}) {
  const visible = tasks.slice(0, 2);
  const overflow = tasks.length - 2;
  const cellKey = getDateKey(date);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; onDragOverCell(cellKey); };
  const handleDragLeave = () => onDragOverCell(null);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); onDragOverCell(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId && onDrop) onDrop(taskId, date);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={(e) => { if (onCreateTask && !(e.target as HTMLElement).closest('.task-pill')) onCreateTask(date.toISOString()); }}
      className={`day-cell bg-card p-1.5 min-h-[90px] overflow-hidden min-w-0 transition-colors duration-150 cursor-pointer hover:bg-muted/20 group/daycell relative ${isToday ? 'bg-primary/10 ring-1 ring-inset ring-primary/30' : ''} ${!isCurrentMonth ? 'opacity-35' : ''}`}
    >
      <div className={`text-[11px] mb-1 pl-0.5 ${isToday ? 'text-primary font-semibold' : 'text-muted-foreground/60'}`}>
        {date.getDate()}
      </div>
      {/* Hover create indicator — hidden when hovering a task pill (CSS :has) */}
      {tasks.length === 0 ? (
        /* Empty day: centred + icon */
        <div className="create-hint absolute inset-0 flex items-center justify-center opacity-0 group-hover/daycell:opacity-100 transition-opacity pointer-events-none">
          <Plus className="h-4 w-4 text-muted-foreground/30" />
        </div>
      ) : (
        /* Day with tasks: ghost pill at bottom */
        <div className="create-hint opacity-0 group-hover/daycell:opacity-100 transition-opacity pointer-events-none mt-0.5">
          <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[11px] border border-dashed border-muted-foreground/20">
            <Plus className="h-2.5 w-2.5 text-muted-foreground/30" />
            <span className="text-muted-foreground/30">New task</span>
          </div>
        </div>
      )}
      <div className="space-y-0.5">
        {visible.map(task => (
          <div key={task.id} className="task-pill relative z-[1]">
            {draggedTaskId === task.id && (
              <div className="rounded px-1.5 py-0.5" style={{ border: '1.5px dashed var(--muted-foreground)', opacity: 0.2, height: 22 }} />
            )}
            <TaskPill task={task} onTaskClick={onTaskClick} draggable onDragStart={onPillDragStart} onDragEnd={onPillDragEnd} isBeingDragged={draggedTaskId === task.id} />
          </div>
        ))}
        {isDragOver && !isSource && (
          <div className="rounded mt-0.5" style={{ border: '1.5px dashed var(--primary)', opacity: 0.4, background: 'color-mix(in oklab, var(--primary) 6%, transparent)', height: 22 }} />
        )}
        {overflow > 0 && (
          <OverflowPopover tasks={tasks.slice(2)} onTaskClick={onTaskClick} />
        )}
      </div>
    </div>
  );
}

// Popover for "+N more" overflow tasks in month/week view day cells
function OverflowPopover({ tasks, onTaskClick }: { tasks: ExtTask[]; onTaskClick: (t: ExtTask) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          className="text-[10px] text-muted-foreground/60 pl-1.5 py-0.5 hover:text-muted-foreground transition-colors duration-150 cursor-pointer"
        >
          +{tasks.length} more
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="w-64 p-1.5 max-h-[320px] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-0.5">
          {tasks.map(task => (
            <TaskPill key={task.id} task={task} onTaskClick={onTaskClick} showTime={hasSpecificTime(task)} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Hours for the week time grid (6am - 10pm)
const HOUR_HEIGHT = 48; // px per hour
const DEFAULT_START_HOUR = 6;
const DEFAULT_END_HOUR = 22;

function HourPicker({ value, onChange, disableFrom, disableDirection }: {
  value: number; onChange: (v: number) => void;
  disableFrom: number; disableDirection: 'gte' | 'lte';
}) {
  const [open, setOpen] = useState(false);
  const isDisabled = (i: number) => disableDirection === 'gte' ? i >= disableFrom : i <= disableFrom;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="h-7 px-2.5 text-[11px] bg-secondary border border-border/20 rounded-md flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors duration-150">
          {String(value).padStart(2, '0')}:00
          <ChevronDown className="h-3 w-3 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="center" className="w-[90px] p-1 max-h-[200px] overflow-y-auto">
        {Array.from({ length: 24 }, (_, i) => (
          <button
            key={i}
            disabled={isDisabled(i)}
            onClick={() => { onChange(i); setOpen(false); }}
            className={`w-full text-left px-2 py-1 text-[11px] rounded-sm transition-colors duration-150 ${
              i === value ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted'
            } ${isDisabled(i) ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {String(i).padStart(2, '0')}:00
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function CalendarView({ tasks, onTaskClick, onDateChange, onCreateTask, hasFilters = false }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);
  const [taskDurations, setTaskDurations] = useState<Record<string, TaskDuration>>(loadDurations);
  const [resizingTaskId, setResizingTaskId] = useState<string | null>(null);
  const resizeStartY = useRef(0);
  const resizeStartDuration = useRef(60);
  const justInteracted = useRef(false);

  const updateTaskDuration = useCallback((taskId: string, durationMinutes: number) => {
    const clamped = Math.max(MIN_DURATION, Math.min(MAX_DURATION, Math.round(durationMinutes / SNAP_MINUTES) * SNAP_MINUTES));
    setTaskDurations(prev => {
      const next = { ...prev, [taskId]: { durationMinutes: clamped } };
      saveDurations(next);
      return next;
    });
  }, []);
  const { statuses: dynamicStatuses } = useStatuses();
  const [startHour, setStartHour] = useState(() => {
    if (typeof window !== 'undefined') return parseInt(localStorage.getItem('calendar-start-hour') || String(DEFAULT_START_HOUR), 10);
    return DEFAULT_START_HOUR;
  });
  const [endHour, setEndHour] = useState(() => {
    if (typeof window !== 'undefined') return parseInt(localStorage.getItem('calendar-end-hour') || String(DEFAULT_END_HOUR), 10);
    return DEFAULT_END_HOUR;
  });

  const weekHours = Array.from({ length: endHour - startHour + 1 }, (_, i) => i + startHour);

  const handleStartHourChange = (h: number) => { setStartHour(h); localStorage.setItem('calendar-start-hour', String(h)); };
  const handleEndHourChange = (h: number) => { setEndHour(h); localStorage.setItem('calendar-end-hour', String(h)); };
  const [calendarMode, setCalendarMode] = useState<'month' | 'week'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('calendar-mode') as 'month' | 'week') || 'month';
    }
    return 'month';
  });
  const [showWeekends, setShowWeekends] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('calendar-weekends') !== 'false';
    }
    return true;
  });

  const handleToggleWeekends = () => {
    setShowWeekends(prev => {
      localStorage.setItem('calendar-weekends', String(!prev));
      return !prev;
    });
  };

  const visibleDayNames = showWeekends ? DAY_NAMES : DAY_NAMES.slice(0, 5);
  const colCount = visibleDayNames.length;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Group tasks by date key — memoised so the Map is only rebuilt when tasks change
  const tasksByDate = useMemo(() => {
    const map = new Map<string, ExtTask[]>();
    tasks.forEach(task => {
      if (task.due_date) {
        const d = new Date(task.due_date);
        const key = getDateKey(d);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(task);
      }
    });
    return map;
  }, [tasks]);

  const handleModeChange = (mode: 'month' | 'week') => {
    setCalendarMode(mode);
    localStorage.setItem('calendar-mode', mode);
  };

  // Month days — memoised; rebuilds only when year/month changes.
  // today is computed fresh inside so navigating after midnight always reflects the correct date.
  const monthDays = useMemo(() => {
    const today = getToday(); // Compute fresh inside the memo — avoids stale midnight closure
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const firstDayOfWeek = (firstDay.getDay() + 6) % 7;
    const daysInMonth = lastDay.getDate();
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    const todayKey = getDateKey(today);

    const days: Array<{ date: Date; isCurrentMonth: boolean; isToday: boolean }> = [];
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      days.push({ date: d, isCurrentMonth: false, isToday: getDateKey(d) === todayKey });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      days.push({ date: d, isCurrentMonth: true, isToday: getDateKey(d) === todayKey });
    }
    const remaining = (7 - (days.length % 7)) % 7;
    for (let day = 1; day <= remaining; day++) {
      const d = new Date(year, month + 1, day);
      days.push({ date: d, isCurrentMonth: false, isToday: getDateKey(d) === todayKey });
    }
    return days;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  // All 7 days for the current week — memoised; rebuilds only when currentDate changes.
  // today is computed fresh inside so navigating after midnight always reflects the correct date.
  const allWeekDays = useMemo(() => {
    const today = getToday(); // Compute fresh inside the memo — avoids stale midnight closure
    const weekStart = getWeekStart(currentDate);
    const todayKey = getDateKey(today);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return { date: d, isCurrentMonth: d.getMonth() === month, isToday: getDateKey(d) === todayKey };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, month]);

  // Filtered week days — excludes weekends when showWeekends is false.
  // Hoisted into a memo so all week-view sections share the same filtered array
  // without recomputing on every render.
  const filteredWeekDays = useMemo(
    () => allWeekDays.filter(d => showWeekends || (d.date.getDay() !== 0 && d.date.getDay() !== 6)),
    [allWeekDays, showWeekends]
  );

  const handlePrev = () => {
    if (calendarMode === 'month') {
      setCurrentDate(new Date(year, month - 1, 1));
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 7);
      setCurrentDate(d);
    }
  };

  const handleNext = () => {
    if (calendarMode === 'month') {
      setCurrentDate(new Date(year, month + 1, 1));
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 7);
      setCurrentDate(d);
    }
  };

  const handleToday = () => setCurrentDate(new Date());

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const headerLabel = calendarMode === 'month'
    ? `${monthNames[month]} ${year}`
    : (() => {
        const ws = getWeekStart(currentDate);
        const we = new Date(ws);
        we.setDate(ws.getDate() + 6);
        return `${ws.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${we.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
      })();

  // Helper: format a local Date as YYYY-MM-DDT00:00:00 (no UTC offset).
  // Date-storage convention: date-only values use this format to avoid the date being
  // shifted to the previous day for users east of UTC. Time-aware values use toISOString().
  const toLocalDateString = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}T00:00:00`;
  };

  // Handle dropping a task on a new date (month view preserves original time if it had one)
  const handleMonthDrop = useCallback((taskId: string, targetDate: Date) => {
    if (!onDateChange) return;
    const task = tasks.find(t => t.id === taskId);
    const originalDate = task?.due_date ? new Date(task.due_date) : null;
    const newDate = new Date(targetDate);
    if (originalDate && hasSpecificTime(task!)) {
      // Task had a specific time — preserve it and store as full ISO
      newDate.setHours(originalDate.getHours(), originalDate.getMinutes(), 0, 0);
      setDraggedTaskId(null); setDragOverCell(null);
      onDateChange(taskId, newDate.toISOString());
    } else {
      // Date-only drop — store as local midnight (no UTC shift)
      setDraggedTaskId(null); setDragOverCell(null);
      onDateChange(taskId, toLocalDateString(newDate));
    }
  }, [onDateChange, tasks]);

  const handleWeekDrop = useCallback((taskId: string, targetDate: Date, hour: number) => {
    if (!onDateChange) return;
    const newDate = new Date(targetDate);
    newDate.setHours(hour, 0, 0, 0);
    setDraggedTaskId(null); setDragOverCell(null);
    onDateChange(taskId, newDate.toISOString());
  }, [onDateChange]);

  const handleAllDayDrop = useCallback((taskId: string, targetDate: Date) => {
    if (!onDateChange) return;
    const newDate = new Date(targetDate);
    // All-day drop — store as local midnight (no UTC shift, matches date-only convention)
    setDraggedTaskId(null); setDragOverCell(null);
    onDateChange(taskId, toLocalDateString(newDate));
  }, [onDateChange]);

  const handlePillDragStart = useCallback((taskId: string) => setDraggedTaskId(taskId), []);
  const handlePillDragEnd = useCallback(() => { setDraggedTaskId(null); setDragOverCell(null); justInteracted.current = true; setTimeout(() => { justInteracted.current = false; }, 200); }, []);

  // Safety net: clear drag state on any document dragend (handles drops outside valid targets)
  useEffect(() => {
    const cleanup = () => { setDraggedTaskId(null); setDragOverCell(null); };
    document.addEventListener('dragend', cleanup);
    return () => document.removeEventListener('dragend', cleanup);
  }, []);

  // Get the source cell key for the dragged task
  const draggedTask = draggedTaskId ? tasks.find(t => t.id === draggedTaskId) : null;
  const sourceCellKey = draggedTask?.due_date ? getDateKey(new Date(draggedTask.due_date)) : null;
  const sourceHour = draggedTask?.due_date && hasSpecificTime(draggedTask) ? Math.floor(getTaskHour(draggedTask)) : null;

  const tasksWithDueDates = tasks.filter(t => t.due_date);

  return (
    <TooltipProvider>
      <div className="bg-card rounded-lg border border-border/20 p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          {/* Left: nav arrows + date label + Today */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={handlePrev} className="h-7 w-7 p-0" aria-label={calendarMode === 'month' ? 'Previous month' : 'Previous week'}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-[13px] font-medium text-foreground px-1 min-w-[140px] text-center">{headerLabel}</h2>
            <Button variant="ghost" size="sm" onClick={handleNext} className="h-7 w-7 p-0" aria-label={calendarMode === 'month' ? 'Next month' : 'Next week'}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleToday} className="text-[13px] text-muted-foreground h-7 px-2 ml-1" aria-label="Go to today">
              Today
            </Button>
          </div>
          {/* Right: hour picker + weekends toggle + week/month toggle */}
          <div className="flex items-center gap-2">
            {calendarMode === 'week' && (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <HourPicker value={startHour} onChange={handleStartHourChange} disableFrom={endHour} disableDirection="gte" />
                <span>–</span>
                <HourPicker value={endHour} onChange={handleEndHourChange} disableFrom={startHour} disableDirection="lte" />
              </div>
            )}
            <button
              onClick={handleToggleWeekends}
              className="rounded-md px-2.5 py-1 text-[13px] font-medium transition-colors duration-150 border border-border/20 text-muted-foreground hover:text-foreground"
            >
              {showWeekends ? 'Hide weekends' : 'Show weekends'}
            </button>
            <div className="flex items-center gap-0.5 rounded-lg border border-border/20 bg-muted p-0.5">
              <button
                onClick={() => handleModeChange('week')}
                className={`rounded-md px-2.5 py-1 text-[13px] font-medium transition-colors duration-150 ${
                  calendarMode === 'week' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >Week</button>
              <button
                onClick={() => handleModeChange('month')}
                className={`rounded-md px-2.5 py-1 text-[13px] font-medium transition-colors duration-150 ${
                  calendarMode === 'month' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >Month</button>
            </div>
          </div>
        </div>

        {tasksWithDueDates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CalendarDays className="h-8 w-8 text-muted-foreground/30 mb-3" />
            <p className="text-[13px] font-medium text-muted-foreground">
              {hasFilters ? 'No matching tasks have due dates' : 'No tasks with due dates'}
            </p>
            <p className="text-[13px] text-muted-foreground/60 mt-1">
              {hasFilters ? 'Try clearing some filters to see more tasks' : 'Add a due date to a task to see it here'}
            </p>
          </div>
        ) : calendarMode === 'month' ? (
          /* ---- MONTH VIEW ---- */
          <div className={`grid gap-px bg-border/10 border border-border/20 rounded-lg overflow-hidden`} style={{ gridTemplateColumns: `repeat(${colCount}, 1fr)` }}>
            {visibleDayNames.map(day => (
              <div key={day} className="bg-card px-2 py-1.5 text-center">
                <span className="text-[11px] text-muted-foreground/60 font-medium">{day}</span>
              </div>
            ))}
            {monthDays
              .filter(day => showWeekends || (day.date.getDay() !== 0 && day.date.getDay() !== 6))
              .map((day) => {
              const dayTasks = tasksByDate.get(getDateKey(day.date)) || [];
              return (
                // Use date-based key (not array index) so cells don't remount when weekends toggle changes
                <MonthDayCell key={getDateKey(day.date)} date={day.date} isCurrentMonth={day.isCurrentMonth} isToday={day.isToday} tasks={dayTasks} onTaskClick={onTaskClick} onDrop={handleMonthDrop} draggedTaskId={draggedTaskId} isSource={sourceCellKey === getDateKey(day.date)} isDragOver={dragOverCell === getDateKey(day.date)} onDragOverCell={setDragOverCell} onPillDragStart={handlePillDragStart} onPillDragEnd={handlePillDragEnd} onCreateTask={onCreateTask} />
              );
            })}
          </div>
        ) : (
          /* ---- WEEK VIEW (time grid) ---- */
          <div className="border border-border/20 rounded-lg overflow-hidden">
            {/* Day headers */}
            <div className={`grid gap-px bg-border/10`} style={{ gridTemplateColumns: `50px repeat(${colCount}, 1fr)` }}>
              <div className="bg-card p-1.5" />
              {filteredWeekDays.map((day, i) => (
                <div key={getDateKey(day.date)} className={`bg-card px-2 py-2 text-center ${day.isToday ? 'bg-primary/10' : ''}`}>
                  <div className="text-[11px] text-muted-foreground/60 font-medium">{DAY_NAMES[i]}</div>
                  <div className={`text-[13px] font-medium ${day.isToday ? 'text-primary' : 'text-foreground'}`}>{day.date.getDate()}</div>
                </div>
              ))}
            </div>

            {/* All-day tasks row */}
            {(() => {
              const filteredDays = filteredWeekDays;
              const hasAllDay = filteredDays.some(day => {
                const dayTasks = tasksByDate.get(getDateKey(day.date)) || [];
                return dayTasks.some(t => !hasSpecificTime(t));
              });
              if (!hasAllDay) return null;
              return (
                <div className={`grid gap-px bg-border/10 border-t border-border/20`} style={{ gridTemplateColumns: `50px repeat(${colCount}, 1fr)` }}>
                  <div className="bg-card p-1 flex items-start justify-end pr-2 pt-1.5">
                    <span className="text-[10px] text-muted-foreground/60">All day</span>
                  </div>
                  {filteredDays.map((day, i) => {
                    const dayTasks = (tasksByDate.get(getDateKey(day.date)) || []).filter(t => !hasSpecificTime(t));
                    return (
                      <div
                        key={getDateKey(day.date)}
                        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                        onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id) handleAllDayDrop(id, day.date); }}
                        className={`bg-card p-1 min-h-[32px] overflow-hidden ${day.isToday ? 'bg-primary/[0.03]' : ''}`}
                      >
                        <div className="space-y-0.5">
                          {dayTasks.slice(0, 3).map(task => (
                            <div key={task.id}>
                              {draggedTaskId === task.id && <div className="rounded px-1.5 py-0.5" style={{ border: '1.5px dashed var(--muted-foreground)', opacity: 0.2, height: 22 }} />}
                              <TaskPill task={task} onTaskClick={onTaskClick} draggable onDragStart={handlePillDragStart} onDragEnd={handlePillDragEnd} isBeingDragged={draggedTaskId === task.id} />
                            </div>
                          ))}
                          {dayTasks.length > 3 && <OverflowPopover tasks={dayTasks.slice(3)} onTaskClick={onTaskClick} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Tasks before visible hours */}
            {(() => {
              const filteredDays = filteredWeekDays;
              const hasEarlyTasks = filteredDays.some(day => {
                const dayTasks = tasksByDate.get(getDateKey(day.date)) || [];
                return dayTasks.some(t => hasSpecificTime(t) && getTaskHour(t) < startHour);
              });
              if (!hasEarlyTasks) return null;
              return (
                <div className={`grid gap-px bg-border/10 border-t border-border/20`} style={{ gridTemplateColumns: `50px repeat(${colCount}, 1fr)` }}>
                  <div className="bg-card flex items-center justify-end pr-2">
                    <span className="text-[10px] text-muted-foreground/60">Earlier</span>
                  </div>
                  {filteredDays.map((day, i) => {
                    const earlyTasks = (tasksByDate.get(getDateKey(day.date)) || [])
                      .filter(t => hasSpecificTime(t) && getTaskHour(t) < startHour)
                      .sort((a, b) => getTaskHour(a) - getTaskHour(b));
                    const MAX_EARLY = 3;
                    return (
                      <div key={getDateKey(day.date)} className={`bg-muted/20 p-1 min-h-[28px] overflow-hidden min-w-0 ${day.isToday ? 'bg-primary/[0.03]' : ''}`}>
                        {earlyTasks.slice(0, MAX_EARLY).map(task => (
                          <TaskPill key={task.id} task={task} onTaskClick={onTaskClick} showTime draggable onDragStart={handlePillDragStart} onDragEnd={handlePillDragEnd} isBeingDragged={draggedTaskId === task.id} />
                        ))}
                        {earlyTasks.length > MAX_EARLY && <OverflowPopover tasks={earlyTasks.slice(MAX_EARLY)} onTaskClick={onTaskClick} />}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Time grid — absolute positioning for resizable tasks */}
            <div className={`grid gap-px bg-border/10`} style={{ gridTemplateColumns: `50px repeat(${colCount}, 1fr)` }}>
              <div className="contents">
                {/* Hour labels */}
                <div className="bg-card">
                  {weekHours.map(hour => (
                    <div key={hour} className="flex items-start justify-end pr-2 pt-0.5" style={{ height: `${HOUR_HEIGHT}px` }}>
                      <span className="text-[10px] text-muted-foreground/30 tabular-nums">{String(hour).padStart(2, '0')}:00</span>
                    </div>
                  ))}
                </div>
                {/* Day columns */}
                {filteredWeekDays.map((day) => {
                  const dayKey = getDateKey(day.date);
                  const allDayTasks = (tasksByDate.get(dayKey) || []).filter(t => hasSpecificTime(t) && getTaskHour(t) >= startHour && getTaskHour(t) <= endHour);
                  const totalHeight = weekHours.length * HOUR_HEIGHT;
                  return (
                    <div
                      key={dayKey}
                      className={`bg-card relative ${day.isToday ? 'bg-primary/[0.02]' : ''}`}
                      style={{ height: `${totalHeight}px` }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        const rect = e.currentTarget.getBoundingClientRect();
                        const y = e.clientY - rect.top;
                        const rawMin = (y / HOUR_HEIGHT) * 60 + startHour * 60;
                        const snapped = Math.round(rawMin / SNAP_MINUTES) * SNAP_MINUTES;
                        const newCell = `${dayKey}:${snapped}`;
                        if (newCell !== dragOverCell) setDragOverCell(newCell);
                      }}
                      onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCell(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const id = e.dataTransfer.getData('text/plain');
                        if (!id) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const y = e.clientY - rect.top;
                        const rawMinutes = (y / HOUR_HEIGHT) * 60 + startHour * 60;
                        const snappedMinutes = Math.round(rawMinutes / SNAP_MINUTES) * SNAP_MINUTES;
                        const hour = Math.floor(snappedMinutes / 60);
                        const minute = snappedMinutes % 60;
                        setDraggedTaskId(null);
                        setDragOverCell(null);
                        justInteracted.current = true;
                        setTimeout(() => { justInteracted.current = false; }, 200);
                        if (onDateChange) {
                          const newDate = new Date(day.date);
                          newDate.setHours(hour, minute, 0, 0);
                          onDateChange(id, newDate.toISOString());
                        }
                      }}
                      onClick={(e) => {
                        if (!onCreateTask || (e.target as HTMLElement).closest('.task-block')) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const y = e.clientY - rect.top;
                        const hour = Math.floor(y / HOUR_HEIGHT) + startHour;
                        const d = new Date(day.date);
                        d.setHours(hour, 0, 0, 0);
                        onCreateTask(d.toISOString());
                      }}
                    >
                      {/* Hour grid lines */}
                      {weekHours.map(hour => (
                        <div
                          key={hour}
                          className="absolute left-0 right-0 border-t border-border/20"
                          style={{ top: `${(hour - startHour) * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
                        />
                      ))}
                      {/* Tasks + drop indicator — layout includes phantom for preview */}
                      {(() => {
                        const PHANTOM_ID = '__drop_preview__';
                        const dropMatch = dragOverCell?.startsWith(dayKey + ':') ? dragOverCell : null;
                        const dropMinutes = dropMatch ? parseInt(dropMatch.split(':').pop() || '0', 10) : null;
                        const dragDuration = draggedTaskId ? getTaskDuration(draggedTaskId, taskDurations) : 60;

                        const layoutItems = allDayTasks
                          .filter(t => t.id !== draggedTaskId)
                          .map(t => ({
                            id: t.id,
                            startMin: Math.round(getTaskHour(t) * 60),
                            endMin: Math.round(getTaskHour(t) * 60) + getTaskDuration(t.id, taskDurations),
                          }));
                        if (dropMinutes !== null && draggedTaskId) {
                          layoutItems.push({ id: PHANTOM_ID, startMin: dropMinutes, endMin: dropMinutes + dragDuration });
                        }
                        const taskLayouts = layoutOverlappingTasks(layoutItems);

                        const phantomLayout = taskLayouts.get(PHANTOM_ID);
                        const dropStartH = dropMinutes !== null ? Math.floor(dropMinutes / 60) : 0;
                        const dropStartM = dropMinutes !== null ? dropMinutes % 60 : 0;
                        const dropEndMin = dropMinutes !== null ? dropMinutes + dragDuration : 0;
                        const dropEndH = Math.floor(dropEndMin / 60);
                        const dropEndM = dropEndMin % 60;
                        const dropTimeLabel = dropMinutes !== null ? `${formatTimeFromMinutes(dropStartH, dropStartM)} – ${formatTimeFromMinutes(dropEndH, dropEndM)}` : '';
                        const dropIndicator = dropMinutes !== null && phantomLayout ? (
                          <div
                            key="drop-indicator"
                            className="absolute rounded pointer-events-none z-40 transition-all duration-100 ease-out"
                            style={{
                              top: ((dropMinutes - startHour * 60) / 60) * HOUR_HEIGHT,
                              height: (dragDuration / 60) * HOUR_HEIGHT,
                              left: `calc(${(phantomLayout.col * 100 / phantomLayout.totalCols)}% + 2px)`,
                              width: `calc(${100 / phantomLayout.totalCols}% - 4px)`,
                              border: '2px dashed var(--primary)',
                              background: 'color-mix(in oklab, var(--primary) 10%, transparent)',
                            }}
                          >
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 block truncate rounded-sm" style={{ color: 'var(--primary)', background: 'color-mix(in oklab, var(--primary) 15%, var(--card))', width: 'fit-content' }}>{dropTimeLabel}</span>
                          </div>
                        ) : null;

                        const taskElements = allDayTasks.filter(t => t.id !== draggedTaskId).map(task => {
                        const layout = taskLayouts.get(task.id) || { col: 0, totalCols: 1 };
                        const colWidth = 100 / layout.totalCols;
                        const leftPct = layout.col * colWidth;
                        const taskHour = getTaskHour(task);
                        const duration = getTaskDuration(task.id, taskDurations);
                        const top = (taskHour - startHour) * HOUR_HEIGHT;
                        const height = Math.max((duration / 60) * HOUR_HEIGHT, (MIN_DURATION / 60) * HOUR_HEIGHT);
                        const isResizing = resizingTaskId === task.id;
                        const isDragged = draggedTaskId === task.id;
                        const startH = Math.floor(taskHour);
                        const startM = Math.round((taskHour - startH) * 60);
                        const endTotalMin = Math.round(taskHour * 60 + duration);
                        const endH = Math.floor(endTotalMin / 60);
                        const endM = endTotalMin % 60;
                        const timeLabel = `${formatTimeFromMinutes(startH, startM)} – ${formatTimeFromMinutes(endH, endM)}`;
                        const dynStatus = dynamicStatuses.find(s => s.slug === task.status);
                        const dotColor = dynStatus?.dot_colour || dynStatus?.colour || STATUS_STYLES[task.status]?.dot || 'var(--muted-foreground)';

                        return (
                          <div
                            key={task.id}
                            className={`task-block absolute rounded-md border border-border/30 overflow-hidden cursor-pointer group/task ${isResizing ? 'ring-1 ring-primary/40 z-30' : 'z-20 hover:shadow-md hover:z-30'} ${isDragged ? 'opacity-30' : ''}`}
                            style={{
                              top: `${top}px`,
                              height: `${height}px`,
                              left: `calc(${leftPct}% + 2px)`,
                              width: `calc(${colWidth}% - 4px)`,
                              backgroundColor: `color-mix(in oklab, ${dotColor} 10%, var(--card))`,
                              borderLeftColor: dotColor,
                              borderLeftWidth: '3px',
                              transition: 'top 150ms ease-out, left 150ms ease-out, width 150ms ease-out',
                            }}
                            draggable={!isResizing}
                            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                            onDragStart={(e) => {
                              if (isResizing) { e.preventDefault(); return; }
                              e.dataTransfer.setData('text/plain', task.id);
                              e.dataTransfer.effectAllowed = 'move';
                              setTimeout(() => handlePillDragStart(task.id), 0);
                            }}
                            onDragEnd={handlePillDragEnd}
                            onClick={(e) => {
                              if (isResizing || justInteracted.current) return;
                              e.stopPropagation();
                              onTaskClick(task);
                            }}
                          >
                            <div className="px-1.5 py-0.5 h-full flex flex-col min-h-0">
                              <span className="text-[10px] text-muted-foreground/60 tabular-nums shrink-0">{timeLabel}</span>
                              <span className="text-[11px] text-foreground truncate leading-tight">{task.title}</span>
                              {task.project_name && (
                                <span className="text-[10px] text-muted-foreground/40 truncate">{task.project_name}</span>
                              )}
                            </div>
                            {/* Resize handle */}
                            <div
                              className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize opacity-0 group-hover/task:opacity-100 transition-opacity"
                              style={{ backgroundColor: `color-mix(in oklab, ${dotColor} 30%, transparent)` }}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                setResizingTaskId(task.id);
                                resizeStartY.current = e.clientY;
                                resizeStartDuration.current = duration;
                                const handleMouseMove = (ev: MouseEvent) => {
                                  const dy = ev.clientY - resizeStartY.current;
                                  const deltaMinutes = (dy / HOUR_HEIGHT) * 60;
                                  updateTaskDuration(task.id, resizeStartDuration.current + deltaMinutes);
                                };
                                const handleMouseUp = () => {
                                  setResizingTaskId(null);
                                  justInteracted.current = true;
                                  setTimeout(() => { justInteracted.current = false; }, 200);
                                  document.removeEventListener('mousemove', handleMouseMove);
                                  document.removeEventListener('mouseup', handleMouseUp);
                                };
                                document.addEventListener('mousemove', handleMouseMove);
                                document.addEventListener('mouseup', handleMouseUp);
                              }}
                            />
                          </div>
                        );
                      });
                        return <>{dropIndicator}{taskElements}</>;
                      })()}
                      {/* Create hint for empty areas */}
                      {allDayTasks.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
                          <Plus className="h-4 w-4 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tasks after visible hours */}
            {(() => {
              const filteredDays = filteredWeekDays;
              const hasLateTasks = filteredDays.some(day => {
                const dayTasks = tasksByDate.get(getDateKey(day.date)) || [];
                return dayTasks.some(t => hasSpecificTime(t) && getTaskHour(t) > endHour);
              });
              if (!hasLateTasks) return null;
              return (
                <div className={`grid gap-px bg-border/10 border-t border-border/20`} style={{ gridTemplateColumns: `50px repeat(${colCount}, 1fr)` }}>
                  <div className="bg-card flex items-center justify-end pr-2">
                    <span className="text-[10px] text-muted-foreground/60">Later</span>
                  </div>
                  {filteredDays.map((day, i) => {
                    const lateTasks = (tasksByDate.get(getDateKey(day.date)) || [])
                      .filter(t => hasSpecificTime(t) && getTaskHour(t) > endHour)
                      .sort((a, b) => getTaskHour(a) - getTaskHour(b));
                    const MAX_LATE = 3;
                    return (
                      <div key={getDateKey(day.date)} className={`bg-muted/20 p-1 min-h-[28px] overflow-hidden min-w-0 ${day.isToday ? 'bg-primary/[0.03]' : ''}`}>
                        {lateTasks.slice(0, MAX_LATE).map(task => (
                          <TaskPill key={task.id} task={task} onTaskClick={onTaskClick} showTime draggable onDragStart={handlePillDragStart} onDragEnd={handlePillDragEnd} isBeingDragged={draggedTaskId === task.id} />
                        ))}
                        {lateTasks.length > MAX_LATE && <OverflowPopover tasks={lateTasks.slice(MAX_LATE)} onTaskClick={onTaskClick} />}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
