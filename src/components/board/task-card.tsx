'use client';

import { memo } from 'react';
import type { Task } from '@/lib/types';
import { CalendarDays, Check, GripVertical } from 'lucide-react';
import { ASSIGNEE_COLORS, PRIORITY_BADGE, toDisplayName, getInitials } from '@/lib/constants';
import { formatDueDate, getDueDateColor } from '@/lib/date';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

function formatCompletedAt(completedAt: string | null | undefined, updatedAt: string): { text: string; className: string } {
  // Backfill: use updated_at if completed_at is missing
  const timestamp = completedAt || updatedAt;
  const completed = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - completed.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const completedDay = new Date(completed.getFullYear(), completed.getMonth(), completed.getDate());
  const isToday = completedDay.getTime() === today.getTime();

  if (diffMins < 1) return { text: 'Completed just now', className: 'text-status-success' };
  if (diffMins < 60) return { text: `Completed ${diffMins}m ago`, className: 'text-status-success' };
  if (diffHours < 24 && isToday) {
    const time = completed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    return { text: `Completed today ${time}`, className: 'text-status-success' };
  }
  if (diffDays === 1) {
    const time = completed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    return { text: `Completed yesterday ${time}`, className: 'text-status-success' };
  }
  const dateStr = completed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const time = completed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  return { text: `Completed ${dateStr} ${time}`, className: 'text-status-success' };
}


interface TaskCardProps {
  task: Task & { project_name?: string; project_color?: string };
  onClick: () => void;
  /** Apply reduced opacity to completed tasks (only relevant in status grouping mode) */
  dimDone?: boolean;
}

const PRIORITY_BORDER_COLORS: Record<string, string> = {
  P1: 'var(--destructive)',
  P2: 'var(--status-warning, oklch(0.75 0.183 55.934))',
  P3: 'var(--primary)',
  P4: 'var(--status-success, oklch(0.72 0.17 162))',
};

function TaskCardInner({ task, onClick, dimDone = false }: TaskCardProps) {
  const due = task.status === 'done' 
    ? formatCompletedAt(task.completed_at, task.updated_at)
    : task.due_date 
      ? { text: formatDueDate(task.due_date, task.status), className: getDueDateColor(task.due_date, task.status) }
      : null;
  const isDone = task.status === 'done';
  const assigneeColor = task.assignee ? (ASSIGNEE_COLORS[task.assignee] || 'bg-muted-foreground/20 text-muted-foreground') : '';

  return (
    <div
      onClick={onClick}
      onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      role="button"
      tabIndex={0}
      aria-label={`Task: ${task.title}`}
      className={`group relative cursor-pointer rounded-lg border border-border/20 bg-card transition-[background-color,box-shadow,opacity] duration-150 hover:bg-muted/40 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none ${isDone && dimDone ? 'opacity-60' : ''}`}
      style={{
        borderLeftWidth: task.priority ? '3px' : '1px',
        borderLeftColor: task.priority ? PRIORITY_BORDER_COLORS[task.priority] : undefined,
      }}
    >
      {/* Drag handle - visible on hover */}
      <div className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <GripVertical size={14} className="text-muted-foreground/30" aria-hidden="true" />
      </div>

      <div className="px-3 py-2.5 pl-5">
        {/* Title */}
        <h4 className="text-[13px] font-medium leading-snug text-foreground mb-2 line-clamp-2">
          {task.title}
        </h4>

        {/* Sub-task progress */}
        {task.subtask_count != null && task.subtask_count > 0 && (
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-1 rounded-full bg-border/20 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${(task.subtasks_done_count || 0) === task.subtask_count ? 'bg-status-success' : 'bg-primary'}`}
                style={{ width: `${((task.subtasks_done_count || 0) / task.subtask_count) * 100}%` }}
              />
            </div>
            <span className="text-[11px] font-medium text-muted-foreground/60 whitespace-nowrap tabular-nums">
              {task.subtasks_done_count || 0}/{task.subtask_count}
            </span>
          </div>
        )}

        {/* Bottom row: project, due date, assignee */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {task.project_name ? (
              <>
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: task.project_color || 'var(--muted-foreground)' }}
                />
                <span className="text-[11px] text-muted-foreground/60 truncate">
                  {task.project_name}
                </span>
              </>
            ) : (
              <span className="text-[11px] text-muted-foreground/30 truncate">No client</span>
            )}
            {task.priority && PRIORITY_BADGE[task.priority] && (
              <span className={`text-[10px] px-1.5 py-0 rounded border font-medium ${PRIORITY_BADGE[task.priority].className}`}>
                {task.priority}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {due && (
              <div className={`flex items-center gap-1 ${due.className}`}>
                {isDone ? <Check size={11} /> : <CalendarDays size={11} />}
                <span className="text-[11px]">{due.text}</span>
              </div>
            )}
            {task.assignee && (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={`flex items-center justify-center h-5 w-5 rounded-full text-[9px] leading-none font-semibold ${assigneeColor}`}>
                      {getInitials(toDisplayName(task.assignee))}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-[13px]">{toDisplayName(task.assignee)}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * TaskCard — memoised so it only re-renders when the task data or onClick
 * reference changes. This prevents re-renders caused by board-level state
 * (e.g. sheetOpen, popover states) from cascading into every card.
 */
export const TaskCard = memo(TaskCardInner);
