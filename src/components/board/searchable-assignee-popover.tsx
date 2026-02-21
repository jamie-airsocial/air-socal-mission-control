'use client';

import { useState, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger, PopoverClose } from '@/components/ui/popover';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { getAssigneeColor, ASSIGNEE_COLORS } from '@/lib/constants';
import { useUsers } from '@/hooks/use-users';

export function SearchableAssigneePopover({ 
  value, 
  onChange, 
  open, 
  onOpenChange,
  compact = false,
  trigger,
}: { 
  value: string; 
  onChange: (value: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  compact?: boolean;
  trigger?: React.ReactNode;
}) {
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const { users } = useUsers();

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange?.(nextOpen);
    if (nextOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSearch('');
    }
  };

  const assignees = users.length > 0
    ? users.map(u => ({ name: u.full_name, team: u.team }))
    : [];

  const filtered = assignees.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedUser = users.find(u => u.full_name === value);
  const valueColor = value
    ? (ASSIGNEE_COLORS[value] || getAssigneeColor(value, selectedUser?.team))
    : '';

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {trigger ? trigger : compact ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="flex items-center hover:bg-muted/60 rounded p-0.5 transition-colors duration-150">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] leading-none font-medium flex-shrink-0 ${value ? (valueColor || 'bg-muted/60 text-muted-foreground') : 'bg-muted/30'}`}>
                  {value ? value.charAt(0) : ''}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[13px]">{value || 'No assignee'}</TooltipContent>
          </Tooltip>
        ) : (
          <button className="flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-muted/60 transition-colors duration-150 whitespace-nowrap">
            {value ? (
              <>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] leading-none font-medium ${valueColor || 'bg-muted/40 text-muted-foreground'}`}>
                  {value.charAt(0)}
                </span>
                <span className="text-[13px] truncate max-w-[120px]">{value}</span>
              </>
            ) : (
              <span className="text-[13px] text-muted-foreground/30">No assignee</span>
            )}
            <ChevronDown size={12} className="text-muted-foreground/30" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start" onWheel={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setHighlightedIndex(0); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIndex(prev => Math.min(prev + 1, filtered.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedIndex(prev => Math.max(prev - 1, -1)); }
            else if (e.key === 'Enter') { e.preventDefault(); const items = document.querySelectorAll('[data-search-item]'); const idx = highlightedIndex >= 0 ? highlightedIndex : 0; if (items.length > 0 && items[idx]) (items[idx] as HTMLElement).click(); }
          }}
          placeholder="Search..."
          className="w-full px-3 py-2 text-[13px] bg-transparent border-b border-border/20 outline-none text-foreground placeholder:text-muted-foreground/30 rounded-t-md"
        />
        <div className="p-1 max-h-[240px] overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
          {value && !search && (
            <>
              <PopoverClose asChild>
                <button
                  onClick={() => { onChange(''); }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-[13px] text-muted-foreground/30 hover:text-muted-foreground/60 hover:bg-muted/40 transition-colors duration-150"
                >
                  <span className="w-5 h-5 rounded-full border border-dashed border-muted-foreground/20 flex-shrink-0" />
                  No assignee
                </button>
              </PopoverClose>
              <div className="border-t border-border/20 my-1" />
            </>
          )}
          {filtered.map((a, idx) => {
            const colorClass = getAssigneeColor(a.name, a.team);
            return (
              <PopoverClose asChild key={a.name}>
                <button
                  onClick={() => { onChange(a.name); }}
                  data-search-item
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[13px] hover:bg-muted/60 transition-colors duration-150 ${value === a.name ? 'bg-muted/50' : ''} ${highlightedIndex === idx ? 'bg-primary/15 text-primary' : ''}`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] leading-none font-medium ${colorClass}`}>
                    {a.name.charAt(0)}
                  </span>
                  <span className="flex-1 text-left">{a.name}</span>
                  {value === a.name && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                </button>
              </PopoverClose>
            );
          })}
          {filtered.length === 0 && (
            <div className="px-2 py-3 text-[13px] text-muted-foreground/30 text-center">
              No assignees found
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
