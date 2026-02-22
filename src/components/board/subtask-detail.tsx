'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { Task, Comment } from '@/lib/types';
import { toSlug, toDisplayName, getInitials } from '@/lib/constants';
import { formatTimestamp } from '@/lib/activity-ui';
import { toast } from 'sonner';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { PropertyRow } from './property-row';
import { SearchableStatusPopover } from './searchable-status-popover';
import { SearchablePriorityPopover } from './searchable-priority-popover';
import { SearchableAssigneePopover } from './searchable-assignee-popover';
import { EnhancedDatePicker, formatRelativeDate } from './enhanced-date-picker';
import { CollapsibleAttachments, type TaskAttachment } from './task-attachments';
import {
  ArrowLeft, Activity, Flag, User, Calendar as CalendarIcon,
  Paperclip, Send, X,
} from 'lucide-react';
import { format } from 'date-fns';
import { ensureHtml } from '@/lib/markdown-to-html';

// Dynamic import to avoid SSR issues with Tiptap
const TaskDescriptionEditor = dynamic(
  () => import('@/components/board/task-description-editor').then(mod => ({ default: mod.TaskDescriptionEditor })),
  { ssr: false }
);

// ── Types ────────────────────────────────────────────────────────────────────

export interface SubtaskDetailViewProps {
  subtask: Task & { project_name?: string; project_color?: string };
  parentTitle: string;
  onBack: () => void;
  onUpdate: (updates: Partial<Task>) => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function SubtaskDetailView({ subtask, parentTitle, onBack, onUpdate }: SubtaskDetailViewProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(subtask.title);
  const [dueDateOpen, setDueDateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'activity'>('details');

  // Subtask attachments and comments
  const [subtaskAttachments, setSubtaskAttachments] = useState<TaskAttachment[]>([]);
  const [subtaskComments, setSubtaskComments] = useState<Comment[]>([]);
  const [subtaskNewComment, setSubtaskNewComment] = useState('');
  // State for the comment-delete confirmation dialog (#4)
  const [deleteCommentId, setDeleteCommentId] = useState<string | null>(null);

  useEffect(() => {
    if (!subtask.id || subtask.id.startsWith('temp-')) return;
    fetch(`/api/tasks/${subtask.id}/attachments`).then(r => r.json()).then(d => setSubtaskAttachments(Array.isArray(d) ? d : [])).catch(() => {});
    fetch(`/api/tasks/${subtask.id}/comments`).then(r => r.json()).then(d => setSubtaskComments(Array.isArray(d) ? d : [])).catch(() => {});
    // Activity endpoint does not exist for subtasks — skip silently
  }, [subtask.id]);

  const addSubtaskComment = async () => {
    if (!subtaskNewComment.trim()) return;
    if (subtask.id.startsWith('temp-')) {
      // Local-only for temp subtasks
      setSubtaskComments(prev => [...prev, { id: `temp-${Date.now()}`, content: subtaskNewComment, author: 'jamie', created_at: new Date().toISOString() } as Comment]);
      setSubtaskNewComment('');
      return;
    }
    const res = await fetch(`/api/tasks/${subtask.id}/comments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: subtaskNewComment, author: 'jamie' }),
    });
    if (!res.ok) { toast.error('Failed to post comment'); return; }
    const comment = await res.json();
    setSubtaskComments(prev => [...prev, comment]);
    setSubtaskNewComment('');
  };

  // Drag-and-drop state for attachments
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes('Files')) setIsDragging(true);
  };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragCounterRef.current = 0; setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      if (subtask.id && !subtask.id.startsWith('temp-')) {
        for (const file of Array.from(files)) {
          const formData = new FormData();
          formData.append('file', file);
          fetch(`/api/tasks/${subtask.id}/attachments`, { method: 'POST', body: formData })
            .then(r => r.json())
            .then(data => { if (data.id) setSubtaskAttachments(prev => [data, ...prev]); })
            .catch(err => console.error('Upload failed:', err));
        }
      } else {
        // TODO: Pending attachments on temp subtasks are not persisted — needs flush mechanism
        for (const file of Array.from(files)) {
          setSubtaskAttachments(prev => [{ id: `pending-${Date.now()}-${file.name}`, file_name: file.name, file_url: '', file_size: file.size, file_type: file.type, task_id: '', storage_path: '', created_at: new Date().toISOString() } as TaskAttachment, ...prev]);
        }
      }
    }
  };

  const dueDate = subtask.due_date ? new Date(subtask.due_date) : null;
  const rawDueTime = dueDate ? format(dueDate, 'HH:mm') : '';
  const dueTime = rawDueTime === '00:00' ? '' : rawDueTime;

  return (
    <div
      className="px-5 pt-4 pb-3 relative h-full overflow-y-auto"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-[11px] text-muted-foreground/30 hover:text-muted-foreground transition-colors duration-150 mb-3"
      >
        <ArrowLeft size={12} />
        Back to {parentTitle}
      </button>

      {/* Editable title */}
      {editingTitle ? (
        <input
          type="text"
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={() => { onUpdate({ title: titleDraft }); setEditingTitle(false); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { onUpdate({ title: titleDraft }); setEditingTitle(false); }
            if (e.key === 'Escape') { setTitleDraft(subtask.title); setEditingTitle(false); }
          }}
          className="text-[17px] font-semibold text-foreground leading-snug w-full bg-muted/40 border border-primary/30 rounded px-2 py-1 outline-none mb-3"
          autoFocus
        />
      ) : (
        <h2
          role="button"
          tabIndex={0}
          onClick={() => { setEditingTitle(true); setTitleDraft(subtask.title); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditingTitle(true); setTitleDraft(subtask.title); } }}
          className="text-[17px] font-semibold text-foreground leading-snug cursor-pointer hover:text-foreground/80 transition-colors duration-150 mb-3"
        >
          {subtask.title}
        </h2>
      )}

      {/* Property grid */}
      <div className="space-y-0 mb-4">
        <PropertyRow icon={<Activity size={13} />} label="Status">
          <SearchableStatusPopover
            value={subtask.status}
            onChange={(status) => onUpdate({ status: status as Task['status'] })}
          />
        </PropertyRow>

        <PropertyRow icon={<Flag size={13} />} label="Priority">
          <SearchablePriorityPopover
            value={subtask.priority || ''}
            onChange={(priority) => onUpdate({ priority: priority as Task['priority'] })}
          />
        </PropertyRow>

        <PropertyRow icon={<User size={13} />} label="Assignee">
          <SearchableAssigneePopover
            value={subtask.assignee ? toDisplayName(subtask.assignee) || subtask.assignee : ''}
            onChange={(assignee) => onUpdate({ assignee: assignee ? toSlug(assignee) as Task['assignee'] : null as unknown as Task['assignee'] })}
          />
        </PropertyRow>

        <PropertyRow icon={<CalendarIcon size={13} />} label="Due date">
          <div className="flex items-center gap-1.5">
            <Popover open={dueDateOpen} onOpenChange={setDueDateOpen}>
              <PopoverTrigger asChild>
                <button className={`text-[13px] whitespace-nowrap hover:text-foreground/80 transition-colors duration-150 hover:bg-muted/60 rounded px-1.5 py-0.5 ${!dueDate ? 'text-muted-foreground/30' : ''}`}>
                  {formatRelativeDate(dueDate)}
                  {dueTime && <span> at {dueTime}</span>}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <EnhancedDatePicker
                  date={dueDate}
                  time={dueTime}
                  onDateChange={(date) => {
                    onUpdate({ due_date: date ? date.toISOString() : null });
                  }}
                  onTimeChange={(time) => {
                    const d = dueDate || new Date();
                    if (time) {
                      const [h, m] = time.split(':').map(Number);
                      d.setHours(h, m, 0, 0);
                    }
                    onUpdate({ due_date: d.toISOString() });
                  }}
                  onClear={() => onUpdate({ due_date: null })}
                  onOpenChange={setDueDateOpen}
                />
              </PopoverContent>
            </Popover>
          </div>
        </PropertyRow>
      </div>

      <div className="border-t border-border/20 mb-4" />

      {/* Soft Pill Tabs */}
      <div className="flex items-center gap-1 mb-3">
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
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'details' && (
        <div>
          <div className="mb-4">
            <TaskDescriptionEditor
              content={ensureHtml(subtask.description) || ''}
              onChange={(html) => onUpdate({ description: html })}
              placeholder="Add description..."
            />
          </div>

          <div className="mt-4">
            <CollapsibleAttachments
              attachments={subtaskAttachments}
              onAdd={async (files) => {
                if (subtask.id && !subtask.id.startsWith('temp-')) {
                  for (const file of Array.from(files)) {
                    const formData = new FormData();
                    formData.append('file', file);
                    const res = await fetch(`/api/tasks/${subtask.id}/attachments`, { method: 'POST', body: formData });
                    const data = await res.json();
                    if (data.id) setSubtaskAttachments(prev => [data, ...prev]);
                  }
                } else {
                  // Inform the user that attachments on temp subtasks are not persisted until the task is saved
                  toast.info('Attachments will be saved when the task is created');
                  for (const file of Array.from(files)) {
                    setSubtaskAttachments(prev => [{ id: `pending-${Date.now()}-${file.name}`, file_name: file.name, file_url: '', file_size: file.size, file_type: file.type, task_id: '', storage_path: '', created_at: new Date().toISOString() } as TaskAttachment, ...prev]);
                  }
                }
              }}
              onDelete={async (id) => {
                const res = await fetch(`/api/tasks/${subtask.id}/attachments/${id}`, { method: 'DELETE' });
                if (!res.ok) { toast.error('Failed to delete attachment'); return; }
                setSubtaskAttachments(prev => prev.filter(a => a.id !== id));
              }}
              onRename={async (id, name) => {
                const res = await fetch(`/api/tasks/${subtask.id}/attachments/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file_name: name }) });
                if (!res.ok) { toast.error('Failed to rename attachment'); return; }
                setSubtaskAttachments(prev => prev.map(a => a.id === id ? { ...a, file_name: name } : a));
              }}
              uploading={false}
            />
          </div>
        </div>
      )}

      {activeTab === 'comments' && (
        <div>
          <div className="space-y-3 mb-3">
            {subtaskComments.length === 0 && (
              <p className="text-[13px] text-muted-foreground/30">No comments yet</p>
            )}
            {subtaskComments.map((c) => (
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

          <div className="flex items-end gap-2 mt-2 px-1">
            <textarea
              className="flex-1 bg-muted/20 text-[13px] outline-none rounded-lg px-3 py-2.5 placeholder:text-muted-foreground/60 resize-none min-h-[36px] max-h-[200px] focus-visible:ring-2 focus-visible:ring-primary/30 transition-all"
              placeholder="Write a comment..."
              value={subtaskNewComment}
              onChange={(e) => {
                setSubtaskNewComment(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  addSubtaskComment();
                }
              }}
              rows={1}
            />
            <button
              onClick={addSubtaskComment}
              aria-label="Send comment"
              className="p-1 text-muted-foreground/30 hover:text-primary transition-colors duration-150 flex-shrink-0 mt-0.5"
            >
              <Send size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {activeTab === 'activity' && (
        <div>
          <p className="text-[13px] text-muted-foreground/30">Activity tracking for sub-tasks coming soon</p>
        </div>
      )}

      {/* Comment delete confirmation dialog (#4) */}
      <ConfirmDeleteDialog
        open={deleteCommentId !== null}
        onConfirm={async () => {
          if (!deleteCommentId || !subtask.id) return;
          const res = await fetch(`/api/tasks/${subtask.id}/comments?commentId=${deleteCommentId}`, { method: 'DELETE' });
          if (!res.ok) { toast.error('Failed to delete comment'); setDeleteCommentId(null); return; }
          setSubtaskComments(prev => prev.filter(x => x.id !== deleteCommentId));
          setDeleteCommentId(null);
        }}
        onCancel={() => setDeleteCommentId(null)}
        title="Delete comment?"
        description="This will permanently delete this comment. This action cannot be undone."
      />

      {/* Timestamps footer */}
      <div className="mt-6 pt-4 border-t border-border/20 flex items-center gap-4 text-[11px] text-muted-foreground/30">
        <span>Created {formatTimestamp(subtask.created_at)}</span>
        <span>·</span>
        <span>Updated {formatTimestamp(subtask.updated_at)}</span>
      </div>

      {/* Drop zone overlay */}
      {isDragging && (
        <div
          className="absolute inset-0 bg-primary/5 backdrop-blur-[2px] rounded-xl border-2 border-dashed border-primary/40 flex items-center justify-center z-50"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center gap-3 pointer-events-none">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
              <Paperclip size={28} className="text-primary/70" />
            </div>
            <div className="text-center">
              <p className="text-base font-medium text-primary">Drop files here</p>
              <p className="text-[13px] text-muted-foreground/60 mt-1">Add attachments to this subtask</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
