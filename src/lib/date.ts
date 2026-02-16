import { format, formatDistanceToNow, differenceInDays, isToday, isYesterday, isTomorrow, isPast } from 'date-fns';

export function formatDueDate(value?: string | Date | null): string {
  if (!value) return 'Set date';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Set date';

  const now = new Date();
  const daysUntilDue = differenceInDays(date, now);
  const time = format(date, 'HH:mm');
  const hasTime = time !== '00:00';
  const timeSuffix = hasTime ? ` at ${time}` : '';

  if (isPast(date) && !isToday(date)) {
    const daysOverdue = Math.abs(daysUntilDue);
    if (daysOverdue === 1) return `Overdue by 1 day`;
    return `Overdue by ${daysOverdue} days`;
  }

  if (isToday(date)) return hasTime ? `Today ${time}` : 'Due today';
  if (isTomorrow(date)) return hasTime ? `Tomorrow ${time}` : 'Due tomorrow';
  if (daysUntilDue > 0 && daysUntilDue <= 7) return `${format(date, 'EEE')}${timeSuffix}`;
  
  return `${format(date, 'd MMM yyyy')}${timeSuffix}`;
}

export function getDueDateColor(value?: string | Date | null): string {
  if (!value) return 'text-muted-foreground/30';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'text-muted-foreground';

  if (isPast(date) && !isToday(date)) return 'text-red-400';
  return 'text-muted-foreground';
}

export function formatRelativeDate(value?: string | Date | null): string {
  if (!value) return 'No date';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'No date';

  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  if (isTomorrow(date)) return 'Tomorrow';
  
  const daysAway = differenceInDays(date, new Date());
  if (daysAway > 0 && daysAway <= 7) return format(date, 'EEE');
  
  return format(date, 'd MMM');
}
