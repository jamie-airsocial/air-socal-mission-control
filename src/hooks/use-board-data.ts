'use client';

/**
 * useBoardData — manages all task/project data fetching, realtime subscriptions,
 * and CRUD operations for the board. Extracted from board/page.tsx to keep that
 * component focused on rendering.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Task, Project, Client } from '@/lib/types';
import { STATUS_STYLES } from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type TaskWithClient = Task & { client_name?: string; client_color?: string; client_team?: string; project_name?: string; project_color?: string };

export function useBoardData() {
  const [tasks, setTasks] = useState<TaskWithClient[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [registeredLabels, setRegisteredLabels] = useState<string[]>([]);
  // C2: Track in-flight optimistic updates so realtime re-fetches don't clobber them
  const pendingUpdatesRef = useRef<Set<string>>(new Set());

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks');
      if (res.ok) {
        const data = await res.json();
        // Map client_id → project_id for internal compat (kanban/filters use project_id)
        setTasks(data.map((t: Record<string, unknown>) => ({
          ...t,
          project_id: t.client_id || t.project_id || null,
          project_name: t.client_name || t.project_name || null,
          project_color: t.client_color || t.project_color || null,
          client_team: t.client_team || null,
        })));
      } else {
        console.error('[Board] Failed to fetch tasks:', res.status);
      }
    } catch (error) {
      console.error('[Board] Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      const r = await fetch('/api/clients');
      if (r.ok) {
        const data = await r.json();
        setClients(data);
        // Map clients to project shape for backward compat with filters/views
        setProjects(data.map((c: Client) => ({ id: c.id, name: c.name, color: c.color || '', created_at: c.created_at })));
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Fetch registered labels once on mount.
  // No need to re-fetch on every task change — new labels are tracked via:
  //   a) handleLabelCreate (updates registeredLabels directly)
  //   b) allLabels = union(registeredLabels, tasks.flatMap(t => t.labels))
  useEffect(() => {
    fetch('/api/labels')
      .then(r => { if (r.ok) return r.json(); return []; })
      .then(d => { if (Array.isArray(d)) setRegisteredLabels(d); })
      .catch(() => {});
  }, []);

  // Realtime subscriptions — scoped to a single channel per mount
  useEffect(() => {
    const channel = supabase
      .channel('tasks-board-page-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        // C2: Skip realtime re-fetch if optimistic updates are in-flight — they would overwrite
        // the optimistic state with stale server data. Delay by 500ms to let them settle.
        if (pendingUpdatesRef.current.size > 0) {
          setTimeout(() => {
            if (pendingUpdatesRef.current.size === 0) fetchTasks();
          }, 500);
          return;
        }
        fetchTasks();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => {
        fetchProjects();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTasks, fetchProjects]);

  // All unique labels across registered + task labels
  const allLabels = useMemo(() =>
    Array.from(new Set([...registeredLabels, ...tasks.flatMap(t => t.labels || [])])),
    [registeredLabels, tasks]
  );

  const handleStatusChange = useCallback(async (taskId: string, newStatus: string) => {
    // C9: Capture only the original value for this specific task — avoids stale closure on full array
    const originalStatus = tasks.find(t => t.id === taskId)?.status;
    // C2: Mark this task as having a pending optimistic update
    pendingUpdatesRef.current.add(taskId);

    setTasks(prev =>
      prev.map(t => {
        if (t.id !== taskId) return t;
        const updates: Partial<Task> = { status: newStatus as Task['status'] };
        if (newStatus === 'done') updates.completed_at = new Date().toISOString();
        else updates.completed_at = null;
        return { ...t, ...updates };
      })
    );

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        if (errorData.code === 'INCOMPLETE_SUBTASKS') {
          const count = errorData.incomplete_count || 0;
          // C9: Functional rollback — safe even if other optimistic updates happened between
          setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: originalStatus ?? t.status, completed_at: null } : t));
          toast.error(`Cannot complete task with ${count} incomplete subtask${count !== 1 ? 's' : ''}`, {
            description: 'Complete all subtasks first, or use the force option.',
            duration: 4000,
          });
          return;
        }
        throw new Error('Failed to update status');
      }

      const statusLabel = STATUS_STYLES[newStatus as keyof typeof STATUS_STYLES]?.label || newStatus;
      toast.success(`Task moved to ${statusLabel}`);
    } catch (error) {
      // C9: Functional rollback — safe even if other optimistic updates happened concurrently
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: originalStatus ?? t.status } : t));
      if (!(error instanceof Error && error.message.includes('INCOMPLETE_SUBTASKS'))) {
        toast.error('Failed to update task status');
      }
    } finally {
      // C2: Clear pending flag when update completes (success or failure)
      pendingUpdatesRef.current.delete(taskId);
    }
  }, [tasks]);

  const handleFieldChange = useCallback(async (
    taskId: string,
    field: 'priority' | 'project_id' | 'assignee' | 'service',
    value: string | null
  ) => {
    // C9: Capture only the original field value for this task — avoids stale closure on full array
    const originalValue = tasks.find(t => t.id === taskId)?.[field] ?? null;
    // C2: Mark this task as having a pending optimistic update
    pendingUpdatesRef.current.add(taskId);
    setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, [field]: value } : t)));

    // Map project_id → client_id for API; service stays as-is
    const apiField = field === 'project_id' ? 'client_id' : field;

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [apiField]: value }),
      });
      if (!res.ok) throw new Error('Failed to update task');
      const label =
        field === 'priority'
          ? value || 'none'
          : field === 'project_id'
          ? (projects.find(p => p.id === value)?.name || 'No client')
          : field === 'service'
          ? (value || 'No service')
          : (value || 'No assignee');
      toast.success(`Moved to ${label}`);
    } catch {
      // C9: Functional rollback — safe even if other optimistic updates happened concurrently
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, [field]: originalValue } : t));
      toast.error(`Failed to update ${field}`);
    } finally {
      // C2: Clear pending flag when update completes (success or failure)
      pendingUpdatesRef.current.delete(taskId);
    }
  }, [tasks, projects]);

  const handleLabelRename = useCallback(async (oldLabel: string, newLabel: string) => {
    const affected = tasks.filter(t => t.labels?.includes(oldLabel));
    setTasks(prev => prev.map(t => {
      if (!t.labels?.includes(oldLabel)) return t;
      return { ...t, labels: t.labels.map((l: string) => l === oldLabel ? newLabel : l) };
    }));
    setRegisteredLabels(prev => prev.map(l => l === oldLabel ? newLabel : l));

    try {
      const res = await fetch('/api/labels', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldName: oldLabel, newName: newLabel }),
      });
      if (!res.ok) { toast.error('Failed to rename label'); return; }

      await Promise.all(affected.map(t => {
        const newLabels = (t.labels || []).map((l: string) => l === oldLabel ? newLabel : l);
        return fetch(`/api/tasks/${t.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ labels: newLabels }),
        });
      }));
      toast.success('Label renamed');
    } catch {
      toast.error('Failed to rename label');
    }
  }, [tasks]);

  const handleLabelDelete = useCallback(async (label: string) => {
    const affected = tasks.filter(t => t.labels?.includes(label));
    setTasks(prev => prev.map(t => {
      if (!t.labels?.includes(label)) return t;
      return { ...t, labels: t.labels.filter((l: string) => l !== label) };
    }));
    setRegisteredLabels(prev => prev.filter(l => l !== label));

    try {
      const res = await fetch('/api/labels', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: label }),
      });
      if (!res.ok) { toast.error('Failed to delete label'); return; }

      await Promise.all(affected.map(t => {
        const newLabels = (t.labels || []).filter((l: string) => l !== label);
        return fetch(`/api/tasks/${t.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ labels: newLabels }),
        });
      }));
      toast.success('Label deleted');
    } catch {
      toast.error('Failed to delete label');
    }
  }, [tasks]);

  const handleLabelCreate = useCallback(async (label: string) => {
    setRegisteredLabels(prev => [...prev, label]);
    try {
      const res = await fetch('/api/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: label }),
      });
      if (!res.ok) toast.error('Failed to create label');
    } catch {
      toast.error('Failed to create label');
    }
  }, []);

  return {
    tasks,
    setTasks,
    projects,
    clients,
    loading,
    fetchTasks,
    allLabels,
    registeredLabels,
    setRegisteredLabels,
    handleStatusChange,
    handleFieldChange,
    handleLabelRename,
    handleLabelDelete,
    handleLabelCreate,
  };
}
