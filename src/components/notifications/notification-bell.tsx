'use client';

import { useState } from 'react';
import { Bell, Check, Settings, Sparkles } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export function NotificationBell() {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label="Notifications"
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
            <button
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors duration-150"
              disabled
            >
              <Check size={12} />
              Mark all read
            </button>
            <button
              className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/40 transition-colors duration-150"
              aria-label="Notification settings"
            >
              <Settings size={14} />
            </button>
          </div>
        </div>

        {/* Empty state */}
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <Sparkles size={32} className="text-muted-foreground/30 mb-3" />
          <p className="text-[13px] font-medium text-muted-foreground">All caught up!</p>
          <p className="text-[11px] text-muted-foreground/60 mt-0.5">No notifications to show. Enjoy the peace.</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
