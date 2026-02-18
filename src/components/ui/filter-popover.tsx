'use client';

import { useState } from 'react';
import { Filter, Check } from 'lucide-react';
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
  /** Width class for the popover content — defaults to "w-48" */
  width?: string;
}

export function FilterPopover({
  label,
  options,
  selected,
  onSelectionChange,
  width = 'w-48',
}: FilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const hasActive = selected.length > 0;

  const toggle = (value: string) => {
    onSelectionChange(
      selected.includes(value)
        ? selected.filter(v => v !== value)
        : [...selected, value],
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`h-8 px-3 text-[13px] rounded-lg border flex items-center gap-1.5 transition-colors ${
            hasActive
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-border/20 bg-secondary text-muted-foreground hover:text-foreground'
          }`}
        >
          <Filter size={12} />
          {label}
          {hasActive && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
        </button>
      </PopoverTrigger>
      <PopoverContent className={`${width} p-1`} align="start">
        {options.map(opt => {
          const isSelected = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              onClick={() => toggle(opt.value)}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded text-[13px] hover:bg-muted/60 transition-colors"
            >
              <span className="flex items-center gap-2">
                {opt.dot && (
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: opt.dot }}
                  />
                )}
                <span>{opt.label}</span>
              </span>
              {isSelected && <Check size={14} className="text-primary shrink-0" />}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
