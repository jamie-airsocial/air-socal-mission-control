'use client';

import { useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SERVICE_STYLES } from '@/lib/constants';
import { ServiceIcon } from '@/components/ui/service-icon';

const SERVICES = Object.entries(SERVICE_STYLES);

export function FilterServicePopover({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = value.length > 0;

  const label = !active
    ? 'Service'
    : value.length === 1
    ? value[0] === '__none__' ? 'No service' : (SERVICE_STYLES[value[0]]?.label || value[0])
    : `${value.length} services`;

  const toggle = (key: string) => {
    onChange(value.includes(key) ? value.filter(v => v !== key) : [...value, key]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`h-8 px-3 text-[13px] border rounded-lg transition-colors duration-150 flex items-center gap-1.5 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none ${
            active ? 'border-primary text-primary' : 'border-border/20 bg-secondary text-foreground hover:border-primary/50'
          }`}
        >
          {label}
          <ChevronDown size={12} className="text-muted-foreground/40" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-1" align="start">
        <button
          onClick={() => toggle('__none__')}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[13px] hover:bg-muted/60 transition-colors duration-150 ${
            value.includes('__none__') ? 'bg-muted/50' : ''
          }`}
        >
          <span className="w-4 h-4 rounded flex items-center justify-center text-[10px] text-muted-foreground/40">—</span>
          <span className="flex-1 text-left text-muted-foreground">No service</span>
          {value.includes('__none__') && <Check size={14} className="text-primary shrink-0" />}
        </button>
        {SERVICES.map(([key, style]) => (
          <button
            key={key}
            onClick={() => toggle(key)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[13px] hover:bg-muted/60 transition-colors duration-150 ${
              value.includes(key) ? 'bg-primary/10 text-primary' : ''
            }`}
          >
            <ServiceIcon serviceKey={key} size={13} />
            <span className="flex-1 text-left">{style.label}</span>
            {value.includes(key) && <Check size={14} className="text-primary shrink-0" />}
          </button>
        ))}
        {active && (
          <>
            <div className="border-t border-border/20 my-1" />
            <button
              onClick={() => { onChange([]); }}
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
