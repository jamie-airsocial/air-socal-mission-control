'use client';

import { useState } from 'react';
import { format } from 'date-fns';
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
  capacityTarget?: number;
  className?: string;
  defaultExpanded?: boolean;
  selectedIndex?: number | null;
  onMonthClick?: (index: number) => void;
}

export function ForecastChart({ data, color, mode, capacityTarget = 0, className = '', defaultExpanded = false, selectedIndex, onMonthClick }: ForecastChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(defaultExpanded);

  const scaleMax = capacityTarget > 0 ? capacityTarget : Math.max(...data.map(d => d.total), 1);

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
    <div className={`space-y-2 overflow-visible ${className}`}>
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-medium text-muted-foreground/60">6-month forecast</span>
      </div>

      <div className="relative">
        <div className="flex items-end gap-1 h-24 relative overflow-visible">
          {data.map((point, i) => {
            const heightPercent = scaleMax > 0 ? Math.min((point.total / scaleMax) * 100, 100) : 0;
            const isHovered = hoveredIndex === i;
            const isSelected = selectedIndex === i;
            const capacityPct = capacityTarget > 0 ? (point.total / capacityTarget) * 100 : 0;

            const tooltipPosition = 'left-1/2 -translate-x-1/2';

            return (
              <div
                key={i}
                className="flex-1 relative group h-full"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => onMonthClick?.(i)}
              >
                <div className="w-full h-full flex flex-col justify-end">
                  <div
                    className="w-full rounded-t transition-all duration-200 cursor-pointer"
                    style={{
                      height: `${Math.max(heightPercent, 2)}%`,
                      backgroundColor: color,
                      opacity: isHovered || isSelected ? 1 : 0.6,
                    }}
                  />
                </div>

                {/* Tooltip positioned just above the bar */}
                {isHovered && (() => {
                  const capColor = capacityPct < 80 ? 'text-emerald-500' : capacityPct <= 95 ? 'text-amber-500' : 'text-red-500';
                  return (
                    <div className={`absolute ${tooltipPosition} z-50 pointer-events-none`} style={{ bottom: `${Math.max(heightPercent, 2) + 2}%` }}>
                      <div className="bg-popover border border-border/20 rounded-lg shadow-lg px-2.5 py-1.5 whitespace-nowrap">
                        <p className="text-[11px] font-medium">
                          {format(point.month, 'MMM yyyy')} · {mode === 'currency'
                            ? `£${Math.round(point.total).toLocaleString()}`
                            : <span className={capColor}>{Math.round(capacityPct)}%</span>}
                          {mode === 'currency' && capacityTarget > 0 && (
                            <span className={`ml-1 text-[10px] font-normal ${capColor}`}>
                              {Math.round(capacityPct)}%
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>

        {/* X-axis labels */}
        <div className="flex gap-1 mt-1">
          {data.map((point, i) => (
            <div key={i} className="flex-1 text-center">
              <span className={`text-[9px] cursor-pointer transition-colors ${
                selectedIndex === i ? 'text-foreground font-medium' : 'text-muted-foreground/40 hover:text-muted-foreground/60'
              }`}
                onClick={() => onMonthClick?.(i)}
              >
                {format(point.month, 'MMM')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
