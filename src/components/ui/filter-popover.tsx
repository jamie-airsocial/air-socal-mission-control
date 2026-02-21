'use client';

import { useState, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface FilterOption {
  value: string;
  label: string;
  /** Optional colour for a small dot shown next to the label */
  dot?: string;
}

interface FilterPopoverProps {
  label: string;
  options: FilterOption[];
  selected: string[];
  onSelectionChange: (values: string[]) => void;
  /** Width class for the popover content — defaults to "w-56" */
  width?: string;
}

export function FilterPopover({
  label,
  options,
  selected,
  onSelectionChange,
  width = 'w-56',
}: FilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasActive = selected.length > 0;

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSearch('');
      setHighlightedIndex(-1);
    }
  };

  const toggle = (value: string) => {
    onSelectionChange(
      selected.includes(value)
        ? selected.filter(v => v !== value)
        : [...selected, value],
    );
  };

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  const displayText = !hasActive
    ? label
    : selected.length === 1
      ? options.find(o => o.value === selected[0])?.label || label
      : `${selected.length} ${label.toLowerCase()}`;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          className={`h-8 px-3 text-[13px] rounded-lg border flex items-center gap-1.5 transition-colors whitespace-nowrap ${
            hasActive
              ? 'border-primary text-primary'
              : 'border-border/20 bg-secondary text-foreground hover:border-primary/50'
          }`}
        >
          {hasActive && selected.length === 1 && options.find(o => o.value === selected[0])?.dot && (
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: options.find(o => o.value === selected[0])?.dot }}
            />
          )}
          <span className="truncate max-w-[100px]">{displayText}</span>
          <ChevronDown size={12} className="text-muted-foreground/60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className={`${width} p-0`} align="start">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setHighlightedIndex(0); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIndex(prev => Math.min(prev + 1, filtered.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedIndex(prev => Math.max(prev - 1, 0)); }
            else if (e.key === 'Enter' && highlightedIndex >= 0) { e.preventDefault(); toggle(filtered[highlightedIndex].value); }
          }}
          placeholder="Search..."
          className="w-full px-3 py-2 text-[13px] bg-transparent border-b border-border/20 outline-none text-foreground placeholder:text-muted-foreground/30 rounded-t-md"
        />
        <div className="p-1 max-h-[280px] overflow-y-auto">
          {filtered.map((opt, idx) => {
            const isSelected = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => toggle(opt.value)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[13px] hover:bg-muted/60 transition-colors duration-150 ${
                  isSelected ? 'bg-muted/50' : ''
                } ${highlightedIndex === idx ? 'bg-primary/15 text-primary' : ''}`}
              >
                {opt.dot && (
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: opt.dot }}
                  />
                )}
                <span className="flex-1 text-left">{opt.label}</span>
                {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="px-2 py-3 text-[13px] text-muted-foreground/30 text-center">
              No results
            </div>
          )}
        </div>

        {hasActive && (
          <div className="border-t border-border/20 p-1">
            <button
              onClick={() => onSelectionChange([])}
              className="w-full px-2 py-1.5 text-[13px] text-destructive hover:bg-destructive/10 rounded transition-colors duration-150 text-left"
            >
              Clear selection
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
