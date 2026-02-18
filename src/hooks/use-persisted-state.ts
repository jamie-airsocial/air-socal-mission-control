'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * Like useState but persists to sessionStorage.
 * Survives client-side navigation, resets on tab close.
 */
export function usePersistedState<T>(key: string, defaultValue: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const stored = sessionStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch { /* quota exceeded — ignore */ }
  }, [key, value]);

  return [value, setValue];
}
