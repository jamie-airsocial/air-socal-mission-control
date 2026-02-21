'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Sun, Moon, X, Clock, Trash2, Settings, Plus, Users, ListChecks, TrendingUp, UsersRound, Receipt } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { useAuth } from '@/contexts/auth-context';

type Client = {
  id: string;
  name: string;
  color: string | null;
};

type Task = {
  id: string;
  title: string;
  status: string;
  client_name: string | null;
  client_color: string | null;
  client_id: string | null;
};

type SearchHistory = {
  query: string;
  timestamp: number;
};

type QuickAction = {
  id: string;
  label: string;
  action: () => void;
};

type NavigateItem = {
  id: string;
  label: string;
  href: string;
};

type SearchResult = 
  | { type: 'client'; data: Client }
  | { type: 'task'; data: Task }
  | { type: 'recent'; data: SearchHistory }
  | { type: 'action'; data: QuickAction }
  | { type: 'navigate'; data: NavigateItem };

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const MAX_RESULTS_PER_SECTION = 5;
const MAX_HISTORY_ITEMS = 5;

const NAV_ITEMS = [
  { href: '/clients', label: 'Clients', icon: Users, permKey: 'clients' },
  { href: '/tasks', label: 'Tasks', icon: ListChecks, permKey: 'tasks' },
  { href: '/pipeline', label: 'Pipeline', icon: TrendingUp, permKey: 'pipeline' },
  { href: '/teams', label: 'Teams', icon: UsersRound, permKey: 'teams' },
  { href: '/xero', label: 'Xero', icon: Receipt, permKey: 'xero' },
];

