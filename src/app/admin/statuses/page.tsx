'use client';

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil, Loader2, Lock, GripVertical } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useStatuses, type TaskStatus } from '@/hooks/use-statuses';

// Predefined colour palette
const COLOUR_PALETTE = [
  { hex: '#f59e0b', label: 'Orange' },
  { hex: '#a855f7', label: 'Purple' },
  { hex: '#3b82f6', label: 'Blue' },
  { hex: '#22c55e', label: 'Green' },
  { hex: '#ef4444', label: 'Red' },
  { hex: '#ec4899', label: 'Pink' },
  { hex: '#14b8a6', label: 'Teal' },
  { hex: '#6366f1', label: 'Indigo' },
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function AdminStatusesPage() {
  const { statuses, setStatuses, loading, refetch } = useStatuses();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TaskStatus | null>(null);
  const [editTarget, setEditTarget] = useState<TaskStatus | null>(null);
  
  // New status form
  const [newLabel, setNewLabel] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newColour, setNewColour] = useState(COLOUR_PALETTE[0].hex);
  
  // Edit status form
  const [editLabel, setEditLabel] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editColour, setEditColour] = useState('');
  
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTaskCount, setDeleteTaskCount] = useState<number | null>(null);

  // Fetch task count when delete dialog opens
  useEffect(() => {
    if (!deleteTarget) { setDeleteTaskCount(null); return; }
    setDeleteTaskCount(null);
    fetch(`/api/tasks?status=${deleteTarget.slug}`)
      .then(r => r.ok ? r.json() : [])
      .then(tasks => setDeleteTaskCount(Array.isArray(tasks) ? tasks.length : 0))
      .catch(() => setDeleteTaskCount(null));
  }, [deleteTarget]);

  const handleLabelChange = (value: string) => {
    setNewLabel(value);
    setNewSlug(slugify(value));
  };

  const createStatus = async () => {
    if (!newLabel.trim()) {
      toast.error('Label is required');
      return;
    }
    if (!newSlug.trim()) {
      toast.error('Slug is required');
      return;
    }
    
    setCreating(true);
    const res = await fetch('/api/statuses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: newLabel.trim(),
        slug: newSlug.trim(),
        colour: newColour,
        dot_colour: newColour,
      }),
    });
    setCreating(false);
    
    if (res.ok) {
      toast.success(`Status "${newLabel}" created`);
      setAddDialogOpen(false);
      setNewLabel('');
      setNewSlug('');
      setNewColour(COLOUR_PALETTE[0].hex);
      refetch();
    } else {
      const e = await res.json();
      toast.error(e.error || 'Failed to create status');
    }
  };

  const openEditDialog = (status: TaskStatus) => {
    setEditTarget(status);
    setEditLabel(status.label);
    setEditSlug(status.slug);
    setEditColour(status.colour);
    setEditDialogOpen(true);
  };

  const updateStatus = async () => {
    if (!editTarget) return;
    if (!editLabel.trim()) {
      toast.error('Label is required');
      return;
    }
    
    setUpdating(true);
    const res = await fetch('/api/statuses', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editTarget.id,
        label: editLabel.trim(),
        colour: editColour,
        dot_colour: editColour,
      }),
    });
    setUpdating(false);
    
    if (res.ok) {
      toast.success('Status updated');
      setEditDialogOpen(false);
      setEditTarget(null);
      refetch();
    } else {
      const e = await res.json();
      toast.error(e.error || 'Failed to update status');
    }
  };

  const onDragEnd = useCallback(async (result: DropResult) => {
    if (!result.destination || result.source.index === result.destination.index) return;
    
    const reordered = Array.from(statuses);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    
    // Optimistic update — instant visual feedback
    const optimistic = reordered.map((s, i) => ({ ...s, sort_order: i }));
    setStatuses(optimistic);
    
    // Persist in background — single batch request
    try {
      const res = await fetch('/api/statuses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reordered.map((s, i) => ({ id: s.id, sort_order: i }))),
      });
      if (!res.ok) {
        toast.error('Failed to reorder statuses');
        refetch();
      }
    } catch {
      toast.error('Failed to reorder statuses');
      refetch();
    }
  }, [statuses, setStatuses, refetch]);

  const confirmDeleteStatus = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/statuses?id=${deleteTarget.id}`, { method: 'DELETE' });
    setDeleting(false);
    
    if (res.ok) {
      toast.success('Status deleted', { description: `${deleteTarget.label} has been removed.` });
      setDeleteTarget(null);
      refetch();
    } else {
      const e = await res.json();
      toast.error(e.error || 'Failed to delete status');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-[13px] text-muted-foreground/40">
        <Loader2 size={16} className="animate-spin" /> Loading statuses…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] text-muted-foreground">
            {statuses.length} status{statuses.length !== 1 ? 'es' : ''} · Drag to reorder
          </p>
          <p className="text-[11px] text-muted-foreground/50 mt-0.5">
            Protected statuses (To Do, Done) cannot be deleted
          </p>
        </div>
        <Button size="sm" onClick={() => setAddDialogOpen(true)} className="h-8 text-[13px] gap-1.5">
          <Plus size={14} /> Add status
        </Button>
      </div>

      {/* Drag-and-drop status list */}
      <div className="bg-card border border-border/20 rounded-lg overflow-hidden">
        <div className="border-b border-border/20 bg-muted/30 grid grid-cols-[32px_28px_1fr_1fr_80px] gap-4 px-4 py-3">
          <span />
          <span />
          <span className="text-[11px] font-medium text-muted-foreground/60">Label</span>
          <span className="text-[11px] font-medium text-muted-foreground/60">Slug</span>
          <span className="text-[11px] font-medium text-muted-foreground/60 text-right">Actions</span>
        </div>
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="statuses">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps}>
                {statuses.map((status, index) => {
                  const isProtected = status.is_default || ['todo', 'done'].includes(status.slug);
                  return (
                    <Draggable key={status.id} draggableId={status.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`grid grid-cols-[32px_28px_1fr_1fr_80px] gap-4 items-center px-4 py-3 border-b border-border/10 transition-colors ${snapshot.isDragging ? 'bg-muted/40 shadow-lg rounded-lg' : 'hover:bg-secondary/20'}`}
                        >
                          <div {...provided.dragHandleProps} className="flex items-center justify-center cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors">
                            <GripVertical size={14} />
                          </div>
                          <div>
                            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: status.colour }} />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium text-foreground">{status.label}</span>
                            {isProtected && <Lock size={11} className="text-muted-foreground/40 shrink-0" />}
                          </div>
                          <div>
                            <code className="text-[12px] text-muted-foreground/60 bg-muted/40 px-1.5 py-0.5 rounded">{status.slug}</code>
                          </div>
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEditDialog(status)} className="p-1.5 rounded hover:bg-muted/60 text-muted-foreground/40 hover:text-foreground transition-colors" title="Edit status">
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => setDeleteTarget(status)} disabled={isProtected} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive transition-colors disabled:opacity-20 disabled:cursor-not-allowed" title={isProtected ? 'Cannot delete protected status' : 'Delete status'}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>

      {/* Add Status Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border/20">
          <DialogHeader>
            <DialogTitle className="text-[15px]">Create new status</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-[13px] text-muted-foreground">Label *</Label>
              <Input
                value={newLabel}
                onChange={e => handleLabelChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createStatus(); }}
                placeholder="e.g. In Review"
                className="h-9 text-[13px] bg-secondary border-border/20"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] text-muted-foreground">Slug *</Label>
              <Input
                value={newSlug}
                onChange={e => setNewSlug(e.target.value)}
                placeholder="Auto-generated from label"
                className="h-9 text-[13px] bg-secondary border-border/20"
              />
              <p className="text-[11px] text-muted-foreground/50">Used in URLs and code</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] text-muted-foreground">Colour</Label>
              <div className="grid grid-cols-8 gap-2">
                {COLOUR_PALETTE.map(c => (
                  <button
                    key={c.hex}
                    onClick={() => setNewColour(c.hex)}
                    className={`w-8 h-8 rounded-md transition-all ${
                      newColour === c.hex
                        ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-110'
                        : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)} className="text-[13px] h-8 border-border/20">
              Cancel
            </Button>
            <Button onClick={createStatus} disabled={creating} className="text-[13px] h-8">
              {creating ? 'Creating…' : 'Create status'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Status Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border/20">
          <DialogHeader>
            <DialogTitle className="text-[15px]">Edit status</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-[13px] text-muted-foreground">Label *</Label>
              <Input
                value={editLabel}
                onChange={e => setEditLabel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') updateStatus(); }}
                className="h-9 text-[13px] bg-secondary border-border/20"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] text-muted-foreground">Slug</Label>
              <Input
                value={editSlug}
                disabled
                className="h-9 text-[13px] bg-muted/40 border-border/20 text-muted-foreground/60 cursor-not-allowed"
              />
              <p className="text-[11px] text-muted-foreground/50">Slug cannot be changed after creation</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] text-muted-foreground">Colour</Label>
              <div className="grid grid-cols-8 gap-2">
                {COLOUR_PALETTE.map(c => (
                  <button
                    key={c.hex}
                    onClick={() => setEditColour(c.hex)}
                    className={`w-8 h-8 rounded-md transition-all ${
                      editColour === c.hex
                        ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-110'
                        : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="text-[13px] h-8 border-border/20">
              Cancel
            </Button>
            <Button onClick={updateStatus} disabled={updating} className="text-[13px] h-8">
              {updating ? 'Updating…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Status confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="bg-card border-border/20 sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px]">Delete &quot;{deleteTarget?.label}&quot;?</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-muted-foreground">
              {deleteTaskCount === null
                ? 'Checking tasks…'
                : deleteTaskCount > 0
                  ? `${deleteTaskCount} task${deleteTaskCount !== 1 ? 's' : ''} currently ${deleteTaskCount !== 1 ? 'use' : 'uses'} this status. You must reassign them before deleting.`
                  : 'No tasks are using this status. It will be permanently removed.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-[13px] h-8 border-border/20">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteStatus}
              disabled={deleting || (deleteTaskCount !== null && deleteTaskCount > 0)}
              className="text-[13px] h-8 bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {deleting ? 'Deleting…' : deleteTaskCount && deleteTaskCount > 0 ? `Can't delete — ${deleteTaskCount} task${deleteTaskCount !== 1 ? 's' : ''} in use` : 'Delete status'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
