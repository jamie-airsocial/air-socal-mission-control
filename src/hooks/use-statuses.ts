'use client';
import { useState, useEffect, useCallback } from 'react';

export interface TaskStatus {
  id: string;
  slug: string;
  label: string;
  colour: string;
  dot_colour: string | null;
  sort_order: number;
  is_default: boolean;
  created_at?: string;
}

export function useStatuses() {
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStatuses = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/statuses');
      if (!response.ok) throw new Error('Failed to fetch statuses');
      const data = await response.json();
      setStatuses(data);
    } catch (error) {
      console.error('Error fetching statuses:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  return { statuses, setStatuses, loading, refetch: fetchStatuses };
}
