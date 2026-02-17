'use client';

import { useState, useRef, useEffect } from 'react';
import * as chrono from 'chrono-node';
import { Clock, X } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { format, isToday, isTomorrow, isThisWeek } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';

export function formatRelativeDate(date: Date | null): string {
  if (!date) return 'Set date';
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  if (isThisWeek(date, { weekStartsOn: 1 })) return format(date, 'EEEE');
  return format(date, "d MMM ''yy");
}

function TimeInput({ value, onChange }: { value: string; onChange: (time: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [invalid, setInvalid] = useState(false);
  
  // Sync when parent clears/changes value
  useEffect(() => { setDraft(value); }, [value]);

  const validate = () => {
    if (!draft) { onChange(''); setInvalid(false); return; }
    const match = draft.match(/^(\d{1,2}):?(\d{2})$/);
    if (match) {
      const h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        const formatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        setDraft(formatted);
        onChange(formatted);
        setInvalid(false);
        return;
      }
    }
    setInvalid(true);
    setDraft(value);
    setTimeout(() => setInvalid(false), 1500);
  };

  return (
    <input
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={validate}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
      placeholder="HH:MM"
      maxLength={5}
      className={`text-[13px] bg-transparent hover:bg-muted/60 rounded px-1.5 py-0.5 outline-none transition-colors duration-150 w-[56px] text-center placeholder:text-muted-foreground/30 ${invalid ? 'text-destructive' : 'text-muted-foreground/60'}`}
    />
  );
}

export function EnhancedDatePicker({ 
  date, 
  time, 
  onDateChange, 
  onTimeChange, 
  onClear,
  onOpenChange 
}: { 
  date: Date | null; 
  time: string; 
  onDateChange: (date: Date | null) => void; 
  onTimeChange: (time: string) => void; 
  onClear: () => void;
  onOpenChange?: (open: boolean) => void;
}) {
  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  const [showTimeInput, setShowTimeInput] = useState(!!time);
  const nlInputRef = useRef<HTMLInputElement>(null);
  
  // Build prefill string from current date+time
  const buildPrefill = () => {
    if (!date) return '';
    const datePart = formatRelativeDate(date);
    if (datePart === 'Set date') return '';
    return time ? `${datePart} at ${time}` : datePart;
  };
  
  const [nlInput, setNlInput] = useState(buildPrefill);
  const [nlPreview, setNlPreview] = useState<string | null>(null);
  const nlParsedRef = useRef<{ date: Date; hasTime: boolean } | null>(null);
  
  useEffect(() => {
    setShowTimeInput(!!time);
  }, [time]);
  
  // Prefill and focus when picker opens
  useEffect(() => {
    setNlInput(buildPrefill());
    setTimeout(() => nlInputRef.current?.focus(), 50);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, time]);

  const handleNlInput = (value: string) => {
    setNlInput(value);
    if (!value.trim()) {
      setNlPreview(null);
      return;
    }
    
    // Expand common day abbreviations that chrono doesn't handle
    const dayAbbrevs: Record<string, string> = {
      'mon': 'monday', 'tues': 'tuesday', 'tue': 'tuesday', 'wed': 'wednesday',
      'weds': 'wednesday', 'thurs': 'thursday', 'thur': 'thursday', 'thu': 'thursday',
      'fri': 'friday', 'sat': 'saturday', 'sun': 'sunday',
      'tmr': 'tomorrow', 'tmrw': 'tomorrow', 'tom': 'tomorrow',
    };
    let normalized = value;
    for (const [abbr, full] of Object.entries(dayAbbrevs)) {
      normalized = normalized.replace(new RegExp(`\\b${abbr}\\b`, 'gi'), full);
    }
    
    // Fix GB locale quirk: "feb 20" → "feb 20th", "march 3" → "march 3rd"
    // Adds ordinal suffix to bare numbers after month names so chrono-node GB parses correctly
    const months = 'january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec';
    normalized = normalized.replace(
      new RegExp(`(${months})\\s+(\\d{1,2})(?!\\d|st|nd|rd|th)`, 'gi'),
      (_, month, day) => {
        const d = parseInt(day);
        const suffix = d === 1 || d === 21 || d === 31 ? 'st' : d === 2 || d === 22 ? 'nd' : d === 3 || d === 23 ? 'rd' : 'th';
        return `${month} ${day}${suffix}`;
      }
    );
    
    const results = chrono.en.GB.parse(normalized, new Date(), { forwardDate: true });
    if (results.length > 0) {
      const result = results[0];
      let parsed = result.start.date();
      const hasTime = result.start.isCertain('hour');
      
      // Smart PM default: if time is 1-7 AM and user didn't explicitly say AM/morning, assume PM
      // (most task times are during working hours)
      if (hasTime && !result.start.isCertain('meridiem')) {
        const h = parsed.getHours();
        if (h >= 1 && h <= 7) {
          parsed = new Date(parsed);
          parsed.setHours(h + 12);
        }
      }
      
      // Must have a certain date — time-only inputs ("5pm") are not accepted
      const hasCertainDate = result.start.isCertain('day') || result.start.isCertain('weekday') || result.start.isCertain('month');
      if (hasCertainDate) {
        const timeStr = hasTime ? format(parsed, "'at' HH:mm") : '';
        setNlPreview(`${format(parsed, "EEE d MMM ''yy")} ${timeStr}`.trim());
        nlParsedRef.current = { date: parsed, hasTime };
      } else {
        setNlPreview(null);
        nlParsedRef.current = null;
      }
    } else {
      setNlPreview(null);
      nlParsedRef.current = null;
    }
  };

  const handleNlConfirm = () => {
    if (!nlParsedRef.current) return;
    
    const { date: parsed, hasTime } = nlParsedRef.current;
    
    if (hasTime) {
      const hours = parsed.getHours();
      const mins = parsed.getMinutes();
      const timeStr = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
      onTimeChange(timeStr);
    } else {
      onTimeChange('');
    }
    onDateChange(parsed);
    setNlInput('');
    setNlPreview(null);
    nlParsedRef.current = null;
    setTimeout(() => onOpenChange?.(false), 100);
  };

  const handleClear = () => {
    onClear();
    setTimeout(() => onOpenChange?.(false), 50);
  };

  return (
    <div className="w-auto">
      {/* Clear option at top */}
      {(date || time) && (
        <div className="p-2 border-b border-border/20">
          <button
            onClick={handleClear}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-[11px] text-muted-foreground/30 hover:text-muted-foreground/60 hover:bg-muted/30 transition-colors duration-150"
          >
            <span className="w-1.5 h-1.5 rounded-full border border-muted-foreground/20" />
            Clear date
          </button>
        </div>
      )}

      {/* Natural language input */}
      <div className="p-2 border-b border-border/20">
        <input
          ref={nlInputRef}
          type="text"
          value={nlInput}
          onChange={(e) => handleNlInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleNlConfirm();
            }
          }}
          placeholder="e.g. tomorrow at 3pm"
          className="text-[13px] bg-muted/30 rounded-md px-3 py-2 w-full outline-none border border-border/20 focus:border-primary/30 placeholder:text-muted-foreground/30"
        />
        {nlPreview && (
          <div className="mt-1.5 text-[11px] text-muted-foreground/60 px-1">
            → {nlPreview}
          </div>
        )}
      </div>

      {/* Calendar
          Date-storage convention: date-only selections (no time) are stored as
          YYYY-MM-DDT00:00:00 (local midnight, no UTC offset) so the date is
          never shifted to the previous day when the user is east of UTC.
          When a time is also set, store as a full ISO string via toISOString(). */}
      <Calendar
        mode="single"
        selected={date || undefined}
        onSelect={(newDate) => {
          if (newDate) {
            // Normalise to local midnight so we get a stable date without TZ shift
            newDate.setHours(0, 0, 0, 0);
          }
          onDateChange(newDate || null);
          setTimeout(() => onOpenChange?.(false), 50);
        }}
        initialFocus
      />

      {/* Time toggle and input */}
      <div className="p-2 border-t border-border/20">
        {!showTimeInput ? (
          <button
            onClick={() => setShowTimeInput(true)}
            className="text-[11px] text-primary/60 hover:text-primary hover:bg-primary/10 transition-colors duration-150 flex items-center gap-1.5 rounded-md px-2 py-1.5 w-full"
          >
            <Clock size={12} />
            Add time
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <Clock size={12} className="text-muted-foreground/30" />
            <TimeInput value={time} onChange={onTimeChange} />
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      onTimeChange('');
                      setShowTimeInput(false);
                    }}
                    className="p-1 rounded-md text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-colors duration-150"
                  >
                    <X size={12} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-[13px]">Clear time</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </div>

    </div>
  );
}
