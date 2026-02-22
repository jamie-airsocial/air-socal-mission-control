'use client';

import { useState, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger, PopoverClose } from '@/components/ui/popover';
import { STATUS_STYLES } from '@/lib/constants';
import { useStatuses } from '@/hooks/use-statuses';

// Fallback statuses when API is not available
const FALLBACK_STATUSES = ['todo', 'doing', 'review', 'done'] as const;

export function SearchableStatusPopover({ 
  value, 
  onChange, 
  open, 
  onOpenChange,
  trigger,
}: { 
  value: string; 
  onChange: (value: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}) {
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const { statuses: dynamicStatuses, loading } = useStatuses();

  // Use dynamic statuses if loaded, fallback to hardcoded
  const statuses = !loading && dynamicStatuses.length > 0
    ? dynamicStatuses
    : FALLBACK_STATUSES.map(slug => ({
        slug,
        label: STATUS_STYLES[slug]?.label || slug,
        colour: STATUS_STYLES[slug]?.text || '#6366f1',
        dot_colour: STATUS_STYLES[slug]?.dot || 'var(--muted-foreground)',
      }));

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange?.(nextOpen);
    if (nextOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSearch('');
    }
  };
  
  const filtered = statuses
    .filter(status => status.label.toLowerCase().includes(search.toLowerCase()));
  
  const currentStatus = value ? statuses.find(s => s.slug === value) : null;
  const currentDotColour = currentStatus
    ? (currentStatus.dot_colour || currentStatus.colour)
    : null;
  
  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {trigger || (
          <button className="flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-muted/60 transition-colors duration-150 whitespace-nowrap">
            {currentStatus ? (
              <>
                <span className="w-2 h-2 rounded-full transition-colors duration-150" style={{ backgroundColor: currentDotColour || 'var(--muted-foreground)' }} />
                <span className="text-[13px] transition-colors duration-150" style={{ color: currentStatus.colour }}>{currentStatus.label}</span>
              </>
            ) : (
              <span className="text-[13px] text-muted-foreground/30">No status</span>
            )}
            <ChevronDown size={12} className="text-muted-foreground/30" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-40 p-0" align="start">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setHighlightedIndex(0); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIndex(prev => prev + 1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedIndex(prev => Math.max(prev - 1, -1)); }
            else if (e.key === 'Enter') { e.preventDefault(); const items = document.querySelectorAll('[data-search-item]'); const idx = highlightedIndex >= 0 ? highlightedIndex : 0; if (items.length > 0 && items[idx]) (items[idx] as HTMLElement).click(); }
          }}
          placeholder="Search..."
          className="w-full px-3 py-2 text-[13px] bg-transparent border-b border-border/20 outline-none text-foreground placeholder:text-muted-foreground/60 rounded-t-md"
        />
        <div className="p-1 max-h-[280px] overflow-y-auto">
          {value && !search && (
            <>
              <PopoverClose asChild>
                <button
                  onClick={() => { onChange(''); }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-[13px] text-muted-foreground/30 hover:text-muted-foreground/60 hover:bg-muted/40 transition-colors duration-150"
                >
                  <span className="w-2 h-2 rounded-full border border-muted-foreground/20 shrink-0" />
                  <span className="flex-1 text-left">No status</span>
                </button>
              </PopoverClose>
              <div className="border-t border-border/20 my-1" />
            </>
          )}
          {filtered.map((status, idx) => (
            <PopoverClose asChild key={status.slug}>
              <button
                onClick={() => { onChange(status.slug); }}
                data-search-item 
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[13px] hover:bg-muted/60 transition-colors duration-150 ${value === status.slug ? 'bg-muted/50' : ''} ${highlightedIndex === idx ? 'bg-primary/15 text-primary' : ''}`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: status.dot_colour || status.colour }} />
                <span className="flex-1 text-left">{status.label}</span>
                {value === status.slug && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
              </button>
            </PopoverClose>
          ))}
          {filtered.length === 0 && (
            <div className="px-2 py-3 text-[13px] text-muted-foreground/30 text-center">
              No statuses found
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
