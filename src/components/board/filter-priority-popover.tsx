'use client';

import { useState, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PRIORITY_STYLES } from '@/lib/constants';

export function FilterPriorityPopover({ 
  value, 
  onChange,
}: { 
  value: string[]; // array of selected priorities (empty = all)
  onChange: (value: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSearch('');
    }
  };
  
  const filtered = Object.entries(PRIORITY_STYLES).filter(([key, style]) => 
    key.toLowerCase().includes(search.toLowerCase()) || 
    style.label.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggle = (priority: string) => {
    if (value.includes(priority)) {
      onChange(value.filter(v => v !== priority));
    } else {
      onChange([...value, priority]);
    }
  };

  const handleClear = () => {
    onChange([]);
  };

  const isActive = value.length > 0;
  const displayText = value.length === 0 
    ? 'Priority' 
    : value.length === 1 
      ? `${value[0]} · ${value[0] === '__none__' ? 'No priority' : (PRIORITY_STYLES[value[0]]?.label || value[0])}`
      : `${value.length} priorities`;
  
  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button aria-label="Filter by priority" className={`h-8 px-3 text-[13px] rounded-lg border transition-colors duration-150 flex items-center gap-1.5 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none ${
          isActive ? 'border-primary text-primary' : 'border-border/20 bg-secondary text-foreground hover:border-primary/50'
        }`}>
          <span className="truncate max-w-[120px]">{displayText}</span>
          <ChevronDown size={12} className="text-muted-foreground/60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setHighlightedIndex(0); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIndex(prev => Math.min(prev + 1, filtered.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedIndex(prev => Math.max(prev - 1, 0)); }
            else if (e.key === 'Enter' && highlightedIndex >= 0) { e.preventDefault(); handleToggle(filtered[highlightedIndex][0]); }
          }}
          placeholder="Search..."
          className="w-full px-3 py-2 text-[13px] bg-transparent border-b border-border/20 outline-none text-foreground placeholder:text-muted-foreground/30 rounded-t-md"
        />
        <div className="p-1 max-h-[280px] overflow-y-auto">
          {!search && (
            <button
              onClick={() => {
                if (value.includes('__none__')) onChange(value.filter(v => v !== '__none__'));
                else onChange([...value, '__none__']);
              }}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[13px] hover:bg-muted/60 transition-colors duration-150 ${value.includes('__none__') ? 'bg-muted/50' : ''}`}
            >
              <span className="px-1 py-0.5 rounded text-[10px] font-medium bg-muted/30 text-muted-foreground/40">—</span>
              <span className="flex-1 text-left text-muted-foreground">No priority</span>
              {value.includes('__none__') && <Check className="h-3.5 w-3.5 text-primary" />}
            </button>
          )}
          {filtered.map(([key, style], idx) => {
            const isSelected = value.includes(key);
            return (
              <button
                key={key}
                onClick={() => handleToggle(key)}
                data-search-item 
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[13px] hover:bg-muted/60 transition-colors duration-150 ${
                  isSelected ? 'bg-muted/50' : ''
                } ${highlightedIndex === idx ? 'bg-primary/15 text-primary' : ''}`}
              >
                <span className={`px-2 py-0.5 rounded text-[13px] font-medium ${style.bg} ${style.text} flex-shrink-0`}>
                  {key} · {style.label}
                </span>
                <span className="flex-1" />
                {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="px-2 py-3 text-[13px] text-muted-foreground/30 text-center">
              No priorities found
            </div>
          )}</div>

          {value.length > 0 && (
            <>
              <div className="border-t border-border/20 my-1" />
              <button
                onClick={handleClear}
                className="w-full px-2 py-1.5 text-[13px] text-destructive hover:bg-destructive/10 rounded transition-colors duration-150 text-left"
              >
                Clear selection
              </button>
            </>
          )}
              </PopoverContent>
    </Popover>
  );
}
