'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { Task, Project, Comment } from '@/lib/types';
import { STATUS_STYLES, SERVICE_STYLES, toSlug, toDisplayName, getInitials } from '@/lib/constants';
// Note: ASSIGNEE_COLORS / NAME_TO_SLUG are used in subtask-list.tsx, not here.
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Trash2, X, Send, Paperclip,
  Activity, Flag, User, Folder, Briefcase, Calendar as CalendarIcon, Tag,
  Zap, Link2, Copy, Pencil, Check,
  ChevronLeft, ArrowRight, Plus, MessageSquare,
} from 'lucide-react';
import { format } from 'date-fns';
import { PropertyRow } from './property-row';
import { SearchableStatusPopover } from './searchable-status-popover';
import { SearchablePriorityPopover } from './searchable-priority-popover';
import { SearchableAssigneePopover } from './searchable-assignee-popover';
import { SearchableProjectPopover } from './searchable-project-popover';
import { EnhancedDatePicker, formatRelativeDate } from './enhanced-date-picker';
import { LabelCombobox } from './label-combobox';
import { CollapsibleAttachments, type TaskAttachment } from './task-attachments';
import { SubtaskDetailView } from './subtask-detail';
import { InteractiveSubtasks } from './subtask-list';
import { copyToClipboard } from '@/lib/clipboard';
import { ensureHtml } from '@/lib/markdown-to-html';
import { toast } from 'sonner';
import { KeyboardShortcutsCheatSheet } from '@/components/tasks/keyboard-shortcuts';

// Dynamic import to avoid SSR issues with Tiptap
const TaskDescriptionEditor = dynamic(
  () => import('@/components/board/task-description-editor').then(mod => ({ default: mod.TaskDescriptionEditor })),
  { ssr: false }
);

// TaskAttachment type is imported from task-attachments.tsx.
// ConfirmDeleteDialog (from @/components/ui/confirm-delete-dialog) is used for all
// destructive confirmations. The old local ConfirmDialog has been removed.

interface TaskSheetProps {
  task: (Task & { project_name?: string; project_color?: string }) | null;
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<Task>, opts?: { optimistic?: boolean; taskId?: string }) => void;
  onDelete?: () => void;
  projects: Project[];
  isNew?: boolean;
  allTasks?: (Task & { project_name?: string; project_color?: string })[];
  onTaskClick?: (task: Task & { project_name?: string; project_color?: string }) => void;
  allLabels?: string[];
}

// Labels are now dynamically loaded from all tasks - no hardcoded options needed
// KeyboardShortcutsCheatSheet is imported from @/components/tasks/keyboard-shortcuts

function formatTimestamp(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  const timeStr = format(d, 'HH:mm');
  
  if (diffDays === 0) {
    return `Today at ${timeStr}`;
  }
  if (diffDays === 1) {
    return `Yesterday at ${timeStr}`;
  }
  return format(d, "d MMM ''yy") + ` at ${timeStr}`;
}


function activityIcon(key: string) {
  const cls = 'h-3 w-3';
  switch (key) {
    case 'created': return <Plus className={cls} />;
    case 'status': return <ArrowRight className={cls} />;
    case 'priority': return <Zap className={cls} />;
    case 'assignee': return <User className={cls} />;
    case 'due_date': return <CalendarIcon className={cls} />;
    case 'title': return <Pencil className={cls} />;
    default: return <Activity className={cls} />;
  }
}




