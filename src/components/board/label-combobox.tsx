'use client';

import { useState, useRef } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, X, Check } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

interface LabelComboboxProps {
  selectedLabels: string[];
  allLabels: string[];
  onChange: (labels: string[]) => void;
  externalOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function LabelCombobox({ selectedLabels, allLabels, onChange, externalOpen, onOpenChange }: LabelComboboxProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen ?? internalOpen;
  const setOpen = (v: boolean) => { setInternalOpen(v); onOpenChange?.(v); };
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSearch('');
      setHighlightedIndex(-1);
    }
  };

  const uniqueLabels = Array.from(new Set(allLabels)).sort();
  const filtered = search
    ? uniqueLabels.filter(l => l.toLowerCase().includes(search.toLowerCase()))
    : uniqueLabels;
  const canCreate = search.trim() && !uniqueLabels.some(l => l.toLowerCase() === search.trim().toLowerCase());

  const handleToggle = (label: string) => {
    if (selectedLabels.includes(label)) {
      onChange(selectedLabels.filter(l => l !== label));
    } else {
      onChange([...selectedLabels, label]);
    }
  };

  const handleCreate = () => {
    const trimmed = search.trim();
    if (trimmed && !selectedLabels.includes(trimmed)) {
      onChange([...selectedLabels, trimmed]);
      // Labels are persisted via the task's labels field — no separate labels API endpoint exists.
      setSearch('');
    }
  };

  const handleRemoveLabel = (label: string) => {
    onChange(selectedLabels.filter(l => l !== label));
  };

  const displayLabels = selectedLabels.slice(0, 2);
  const hasMore = selectedLabels.length > 2;

  return (
    <div className="flex items-center gap-1.5 flex-nowrap min-w-0">
      {displayLabels.map(label => (
        <TooltipProvider key={label} delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => handleRemoveLabel(label)}
                className="px-2 py-0.5 rounded-full text-[11px] bg-muted/40 text-muted-foreground border border-border/20 hover:border-destructive/20 hover:text-destructive transition-colors duration-150 flex items-center gap-1 max-w-[70px] group min-w-0 shrink"
              >
                <span className="truncate">{label}</span>
                <X className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[13px]">{label}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}

      {hasMore && (
        <Popover>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <button className="px-2 py-0.5 rounded-full text-[11px] bg-primary/10 text-primary/70 border border-primary/20 hover:bg-primary/20 hover:text-primary transition-colors duration-150 flex-shrink-0">
                    +{selectedLabels.length - 2} more
                  </button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[13px]">Click to view all labels</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <PopoverContent className="w-64 p-2" align="start">
            <p className="text-[11px] text-muted-foreground/60 mb-2">All labels (click to remove)</p>
            <div className="flex flex-wrap gap-1.5">
              {selectedLabels.map(label => (
                <button
                  key={label}
                  onClick={() => handleRemoveLabel(label)}
                  className="px-2 py-0.5 rounded-full text-[11px] bg-muted/40 text-muted-foreground border border-border/20 hover:border-destructive/20 hover:text-destructive transition-colors duration-150"
                >
                  {label} ×
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}

      <Popover open={open} onOpenChange={handleOpenChange}>
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <button className="w-5 h-5 rounded-full flex items-center justify-center text-muted-foreground/30 hover:bg-muted/40 hover:text-muted-foreground/60 transition-colors duration-150 flex-shrink-0">
                  <Plus size={11} />
                </button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[13px]">Add label</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <PopoverContent className="w-56 p-0" align="start">
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setHighlightedIndex(0); }}
            onKeyDown={(e) => {
              const itemCount = filtered.length + (canCreate ? 1 : 0);
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setHighlightedIndex(prev => Math.min(prev + 1, itemCount - 1));
                // scroll into view
                setTimeout(() => {
                  const el = listRef.current?.querySelector('[data-highlighted="true"]');
                  el?.scrollIntoView({ block: 'nearest' });
                }, 0);
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHighlightedIndex(prev => Math.max(prev - 1, 0));
                setTimeout(() => {
                  const el = listRef.current?.querySelector('[data-highlighted="true"]');
                  el?.scrollIntoView({ block: 'nearest' });
                }, 0);
              } else if (e.key === 'Enter') {
                e.preventDefault();
                if (canCreate && highlightedIndex === 0) {
                  handleCreate();
                } else {
                  const labelIdx = highlightedIndex - (canCreate ? 1 : 0);
                  if (labelIdx >= 0 && filtered[labelIdx]) {
                    handleToggle(filtered[labelIdx]);
                  } else if (search.trim() && canCreate) {
                    handleCreate();
                  }
                }
              }
            }}
            placeholder="Search or create..."
            className="w-full px-3 py-2 text-[13px] bg-transparent border-b border-border/20 outline-none text-foreground placeholder:text-muted-foreground/60 rounded-t-md"
          />
          <div ref={listRef} className="p-1 max-h-[280px] overflow-y-auto">
            {canCreate && (
              <>
                <button
                  onClick={handleCreate}
                  data-highlighted={highlightedIndex === 0}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[13px] text-primary hover:bg-muted/60 transition-colors duration-150 ${highlightedIndex === 0 ? 'bg-primary/15' : ''}`}
                >
                  <Plus className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>Create &ldquo;<strong>{search.trim()}</strong>&rdquo;</span>
                </button>
                {filtered.length > 0 && <div className="border-t border-border/20 my-1" />}
              </>
            )}
            {filtered.map((label, idx) => {
              const itemIdx = idx + (canCreate ? 1 : 0);
              const isHighlighted = highlightedIndex === itemIdx;
              return (
              <button
                key={label}
                onClick={() => handleToggle(label)}
                data-highlighted={isHighlighted}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[13px] hover:bg-muted/60 transition-colors duration-150 ${
                  selectedLabels.includes(label) ? 'bg-muted/50' : ''
                } ${isHighlighted ? 'bg-primary/15 text-primary' : ''}`}
              >
                <span className="flex-1 truncate text-left">{label}</span>
                {selectedLabels.includes(label) && (
                  <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                )}
              </button>
              );
            })}
            {filtered.length === 0 && !canCreate && (
              <div className="px-2 py-3 text-[13px] text-muted-foreground/30 text-center">
                Type to search or create
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
