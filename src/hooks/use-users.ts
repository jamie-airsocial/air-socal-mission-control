'use client';

import { useState, useEffect } from 'react';
import type { AppUser } from '@/lib/auth-types';

let cachedUsers: AppUser[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function useUsers() {
  const [users, setUsers] = useState<AppUser[]>(cachedUsers || []);
  const [loading, setLoading] = useState(!cachedUsers);

  useEffect(() => {
    const now = Date.now();
    if (cachedUsers && now - cacheTimestamp < CACHE_TTL) {
      setUsers(cachedUsers);
      setLoading(false);
      return;
    }

    fetch('/api/users')
      .then(res => res.json())
      .then((data: AppUser[]) => {
        cachedUsers = data;
        cacheTimestamp = Date.now();
        setUsers(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return { users, loading };
}

/** Invalidate the cache so next fetch gets fresh data */
export function invalidateUsersCache() {
  cachedUsers = null;
  cacheTimestamp = 0;
}
