'use client';

import { useEffect, useCallback } from 'react';

export interface ShortcutDefinition {
  key: string;
  description: string;
  action: () => void;
  /** Skip when an input/textarea is focused */
  skipInInput?: boolean;
  /** Require meta/ctrl */
  meta?: boolean;
}

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || (el as HTMLElement).isContentEditable;
}

export function useKeyboardShortcuts(shortcuts: ShortcutDefinition[]) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const keyMatch = e.key === shortcut.key;
        const metaMatch = shortcut.meta ? (e.metaKey || e.ctrlKey) : true;
        const skipMeta = !shortcut.meta ? !(e.metaKey || e.ctrlKey || e.altKey) : true;

        if (keyMatch && metaMatch && skipMeta) {
          if (shortcut.skipInInput !== false && isInputFocused()) continue;
          e.preventDefault();
          shortcut.action();
          break;
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export interface ShortcutDisplay {
  key: string;
  description: string;
}
