'use client';

import { useState } from 'react';
import { Bell, Check, Settings, Sparkles, X, UserPlus, CheckCircle2, MessageSquare, AtSign, ShieldAlert } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

type NotificationType = 'task_assigned' | 'task_completed' | 'comment' | 'mention' | 'system';

type NotificationPreferences = Record<NotificationType, boolean>;

const TYPE_CONFIG: Record<NotificationType, { icon: typeof Bell; iconClass: string; bgClass: string; title: string; description: string }> = {
  task_assigned: {
    icon: UserPlus,
    iconClass: 'text-sky-500',
    bgClass: 'bg-sky-500/10',
    title: 'Task Assigned',
    description: 'When a task is assigned to you',
  },
  task_completed: {
    icon: CheckCircle2,
    iconClass: 'text-emerald-500',
    bgClass: 'bg-emerald-500/10',
    title: 'Task Completed',
    description: 'When a task is marked as done',
  },
  comment: {
    icon: MessageSquare,
    iconClass: 'text-primary',
    bgClass: 'bg-primary/10',
    title: 'Comments',
    description: 'New comments on tasks you follow',
  },
  mention: {
    icon: AtSign,
    iconClass: 'text-amber-500',
    bgClass: 'bg-amber-500/10',
    title: 'Mentions',
    description: 'When someone mentions you',
  },
  system: {
    icon: ShieldAlert,
    iconClass: 'text-rose-500',
    bgClass: 'bg-rose-500/10',
    title: 'System',
    description: 'Important system notifications',
  },
};

function getPreferences(): NotificationPreferences {
  if (typeof window === 'undefined') return { task_assigned: true, task_completed: true, comment: true, mention: true, system: true };
  try {
    const stored = localStorage.getItem('notification-preferences');
    return stored ? JSON.parse(stored) : { task_assigned: true, task_completed: true, comment: true, mention: true, system: true };
  } catch {
    return { task_assigned: true, task_completed: true, comment: true, mention: true, system: true };
  }
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>(getPreferences);

  const togglePreference = (type: NotificationType) => {
    const updated = { ...preferences, [type]: !preferences[type] };
    setPreferences(updated);
    localStorage.setItem('notification-preferences', JSON.stringify(updated));
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setShowPreferences(false); }}>
      <PopoverTrigger asChild>
        <button
          aria-label="Notifications"
          title="Notifications"
          className="h-9 w-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground active:scale-[0.95] transition-all duration-150"
        >
          <Bell size={16} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
          <div>
            <h3 className="text-[13px] font-semibold">Notifications</h3>
            <p className="text-[11px] text-muted-foreground/60">All caught up</p>
          </div>
          <div className="flex items-center gap-1">
            {!showPreferences && (
              <button
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors duration-150"
                disabled
              >
                <Check size={12} />
                Mark all read
              </button>
            )}
            <button
              onClick={() => setShowPreferences(!showPreferences)}
              className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/40 transition-colors duration-150"
              aria-label="Notification settings"
            >
              {showPreferences ? <X size={14} /> : <Settings size={14} />}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="max-h-[420px] overflow-y-auto px-3 py-3">
          {showPreferences ? (
            <div className="space-y-2">
              {(Object.keys(TYPE_CONFIG) as NotificationType[]).map((type) => {
                const config = TYPE_CONFIG[type];
                const Icon = config.icon;
                const enabled = preferences[type];
                return (
                  <button
                    key={type}
                    onClick={() => togglePreference(type)}
                    className={`w-full flex items-start gap-3 rounded-xl border p-3 transition-all text-left ${
                      enabled
                        ? 'border-border/20 bg-card hover:bg-secondary'
                        : 'border-transparent bg-muted/30 opacity-60 hover:opacity-80'
                    }`}
                  >
                    <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${config.bgClass} ${!enabled ? 'opacity-40' : ''}`}>
                      <Icon className={`h-4 w-4 ${config.iconClass}`} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] font-medium ${enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {config.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {config.description}
                      </p>
                    </div>
                    <div className={`relative mt-1 inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                      enabled ? 'bg-primary' : 'bg-muted-foreground/20'
                    }`}>
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition-transform ${
                        enabled ? 'translate-x-4' : 'translate-x-0'
                      }`} />
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-9 px-4">
              <Sparkles size={32} className="text-muted-foreground/30 mb-3" />
              <p className="text-[13px] font-medium text-muted-foreground">All caught up!</p>
              <p className="text-[11px] text-muted-foreground/60 mt-0.5">No notifications to show. Enjoy the peace.</p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
