'use client';

import { useState, useMemo } from 'react';
import { format, addMonths, startOfMonth } from 'date-fns';
import { getServiceStyle } from '@/lib/constants';
import { ChevronDown } from 'lucide-react';

interface ForecastDataPoint {
  month: Date;
  total: number;
  breakdown: Array<{ service: string; amount: number }>;
}

interface ForecastChartProps {
  data: ForecastDataPoint[];
  color: string;
  mode: 'currency' | 'percentage';
  className?: string;
}

export function ForecastChart({ data, color, mode, className = '' }: ForecastChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  const maxValue = useMemo(() => Math.max(...data.map(d => d.total), 1), [data]);

  // Calculate Y-axis labels (5 steps)
  const yAxisLabels = useMemo(() => {
    const step = Math.ceil(maxValue / 4);
    return [0, step, step * 2, step * 3, maxValue].reverse();
  }, [maxValue]);

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border border-border/20 bg-muted/20 hover:bg-muted/30 transition-colors ${className}`}
      >
        <span className="text-[11px] text-muted-foreground/60">6-month forecast</span>
        <ChevronDown size={12} className="text-muted-foreground/40" />
      </button>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-medium text-muted-foreground/60">6-month forecast</span>
        <button
          onClick={() => setExpanded(false)}
          className="text-[11px] text-muted-foreground/40 hover:text-muted-foreground transition-colors"
        >
          Hide
        </button>
      </div>

      <div className="relative">
        {/* Chart container */}
        <div className="flex items-end gap-1 h-32 relative">
          {/* Y-axis labels */}
          <div className="absolute -left-8 top-0 bottom-0 flex flex-col justify-between text-[9px] text-muted-foreground/40 tabular-nums">
            {yAxisLabels.map((val, i) => (
              <span key={i}>
                {mode === 'currency' ? `£${Math.round(val / 1000)}k` : `${Math.round(val)}%`}
              </span>
            ))}
          </div>

          {/* Bars */}
          {data.map((point, i) => {
            const heightPercent = maxValue > 0 ? (point.total / maxValue) * 100 : 0;
            const isHovered = hoveredIndex === i;

            return (
              <div
                key={i}
                className="flex-1 relative group"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Bar */}
                <div
                  className="w-full rounded-t transition-all duration-200 cursor-pointer"
                  style={{
                    height: `${Math.max(heightPercent, 2)}%`,
                    backgroundColor: color,
                    opacity: isHovered ? 1 : 0.6,
                  }}
                />

                {/* Tooltip */}
                {isHovered && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10 pointer-events-none">
                    <div className="bg-popover border border-border/20 rounded-lg shadow-lg p-2 min-w-[140px]">
                      <p className="text-[11px] font-medium mb-1.5">
                        {format(point.month, 'MMM yyyy')}
                      </p>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground/60">Total</span>
                          <span className="text-[11px] font-bold">
                            {mode === 'currency'
                              ? `£${Math.round(point.total).toLocaleString()}`
                              : `${Math.round(point.total)}%`}
                          </span>
                        </div>
                        {point.breakdown.length > 0 && (
                          <>
                            <div className="h-px bg-border/10 my-1" />
                            {point.breakdown
                              .sort((a, b) => b.amount - a.amount)
                              .map((item, idx) => {
                                const style = getServiceStyle(item.service);
                                return (
                                  <div key={idx} className="flex items-center justify-between">
                                    <div className="flex items-center gap-1">
                                      <span
                                        className="h-1.5 w-1.5 rounded-full shrink-0"
                                        style={{ backgroundColor: style.dot }}
                                      />
                                      <span className="text-[9px] text-muted-foreground/50">
                                        {style.label}
                                      </span>
                                    </div>
                                    <span className="text-[9px] text-muted-foreground/60">
                                      {mode === 'currency'
                                        ? `£${Math.round(item.amount).toLocaleString()}`
                                        : `${Math.round(item.amount)}%`}
                                    </span>
                                  </div>
                                );
                              })}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* X-axis labels */}
        <div className="flex gap-1 mt-1">
          {data.map((point, i) => (
            <div key={i} className="flex-1 text-center">
              <span className="text-[9px] text-muted-foreground/40">
                {format(point.month, 'MMM')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