export function TaskSheet({ 
  task, 
  open, 
  onClose, 
  onSave, 
  onDelete, 
  projects, 
  isNew, 
  allTasks = [], 
  onTaskClick,
  allLabels: allLabelsProp,
}: TaskSheetProps) {
  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  const [form, setForm] = useState({
    title: '',
    description: '',
    status: 'todo' as Task['status'],
    priority: '' as string,
    assignee: '' as string,
    project_id: '' as string,
    service: '' as string,
    due_date: null as Date | null,
    due_time: '' as string,
    labels: [] as string[],
  });
  
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteCommentId, setDeleteCommentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'activity'>('details');
  const [copiedLink, setCopiedLink] = useState(false);
  const [activityLog, setActivityLog] = useState<Array<{ id: string; text: string; time: string; icon: string }>>([]);
  const [autoSavedTaskId, setAutoSavedTaskId] = useState<string | null>(null);
  const [pendingSubtasks, setPendingSubtasks] = useState<(Task & { project_name?: string; project_color?: string })[]>([]);
  // C8: ref-based lock to prevent duplicate task creation from concurrent ensureTaskSaved calls
  const savePromiseRef = useRef<Promise<string | null> | null>(null);
  
  // FIX 1: Subtask detail view state (CRITICAL - was missing entirely)
  const [activeSubtaskId, setActiveSubtaskId] = useState<string | null>(null);
  const [closingSubtask, setClosingSubtask] = useState(false);
  
  // FIX 1: Local copy of allTasks for instant optimistic updates
  const [localAllTasks, setLocalAllTasks] = useState(allTasks);
  
  // Popover states for keyboard shortcuts
  const [statusOpen, setStatusOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [dueDateOpen, setDueDateOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);
  
  // Drag-and-drop state
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);
  
  // Refs
  const sheetRef = useRef<HTMLDivElement>(null);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-size title textarea when content changes or sheet opens
  const resizeTitleTextarea = useCallback(() => {
    const el = titleInputRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, []);

  useEffect(() => {
    resizeTitleTextarea();
    // Also resize after a short delay to handle sheet open animation
    const timer = setTimeout(resizeTitleTextarea, 150);
    return () => clearTimeout(timer);
  }, [form.title, resizeTitleTextarea]);
  
  // Sheet width resizing
  const isDraggingRef = useRef(false);
  const [sheetWidth, setSheetWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mc-task-sheet-width');
      return saved ? parseInt(saved, 10) : 620;
    }
    return 620;
  });

  // Track active resize listeners so we can clean them up on unmount
  const resizeCleanupRef = useRef<(() => void) | null>(null);

  // Remove any lingering resize listeners when the sheet unmounts
  useEffect(() => {
    return () => {
      resizeCleanupRef.current?.();
      resizeCleanupRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    const startX = e.clientX;
    const startWidth = sheetWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const diff = startX - moveEvent.clientX;
      const newWidth = Math.max(520, Math.min(900, startWidth + diff));
      setSheetWidth(newWidth);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      setSheetWidth((w) => {
        localStorage.setItem('mc-task-sheet-width', String(w));
        return w;
      });
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      resizeCleanupRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Store cleanup fn so unmount effect can remove these listeners if needed
    resizeCleanupRef.current = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [sheetWidth]);

  // Sync localAllTasks when allTasks prop changes, preserving optimistic (temp) entries
  useEffect(() => {
    setLocalAllTasks(prev => {
      const tempTasks = prev.filter(t => t.id.startsWith('temp-'));
      if (tempTasks.length === 0) return allTasks;
      // Merge: use allTasks as base, append temp tasks that aren't yet in allTasks
      const allIds = new Set(allTasks.map(t => t.id));
      return [...allTasks, ...tempTasks.filter(t => !allIds.has(t.id))];
    });
  }, [allTasks]);

  // Load task data
  useEffect(() => {
    // Reset auto-save state when task changes
    setAutoSavedTaskId(null);
    
    if (task && task.id) {
      const dueDate = task.due_date ? new Date(task.due_date) : null;
      const rawDueTime = dueDate ? format(dueDate, 'HH:mm') : '';
      const dueTime = rawDueTime === '00:00' ? '' : rawDueTime;
      
      const nextForm = {
        title: task.title || '',
        description: ensureHtml(task.description) || '',
        status: task.status || 'todo',
        priority: task.priority || '',
        assignee: toDisplayName(task.assignee || ''),
        project_id: task.client_id || task.project_id || '',
        service: task.service || '',
        due_date: dueDate,
        due_time: dueTime,
        labels: task.labels || []
      };
      setForm(nextForm);
      // Reset the activity-feed diff reference so the first render of a newly-opened
      // task doesn't fire spurious activity entries (#7)
      prevFormRef.current = nextForm;
      
      // Load comments
      fetch(`/api/tasks/${task.id}/comments`)
        .then((r) => r.json())
        .then(setComments)
        .catch(() => {});
      
      // Load attachments
      fetch(`/api/tasks/${task.id}/attachments`)
        .then((r) => r.json())
        .then((data) => { if (Array.isArray(data)) setAttachments(data); })
        .catch(() => {});
        
      // Initialize activity log
      setActivityLog([{
        id: crypto.randomUUID(),
        text: `Task created ${formatTimestamp(task.created_at)}`,
        time: formatTimestamp(task.created_at),
        icon: 'created',
      }]);
    } else {
      const newDueDate = task?.due_date ? new Date(task.due_date) : null;
      const newRawTime = newDueDate ? format(newDueDate, 'HH:mm') : '';
      const newDueTime = newRawTime === '00:00' ? '' : newRawTime;
      setForm({
        title: '',
        description: '',
        status: (task?.status as Task['status']) || 'todo',
        priority: task?.priority || '',
        assignee: task?.assignee ? toDisplayName(task.assignee) : '',
        project_id: task?.client_id || task?.project_id || '',
        service: task?.service || '',
        due_date: newDueDate,
        due_time: newDueTime,
        labels: [],
      });
      setComments([]);
      setAttachments([]);
      setActivityLog([]);
    }
  }, [task]);

  // Track form changes for activity feed
  const prevFormRef = useRef(form);
  useEffect(() => {
    const prev = prevFormRef.current;
    const newActivity: Array<{ id: string; text: string; time: string; icon: string }> = [];
    
    if (prev.status !== form.status && prev.status) {
      newActivity.push({
        id: crypto.randomUUID(),
        text: `You changed status to ${STATUS_STYLES[form.status]?.label || form.status}`,
        time: formatTimestamp(new Date()),
        icon: 'status',
      });
    }
    
    if (prev.priority !== form.priority && prev.priority) {
      newActivity.push({
        id: crypto.randomUUID(),
        text: `You changed priority to ${form.priority}`,
        time: formatTimestamp(new Date()),
        icon: 'priority',
      });
    }
    
    if (prev.assignee !== form.assignee && prev.assignee) {
      newActivity.push({
        id: crypto.randomUUID(),
        text: `You assigned to ${form.assignee}`,
        time: formatTimestamp(new Date()),
        icon: 'assignee',
      });
    }
    
    if (prev.due_date !== form.due_date && prev.due_date) {
      newActivity.push({
        id: crypto.randomUUID(),
        text: form.due_date ? `You set due date to ${formatTimestamp(form.due_date)}` : 'You cleared the due date',
        time: formatTimestamp(new Date()),
        icon: 'due_date',
      });
    }
    
    if (prev.title !== form.title && prev.title) {
      newActivity.push({
        id: crypto.randomUUID(),
        text: 'You edited the title',
        time: formatTimestamp(new Date()),
        icon: 'title',
      });
    }

    if (prev.project_id !== form.project_id && prev.project_id) {
      const project = projects.find(p => p.id === form.project_id);
      newActivity.push({
        id: crypto.randomUUID(),
        text: `You moved to ${project?.name || 'Unknown'}`,
        time: formatTimestamp(new Date()),
        icon: 'project',
      });
    }

    if (JSON.stringify(prev.labels) !== JSON.stringify(form.labels) && prev.labels.length > 0) {
      const added = form.labels.filter(l => !prev.labels.includes(l));
      const removed = prev.labels.filter(l => !form.labels.includes(l));
      added.forEach((label) => {
        newActivity.push({
          id: crypto.randomUUID(),
          text: `You added label "${label}"`,
          time: formatTimestamp(new Date()),
          icon: 'label',
        });
      });
      removed.forEach((label) => {
        newActivity.push({
          id: crypto.randomUUID(),
          text: `You removed label "${label}"`,
          time: formatTimestamp(new Date()),
          icon: 'label',
        });
      });
    }
    
    if (newActivity.length > 0) {
      setActivityLog(prev => [...newActivity, ...prev]);
    }
    
    prevFormRef.current = form;
  }, [form, projects]);

  // FIX 1: Close subtask panel handler
  const closeSubtask = () => {
    setClosingSubtask(true);
    setTimeout(() => {
      setActiveSubtaskId(null);
      setClosingSubtask(false);
    }, 200);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape: close subtask panel first, don't close the whole sheet
      if (e.key === 'Escape' && activeSubtaskId) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        closeSubtask();
        return;
      }
      
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || 
                      target.tagName === 'TEXTAREA' || 
                      target.isContentEditable;
      
      // Don't trigger shortcuts when typing
      if (isTyping) return;
      
      const key = e.key.toLowerCase();
      
      if (key === 's') { e.preventDefault(); setStatusOpen(true); return; }
      if (key === 'p') { e.preventDefault(); setPriorityOpen(true); return; }
      if (key === 'a') { e.preventDefault(); setAssigneeOpen(true); return; }
      if (key === 'd') { e.preventDefault(); setDueDateOpen(true); return; }
      if (key === 'l') { e.preventDefault(); setLabelsOpen(true); return; }
      if (key === 'c') { e.preventDefault(); commentInputRef.current?.focus(); return; }
      if (key === 'e') { e.preventDefault(); titleInputRef.current?.select(); return; }
    };
    
    if (open) {
      window.addEventListener('keydown', handleKeyDown, true);
      return () => window.removeEventListener('keydown', handleKeyDown, true);
    }
  }, [open, activeSubtaskId]);

  // Drag-and-drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    uploadAttachments(files);
  };

  // Autosave helpers
  const formRef = useRef(form);
  useEffect(() => { formRef.current = form; }, [form]);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadRef = useRef(true);

  // H4: Reset autosave guard whenever the task changes.
  // Note: prevFormRef is reset in the "Load task data" effect after setForm() to
  // avoid stale comparisons when switching tasks (#7).
  useEffect(() => {
    initialLoadRef.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);

  const buildSavePayload = () => {
    const f = formRef.current;
    if (!f.title.trim()) return null;
    let finalDueDate: string | null = null;
    if (f.due_date) {
      const d = new Date(f.due_date);
      if (f.due_time) {
        const [h, m] = f.due_time.split(':').map(Number);
        d.setHours(h, m, 0, 0);
      } else {
        d.setHours(0, 0, 0, 0);
      }
      finalDueDate = d.toISOString();
    }
    return {
      title: f.title,
      description: f.description || null,
      status: f.status,
      priority: f.priority || null,
      assignee: f.assignee ? toSlug(f.assignee) : null,
      client_id: f.project_id || null,
      service: f.service || null,
      due_date: finalDueDate,
      labels: f.labels || [],
    };
  };

  const saveNow = async (taskId: string) => {
    const payload = buildSavePayload();
    if (!payload) return;
    // Optimistic: update parent state instantly before API call
    onSave(payload as Partial<Task>, { optimistic: true, taskId });
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        toast.error('Failed to save changes');
      }
    } catch (err) {
      console.error('Autosave failed:', err);
    }
  };

  // Instant save for discrete property changes (status, priority, assignee, labels, project, due date)
  useEffect(() => {
    if (isNew || !task?.id) return;
    if (initialLoadRef.current) { initialLoadRef.current = false; return; }
    // Cancel any pending debounced save to avoid overwriting
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveNow(task.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.status, form.priority, form.assignee, form.project_id, form.service, form.due_date, form.due_time, form.labels]);

  // Debounced save for text fields (title, description)
  useEffect(() => {
    if (isNew || !task?.id) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveNow(task.id), 1000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.title, form.description]);

  const handleCopyLink = async () => {
    if (!task) return;
    const url = `${window.location.origin}/board?task=${task.id}`;
    const success = await copyToClipboard(url, 'Link copied to clipboard');
    if (success) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // FIX 7: Duplicate action - create duplicate AND immediately open it
  const handleDuplicate = async () => {
    if (!task) return;
    
    // Create a copy with new title
    const duplicatedTask = {
      title: `${form.title} (Copy)`,
      description: form.description,
      status: form.status,
      priority: form.priority,
      assignee: form.assignee ? toSlug(form.assignee) : null,
      client_id: form.project_id,
      due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
      parent_id: task.parent_id, // Preserve parent if it's a subtask
      labels: form.labels,
    };
    
    try {
      // POST to create new task
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(duplicatedTask),
      });
      
      if (res.ok) {
        const newTask = await res.json();
        toast.success('Task duplicated');
        // Trigger a parent data refresh before closing so the duplicate appears in the list
        onSave({});
        // Close current sheet
        onClose();
        // Open the duplicated task immediately
        if (onTaskClick && newTask) {
          setTimeout(() => onTaskClick(newTask), 100);
        }
      } else {
        toast.error('Something went wrong. Please try again.');
      }
    } catch (err) {
      console.error('Failed to duplicate task:', err);
      toast.error('Something went wrong. Please try again.');
    }
  };

  const addComment = async () => {
    if (!newComment.trim()) return;
    if (isNew) {
      // Local-only for new tasks — saved on Create
      setComments(prev => [...prev, { id: `temp-${Date.now()}`, content: newComment, author: 'jamie', created_at: new Date().toISOString() } as Comment]);
      setNewComment('');
      return;
    }
    if (!task) return;
    const res = await fetch(`/api/tasks/${task.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newComment, author: 'jamie' }),
    });
    if (!res.ok) {
      toast.error('Failed to post comment');
      return;
    }
    const comment = await res.json();
    setComments([...comments, comment]);
    setNewComment('');
    toast.success('Comment posted');
  };

  const deleteComment = async (commentId: string) => {
    if (!task) return;
    const deletedComment = comments.find(c => c.id === commentId);
    const delRes = await fetch(`/api/tasks/${task.id}/comments?commentId=${commentId}`, {
      method: 'DELETE',
    });
    if (!delRes.ok) {
      toast.error('Failed to delete comment');
      return;
    }
    setComments(comments.filter(c => c.id !== commentId));
    setDeleteCommentId(null);
    toast.success('Comment deleted', {
      action: deletedComment ? {
        label: 'Undo',
        onClick: async () => {
          const res = await fetch(`/api/tasks/${task.id}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: deletedComment.content, author: deletedComment.author }),
          });
          if (res.ok) {
            const restored = await res.json();
            setComments(prev => [...prev, restored]);
          }
        },
      } : undefined,
      duration: 5000,
    });
  };

  // C8: Actual save implementation (extracted so savePromiseRef can wrap it).
  // Uses buildSavePayload() to avoid duplicating payload construction (#11).
  const doActualSave = async (): Promise<string | null> => {
    if (!form.title.trim()) return null;

    try {
      const payload = buildSavePayload();
      if (!payload) return null;

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const newTask = await res.json();
        setAutoSavedTaskId(newTask.id);
        return newTask.id;
      }
    } catch (err) {
      console.error('Auto-save failed:', err);
    }
    return null;
  };

  // C8: Auto-save helper — ref-based lock prevents duplicate tasks from concurrent calls
  const ensureTaskSaved = async (): Promise<string | null> => {
    // If already saved (either originally or via auto-save), return ID
    if (autoSavedTaskId) return autoSavedTaskId;
    if (!isNew) return task?.id || null;

    // If a save is already in-flight, wait for it instead of firing a second POST
    if (savePromiseRef.current) return savePromiseRef.current;

    savePromiseRef.current = doActualSave();
    const result = await savePromiseRef.current;
    savePromiseRef.current = null;
    return result;
  };

  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  
  const uploadAttachments = async (files: FileList) => {
    if (isNew) {
      // Store locally for new tasks — uploaded on Create
      const newFiles = Array.from(files);
      setPendingFiles(prev => [...prev, ...newFiles]);
      // Show them in the attachment list as preview
      for (const file of newFiles) {
        setAttachments(prev => [{ id: `pending-${Date.now()}-${file.name}`, file_name: file.name, file_url: '', file_size: file.size, file_type: file.type, task_id: '', storage_path: '', created_at: new Date().toISOString() } as TaskAttachment, ...prev]);
      }
      return;
    }
    
    const taskId = await ensureTaskSaved();
    if (!taskId) return;
    
    setUploadingAttachment(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`/api/tasks/${taskId}/attachments`, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.id) setAttachments((prev) => [data, ...prev]);
      }
    } catch (err) {
      console.error('Attachment upload failed:', err);
    }
    setUploadingAttachment(false);
  };

  const deleteAttachment = async (attachmentId: string) => {
    if (!task) return;
    const res = await fetch(`/api/tasks/${task.id}/attachments/${attachmentId}`, { method: 'DELETE' });
    if (!res.ok) {
      toast.error('Failed to delete attachment');
      return;
    }
    setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    toast.success('Attachment deleted');
  };

  const renameAttachment = async (attachmentId: string, newName: string) => {
    if (!task) return;
    try {
      await fetch(`/api/tasks/${task.id}/attachments/${attachmentId}`, { 
        method: 'PATCH', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_name: newName }) 
      });
      setAttachments((prev) => prev.map((a) => a.id === attachmentId ? { ...a, file_name: newName } : a));
      toast.success('Attachment renamed');
    } catch (err) {
      console.error('Rename failed:', err);
      toast.error('Failed to rename attachment');
    }
  };

  const taskId = task?.id || autoSavedTaskId;
  const subtasks = isNew ? pendingSubtasks : (taskId ? localAllTasks.filter((t) => t.parent_id === taskId) : []);
  
  const handleSubtasksUpdate = (updated: (Task & { project_name?: string; project_color?: string })[]) => {
    // C1: When creating a new task, store subtasks in pendingSubtasks (not localAllTasks)
    if (isNew) {
      setPendingSubtasks(updated);
      return;
    }

    // FIX 1: Update local state INSTANTLY (optimistic update)
    const newAllTasks = [...localAllTasks];
    
    // Update or add subtasks in local state
    for (const st of updated) {
      const existingIndex = newAllTasks.findIndex(t => t.id === st.id);
      if (existingIndex >= 0) {
        // Update existing
        newAllTasks[existingIndex] = st;
      } else {
        // Add new (including temp IDs)
        newAllTasks.push(st);
      }
    }
    
    // Handle deletions (subtasks that were removed)
    const updatedIds = new Set(updated.map(s => s.id));
    const oldSubtaskIds = new Set(subtasks.map(s => s.id));
    const deletedIds = [...oldSubtaskIds].filter(id => !updatedIds.has(id));
    
    for (const deletedId of deletedIds) {
      const idx = newAllTasks.findIndex(t => t.id === deletedId);
      if (idx >= 0) newAllTasks.splice(idx, 1);
    }
    
    // Update local state IMMEDIATELY - UI updates instantly!
    setLocalAllTasks(newAllTasks);
    
    // Sync to database in BACKGROUND (non-blocking)
    for (const st of updated) {
      // Skip temp IDs (they're still being created)
      if (st.id.startsWith('temp-')) continue;
      
      // Background sync to database (don't await!)
      fetch(`/api/tasks/${st.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: st.title,
          status: st.status,
          priority: st.priority,
          assignee: st.assignee,
          due_date: st.due_date,
          description: st.description,
        }),
      }).catch(err => {
        console.error('Background sync failed for subtask', st.id, err);
        toast.error('Failed to save changes');
      });
    }
    
    // Background delete (don't await!)
    for (const deletedId of deletedIds) {
      if (deletedId.startsWith('temp-')) continue;
      
      fetch(`/api/tasks/${deletedId}`, {
        method: 'DELETE',
      }).catch(err => {
        console.error('Background delete failed for subtask', deletedId, err);
        toast.error('Failed to save changes');
      });
    }
    
    // Realtime subscription handles fetchTasks() — no manual trigger needed
  };

  // FIX 1: Get active subtask for detail view
  const activeSubtask = activeSubtaskId ? subtasks.find(s => s.id === activeSubtaskId) : null;

  // FIX 1: Handler for updating subtask from detail view
  const handleSubtaskUpdate = async (updates: Partial<Task>) => {
    if (!activeSubtaskId) return;
    
    if (isNew) {
      // Update pending subtasks for new tasks
      setPendingSubtasks(prev => prev.map(s => 
        s.id === activeSubtaskId ? { ...s, ...updates } : s
      ));
    } else {
      const updatedSubtasks = subtasks.map(s => 
        s.id === activeSubtaskId ? { ...s, ...updates } : s
      );
      // handleSubtasksUpdate handles both optimistic UI update AND background DB sync
      handleSubtasksUpdate(updatedSubtasks);
    }
  };

  return (
    <TooltipProvider delayDuration={0}>
      <Sheet open={open} onOpenChange={(v) => {
          if (!v) {
            // Flush any pending debounced save before closing
            if (saveTimerRef.current && task?.id) {
              clearTimeout(saveTimerRef.current);
              saveTimerRef.current = null;
              saveNow(task.id);
            }
            onClose();
          }
        }}>
        <SheetContent
          side="right"
          className="bg-card border-l border-border/20 p-0 overflow-y-auto [&>button]:hidden rounded-none md:rounded-tl-2xl md:rounded-bl-2xl !w-full md:!w-[var(--sheet-width)] md:!max-w-[900px] md:!top-3 md:!bottom-3 md:!h-auto"
          style={{ '--sheet-width': `${sheetWidth}px` } as React.CSSProperties}
          showCloseButton={false}
          onOpenAutoFocus={(e) => e.preventDefault()}
          ref={sheetRef}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <ErrorBoundary fallbackTitle="Task details failed to load" fallbackSubtitle="Something went wrong loading this task. Try again.">
          {/* Resize drag handle */}
          <div
            onMouseDown={handleResizeMouseDown}
            className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-20 group"
          >
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-transparent group-hover:bg-primary/50 transition-colors duration-150" />
          </div>

          {/* Relative wrapper for absolute subtask panel overlay */}
          <div className="relative min-h-full">

          {/* Main content wrapper with dim effect when subtask panel is open */}
          <div 
            className={`transition-all duration-300 ease-out ${activeSubtaskId ? 'opacity-15 scale-[0.96] cursor-pointer hover:opacity-70 hover:scale-[0.98]' : ''}`}
            onClick={activeSubtaskId ? closeSubtask : undefined}
          >
          
          {/* Header with close + actions */}
          <div className="px-5 pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground/30">
                {task?.created_at && <span>Created {formatTimestamp(task.created_at)}</span>}
                {task?.updated_at && task.updated_at !== task.created_at && (
                  <>
                    <span>·</span>
                    <span>Updated {formatTimestamp(task.updated_at)}</span>
                  </>
                )}
                {!task && <span>New task</span>}
              </div>
              <div className="flex items-center gap-0.5">
                {/* Keyboard shortcuts */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button tabIndex={-1} aria-label="Keyboard shortcuts" className="p-1.5 rounded-md hover:bg-muted/60 text-muted-foreground/30 hover:text-muted-foreground transition-colors duration-150">
                      <Zap size={14} aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="end" className="p-0 bg-popover border-border/20">
                    <KeyboardShortcutsCheatSheet />
                  </TooltipContent>
                </Tooltip>
                
                {/* Keep Copy Link and Duplicate as individual buttons */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      tabIndex={-1}
                      aria-label="Copy link"
                      onClick={handleCopyLink}
                      className="p-1.5 rounded-md hover:bg-muted/60 text-muted-foreground/30 hover:text-muted-foreground transition-colors duration-150"
                    >
                      {copiedLink ? <Check size={14} className="text-status-success" aria-hidden="true" /> : <Link2 size={14} aria-hidden="true" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{copiedLink ? 'Copied!' : 'Copy link'}</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      tabIndex={-1}
                      aria-label="Duplicate task"
                      onClick={handleDuplicate}
                      className="p-1.5 rounded-md hover:bg-muted/60 text-muted-foreground/30 hover:text-muted-foreground transition-colors duration-150"
                    >
                      <Copy size={14} aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Duplicate</TooltipContent>
                </Tooltip>
                
                {/* Delete button */}
                {!isNew && onDelete && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        tabIndex={-1}
                        aria-label="Delete task"
                        onClick={() => setDeleteDialogOpen(true)}
                        className="p-1.5 rounded-md hover:bg-destructive/20 text-muted-foreground/30 hover:text-destructive transition-colors duration-150"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Delete</TooltipContent>
                  </Tooltip>
                )}
                
                <button
                  tabIndex={-1}
                  aria-label="Close"
                  onClick={onClose}
                  className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted/40 transition-colors duration-150 text-muted-foreground hover:text-foreground"
                >
                  <X size={11} aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Title input */}
            <div className="mt-2">
              <textarea
                ref={titleInputRef}
                value={form.title}
                onChange={(e) => {
                  setForm({ ...form, title: e.target.value });
                  e.target.style.height = 'auto';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                placeholder="Task title"
                rows={1}
                className="w-full text-[17px] font-semibold bg-transparent border border-transparent outline-none placeholder:text-muted-foreground/30 text-foreground leading-snug px-2 py-1 rounded hover:bg-muted/40 focus:bg-muted/40 focus:border-primary/30 transition-colors duration-150 -mx-1 resize-none overflow-hidden"
              />
            </div>
          </div>

          {/* Property Grid */}
          <div className="px-5 pb-3 pt-1 grid grid-cols-2 gap-x-4">
            <PropertyRow icon={<Activity size={13} />} label="Status">
              <SearchableStatusPopover
                value={form.status}
                onChange={(status) => setForm({ ...form, status: status as Task['status'] })}
                open={statusOpen}
                onOpenChange={setStatusOpen}
              />
            </PropertyRow>
            
            <PropertyRow icon={<Flag size={13} />} label="Priority">
              <SearchablePriorityPopover
                value={form.priority}
                onChange={(priority) => setForm({ ...form, priority })}
                open={priorityOpen}
                onOpenChange={setPriorityOpen}
              />
            </PropertyRow>
            
            <PropertyRow icon={<User size={13} />} label="Assignee">
              <SearchableAssigneePopover
                value={form.assignee}
                onChange={(assignee) => setForm({ ...form, assignee })}
                open={assigneeOpen}
                onOpenChange={setAssigneeOpen}
              />
            </PropertyRow>
            
            <PropertyRow icon={<Folder size={13} />} label="Client">
              <SearchableProjectPopover
                value={form.project_id ? {
                  id: form.project_id,
                  name: projects.find(p => p.id === form.project_id)?.name || '',
                  color: projects.find(p => p.id === form.project_id)?.color || ''
                } : null}
                projects={projects}
                onChange={(project) => setForm({ ...form, project_id: project?.id || '' })}
                open={projectOpen}
                onOpenChange={setProjectOpen}
              />
            </PropertyRow>

            <PropertyRow icon={<Briefcase size={13} />} label="Service">
              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-muted/60 transition-colors duration-150 whitespace-nowrap">
                    {form.service && SERVICE_STYLES[form.service] ? (
                      <>
                        <span>{SERVICE_STYLES[form.service].icon}</span>
                        <span className={`text-[13px] ${SERVICE_STYLES[form.service].text}`}>{SERVICE_STYLES[form.service].label}</span>
                      </>
                    ) : (
                      <span className="text-[13px] text-muted-foreground/30">No service</span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-1" align="start">
                  <button
                    onClick={() => setForm({ ...form, service: '' })}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[13px] hover:bg-muted/60 transition-colors duration-150 ${!form.service ? 'bg-muted/50' : ''}`}
                  >
                    <span className="w-4 h-4 rounded-full border border-dashed border-muted-foreground/20 flex-shrink-0" />
                    <span className="text-muted-foreground/60">No service</span>
                  </button>
                  <div className="border-t border-border/20 my-1" />
                  {Object.entries(SERVICE_STYLES).map(([key, style]) => (
                    <button
                      key={key}
                      onClick={() => setForm({ ...form, service: key })}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[13px] hover:bg-muted/60 transition-colors duration-150 ${form.service === key ? 'bg-primary/10 text-primary' : ''}`}
                    >
                      <span>{style.icon}</span>
                      <span className="flex-1 text-left">{style.label}</span>
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            </PropertyRow>
            
            <PropertyRow icon={<CalendarIcon size={13} />} label="Due date">
              <div className="flex items-center gap-1.5 group">
                <Popover open={dueDateOpen} onOpenChange={setDueDateOpen}>
                  <PopoverTrigger asChild>
                    <button className={`text-[13px] whitespace-nowrap hover:text-foreground/80 transition-colors duration-150 hover:bg-muted/40 rounded px-1.5 py-0.5 ${!form.due_date ? 'text-muted-foreground/30' : ''}`}>
                      {formatRelativeDate(form.due_date)}
                      {form.due_time && <span> at {form.due_time}</span>}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <EnhancedDatePicker
                      date={form.due_date}
                      time={form.due_time}
                      onDateChange={(date) => setForm(prev => ({ ...prev, due_date: date }))}
                      onTimeChange={(time) => setForm(prev => ({ ...prev, due_time: time }))}
                      onClear={() => setForm(prev => ({ ...prev, due_date: null, due_time: '' }))}
                      onOpenChange={setDueDateOpen}
                    />
                  </PopoverContent>
                </Popover>
                {(form.due_date || form.due_time) && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setForm(prev => ({ ...prev, due_date: null, due_time: '' }))}
                        className="p-1 flex items-center justify-center rounded-md text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-colors duration-150 opacity-0 group-hover:opacity-100"
                      >
                        <X size={11} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">{form.due_time ? 'Clear date and time' : 'Clear date'}</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </PropertyRow>
            
            <PropertyRow icon={<Tag size={13} />} label="Labels">
              <LabelCombobox
                selectedLabels={form.labels}
                allLabels={allLabelsProp || allTasks.flatMap(t => t.labels || [])}
                onChange={(labels) => setForm({ ...form, labels })}
                externalOpen={labelsOpen}
                onOpenChange={setLabelsOpen}
              />
            </PropertyRow>
          </div>

          <div className="mx-5 border-t border-border/20" />

          {/* Soft Pill Tabs */}
          <div className="flex items-center gap-1 px-5 py-2">
            {(['details', 'comments', 'activity'] as const).map(tab => (
              <button 
                key={tab} 
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-[13px] font-medium capitalize rounded-full transition-colors duration-150 ${
                  activeTab === tab 
                    ? 'bg-primary/20 text-primary' 
                    : 'text-muted-foreground/30 hover:text-muted-foreground/60 hover:bg-muted/40'
                }`}
              >
                {tab === 'activity' ? (
                  <Tooltip>
                    <TooltipTrigger asChild><span>Activity *</span></TooltipTrigger>
                    <TooltipContent side="bottom" className="text-[13px]">Activity is tracked for this session only</TooltipContent>
                  </Tooltip>
                ) : tab}
                {tab === 'comments' && comments.length > 0 && (
                  <span className={`ml-1.5 -mr-1 text-[10px] rounded-full min-w-[18px] h-[18px] inline-flex items-center justify-center font-medium ${
                    activeTab === 'comments' ? 'bg-primary/20 text-primary' : 'bg-muted/40 text-muted-foreground/30'
                  }`}>
                    {comments.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'details' && (
            <div>
              {/* Description */}
              <div className="px-5 py-3">
                <ErrorBoundary fallbackTitle="Editor error" fallbackSubtitle="The description editor encountered an error.">
                <TaskDescriptionEditor
                  content={form.description}
                  onChange={(html) => setForm({ ...form, description: html })}
                  placeholder="Add description..."
                />
                </ErrorBoundary>
              </div>

              <div className="mx-5 border-t border-border/20" />

              {/* Attachments */}
              <div className="px-5 py-3">
                <CollapsibleAttachments
                  attachments={attachments}
                  onAdd={uploadAttachments}
                  onDelete={deleteAttachment}
                  onRename={renameAttachment}
                  uploading={uploadingAttachment}
                />
              </div>

              <div className="mx-5 border-t border-border/20" />

              {/* Subtasks - optimistic instant updates */}
              <div className="px-5 py-3">
                <InteractiveSubtasks
                  subtasks={subtasks}
                  onUpdate={handleSubtasksUpdate}
                  onSubtaskClick={(id) => setActiveSubtaskId(id)}
                  onAdd={async () => {
                    const tempId = `temp-${Date.now()}`;
                    const tempSubtask = {
                      id: tempId,
                      title: 'New sub-task',
                      status: 'todo' as Task['status'],
                      priority: null,
                      assignee: null as unknown as Task['assignee'],
                      client_id: form.project_id || null,
                      parent_id: task?.id || 'pending',
                      description: null,
                      due_date: null,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    } as Task & { project_name?: string; project_color?: string };
                    
                    if (isNew) {
                      // New task: just add to local state, will be saved with Create
                      setPendingSubtasks(prev => [...prev, tempSubtask]);
                    } else {
                      // Existing task: save to DB immediately
                      handleSubtasksUpdate([...subtasks, tempSubtask]);
                      try {
                        const res = await fetch('/api/tasks', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            title: 'New sub-task', status: 'todo', priority: null,
                            assignee: null, client_id: task?.client_id || null,
                            parent_id: task!.id, description: null, due_date: null,
                          }),
                        });
                        if (res.ok) {
                          const created = await res.json();
                          handleSubtasksUpdate(
                            [...subtasks, tempSubtask].map(s => s.id === tempId ? { ...s, ...created } : s)
                          );
                        } else {
                          // Remove the temp subtask and notify the user
                          handleSubtasksUpdate(subtasks.filter(s => s.id !== tempId));
                          toast.error('Failed to create subtask');
                        }
                      } catch (err) { console.error('Failed to create subtask', err); }
                    }
                  }}
                  showProgress
                />
              </div>
            </div>
          )}

          {activeTab === 'comments' && (
            <div className="px-5 py-3">
              {/* Comments list */}
              <div className="space-y-3 mb-3">
                {comments.length === 0 && (
                  <div className="flex flex-col items-center py-6 text-center">
                    <MessageSquare className="h-6 w-6 text-muted-foreground/30 mb-2" />
                    <p className="text-[13px] text-muted-foreground/60">No comments yet</p>
                    <p className="text-[13px] text-muted-foreground/30 mt-0.5">Be the first to add one</p>
                  </div>
                )}
                {comments.map((c) => (
                  <div key={c.id} className="flex gap-2.5 group relative">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] leading-none flex-shrink-0 mt-0.5">
                      {getInitials(c.author)}
                    </div>
                    <button 
                      aria-label="Delete comment"
                      onClick={() => setDeleteCommentId(c.id)}
                      className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 text-muted-foreground/30 hover:text-destructive transition-all p-1 rounded hover:bg-destructive/20"
                    >
                      <X size={11} aria-hidden="true" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="text-[13px] font-medium text-foreground">{toDisplayName(c.author)}</span>
                        <span className="text-[10px] text-muted-foreground/30">
                          {formatTimestamp(c.created_at)}
                        </span>
                      </div>
                      <p className="text-[13px] text-foreground/75 leading-relaxed whitespace-pre-wrap">
                        {c.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Comment input */}
              <div className="flex items-end gap-2 mt-2 px-1">
                <textarea
                  ref={commentInputRef}
                  className="flex-1 bg-muted/20 text-[13px] outline-none rounded-lg px-3 py-2.5 placeholder:text-muted-foreground/30 resize-none min-h-[36px] max-h-[200px] focus-visible:ring-2 focus-visible:ring-primary/30 transition-all" 
                  placeholder="Write a comment..."
                  value={newComment}
                  onChange={(e) => { 
                    setNewComment(e.target.value); 
                    e.target.style.height = 'auto'; 
                    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px'; 
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      addComment();
                    }
                  }}
                  rows={1}
                />
                <button 
                  onClick={addComment}
                  aria-label="Send comment"
                  className="p-1 text-muted-foreground/30 hover:text-primary transition-colors duration-150 flex-shrink-0 mt-0.5"
                >
                  <Send size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="px-5 py-3">
              <p className="text-[11px] text-muted-foreground/30 mb-3">* This session only — activity is not persisted.</p>
              <div className="space-y-2">
                {activityLog.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 py-1">
                    <span className="w-5 h-5 rounded-full bg-muted/40 flex items-center justify-center text-muted-foreground/60">
                      {activityIcon(a.icon)}
                    </span>
                    <span className="text-[13px] text-muted-foreground/60 flex-1">{a.text}</span>
                    <span className="text-[11px] text-muted-foreground/30">{a.time}</span>
                  </div>
                ))}
                {activityLog.length === 0 && (
                  <p className="text-[13px] text-muted-foreground/30">No activity yet</p>
                )}
              </div>
            </div>
          )}

          {/* Footer: Create button for new tasks */}
          {isNew && (
            <div className="px-5 py-3 border-t border-border/20 flex items-center justify-between sticky bottom-0 bg-card z-10">
              <button
                onClick={async () => {
                  // If task was auto-saved already, clean it up before closing
                  if (autoSavedTaskId) {
                    const res = await fetch(`/api/tasks/${autoSavedTaskId}`, { method: 'DELETE' });
                    if (!res.ok) console.error('Failed to clean up auto-saved task', autoSavedTaskId);
                  }
                  setPendingSubtasks([]);
                  setAutoSavedTaskId(null);
                  onClose();
                }}
                className="px-3 py-1.5 text-[13px] text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/40 rounded-md transition-colors duration-150"
              >
                Discard
              </button>
              <button
                onClick={async () => {
                  if (!form.title.trim()) return;
                  // Cancel any pending debounce timer to avoid a duplicate save
                  // racing with the explicit Create action below.
                  if (saveTimerRef.current) {
                    clearTimeout(saveTimerRef.current);
                    saveTimerRef.current = null;
                  }
                  // Create the task
                  const taskId = await ensureTaskSaved();
                  if (!taskId) return;
                  // Create all pending subtasks
                  for (const st of pendingSubtasks) {
                    await fetch('/api/tasks', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        title: st.title, status: st.status, priority: st.priority,
                        assignee: st.assignee, client_id: form.project_id || null,
                        parent_id: taskId, description: st.description, due_date: st.due_date,
                      }),
                    }).catch(err => console.error('Failed to create subtask', err));
                  }
                  // Save pending comments
                  for (const c of comments) {
                    if (c.id.startsWith('temp-')) {
                      await fetch(`/api/tasks/${taskId}/comments`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ content: c.content, author: c.author }),
                      }).catch(err => console.error('Failed to create comment', err));
                    }
                  }
                  // Upload pending files
                  for (const file of pendingFiles) {
                    const formData = new FormData();
                    formData.append('file', file);
                    await fetch(`/api/tasks/${taskId}/attachments`, { method: 'POST', body: formData })
                      .catch(err => console.error('Failed to upload file', err));
                  }
                  toast.success('Task created');
                  onSave({});
                  onClose();
                }}
                className="px-4 py-1.5 text-[13px] bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors duration-150 font-medium"
              >
                Create task
              </button>
            </div>
          )}

          {/* Drop zone overlay */}
          {isDragging && (
            <div 
              className="absolute inset-0 bg-primary/5 backdrop-blur-[2px] rounded-xl border-2 border-dashed border-primary/40 flex items-center justify-center z-50"
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={(e) => {
                e.preventDefault();
                const rect = e.currentTarget.getBoundingClientRect();
                const { clientX: x, clientY: y } = e;
                if (x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom) {
                  dragCounterRef.current = 0;
                  setIsDragging(false);
                }
              }}
              onDrop={handleDrop}
            >
              <div className="flex flex-col items-center gap-3 pointer-events-none">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                  <Paperclip size={28} className="text-primary/70" />
                </div>
                <div className="text-center">
                  <p className="text-base font-medium text-primary">Drop files here</p>
                  <p className="text-[13px] text-muted-foreground/60 mt-1">Add attachments to this task</p>
                </div>
              </div>
            </div>
          )}
          
          </div>
          {/* End of main content wrapper */}

          {/* Subtask Detail View Slide-In Panel */}
          {activeSubtask && (
            <>
            {/* Clickable left strip to go back to parent */}
            <div 
              className="absolute top-0 left-0 w-[24px] h-full z-30 cursor-pointer group/back transition-all"
              onClick={closeSubtask}
            >
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-r from-primary/[0.03] to-transparent group-hover/back:from-primary/[0.12] transition-all duration-300">
                <ChevronLeft size={14} className="text-muted-foreground/30 group-hover/back:text-muted-foreground/60 transition-all duration-300 -ml-0.5" />
              </div>
            </div>
            <div 
              className={`absolute top-0 right-0 w-[calc(100%-24px)] h-full bg-card border-l border-border/20 z-30 overflow-y-auto rounded-l-xl shadow-xl ${
                closingSubtask 
                  ? 'animate-out slide-out-to-right duration-200' 
                  : 'animate-in slide-in-from-right duration-300'
              }`}
            >
              <SubtaskDetailView
                subtask={activeSubtask}
                parentTitle={form.title || 'parent task'}
                onBack={closeSubtask}
                onUpdate={handleSubtaskUpdate}
              />
            </div>
            </>
          )}
          </div>
          {/* End relative wrapper */}
          </ErrorBoundary>
        </SheetContent>

        {/* Delete task dialog */}
        <ConfirmDeleteDialog
          open={deleteDialogOpen}
          onConfirm={() => {
            setDeleteDialogOpen(false);
            onDelete?.();
          }}
          onCancel={() => setDeleteDialogOpen(false)}
          title="Delete task?"
          description="This will permanently delete this task and all its subtasks. This action cannot be undone."
        />

        {/* Delete comment dialog */}
        <ConfirmDeleteDialog
          open={deleteCommentId !== null}
          onConfirm={() => deleteCommentId && deleteComment(deleteCommentId)}
          onCancel={() => setDeleteCommentId(null)}
          title="Delete comment?"
          description="This will permanently delete this comment. This action cannot be undone."
        />
      </Sheet>
    </TooltipProvider>
  );
}