export function TopBar() {
  const { permissions, roleName } = useAuth();
  const isAdmin = roleName === 'Admin';
  const [dark, setDark] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [lastFetch, setLastFetch] = useState<number>(0);
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);
  const [historyEnabled, setHistoryEnabled] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
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

  // Load search history and settings
  useEffect(() => {
    const enabled = localStorage.getItem('air-social-search-history-enabled');
    if (enabled !== null) setHistoryEnabled(enabled === 'true');
    
    if (enabled !== 'false') {
      const history = localStorage.getItem('air-social-search-history');
      if (history) {
        try {
          setSearchHistory(JSON.parse(history));
        } catch {}
      }
    }
  }, []);

  // Fetch clients and tasks when search opens
  const fetchData = useCallback(async () => {
    const now = Date.now();
    if (lastFetch && now - lastFetch < CACHE_DURATION) return;

    try {
      const [clientsRes, tasksRes] = await Promise.all([
        fetch('/api/clients'),
        fetch('/api/tasks'),
      ]);

      if (clientsRes.ok) {
        const clientsData = await clientsRes.json();
        setClients(clientsData);
      }

      if (tasksRes.ok) {
        const tasksData = await tasksRes.json();
        setTasks(tasksData);
      }

      setLastFetch(now);
    } catch (error) {
      toast.error('Failed to load search data');
    }
  }, [lastFetch]);

  // ⌘K handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
        fetchData();
        setTimeout(() => searchRef.current?.focus(), 50);
      }
      if (e.key === 'Escape') {
        setShowSearch(false);
        setSearchQuery('');
        setSelectedIndex(0);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fetchData]);

  // Fuzzy match helper
  const fuzzyMatch = (text: string, query: string): boolean => {
    const t = text.toLowerCase();
    const q = query.toLowerCase();
    let queryIndex = 0;
    
    for (let i = 0; i < t.length && queryIndex < q.length; i++) {
      if (t[i] === q[queryIndex]) queryIndex++;
    }
    
    return queryIndex === q.length;
  };

  // Quick actions
  const quickActions: QuickAction[] = [
    {
      id: 'new-task',
      label: 'New task',
      action: () => window.dispatchEvent(new CustomEvent('shortcut:new-task')),
    },
    {
      id: 'new-client',
      label: 'New client',
      action: () => router.push('/clients?new=true'),
    },
  ];

  // Navigate items
  const navigateItems: NavigateItem[] = [
    ...NAV_ITEMS
      .filter(item => permissions[item.permKey as keyof typeof permissions] !== false)
      .map(item => ({ id: item.permKey, label: item.label, href: item.href })),
    ...(isAdmin ? [{ id: 'admin', label: 'Admin', href: '/admin' }] : []),
  ];

  // Filter results - only clients, tasks, and recent searches
  const getFilteredResults = (): SearchResult[] => {
    const query = searchQuery.trim();
    const results: SearchResult[] = [];

    // Show recent searches when empty
    if (!query && historyEnabled) {
      const recentResults = searchHistory.slice(0, MAX_HISTORY_ITEMS).map(item => ({
        type: 'recent' as const,
        data: item,
      }));
      results.push(...recentResults);
      return results;
    }

    if (!query) return results;

    // Filter clients
    const matchingClients = clients
      .filter(c => fuzzyMatch(c.name, query))
      .slice(0, MAX_RESULTS_PER_SECTION)
      .map(c => ({ type: 'client' as const, data: c }));

    // Filter tasks
    const matchingTasks = tasks
      .filter(t => fuzzyMatch(t.title, query))
      .slice(0, MAX_RESULTS_PER_SECTION)
      .map(t => ({ type: 'task' as const, data: t }));

    results.push(...matchingClients, ...matchingTasks);
    return results;
  };

  const results = getFilteredResults();

  // Filtered quick actions (show all when no query, filtered when searching)
  const filteredActions = searchQuery.trim()
    ? quickActions.filter(a => fuzzyMatch(a.label, searchQuery))
    : quickActions;

  // Filtered navigate items (show all when no query, filtered when searching)
  const filteredNavigate = searchQuery.trim()
    ? navigateItems.filter(n => fuzzyMatch(n.label, searchQuery))
    : navigateItems;

  // Save search to history
  const saveToHistory = (query: string) => {
    if (!historyEnabled || !query.trim()) return;

    const newHistory = [
      { query: query.trim(), timestamp: Date.now() },
      ...searchHistory.filter(h => h.query !== query.trim()),
    ].slice(0, MAX_HISTORY_ITEMS);

    setSearchHistory(newHistory);
    localStorage.setItem('air-social-search-history', JSON.stringify(newHistory));
  };

  // Navigate to result
  const navigateToResult = (result: SearchResult) => {
    if (result.type === 'action') {
      result.data.action();
      setShowSearch(false);
      setSearchQuery('');
      setSelectedIndex(0);
    } else if (result.type === 'navigate') {
      router.push(result.data.href);
      setShowSearch(false);
      setSearchQuery('');
      setSelectedIndex(0);
    } else if (result.type === 'client') {
      saveToHistory(searchQuery);
      router.push(`/clients/${result.data.id}`);
      setShowSearch(false);
      setSearchQuery('');
      setSelectedIndex(0);
    } else if (result.type === 'task') {
      saveToHistory(searchQuery);
      // Tasks don't have detail pages yet, show toast
      toast.info(`Task: ${result.data.title}`);
      setShowSearch(false);
      setSearchQuery('');
      setSelectedIndex(0);
    } else if (result.type === 'recent') {
      setSearchQuery(result.data.query);
      setSelectedIndex(0);
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const totalItems = filteredActions.length + filteredNavigate.length + recentResults.length + clientResults.length + taskResults.length;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => (i + 1) % Math.max(1, totalItems));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => (i - 1 + totalItems) % Math.max(1, totalItems));
    } else if (e.key === 'Enter' && totalItems > 0) {
      e.preventDefault();
      // Determine which item is selected based on index
      let currentIdx = selectedIndex;
      
      if (currentIdx < filteredActions.length) {
        navigateToResult({ type: 'action', data: filteredActions[currentIdx] });
      } else if (currentIdx < filteredActions.length + filteredNavigate.length) {
        currentIdx -= filteredActions.length;
        navigateToResult({ type: 'navigate', data: filteredNavigate[currentIdx] });
      } else if (currentIdx < filteredActions.length + filteredNavigate.length + recentResults.length) {
        currentIdx -= filteredActions.length + filteredNavigate.length;
        navigateToResult(recentResults[currentIdx]);
      } else if (currentIdx < filteredActions.length + filteredNavigate.length + recentResults.length + clientResults.length) {
        currentIdx -= filteredActions.length + filteredNavigate.length + recentResults.length;
        navigateToResult(clientResults[currentIdx]);
      } else {
        currentIdx -= filteredActions.length + filteredNavigate.length + recentResults.length + clientResults.length;
        navigateToResult(taskResults[currentIdx]);
      }
    } else if (e.key === 'Escape') {
      setShowSearch(false);
      setSearchQuery('');
      setSelectedIndex(0);
    }
  };

  // Clear history
  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('air-social-search-history');
    toast.success('Search history cleared');
  };

  // Toggle history
  const toggleHistory = () => {
    const newEnabled = !historyEnabled;
    setHistoryEnabled(newEnabled);
    localStorage.setItem('air-social-search-history-enabled', String(newEnabled));
    
    if (!newEnabled) {
      setSearchHistory([]);
      localStorage.removeItem('air-social-search-history');
    }
    
    toast.success(newEnabled ? 'Search history enabled' : 'Search history disabled');
  };

  // Get status dot color
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'done': return 'bg-emerald-500';
      case 'doing': return 'bg-indigo-500';
      case 'todo': return 'bg-amber-500';
      default: return 'bg-muted-foreground/40';
    }
  };

  // Group results by type (excluding actions and navigate - they're rendered separately)
  const recentResults = results.filter(r => r.type === 'recent');
  const clientResults = results.filter(r => r.type === 'client');
  const taskResults = results.filter(r => r.type === 'task');

  return (
    <>
      <header className="fixed top-0 right-0 left-56 z-30 h-12 flex items-center justify-end gap-2 px-4 border-b border-border/20 bg-background/80 backdrop-blur-sm">
        {/* Search trigger */}
        <div className="relative mr-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
          <button
            onClick={() => { 
              setShowSearch(true); 
              fetchData();
              setTimeout(() => searchRef.current?.focus(), 50); 
            }}
            className="h-8 w-48 pl-8 pr-10 text-[13px] text-left bg-secondary border border-border/20 rounded-lg outline-none cursor-pointer hover:border-primary/30 transition-colors duration-150 text-muted-foreground/40"
          >
            Search...
          </button>
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 pointer-events-none">
            <span className="text-[10px] font-medium text-muted-foreground/40">⌘K</span>
          </kbd>
        </div>

        {/* Notifications */}
        <NotificationBell />

        {/* Settings */}
        <Link href="/admin">
          <button
            aria-label="Settings"
            className="h-9 w-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground active:scale-[0.95] transition-all duration-150"
          >
            <Settings size={16} />
          </button>
        </Link>

        {/* Theme toggle */}
        <button
          aria-label="Toggle theme"
          onClick={toggleTheme}
          className="h-9 w-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground active:scale-[0.95] transition-all duration-150"
        >
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* User avatar */}
        <div className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-purple-600 text-[11px] font-bold text-primary-foreground">
          JL
        </div>
      </header>

      {/* Search overlay */}
      {showSearch && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50 animate-in fade-in duration-100" onClick={() => { setShowSearch(false); setSearchQuery(''); setSelectedIndex(0); }} />
          <div className="fixed top-[20%] left-1/2 -translate-x-1/2 z-50 w-full max-w-lg animate-in fade-in slide-in-from-top-4 duration-150">
            <div className="bg-card border border-border/20 rounded-xl shadow-2xl overflow-hidden">
              {/* Search input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border/10">
                <Search size={16} className="text-muted-foreground/50 shrink-0" />
                <input
                  ref={searchRef}
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setSelectedIndex(0); }}
                  onKeyDown={handleKeyDown}
                  placeholder="Search clients, tasks..."
                  className="flex-1 text-[14px] bg-transparent outline-none placeholder:text-muted-foreground/40"
                />
                <button 
                  onClick={() => { setShowSearch(false); setSearchQuery(''); setSelectedIndex(0); }} 
                  className="text-muted-foreground/40 hover:text-muted-foreground transition-colors duration-150"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Results */}
              <div className="max-h-[400px] overflow-y-auto">
                {/* Empty state when searching */}
                {searchQuery && filteredActions.length === 0 && filteredNavigate.length === 0 && clientResults.length === 0 && taskResults.length === 0 && (
                  <div className="px-4 py-8 text-center text-[13px] text-muted-foreground/40">
                    No results found
                  </div>
                )}

                {/* Quick Actions - always show when available (all or filtered) */}
                {filteredActions.length > 0 && (
                  <div className="py-2">
                    <div className="px-4 py-2 text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wide">
                      Quick Actions
                    </div>
                    {filteredActions.map((action, idx) => (
                      <button
                        key={action.id}
                        onClick={() => navigateToResult({ type: 'action', data: action })}
                        className={`w-full flex items-center gap-3 px-4 py-2 text-[13px] transition-colors duration-150 ${
                          idx === selectedIndex ? 'bg-muted/60' : 'hover:bg-muted/40'
                        }`}
                      >
                        <Plus size={14} className="text-muted-foreground/40 shrink-0" />
                        <span className="text-foreground truncate">{action.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Navigate - always show when available (all or filtered) */}
                {filteredNavigate.length > 0 && (
                  <div className="py-2">
                    <div className="px-4 py-2 text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wide">
                      Navigate
                    </div>
                    {filteredNavigate.map((navItem, idx) => {
                      const globalIdx = filteredActions.length + idx;
                      const navDef = NAV_ITEMS.find(n => n.permKey === navItem.id);
                      const Icon = navDef?.icon || (navItem.id === 'admin' ? Settings : Users);
                      return (
                        <button
                          key={navItem.id}
                          onClick={() => navigateToResult({ type: 'navigate', data: navItem })}
                          className={`w-full flex items-center gap-3 px-4 py-2 text-[13px] transition-colors duration-150 ${
                            globalIdx === selectedIndex ? 'bg-muted/60' : 'hover:bg-muted/40'
                          }`}
                        >
                          <Icon size={14} className="text-muted-foreground/40 shrink-0" />
                          <span className="text-foreground truncate">{navItem.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Recent searches */}
                {recentResults.length > 0 && (
                  <div className="py-2">
                    <div className="flex items-center justify-between px-4 py-2">
                      <div className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wide">
                        Recent searches
                      </div>
                      <button
                        onClick={clearHistory}
                        className="text-[11px] text-muted-foreground/60 hover:text-foreground transition-colors duration-150"
                      >
                        Clear all
                      </button>
                    </div>
                    {recentResults.map((result, idx) => {
                      const globalIdx = filteredActions.length + filteredNavigate.length + idx;
                      return (
                        <button
                          key={idx}
                          onClick={() => navigateToResult(result)}
                          className={`w-full flex items-center gap-3 px-4 py-2 text-[13px] transition-colors duration-150 ${
                            globalIdx === selectedIndex ? 'bg-muted/60' : 'hover:bg-muted/40'
                          }`}
                        >
                          <Clock size={14} className="text-muted-foreground/40 shrink-0" />
                          <span className="text-foreground truncate">{result.data.query}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Clients section */}
                {clientResults.length > 0 && (
                  <div className="py-2">
                    <div className="px-4 py-2 text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wide">
                      Clients
                    </div>
                    {clientResults.map((result, idx) => {
                      const globalIdx = filteredActions.length + filteredNavigate.length + recentResults.length + idx;
                      return (
                        <button
                          key={result.data.id}
                          onClick={() => navigateToResult(result)}
                          className={`w-full flex items-center gap-3 px-4 py-2 text-[13px] transition-colors duration-150 ${
                            globalIdx === selectedIndex ? 'bg-muted/60' : 'hover:bg-muted/40'
                          }`}
                        >
                          <div 
                            className="h-2 w-2 rounded-full shrink-0" 
                            style={{ backgroundColor: result.data.color || '#94a3b8' }}
                          />
                          <span className="text-foreground truncate">{result.data.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Tasks section */}
                {taskResults.length > 0 && (
                  <div className="py-2">
                    <div className="px-4 py-2 text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wide">
                      Tasks
                    </div>
                    {taskResults.map((result, idx) => {
                      const globalIdx = filteredActions.length + filteredNavigate.length + recentResults.length + clientResults.length + idx;
                      return (
                        <button
                          key={result.data.id}
                          onClick={() => navigateToResult(result)}
                          className={`w-full flex items-center gap-3 px-4 py-2 text-[13px] transition-colors duration-150 ${
                            globalIdx === selectedIndex ? 'bg-muted/60' : 'hover:bg-muted/40'
                          }`}
                        >
                          <div className={`h-2 w-2 rounded-full shrink-0 ${getStatusColor(result.data.status)}`} />
                          <div className="flex-1 flex items-center gap-2 min-w-0">
                            <span className="text-foreground truncate">{result.data.title}</span>
                            {result.data.client_name && (
                              <span className="text-muted-foreground/60 text-[12px] shrink-0">
                                · {result.data.client_name}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer with history toggle */}
              <div className="flex items-center justify-between px-4 py-2 border-t border-border/10 bg-muted/20">
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleHistory}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ${
                      historyEnabled ? 'bg-primary' : 'bg-muted-foreground/20'
                    }`}
                    role="switch"
                    aria-checked={historyEnabled}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition-transform duration-150 ${
                        historyEnabled ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-[12px] text-muted-foreground">Save search history</span>
                </div>
                <div className="text-[11px] text-muted-foreground/40">
                  ↑↓ to navigate · ↵ to select
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
