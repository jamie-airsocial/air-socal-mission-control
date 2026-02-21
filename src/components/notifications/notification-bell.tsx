'use client';

import { useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
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
          <h3 className="text-[13px] font-semibold">Notifications</h3>
          <button
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors duration-150"
            disabled
          >
            Mark all read
          </button>
        </div>

        {/* Empty state */}
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <BellOff size={32} className="text-muted-foreground/40 mb-3" />
          <p className="text-[13px] text-muted-foreground">No notifications</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
