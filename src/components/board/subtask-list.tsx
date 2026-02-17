'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Task } from '@/lib/types';
import { STATUS_STYLES, ASSIGNEE_COLORS, NAME_TO_SLUG, toSlug, getInitials, toDisplayName } from '@/lib/constants';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { Popover, PopoverContent, PopoverTrigger, PopoverClose } from '@/components/ui/popover';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { SearchableStatusPopover } from './searchable-status-popover';
import { SearchableAssigneePopover } from './searchable-assignee-popover';
import { EnhancedDatePicker, formatRelativeDate } from './enhanced-date-picker';
import {
  Check, X, Trash2, FileText, User, Activity,
  Calendar as CalendarIcon, ChevronDown, Maximize2,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

// Derive assignee list from the single source of truth in constants
const ASSIGNEES = Object.keys(NAME_TO_SLUG);

export interface InteractiveSubtasksProps {
  subtasks: (Task & { project_name?: string; project_color?: string })[];
  onUpdate: (updated: (Task & { project_name?: string; project_color?: string })[]) => void;
  onSubtaskClick?: (id: string) => void;
  onAdd?: () => void;
  /** Explicit parent task ID — used by handleAdd fallback when subtasks array is empty */
  parentId?: string;
  showProgress?: boolean;
}

export function InteractiveSubtasks({ subtasks, onUpdate, onSubtaskClick, onAdd, parentId, showProgress = true }: InteractiveSubtasksProps) {
  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  const [openCalendarId, setOpenCalendarId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Multi-select state
  const [selectedSubtasks, setSelectedSubtasks] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkDateOpen, setBulkDateOpen] = useState(false);

  // Escape key to clear selection
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedSubtasks.size > 0) {
        setSelectedSubtasks(new Set());
        setLastSelectedId(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [selectedSubtasks.size]);

  const handleChangeStatus = (id: string, status: string) => {
    const updated = subtasks.map(s => s.id === id ? { ...s, status: status as Task['status'] } : s);
    onUpdate(updated);
  };

  const handleChangeAssignee = (id: string, assignee: string) => {
    const newSubtasks = subtasks.map(st =>
      st.id === id ? { ...st, assignee: assignee as Task['assignee'] } : st
    );
    onUpdate(newSubtasks);
  };

  const subtasksRef = useRef(subtasks);
  useEffect(() => { subtasksRef.current = subtasks; }, [subtasks]);

  const handleChangeDate = (id: string, date: string) => {
    const newSubtasks = subtasksRef.current.map(st =>
      st.id === id ? { ...st, due_date: date } : st
    );
    onUpdate(newSubtasks);
  };

  const handleDelete = (id: string) => {
    onUpdate(subtasks.filter(st => st.id !== id));
  };

  const handleEditTitle = (id: string, title: string) => {
    if (title.trim()) {
      const updated = subtasks.map(s => s.id === id ? { ...s, title: title.trim() } : s);
      onUpdate(updated);
    }
    setEditingId(null);
  };

  const handleCheckboxClick = (subtaskId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const newSelected = new Set(selectedSubtasks);

    if (event.shiftKey && lastSelectedId) {
      const currentIndex = subtasks.findIndex(s => s.id === subtaskId);
      const lastIndex = subtasks.findIndex(s => s.id === lastSelectedId);
      const start = Math.min(currentIndex, lastIndex);
      const end = Math.max(currentIndex, lastIndex);
      for (let i = start; i <= end; i++) {
        newSelected.add(subtasks[i].id);
      }
    } else {
      if (newSelected.has(subtaskId)) {
        newSelected.delete(subtaskId);
      } else {
        newSelected.add(subtaskId);
      }
      setLastSelectedId(subtaskId);
    }
    setSelectedSubtasks(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedSubtasks.size === subtasks.length) {
      setSelectedSubtasks(new Set());
      setLastSelectedId(null);
    } else {
      setSelectedSubtasks(new Set(subtasks.map(s => s.id)));
    }
  };

  const handleBulkStatusChange = (status: string) => {
    const updated = subtasks.map(s =>
      selectedSubtasks.has(s.id) ? { ...s, status: status as Task['status'] } as typeof s : s
    );
    onUpdate(updated);
  };

  const handleBulkAssigneeChange = (assignee: string) => {
    const updated = subtasks.map(s =>
      selectedSubtasks.has(s.id) ? { ...s, assignee: (assignee ? toSlug(assignee) : null) as Task['assignee'] } as typeof s : s
    );
    onUpdate(updated);
  };

  const handleBulkDateChange = (date: Date | null) => {
    const updated = subtasks.map(s =>
      selectedSubtasks.has(s.id) ? { ...s, due_date: date ? date.toISOString() : null } : s
    );
    onUpdate(updated);
  };

  const handleBulkTimeChange = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const updated = subtasks.map(s => {
      if (!selectedSubtasks.has(s.id) || !s.due_date) return s;
      const d = new Date(s.due_date);
      d.setHours(hours || 0, minutes || 0, 0, 0);
      return { ...s, due_date: d.toISOString() };
    });
    onUpdate(updated);
  };

  const handleBulkDelete = () => {
    const updated = subtasks.filter(s => !selectedSubtasks.has(s.id));
    onUpdate(updated);
    setSelectedSubtasks(new Set());
    setLastSelectedId(null);
    setBulkDeleteConfirm(false);
  };

  const handleAdd = useCallback(async () => {
    // Use explicitly passed parentId if available, fall back to deriving from first subtask.
    // This ensures the button works even when the subtasks array is empty.
    const resolvedParentId = parentId ?? subtasks[0]?.parent_id;
    if (!resolvedParentId) { toast.error('Save the task first before adding subtasks'); return; }

    const tempId = `temp-${Date.now()}`;
    const tempSubtask = {
      id: tempId,
      title: 'New sub-task',
      status: 'todo' as Task['status'],
      priority: null,
      assignee: null as unknown as Task['assignee'],
      project_id: subtasks[0]?.project_id || null,
      parent_id: resolvedParentId,
      description: null,
      due_date: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Task & { project_name?: string; project_color?: string };

    onUpdate([...subtasks, tempSubtask]);

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'New sub-task', status: 'todo', priority: null, assignee: null,
          project_id: subtasks[0]?.project_id || null,
          parent_id: resolvedParentId, description: null, due_date: null,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        onUpdate([...subtasks.filter(s => s.id !== tempId), created]);
        toast.success('Subtask added');
      } else {
        // Remove the temp subtask and notify the user
        onUpdate(subtasks.filter(s => s.id !== tempId));
        toast.error('Failed to create subtask');
      }
    } catch (err) {
      console.error('Failed to create subtask:', err);
      onUpdate(subtasks.filter(s => s.id !== tempId));
      toast.error('Something went wrong. Please try again.');
    }
  }, [subtasks, onUpdate, parentId]);

  return (
    <div>
      {showProgress && (
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {selectedSubtasks.size > 0 && (
              <button
                onClick={handleSelectAll}
                aria-label="Select all subtasks"
                className="w-4 h-4 rounded border border-border/20 flex items-center justify-center bg-primary border-primary hover:bg-primary/80 transition-colors duration-150 mr-1"
              >
                <Check size={12} className="text-primary-foreground" aria-hidden="true" />
              </button>
            )}
            <span className="text-[13px] text-muted-foreground/60">Sub-tasks</span>
            <div className="w-16 h-1 bg-muted/40 rounded-full overflow-hidden">
              <div
                className="h-full bg-status-success/50 rounded-full transition-all"
                style={{ width: `${subtasks.length ? (subtasks.filter(st => st.status === 'done').length / subtasks.length) * 100 : 0}%` }}
              />
            </div>
            <span className="text-[11px] text-muted-foreground/30">
              {subtasks.filter(st => st.status === 'done').length}/{subtasks.length}
            </span>
          </div>
          <button
            onClick={onAdd || handleAdd}
            className="text-[11px] text-primary/60 hover:text-primary transition-colors duration-150"
          >
            + Add
          </button>
        </div>
      )}

      <div className="space-y-0 relative">
        {subtasks.map((st) => {
          const isSelected = selectedSubtasks.has(st.id);
          const dueDate = st.due_date ? new Date(st.due_date) : null;
          const rawTime = dueDate ? format(dueDate, 'HH:mm') : '';
          const dueTime = rawTime === '00:00' ? '' : rawTime;

          return (
            <div
              key={st.id}
              className={`flex items-center gap-2.5 py-[6px] px-2 rounded-md hover:bg-muted/40 group transition-colors duration-150 -mx-1 ${isSelected ? 'bg-primary/5' : ''}`}
            >
              {/* Checkbox */}
              <button
                role="checkbox"
                aria-checked={isSelected}
                aria-label={`Select ${st.title}`}
                onClick={(e) => handleCheckboxClick(st.id, e)}
                className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-primary border-primary opacity-100'
                    : 'border-border/20 opacity-30 group-hover:opacity-100 group-hover:border-border/20 hover:!border-primary hover:!opacity-100'
                } ${selectedSubtasks.size > 0 ? '!opacity-100 !border-primary' : ''}`}
              >
                {isSelected && <Check size={10} className="text-primary-foreground" />}
              </button>

              {/* Status */}
              <div className="w-[90px] flex-shrink-0">
                <div className="[&_button:first-child]:text-[11px] [&_button:first-child]:px-1.5 [&_button:first-child]:py-0.5 [&_button:first-child]:hover:bg-muted/40 [&_button:first-child]:transition-colors duration-150">
                  <SearchableStatusPopover
                    value={st.status}
                    onChange={(status) => handleChangeStatus(st.id, status)}
                  />
                </div>
              </div>

              {/* Editable title */}
              {editingId === st.id ? (
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => handleEditTitle(st.id, editValue)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleEditTitle(st.id, editValue);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  className="text-[13px] flex-1 bg-muted/40 border border-primary/30 rounded px-1.5 py-0.5 outline-none min-w-0"
                  autoFocus
                />
              ) : (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); setEditingId(st.id); setEditValue(st.title); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditingId(st.id); setEditValue(st.title); } }}
                  className={`text-[13px] flex-1 cursor-pointer truncate hover:text-foreground/80 transition-colors duration-150 ${st.status === 'done' ? 'text-foreground/50 line-through' : 'text-foreground/90'}`}
                >
                  {st.title}
                </span>
              )}

              {/* Description indicator */}
              <div className="flex items-center gap-1.5 flex-shrink-0 ml-1.5">
                {st.description && st.description !== '' && st.description !== '<p></p>' && (
                  <Tooltip><TooltipTrigger asChild>
                    <span className="text-muted-foreground/30"><FileText size={11} /></span>
                  </TooltipTrigger><TooltipContent side="top">Has description</TooltipContent></Tooltip>
                )}
              </div>

              <div className="flex items-center flex-shrink-0">
                {/* Assignee */}
                <div className="w-8 flex-shrink-0 flex justify-center">
                  <SearchableAssigneePopover
                    value={st.assignee ? toDisplayName(st.assignee) : ''}
                    onChange={(assignee) => handleChangeAssignee(st.id, assignee)}
                    compact
                  />
                </div>

                {/* Due date */}
                <div className="w-[120px] flex-shrink-0 flex items-center rounded-md bg-muted/20 hover:bg-muted/30 transition-colors duration-150 group">
                  <Popover open={openCalendarId === st.id} onOpenChange={(open) => setOpenCalendarId(open ? st.id : null)}>
                    <PopoverTrigger asChild>
                      <button className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground rounded px-1.5 py-0.5 transition-colors duration-150 whitespace-nowrap min-w-[52px] text-center">
                        {dueDate ? formatRelativeDate(dueDate) : 'Set date'}
                        {dueTime && <span className="ml-0.5"> at {dueTime}</span>}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <EnhancedDatePicker
                        date={dueDate}
                        time={dueTime}
                        onDateChange={(date) => handleChangeDate(st.id, date ? date.toISOString() : '')}
                        onTimeChange={(time) => {
                          const d = dueDate || new Date();
                          if (time) {
                            const [h, m] = time.split(':').map(Number);
                            d.setHours(h, m, 0, 0);
                          }
                          handleChangeDate(st.id, d.toISOString());
                        }}
                        onClear={() => {
                          const updated = subtasks.map(s => s.id === st.id ? { ...s, due_date: null } : s);
                          onUpdate(updated);
                        }}
                        onOpenChange={(open) => setOpenCalendarId(open ? st.id : null)}
                      />
                    </PopoverContent>
                  </Popover>
                  {st.due_date && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const cleared = subtasks.map(s => s.id === st.id ? { ...s, due_date: null } : s);
                            onUpdate(cleared);
                          }}
                          className="text-muted-foreground/30 hover:text-destructive transition-all px-0.5 mr-0.5 w-[16px] flex-shrink-0 flex items-center justify-center opacity-0 group-hover:opacity-100"
                        >
                          <X size={10} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">Clear date</TooltipContent>
                    </Tooltip>
                  )}
                </div>

                {/* Expand to detail */}
                <div className="w-6 flex-shrink-0 flex justify-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={(e) => { e.stopPropagation(); onSubtaskClick?.(st.id); }}
                        aria-label="Open subtask"
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted/40 text-muted-foreground/30 hover:text-muted-foreground/60 transition-all"
                      >
                        <Maximize2 size={11} aria-hidden="true" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Open subtask</TooltipContent>
                  </Tooltip>
                </div>

                {/* Delete */}
                <div className="w-6 flex-shrink-0 flex justify-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setDeleteConfirmId(st.id)}
                        className="opacity-40 hover:opacity-100 text-destructive hover:bg-destructive/20 rounded p-0.5 transition-all"
                      >
                        <Trash2 size={12} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Delete subtask</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          );
        })}

        {/* Floating bulk-action bar */}
        {selectedSubtasks.size > 0 && (
          <div className="mt-2 bg-card border border-border/20 rounded-lg shadow-lg px-3 py-2 flex items-center gap-3 animate-in slide-in-from-bottom duration-200 flex-wrap">
            <span className="text-[11px] text-foreground/70 font-medium">
              {selectedSubtasks.size} selected
            </span>

            {/* Status dropdown */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-[11px] text-muted-foreground hover:text-foreground transition-colors duration-150 flex items-center gap-1 px-2 py-1 rounded hover:bg-muted/40">
                  <Activity size={12} />
                  Status
                  <ChevronDown size={10} />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-40 p-1" align="start">
                {Object.entries(STATUS_STYLES).filter(([key]) => key !== 'backlog').map(([key, style]) => (
                  <PopoverClose asChild key={key}>
                    <button
                      onClick={() => handleBulkStatusChange(key)}
                      className="w-full flex items-center gap-2 px-2 py-1 rounded text-[13px] hover:bg-muted/60 transition-colors duration-150"
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: style.dot }} />
                      <span className={style.text}>{style.label}</span>
                    </button>
                  </PopoverClose>
                ))}
              </PopoverContent>
            </Popover>

            {/* Assignee dropdown */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-[11px] text-muted-foreground hover:text-foreground transition-colors duration-150 flex items-center gap-1 px-2 py-1 rounded hover:bg-muted/40">
                  <User size={12} />
                  Assignee
                  <ChevronDown size={10} />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-40 p-1" align="start">
                {ASSIGNEES.map(a => (
                  <PopoverClose asChild key={a}>
                    <button
                      onClick={() => handleBulkAssigneeChange(a)}
                      className="w-full flex items-center gap-2 px-2 py-1 rounded text-[13px] hover:bg-muted/60 transition-colors duration-150"
                    >
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] leading-none font-medium ${ASSIGNEE_COLORS[a]}`}>
                        {getInitials(a)}
                      </span>
                      <span className="text-[13px]">{toDisplayName(a)}</span>
                    </button>
                  </PopoverClose>
                ))}
              </PopoverContent>
            </Popover>

            {/* Date picker */}
            <Popover open={bulkDateOpen} onOpenChange={setBulkDateOpen}>
              <PopoverTrigger asChild>
                <button className="text-[11px] text-muted-foreground hover:text-foreground transition-colors duration-150 flex items-center gap-1 px-2 py-1 rounded hover:bg-muted/40">
                  <CalendarIcon size={12} />
                  Date
                  <ChevronDown size={10} />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <EnhancedDatePicker
                  date={null}
                  time=""
                  onDateChange={(date) => { handleBulkDateChange(date); setBulkDateOpen(false); }}
                  onTimeChange={handleBulkTimeChange}
                  onClear={() => handleBulkDateChange(null)}
                  onOpenChange={setBulkDateOpen}
                />
              </PopoverContent>
            </Popover>

            <div className="flex-1" />

            <button
              onClick={() => setBulkDeleteConfirm(true)}
              className="text-[11px] text-destructive/70 hover:text-destructive transition-colors duration-150 flex items-center gap-1"
            >
              <Trash2 size={12} />
              Delete
            </button>

            <button
              onClick={() => { setSelectedSubtasks(new Set()); setLastSelectedId(null); }}
              className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors duration-150"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      <ConfirmDeleteDialog
        open={deleteConfirmId !== null}
        onCancel={() => setDeleteConfirmId(null)}
        onConfirm={() => { if (deleteConfirmId) { handleDelete(deleteConfirmId); setDeleteConfirmId(null); } }}
        title="Delete sub-task"
        description="This sub-task will be permanently removed. This action cannot be undone."
      />

      <ConfirmDeleteDialog
        open={bulkDeleteConfirm}
        onCancel={() => setBulkDeleteConfirm(false)}
        onConfirm={handleBulkDelete}
        title={`Delete ${selectedSubtasks.size} subtask${selectedSubtasks.size > 1 ? 's' : ''}`}
        description={`These ${selectedSubtasks.size} sub-task${selectedSubtasks.size > 1 ? 's' : ''} will be permanently removed. This action cannot be undone.`}
      />
    </div>
  );
}
