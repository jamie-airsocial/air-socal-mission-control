'use client';

import { useRef } from 'react';
import { HorizontalScrollRail } from '@/components/ui/horizontal-scroll-rail';

interface KanbanFrameProps {
  children: React.ReactNode;
  className?: string;
  scrollClassName?: string;
  railClassName?: string;
}

export function KanbanFrame({ children, className = '', scrollClassName = '', railClassName = '' }: KanbanFrameProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  return (
    <div className={`min-h-0 flex-1 overflow-hidden flex flex-col ${className}`}>
      <div
        ref={scrollRef}
        className={`min-h-0 flex-1 overflow-x-auto overflow-y-hidden hide-horizontal-scrollbar ${scrollClassName}`}
        role="region"
        aria-label="Kanban board"
      >
        {children}
      </div>
      <HorizontalScrollRail targetRef={scrollRef} className={`shrink-0 mt-0 ${railClassName}`} />
    </div>
  );
}
