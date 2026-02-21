'use client';

import { useState, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger, PopoverClose } from '@/components/ui/popover';
import type { Project } from '@/lib/types';

export function SearchableProjectPopover({ 
  value, 
  projects,
  onChange, 
  open, 
  onOpenChange,
  trigger,
}: { 
  value: { id: string; name: string; color: string } | null; 
  projects: Project[];
  onChange: (value: { id: string; name: string; color: string } | null) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}) {
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange?.(nextOpen);
    if (nextOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSearch('');
    }
  };
  
  const filtered = projects.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase())
  );
  
  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {trigger || (
          <button className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-muted/60 transition-colors duration-150 whitespace-nowrap text-left">
            {value?.name ? (
              <span className="text-[13px] truncate max-w-[160px]">{value.name}</span>
            ) : (
              <span className="text-[13px] text-muted-foreground/30">No client</span>
            )}
            <ChevronDown size={12} className="text-muted-foreground/30 shrink-0" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
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
          className="w-full px-3 py-2 text-[13px] bg-transparent border-b border-border/20 outline-none text-foreground placeholder:text-muted-foreground/30 rounded-t-md"
        />
        <div className="p-1 max-h-[280px] overflow-y-auto">
          {value?.name && !search && (
            <>
              <PopoverClose asChild>
                <button
                  onClick={() => { onChange(null); }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-[13px] text-left text-muted-foreground/30 hover:text-muted-foreground/60 hover:bg-muted/40 transition-colors duration-150"
                >
                  <span className="w-2 h-2 rounded-full border border-muted-foreground/20" />
                  No project
                </button>
              </PopoverClose>
              <div className="border-t border-border/20 my-1" />
            </>
          )}
          {filtered.map((p, idx) => (
            <PopoverClose asChild key={p.id}>
              <button
                onClick={() => { onChange({ id: p.id, name: p.name, color: p.color }); }}
                data-search-item 
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[13px] text-left hover:bg-muted/60 transition-colors duration-150 ${value?.id === p.id ? 'bg-muted/50' : ''} ${highlightedIndex === idx ? 'bg-primary/15 text-primary' : ''}`}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                <span className="truncate flex-1">{p.name}</span>
                {value?.id === p.id && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
              </button>
            </PopoverClose>
          ))}
          {filtered.length === 0 && (
            <div className="px-2 py-3 text-[13px] text-muted-foreground/30 text-center">
              No projects found
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
