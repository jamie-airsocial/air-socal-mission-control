'use client';

import { useState, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger, PopoverClose } from '@/components/ui/popover';
import { getTeamStyle } from '@/lib/constants';

export function SearchableTeamPopover({
  value,
  onChange,
  teams,
  open,
  onOpenChange,
}: {
  value: string;
  onChange: (value: string) => void;
  teams: { slug: string; name: string; color?: string }[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange?.(nextOpen);
    if (nextOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSearch('');
    }
  };

  const options = teams.map(t => {
    const style = getTeamStyle(t.slug);
    return { key: t.slug, label: t.name, color: t.color || style.color };
  });

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  const current = options.find(o => o.key === value);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-muted/60 transition-colors duration-150 whitespace-nowrap">
          {value && current ? (
            <>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: current.color }} />
              <span className="text-[13px]">{current.label}</span>
            </>
          ) : (
            <span className="text-[13px] text-muted-foreground/30">No team</span>
          )}
          <ChevronDown size={12} className="text-muted-foreground/30" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-0" align="start">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          className="w-full px-3 py-2 text-[13px] bg-transparent border-b border-border/20 outline-none text-foreground placeholder:text-muted-foreground/60 rounded-t-md"
        />
        <div className="p-1 max-h-[240px] overflow-y-auto">
          {value && !search && (
            <>
              <PopoverClose asChild>
                <button
                  onClick={() => onChange('')}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-[13px] text-muted-foreground/30 hover:text-muted-foreground/60 hover:bg-muted/40 transition-colors duration-150"
                >
                  <span className="w-2 h-2 rounded-full border border-dashed border-muted-foreground/20 flex-shrink-0" />
                  No team
                </button>
              </PopoverClose>
              <div className="border-t border-border/20 my-1" />
            </>
          )}
          {filtered.map(opt => (
            <PopoverClose asChild key={opt.key}>
              <button
                onClick={() => onChange(opt.key)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[13px] hover:bg-muted/60 transition-colors duration-150 ${value === opt.key ? 'bg-muted/50' : ''}`}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: opt.color }} />
                <span className="flex-1 text-left">{opt.label}</span>
                {value === opt.key && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
              </button>
            </PopoverClose>
          ))}
          {filtered.length === 0 && (
            <div className="px-2 py-3 text-[13px] text-muted-foreground/30 text-center">No teams found</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
