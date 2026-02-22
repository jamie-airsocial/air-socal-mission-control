'use client';

import { useState, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getServiceStyle } from '@/lib/constants';

export function FilterServicePopover({
  value,
  onChange,
  services: serviceList,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  /** Dynamic list of service slugs actually in use */
  services?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const active = value.length > 0;

  const options = (serviceList || []).map(slug => {
    const s = getServiceStyle(slug);
    return { key: slug, label: s.label, dot: s.dot };
  });

  const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));

  const label = !active
    ? 'Service'
    : value.length === 1
    ? value[0] === '__none__' ? 'No service' : (getServiceStyle(value[0]).label)
    : `${value.length} services`;

  const toggle = (key: string) => {
    onChange(value.includes(key) ? value.filter(v => v !== key) : [...value, key]);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) { setTimeout(() => inputRef.current?.focus(), 50); setSearch(''); }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          className={`h-8 px-3 text-[13px] border rounded-lg transition-colors duration-150 flex items-center gap-1.5 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none ${
            active ? 'border-primary text-primary' : 'border-border/20 bg-secondary text-foreground hover:border-primary/50'
          }`}
        >
          {active && value.length === 1 && value[0] !== '__none__' && (
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getServiceStyle(value[0]).dot }} />
          )}
          {label}
          <ChevronDown size={12} className="text-muted-foreground/40" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-0" align="start">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search..."
          className="w-full px-3 py-2 text-[13px] bg-transparent border-b border-border/20 outline-none text-foreground placeholder:text-muted-foreground/60 rounded-t-md"
        />
        <div className="p-1 max-h-[280px] overflow-y-auto">
          <button
            onClick={() => toggle('__none__')}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[13px] hover:bg-muted/60 transition-colors duration-150 ${
              value.includes('__none__') ? 'bg-muted/50' : ''
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 shrink-0" />
            <span className="flex-1 text-left text-muted-foreground">No service</span>
            {value.includes('__none__') && <Check size={14} className="text-primary shrink-0" />}
          </button>
          {filtered.map(opt => (
            <button
              key={opt.key}
              onClick={() => toggle(opt.key)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[13px] hover:bg-muted/60 transition-colors duration-150 ${
                value.includes(opt.key) ? 'bg-primary/10 text-primary' : ''
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: opt.dot }} />
              <span className="flex-1 text-left">{opt.label}</span>
              {value.includes(opt.key) && <Check size={14} className="text-primary shrink-0" />}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-2 py-3 text-[13px] text-muted-foreground/30 text-center">No results</div>
          )}
        </div>
        {active && (
          <div className="border-t border-border/20 p-1">
            <button
              onClick={() => onChange([])}
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
