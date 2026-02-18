'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Bell, Settings, Sun, Moon, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export function TopBar() {
  const [dark, setDark] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Theme toggle
  const toggleTheme = useCallback(() => {
    setDark(d => {
      const next = !d;
      document.documentElement.classList.toggle('dark', next);
      localStorage.setItem('theme', next ? 'dark' : 'light');
      return next;
    });
  }, []);

  // Init theme from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    const isDark = saved !== 'light';
    setDark(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  // ⌘K handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
        setTimeout(() => searchRef.current?.focus(), 50);
      }
      if (e.key === 'Escape') setShowSearch(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Simple search navigation
  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    const q = searchQuery.toLowerCase();
    if (q.includes('client')) router.push('/clients');
    else if (q.includes('task')) router.push('/tasks');
    else if (q.includes('pipeline') || q.includes('prospect')) router.push('/pipeline');
    else if (q.includes('team')) router.push('/teams');
    else if (q.includes('xero') || q.includes('revenue')) router.push('/xero');
    else toast.info(`No results for "${searchQuery}"`);
    setSearchQuery('');
    setShowSearch(false);
  };

  return (
    <>
      <header className="fixed top-0 right-0 left-56 z-30 h-12 flex items-center justify-end gap-2 px-4 border-b border-border/20 bg-background/80 backdrop-blur-sm">
        {/* Search trigger */}
        <div className="relative mr-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
          <button
            onClick={() => { setShowSearch(true); setTimeout(() => searchRef.current?.focus(), 50); }}
            className="h-8 w-48 pl-8 pr-10 text-[13px] text-left bg-secondary border border-border/20 rounded-lg outline-none cursor-pointer hover:border-primary/30 transition-colors duration-150 text-muted-foreground/40"
          >
            Search...
          </button>
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 pointer-events-none">
            <span className="text-[10px] font-medium text-muted-foreground/40">⌘K</span>
          </kbd>
        </div>

        {/* Notifications */}
        <button
          aria-label="Notifications"
          onClick={() => { setShowNotifications(!showNotifications); toast.info('No new notifications'); }}
          className="h-8 w-8 flex items-center justify-center rounded-lg border border-border/20 bg-secondary text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all duration-150"
        >
          <Bell size={15} />
        </button>

        {/* Settings */}
        <button
          aria-label="Settings"
          onClick={() => toast.info('Settings coming soon')}
          className="h-8 w-8 flex items-center justify-center rounded-lg border border-border/20 bg-secondary text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all duration-150"
        >
          <Settings size={15} />
        </button>

        {/* Theme toggle */}
        <button
          aria-label="Toggle theme"
          onClick={toggleTheme}
          className="h-8 w-8 flex items-center justify-center rounded-lg border border-border/20 bg-secondary text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all duration-150"
        >
          {dark ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        {/* User avatar */}
        <div
          className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 ml-1 cursor-pointer select-none"
          style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #0d9488 100%)' }}
          title="Jamie Ludlow"
        >
          <span className="text-[11px] font-bold text-white leading-none">JL</span>
        </div>
      </header>

      {/* Search overlay */}
      {showSearch && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50 animate-in fade-in duration-100" onClick={() => setShowSearch(false)} />
          <div className="fixed top-[20%] left-1/2 -translate-x-1/2 z-50 w-full max-w-lg animate-in fade-in slide-in-from-top-4 duration-150">
            <div className="bg-card border border-border/20 rounded-xl shadow-2xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border/10">
                <Search size={16} className="text-muted-foreground/50 shrink-0" />
                <input
                  ref={searchRef}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSearch(); if (e.key === 'Escape') setShowSearch(false); }}
                  placeholder="Search clients, tasks, pipeline..."
                  className="flex-1 text-[14px] bg-transparent outline-none placeholder:text-muted-foreground/40"
                />
                <button onClick={() => setShowSearch(false)} className="text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                  <X size={14} />
                </button>
              </div>
              <div className="px-4 py-3 text-[12px] text-muted-foreground/40">
                Type to search or navigate — try &quot;clients&quot;, &quot;tasks&quot;, &quot;pipeline&quot;
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
