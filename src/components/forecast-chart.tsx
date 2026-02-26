'use client';

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
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
  capacityTarget?: number;
  className?: string;
  defaultExpanded?: boolean;
}

export function ForecastChart({ data, color, mode, capacityTarget = 0, className = '', defaultExpanded = false }: ForecastChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(defaultExpanded);

  // 100% capacity = full chart height; bars show actual % of capacity
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
        <button
          onClick={() => setExpanded(false)}
          className="text-[11px] text-muted-foreground/40 hover:text-muted-foreground transition-colors"
        >
          Hide
        </button>
      </div>

      <div className="relative">
        {/* Chart container — no Y-axis */}
        <div className="flex items-end gap-1 h-24 relative overflow-visible">
          {/* Bars */}
          {data.map((point, i) => {
            const heightPercent = scaleMax > 0 ? Math.min((point.total / scaleMax) * 100, 100) : 0;
            const isHovered = hoveredIndex === i;
            const capacityPct = capacityTarget > 0 ? (point.total / capacityTarget) * 100 : 0;

            // Tooltip alignment: left-align first 2 bars, right-align last 2, center the rest
            const isLeft = i <= 1;
            const isRight = i >= data.length - 2;
            const tooltipPosition = isLeft
              ? 'left-0'
              : isRight
                ? 'right-0'
                : 'left-1/2 -translate-x-1/2';

            return (
              <div
                key={i}
                className="flex-1 relative group h-full"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Spacer to push bar to bottom */}
                <div className="w-full h-full flex flex-col justify-end">
                  {/* Bar */}
                  <div
                    className="w-full rounded-t transition-all duration-200 cursor-pointer"
                    style={{
                      height: `${Math.max(heightPercent, 2)}%`,
                      backgroundColor: color,
                      opacity: isHovered ? 1 : 0.6,
                    }}
                  />
                </div>

                {/* Tooltip */}
                {isHovered && (
                  <div className={`absolute bottom-full ${tooltipPosition} mb-2 z-50 pointer-events-none`}>
                    <div className="bg-popover border border-border/20 rounded-lg shadow-lg p-2 min-w-[140px] whitespace-nowrap">
                      <p className="text-[11px] font-medium mb-1.5">
                        {format(point.month, 'MMM yyyy')}
                      </p>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-[10px] text-muted-foreground/60">Total</span>
                          <span className="text-[11px] font-bold">
                            {mode === 'currency'
                              ? `£${Math.round(point.total).toLocaleString()}`
                              : `${Math.round(point.total)}%`}
                            {mode === 'currency' && capacityTarget > 0 && (
                              <span className={`ml-1 text-[10px] font-normal ${capacityPct < 80 ? 'text-emerald-500' : capacityPct <= 95 ? 'text-amber-500' : 'text-red-500'}`}>
                                {Math.round(capacityPct)}%
                              </span>
                            )}
                          </span>
                        </div>
                        {point.breakdown.length > 0 && (
                          <>
                            <div className="h-px bg-border/10 my-1" />
                            {point.breakdown
                              .sort((a, b) => b.amount - a.amount)
                              .map((item, idx) => {
                                const style = getServiceStyle(item.service);
                                const itemPct = capacityTarget > 0 ? (item.amount / capacityTarget) * 100 : 0;
                                return (
                                  <div key={idx} className="flex items-center justify-between gap-3">
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
                                      {mode === 'currency' && capacityTarget > 0 && (
                                        <span className="ml-1 text-muted-foreground/40">
                                          {Math.round(itemPct)}%
                                        </span>
                                      )}
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
