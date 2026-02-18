'use client';

import { X } from 'lucide-react';
import type { ShortcutDisplay } from '@/hooks/use-keyboard-shortcuts';

interface ShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
  shortcuts: ShortcutDisplay[];
  pageName?: string;
}

export function ShortcutsDialog({ open, onClose, shortcuts, pageName }: ShortcutsDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm p-5 rounded-xl border border-border/20 bg-card shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[14px] font-semibold">
            Keyboard Shortcuts{pageName ? ` — ${pageName}` : ''}
          </h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors duration-150"
          >
            <X size={16} />
          </button>
        </div>
        <div className="space-y-2">
          {shortcuts.map((s, i) => (
            <div key={i} className="flex items-center justify-between text-[13px]">
              <span className="text-muted-foreground/70">{s.description}</span>
              <kbd className="px-2 py-0.5 rounded bg-muted/40 text-muted-foreground font-mono text-[12px] border border-border/20 shrink-0 ml-4">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[11px] text-muted-foreground/40 text-center">
          Press <kbd className="px-1 font-mono text-[10px] border border-border/20 rounded bg-muted/20">Esc</kbd> or click outside to close
        </p>
      </div>
    </div>
  );
}
