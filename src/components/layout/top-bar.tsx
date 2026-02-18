'use client';

import { useState } from 'react';
import { Search, Bell, Settings, Sun, Moon } from 'lucide-react';

export function TopBar() {
  const [dark, setDark] = useState(true);

  return (
    <header className="fixed top-0 right-0 left-56 z-30 h-12 flex items-center justify-end gap-2 px-4 border-b border-border/20 bg-background/80 backdrop-blur-sm">
      {/* Search */}
      <div className="relative mr-2">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
        <input
          readOnly
          placeholder="Search..."
          onClick={() => {/* future: open command palette */}}
          className="h-8 w-48 pl-8 pr-10 text-[13px] bg-secondary border border-border/20 rounded-lg outline-none cursor-pointer hover:border-primary/30 transition-colors duration-150 placeholder:text-muted-foreground/40 select-none"
        />
        <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 pointer-events-none">
          <span className="text-[10px] font-medium text-muted-foreground/40">⌘K</span>
        </kbd>
      </div>

      {/* Notifications */}
      <button
        aria-label="Notifications"
        className="h-8 w-8 flex items-center justify-center rounded-lg border border-border/20 bg-secondary text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all duration-150"
      >
        <Bell size={15} />
      </button>

      {/* Settings */}
      <button
        aria-label="Settings"
        className="h-8 w-8 flex items-center justify-center rounded-lg border border-border/20 bg-secondary text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all duration-150"
      >
        <Settings size={15} />
      </button>

      {/* Theme toggle */}
      <button
        aria-label="Toggle theme"
        onClick={() => setDark(d => !d)}
        className="h-8 w-8 flex items-center justify-center rounded-lg border border-border/20 bg-secondary text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all duration-150"
      >
        {dark ? <Sun size={15} /> : <Moon size={15} />}
      </button>

      {/* User avatar */}
      <div
        className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 ml-1 cursor-pointer select-none"
        style={{
          background: 'linear-gradient(135deg, #7c3aed 0%, #0d9488 100%)',
        }}
        title="Jamie Ludlow"
      >
        <span className="text-[11px] font-bold text-white leading-none">JL</span>
      </div>
    </header>
  );
}
