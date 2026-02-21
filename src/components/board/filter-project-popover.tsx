'use client';

import { useState, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Project } from '@/lib/types';

export function FilterProjectPopover({ 
  value, 
  projects,
  onChange,
}: { 
  value: string[]; // array of selected project IDs (empty = all)
  projects: Project[];
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
  
  const filtered = projects.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggle = (projectId: string) => {
    if (value.includes(projectId)) {
      onChange(value.filter(v => v !== projectId));
    } else {
      onChange([...value, projectId]);
    }
  };

  const handleClear = () => {
    onChange([]);
  };

  const isActive = value.length > 0;
  const displayText = value.length === 0 
    ? 'Client' 
    : value.length === 1 
      ? projects.find(p => p.id === value[0])?.name || 'Project'
      : `${value.length} projects`;
  const singleProject = value.length === 1 ? projects.find(p => p.id === value[0]) : null;
  
  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button aria-label="Filter by project" className={`h-8 px-3 text-[13px] rounded-lg border transition-colors duration-150 flex items-center gap-1.5 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none ${
          isActive ? 'border-primary text-primary' : 'border-border/20 bg-secondary text-foreground hover:border-primary/50'
        }`}>
          {singleProject && (
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: singleProject.color }} />
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
            else if (e.key === 'Enter' && highlightedIndex >= 0) { e.preventDefault(); handleToggle(filtered[highlightedIndex].id); }
          }}
          placeholder="Search..."
          className="w-full px-3 py-2 text-[13px] bg-transparent border-b border-border/20 outline-none text-foreground placeholder:text-muted-foreground/30 rounded-t-md"
        />
        <div className="p-1 max-h-[280px] overflow-y-auto">
          {filtered.map((p, idx) => {
            const isSelected = value.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => handleToggle(p.id)}
                data-search-item 
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[13px] hover:bg-muted/60 transition-colors duration-150 ${
                  isSelected ? 'bg-muted/50' : ''
                } ${highlightedIndex === idx ? 'bg-primary/15 text-primary' : ''}`}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                <span className="flex-1 text-left truncate">{p.name}</span>
                {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="px-2 py-3 text-[13px] text-muted-foreground/30 text-center">
              No projects found
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
