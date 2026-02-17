'use client';

import { useState, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ASSIGNEE_COLORS, NAME_TO_SLUG, SLUG_TO_NAME } from '@/lib/constants';

// Derive from constants — automatically includes any new agents
const ASSIGNEES = Object.keys(NAME_TO_SLUG);

export function FilterAssigneePopover({ 
  value, 
  onChange,
}: { 
  value: string[]; // array of selected assignees (empty = all)
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
  
  const filtered = ASSIGNEES.filter(a => 
    a.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggle = (assignee: string) => {
    // Convert display name to slug for storage — filter compares against task.assignee slugs
    const slug = NAME_TO_SLUG[assignee] || assignee.toLowerCase();
    if (value.includes(slug)) {
      onChange(value.filter(v => v !== slug));
    } else {
      onChange([...value, slug]);
    }
  };

  const handleClear = () => {
    onChange([]);
  };

  const isActive = value.length > 0;
  // value contains slugs — convert first slug to display name for label
  const displayText = value.length === 0 
    ? 'Everyone' 
    : value.length === 1 
      ? (SLUG_TO_NAME[value[0]] || value[0])
      : `${value.length} assignees`;
  
  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button aria-label="Filter by assignee" className={`h-8 px-3 text-[13px] rounded-lg border transition-colors duration-150 flex items-center gap-1.5 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none ${
          isActive ? 'border-primary text-primary' : 'border-border/20 bg-secondary text-foreground hover:border-primary/50'
        }`}>
          {value.length === 1 && (
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] leading-none font-medium flex-shrink-0 ${ASSIGNEE_COLORS[value[0]] || 'bg-muted/40 text-muted-foreground'}`}>
              {(SLUG_TO_NAME[value[0]] || value[0]).charAt(0)}
            </span>
          )}
          <span className="truncate max-w-[100px]">{displayText}</span>
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
            else if (e.key === 'Enter' && highlightedIndex >= 0) { e.preventDefault(); handleToggle(filtered[highlightedIndex]); }
          }}
          placeholder="Search..."
          className="w-full px-3 py-2 text-[13px] bg-transparent border-b border-border/20 outline-none text-foreground placeholder:text-muted-foreground/30 rounded-t-md"
        />
        <div className="p-1 max-h-[280px] overflow-y-auto">
          {filtered.map((a, idx) => {
            const slug = NAME_TO_SLUG[a] || a.toLowerCase();
            const isSelected = value.includes(slug);
            return (
              <button
                key={a}
                onClick={() => handleToggle(a)}
                data-search-item 
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[13px] hover:bg-muted/60 transition-colors duration-150 ${
                  isSelected ? 'bg-muted/50' : ''
                } ${highlightedIndex === idx ? 'bg-primary/15 text-primary' : ''}`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] leading-none font-medium ${ASSIGNEE_COLORS[a] || 'bg-muted/40 text-muted-foreground'}`}>
                  {a.charAt(0)}
                </span>
                <span className="flex-1 text-left">{a}</span>
                {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="px-2 py-3 text-[13px] text-muted-foreground/30 text-center">
              No assignees found
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
