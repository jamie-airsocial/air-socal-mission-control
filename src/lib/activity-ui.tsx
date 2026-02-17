/**
 * Shared activity UI helpers — used by task-sheet.tsx and subtask-detail.tsx.
 * Client-safe: no server imports.
 */

import { format } from 'date-fns';
import {
  Plus, ArrowRight, Flag, User, Calendar as CalendarIcon, Pencil, Activity, Tag,
} from 'lucide-react';

export function formatTimestamp(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const timeStr = format(d, 'HH:mm');
  if (diffDays === 0) return `Today at ${timeStr}`;
  if (diffDays === 1) return `Yesterday at ${timeStr}`;
  return format(d, "d MMM ''yy") + ` at ${timeStr}`;
}

export function activityIcon(key: string): React.ReactElement {
  const cls = 'h-3 w-3';
  switch (key) {
    case 'created':  return <Plus className={cls} />;
    case 'status':   return <ArrowRight className={cls} />;
    case 'priority': return <Flag className={cls} />;
    case 'assignee': return <User className={cls} />;
    case 'due_date': return <CalendarIcon className={cls} />;
    case 'title':    return <Pencil className={cls} />;
    case 'label':    return <Tag className={cls} />;
    default:         return <Activity className={cls} />;
  }
}
