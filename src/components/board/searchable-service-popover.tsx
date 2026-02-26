'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Plus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger, PopoverClose } from '@/components/ui/popover';
import { getServiceStyle } from '@/lib/constants';
import { toast } from 'sonner';

export function SearchableServicePopover({ 
  value, 
  onChange, 
  open, 
  onOpenChange,
  trigger,
}: { 
  value: string | null | undefined; 
  onChange: (value: string | null) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}) {
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [services, setServices] = useState<{ id: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/services')
      .then(r => r.json())
      .then(d => { 
        if (Array.isArray(d)) setServices(d); 
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange?.(nextOpen);
    if (nextOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSearch('');
    }
  };
  
  const filtered = services.filter(s => 
    s.label.toLowerCase().includes(search.toLowerCase())
  );

  const showCreateNew = search.trim() && 
    !services.some(s => s.label.toLowerCase() === search.toLowerCase());

  const handleCreateService = async () => {
    const slug = search.trim().toLowerCase().replace(/\s+/g, '-');
    try {
      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: slug, label: search.trim() }),
      });
      
      if (res.ok) {
        const newSvc = await res.json();
        setServices(prev => [...prev, newSvc]);
        onChange(newSvc.id);
        toast.success(`Service "${search.trim()}" created`);
        onOpenChange?.(false);
        setSearch('');
      } else {
        toast.error('Failed to create service');
      }
    } catch (err) {
      toast.error('Failed to create service');
    }
  };
  
  const displayValue = value ? services.find(s => s.id === value) : undefined;
  const style = value ? getServiceStyle(value) : null;
  
  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {trigger || (
          <button className="flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-muted/60 transition-colors duration-150 whitespace-nowrap">
            {style ? (
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${style.bg} ${style.text}`}>
                {displayValue ? displayValue.label : style.label}
              </span>
            ) : (
              <span className="text-[13px] text-muted-foreground/30">No service</span>
            )}
            <ChevronDown size={12} className="text-muted-foreground/30" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-52 p-0" align="start">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setHighlightedIndex(0); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { 
              e.preventDefault(); 
              setHighlightedIndex(prev => Math.min(prev + 1, filtered.length + (showCreateNew ? 0 : -1))); 
            }
            else if (e.key === 'ArrowUp') { 
              e.preventDefault(); 
              setHighlightedIndex(prev => Math.max(prev - 1, -1)); 
            }
            else if (e.key === 'Enter') { 
              e.preventDefault(); 
              const items = document.querySelectorAll('[data-search-item]'); 
              const idx = highlightedIndex >= 0 ? highlightedIndex : 0; 
              if (items.length > 0 && items[idx]) (items[idx] as HTMLElement).click(); 
            }
          }}
          placeholder="Search or create..."
          className="w-full px-3 py-2 text-[13px] bg-transparent border-b border-border/20 outline-none text-foreground placeholder:text-muted-foreground/60 rounded-t-md"
        />
        <div className="p-1 max-h-[280px] overflow-y-auto">
          {value && !search && (
            <>
              <PopoverClose asChild>
                <button
                  onClick={() => { onChange(null); }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-[13px] text-muted-foreground/30 hover:text-muted-foreground/60 hover:bg-muted/40 transition-colors duration-150"
                >
                  <span className="flex-1 text-left">No service</span>
                </button>
              </PopoverClose>
              <div className="border-t border-border/20 my-1" />
            </>
          )}
          {loading ? (
            <div className="px-2 py-3 text-[13px] text-muted-foreground/30 text-center">
              Loading...
            </div>
          ) : (
            <>
              {filtered.map((svc, idx) => {
                const svcStyle = getServiceStyle(svc.id);
                return (
                  <PopoverClose asChild key={svc.id}>
                    <button
                      onClick={() => { onChange(svc.id); }}
                      data-search-item 
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[13px] hover:bg-muted/60 transition-colors duration-150 ${value === svc.id ? 'bg-muted/50' : ''} ${highlightedIndex === idx ? 'bg-primary/15 text-primary' : ''}`}
                    >
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${svcStyle.bg} ${svcStyle.text}`}>
                        {svc.label}
                      </span>
                      {value === svc.id && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-auto" />}
                    </button>
                  </PopoverClose>
                );
              })}
              {showCreateNew && (
                <button
                  onClick={handleCreateService}
                  data-search-item
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[13px] text-primary hover:bg-muted/60 transition-colors duration-150 ${highlightedIndex === filtered.length ? 'bg-primary/15' : ''}`}
                >
                  <Plus size={12} /> Create &ldquo;{search.trim()}&rdquo;
                </button>
              )}
              {filtered.length === 0 && !showCreateNew && (
                <div className="px-2 py-3 text-[13px] text-muted-foreground/30 text-center">
                  No services found
                </div>
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
