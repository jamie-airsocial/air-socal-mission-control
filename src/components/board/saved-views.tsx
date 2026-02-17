'use client';

import { useState, useEffect } from 'react';
import { Bookmark, BookmarkPlus, Check, Star, Trash2, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { toast } from 'sonner';

export interface ViewFilters {
  filterProject: string;
  filterAssignee: string;
  filterPriority: string;
  filterStatus?: string;
  filterLabel?: string;
  filterDate: string;
  hideDone: boolean;
  groupBy: 'none' | 'project' | 'assignee' | 'status' | 'priority' | 'service' | 'team';
  view: 'kanban' | 'table' | 'calendar';
  /** Which view mode this saved view belongs to */
  forView?: 'kanban' | 'table' | 'calendar';
}

export interface SavedView {
  id: string;
  name: string;
  filters: ViewFilters;
  isPreset?: boolean;
}

const STORAGE_KEY = 'mc-saved-views';

const PRESETS: SavedView[] = [
  {
    id: 'preset-today',
    name: "Today's Tasks",
    isPreset: true,
    filters: {
      filterProject: '',
      filterAssignee: '',
      filterPriority: '',
      filterDate: 'today',
      hideDone: true,
      groupBy: 'none',
      view: 'table',
    },
  },
  {
    id: 'preset-week',
    name: 'This Week',
    isPreset: true,
    filters: {
      filterProject: '',
      filterAssignee: '',
      filterPriority: '',
      filterDate: 'next7',
      hideDone: true,
      groupBy: 'none',
      view: 'table',
    },
  },
  {
    id: 'preset-high-priority',
    name: 'High Priority',
    isPreset: true,
    filters: {
      filterProject: '',
      filterAssignee: '',
      filterPriority: 'P1',
      filterDate: 'all',
      hideDone: true,
      groupBy: 'none',
      view: 'table',
    },
  },
];

function getSavedViews(): SavedView[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setSavedViews(views: SavedView[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
}

interface SavedViewsProps {
  currentFilters: ViewFilters;
  onLoadView: (filters: ViewFilters) => void;
  clearTrigger?: number;
  currentView: 'kanban' | 'table' | 'calendar';
}

export function SavedViews({ currentFilters, onLoadView, clearTrigger, currentView }: SavedViewsProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState('');
  const [customViews, setCustomViews] = useState<SavedView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  useEffect(() => {
    setCustomViews(getSavedViews());
  }, []);

  useEffect(() => {
    if (clearTrigger && clearTrigger > 0) {
      setActiveViewId(null);
    }
  }, [clearTrigger]);

  // Clear active view when switching between kanban/table
  useEffect(() => {
    setActiveViewId(null);
  }, [currentView]);

  const filteredCustomViews = customViews.filter(v => !v.filters.forView || v.filters.forView === currentView);
  const filteredPresets = PRESETS.filter(v =>
    currentView !== 'calendar' || (v.id !== 'preset-today' && v.id !== 'preset-week')
  );
  const allViews = [...filteredPresets, ...filteredCustomViews];

  const handleSave = () => {
    if (!newName.trim()) return;
    const newView: SavedView = {
      id: `custom-${Date.now()}`,
      name: newName.trim(),
      filters: { ...currentFilters, forView: currentView },
    };
    const updated = [...customViews, newView];
    setCustomViews(updated);
    setSavedViews(updated);
    setNewName('');
    setSaving(false);
    setActiveViewId(newView.id);
    toast.success(`View "${newView.name}" saved`);
  };

  const handleDelete = (id: string) => {
    const updated = customViews.filter((v) => v.id !== id);
    setCustomViews(updated);
    setSavedViews(updated);
    if (activeViewId === id) setActiveViewId(null);
    toast.success('View deleted');
  };

  const handleLoad = (view: SavedView) => {
    onLoadView(view.filters);
    setActiveViewId(view.id);
    setOpen(false);
  };

  const hasActiveFilters = Boolean(
    currentFilters.filterProject ||
    currentFilters.filterAssignee ||
    currentFilters.filterPriority ||
    currentFilters.filterStatus ||
    currentFilters.filterLabel ||
    currentFilters.filterDate !== 'all' ||
    currentFilters.groupBy !== 'none' ||
    currentFilters.hideDone
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`h-8 px-2.5 text-[13px] rounded-lg border transition-colors duration-150 flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none ${
            activeViewId
              ? 'border-primary/50 bg-primary/10 text-primary'
              : 'border-border/20 bg-secondary text-muted-foreground hover:text-foreground'
          }`}
          aria-label="Saved Views"
        >
          <Bookmark className="h-3 w-3" />
          {activeViewId ? (
            <span className="font-medium max-w-[100px] truncate">
              {allViews.find((v) => v.id === activeViewId)?.name || 'Saved'}
            </span>
          ) : (
            <span>Views</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0 bg-card border border-border/20 rounded-lg shadow-lg" align="start">
        <div className="p-3 border-b border-border/20">
          <p className="text-[13px] font-medium text-muted-foreground">Saved Views</p>
        </div>

        {/* Presets */}
        <div className="p-1">
          <p className="px-2 py-1.5 text-[13px] font-medium text-muted-foreground">Presets</p>
          {filteredPresets.map((view) => (
            <button
              key={view.id}
              onClick={() => handleLoad(view)}
              className={`w-full px-2.5 py-2 text-left text-[13px] rounded-md transition-colors duration-150 flex items-center gap-2 ${
                activeViewId === view.id
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'hover:bg-muted/40 text-foreground'
              }`}
            >
              <Star className={`h-3 w-3 shrink-0 ${activeViewId === view.id ? 'text-primary' : 'text-muted-foreground/30'}`} />
              <span className="flex-1 truncate">{view.name}</span>
              {activeViewId === view.id && <Check className="h-3 w-3 shrink-0" />}
            </button>
          ))}
        </div>

        {/* Custom views */}
        {filteredCustomViews.length > 0 && (
          <div className="p-1 border-t border-border/20">
            <p className="px-2 py-1.5 text-[13px] font-medium text-muted-foreground">Custom</p>
            {filteredCustomViews.map((view) => (
              <div
                key={view.id}
                className={`flex items-center gap-1 rounded-md transition-colors duration-150 ${
                  activeViewId === view.id ? 'bg-primary/10' : 'hover:bg-muted/40'
                }`}
              >
                <button
                  onClick={() => handleLoad(view)}
                  className={`flex-1 px-2.5 py-2 text-left text-[13px] truncate ${
                    activeViewId === view.id ? 'text-primary font-medium' : 'text-foreground'
                  }`}
                >
                  {view.name}
                </button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleDelete(view.id)}
                      className="p-1.5 mr-1 rounded text-muted-foreground/30 hover:text-destructive transition-colors duration-150"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Delete view</TooltipContent>
                </Tooltip>
              </div>
            ))}
          </div>
        )}

        {/* Save current */}
        <div className="p-2 border-t border-border/20">
          {saving ? (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                  if (e.key === 'Escape') setSaving(false);
                }}
                placeholder="View name..."
                className="flex-1 h-7 px-2 text-[13px] bg-muted/40 border border-border/20 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground/30"
              />
              <button
                onClick={handleSave}
                disabled={!newName.trim()}
                className="h-7 px-2 rounded-md bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90 transition-colors duration-150 disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => setSaving(false)}
                className="h-7 px-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors duration-150"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setSaving(true)}
              disabled={!hasActiveFilters}
              className="w-full flex items-center justify-center gap-1.5 h-8 rounded-md text-[13px] font-medium transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed bg-muted/40 hover:bg-muted/60 text-muted-foreground hover:text-foreground"
            >
              <BookmarkPlus className="h-3.5 w-3.5" />
              Save current view
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
