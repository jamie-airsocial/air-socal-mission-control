'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil, Loader2, Lock, ChevronUp, ChevronDown } from 'lucide-react';
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
  const { statuses, loading, refetch } = useStatuses();
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

  const reorderStatus = useCallback(async (status: TaskStatus, direction: 'up' | 'down') => {
    const currentIndex = statuses.findIndex(s => s.id === status.id);
    if (currentIndex === -1) return;
    
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= statuses.length) return;
    
    const targetStatus = statuses[targetIndex];
    
    // Swap sort orders
    const updates = [
      fetch('/api/statuses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: status.id, sort_order: targetStatus.sort_order }),
      }),
      fetch('/api/statuses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: targetStatus.id, sort_order: status.sort_order }),
      }),
    ];
    
    const results = await Promise.all(updates);
    if (results.every(r => r.ok)) {
      refetch();
    } else {
      toast.error('Failed to reorder statuses');
    }
  }, [statuses, refetch]);

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
            {statuses.length} status{statuses.length !== 1 ? 'es' : ''} · Use arrows to reorder
          </p>
          <p className="text-[11px] text-muted-foreground/50 mt-0.5">
            Protected statuses (To Do, Done) cannot be deleted
          </p>
        </div>
        <Button size="sm" onClick={() => setAddDialogOpen(true)} className="h-8 text-[13px] gap-1.5">
          <Plus size={14} /> Add status
        </Button>
      </div>

      {/* Table */}
      <div className="bg-card border border-border/20 rounded-lg overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border/20 bg-muted/30">
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider w-12">
                Colour
              </th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
                Label
              </th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
                Slug
              </th>
              <th className="text-center px-4 py-3 text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider w-24">
                Order
              </th>
              <th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider w-32">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {statuses.map((status, index) => {
              const isProtected = status.is_default || ['todo', 'done'].includes(status.slug);
              return (
                <tr key={status.id} className="border-b border-border/10 hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-3">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: status.colour }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-foreground">{status.label}</span>
                      {isProtected && (
                        <Lock size={11} className="text-muted-foreground/40 shrink-0" />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-[12px] text-muted-foreground/60 bg-muted/40 px-1.5 py-0.5 rounded">
                      {status.slug}
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => reorderStatus(status, 'up')}
                        disabled={index === 0}
                        className="p-1 rounded hover:bg-muted/60 text-muted-foreground/40 hover:text-foreground transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                        title="Move up"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        onClick={() => reorderStatus(status, 'down')}
                        disabled={index === statuses.length - 1}
                        className="p-1 rounded hover:bg-muted/60 text-muted-foreground/40 hover:text-foreground transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                        title="Move down"
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEditDialog(status)}
                        className="p-1.5 rounded hover:bg-muted/60 text-muted-foreground/40 hover:text-foreground transition-colors"
                        title="Edit status"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(status)}
                        disabled={isProtected}
                        className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                        title={isProtected ? 'Cannot delete protected status' : 'Delete status'}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
              This status will be permanently removed. Make sure no tasks are currently using it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-[13px] h-8 border-border/20">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteStatus}
              disabled={deleting}
              className="text-[13px] h-8 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting…' : 'Delete status'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
