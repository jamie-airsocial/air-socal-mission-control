'use client';

import { useEffect, useRef, useState } from 'react';

interface HorizontalScrollRailProps {
  targetRef: React.RefObject<HTMLDivElement | null>;
  className?: string;
}

export function HorizontalScrollRail({ targetRef, className = '' }: HorizontalScrollRailProps) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const [thumbWidth, setThumbWidth] = useState(80);
  const [thumbLeft, setThumbLeft] = useState(0);
  const dragStateRef = useRef<{
    startX: number;
    startLeft: number;
    maxThumbLeft: number;
    maxScrollLeft: number;
  } | null>(null);

  useEffect(() => {
    const target = targetRef.current;
    const rail = railRef.current;
    if (!target || !rail) return;

    const updateThumb = () => {
      const visible = target.clientWidth;
      const total = target.scrollWidth;
      const maxScroll = Math.max(total - visible, 0);
      const railWidth = rail.clientWidth;

      if (railWidth <= 0) return;

      if (maxScroll <= 0) {
        setThumbWidth(railWidth);
        setThumbLeft(0);
        return;
      }

      const nextThumbWidth = Math.max((visible / total) * railWidth, 56);
      const maxThumbLeft = Math.max(railWidth - nextThumbWidth, 0);
      const ratio = target.scrollLeft / maxScroll;
      const nextThumbLeft = ratio * maxThumbLeft;

      setThumbWidth(nextThumbWidth);
      setThumbLeft(nextThumbLeft);
    };

    updateThumb();
    target.addEventListener('scroll', updateThumb);
    window.addEventListener('resize', updateThumb);

    return () => {
      target.removeEventListener('scroll', updateThumb);
      window.removeEventListener('resize', updateThumb);
    };
  }, [targetRef]);

  const onThumbMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = targetRef.current;
    const rail = railRef.current;
    if (!target || !rail) return;

    const maxScrollLeft = Math.max(target.scrollWidth - target.clientWidth, 0);
    const maxThumbLeft = Math.max(rail.clientWidth - thumbWidth, 0);

    dragStateRef.current = {
      startX: e.clientX,
      startLeft: thumbLeft,
      maxThumbLeft,
      maxScrollLeft,
    };

    const handleMove = (event: MouseEvent) => {
      if (!dragStateRef.current || !target) return;
      const delta = event.clientX - dragStateRef.current.startX;
      const nextLeft = Math.min(Math.max(dragStateRef.current.startLeft + delta, 0), dragStateRef.current.maxThumbLeft);
      const ratio = dragStateRef.current.maxThumbLeft <= 0 ? 0 : nextLeft / dragStateRef.current.maxThumbLeft;
      target.scrollLeft = ratio * dragStateRef.current.maxScrollLeft;
    };

    const handleUp = () => {
      dragStateRef.current = null;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  return (
    <div className={`mt-2 px-1 ${className}`}>
      <div ref={railRef} className="relative h-4 rounded-full bg-muted/40 border border-border/30">
        <div
          role="scrollbar"
          aria-orientation="horizontal"
          aria-label="Horizontal scroll"
          onMouseDown={onThumbMouseDown}
          className="absolute top-0.5 h-3 rounded-full bg-foreground/25 hover:bg-foreground/35 cursor-grab active:cursor-grabbing transition-colors"
          style={{ width: `${thumbWidth}px`, transform: `translateX(${thumbLeft}px)` }}
        />
      </div>
    </div>
  );
}
