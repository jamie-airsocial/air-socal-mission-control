import { formatDistanceToNow, differenceInDays, differenceInCalendarDays, differenceInHours, isToday, isYesterday, isTomorrow, isPast, format } from 'date-fns';

export function formatDateTimeUK(value?: string | Date | null): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const formatted = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  return formatted.replace(',', '').replace(/\//g, '-');
}

export function formatDateUK(value?: string | Date | null): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const formatted = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
  return formatted.replace(/\//g, '-');
}

export function formatTimeUK(value?: string | Date | null): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function toLocalDateTimeInput(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatRelative(value?: string | Date | null): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  const now = new Date();
  const time = format(date, 'HH:mm');
  
  // "Just now" and "X minutes/hours ago"
  if (isToday(date)) {
    const hours = differenceInHours(now, date);
    const minutes = Math.floor((now.getTime() - date.getTime()) / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  // "Yesterday at 14:30"
  if (isYesterday(date)) return `Yesterday at ${time}`;

  // "2 days ago at 14:30" for recent days
  const days = differenceInDays(now, date);
  if (days >= 2 && days <= 6) return `${days} days ago at ${time}`;

  // "10 Feb at 14:30" for older
  return `${format(date, 'd MMM')} at ${time}`;
}

export function formatDueDate(value?: string | Date | null, status?: string): string {
  if (!value) return 'Set date';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Set date';

  const now = new Date();
  const daysUntilDue = differenceInCalendarDays(date, now);
  const time = format(date, 'HH:mm');
  const hasTime = time !== '00:00';
  const timeSuffix = hasTime ? ` at ${time}` : '';

  // Completed tasks never show as overdue
  if (status !== 'done' && isPast(date)) {
    const elapsedHours = Math.max(1, Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60)));
    if (elapsedHours < 24) {
      return `Overdue by ${elapsedHours} hour${elapsedHours === 1 ? '' : 's'}`;
    }
    const days = Math.floor(elapsedHours / 24);
    return `Overdue by ${days} day${days === 1 ? '' : 's'}`;
  }

  if (isToday(date)) return hasTime ? `Today ${time}` : 'Due today';
  if (isTomorrow(date)) return hasTime ? `Tomorrow ${time}` : 'Due tomorrow';
  if (daysUntilDue > 0 && daysUntilDue <= 7) return `${format(date, 'EEE')}${timeSuffix}`;
  
  return `${format(date, 'd MMM yyyy')}${timeSuffix}`;
}

export function getDueDateColor(value?: string | Date | null, status?: string): string {
  if (!value) return 'text-muted-foreground/30';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'text-muted-foreground';

  // Completed tasks never show as overdue
  if (status === 'done') return 'text-muted-foreground';

  // Overdue = red. Includes today if specific time has passed.
  if (isPast(date)) {
    if (!isToday(date)) return 'text-destructive';
    const time = format(date, 'HH:mm');
    if (time !== '00:00') return 'text-destructive';
  }
  return 'text-muted-foreground';
}
