'use client';

import { useState, useRef } from 'react';
import { ChevronDown, Check, Tag, Settings2, ArrowLeft, Pencil, Trash2, X, Plus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { toast } from 'sonner';

export function FilterLabelPopover({ 
  value, 
  allLabels,
  onChange,
  taskCounts,
  onRenameLabel,
  onDeleteLabel,
  onCreateLabel,
}: { 
  value: string[];
  allLabels: string[];
  onChange: (value: string[]) => void;
  taskCounts?: Record<string, number>;
  onRenameLabel?: (oldLabel: string, newLabel: string) => Promise<void>;
  onDeleteLabel?: (label: string) => Promise<void>;
  onCreateLabel?: (label: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [manageMode, setManageMode] = useState(false);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSearch('');
      setManageMode(false);
      setEditingLabel(null);
      setConfirmDelete(null);
      setNewLabel('');
    }
  };

  const uniqueLabels = Array.from(new Set(allLabels)).sort();
  const filtered = search
    ? uniqueLabels.filter(l => l.toLowerCase().includes(search.toLowerCase()))
    : uniqueLabels;

  const handleToggle = (label: string) => {
    if (value.includes(label)) {
      onChange(value.filter(v => v !== label));
    } else {
      onChange([...value, label]);
    }
  };

  const handleStartEdit = (label: string) => {
    setEditingLabel(label);
    setEditValue(label);
    setConfirmDelete(null);
  };

  const handleSaveEdit = async () => {
    if (!editingLabel || !editValue.trim() || !onRenameLabel) return;
    const trimmed = editValue.trim();
    if (trimmed === editingLabel) { setEditingLabel(null); return; }
    if (uniqueLabels.includes(trimmed)) { toast.error('Label already exists'); return; }
    await onRenameLabel(editingLabel, trimmed);
    setEditingLabel(null);
    toast.success(`Renamed "${editingLabel}" → "${trimmed}"`);
  };

  const handleDelete = async (label: string) => {
    if (!onDeleteLabel) return;
    await onDeleteLabel(label);
    setConfirmDelete(null);
    toast.success(`Deleted "${label}"`);
  };

  const handleCreate = async () => {
    const trimmed = newLabel.trim();
    if (!trimmed || !onCreateLabel) return;
    if (uniqueLabels.includes(trimmed)) { toast.error('Label already exists'); return; }
    await onCreateLabel(trimmed);
    setNewLabel('');
    toast.success(`Created "${trimmed}"`);
  };

  const isActive = value.length > 0;
  const displayText = value.length === 0
    ? 'Label'
    : value.length === 1
      ? value[0]
      : `${value.length} labels`;

  const canManage = !!(onRenameLabel && onDeleteLabel);

  return (
    <>
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button aria-label="Filter by label" className={`h-8 px-3 text-[13px] rounded-lg border transition-colors duration-150 flex items-center gap-1.5 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none ${
          isActive ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border/20 bg-secondary text-muted-foreground hover:text-foreground'
        }`}>
          <Tag className="h-3 w-3" />
          <span className="truncate max-w-[120px]">{displayText}</span>
          {isActive && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
          <ChevronDown size={12} className="text-muted-foreground/60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        {manageMode ? (
          <div>
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border/20">
              <button
                onClick={() => { setManageMode(false); setEditingLabel(null); setConfirmDelete(null); }}
                className="p-0.5 rounded hover:bg-muted/40 transition-colors duration-150"
              >
                <ArrowLeft className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              <span className="text-[13px] font-medium text-foreground">Manage labels</span>
            </div>

            {/* Create new */}
            <div className="flex items-center gap-1.5 px-2 py-2 border-b border-border/20">
              <input
                autoFocus
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
                placeholder="New label..."
                className="flex-1 px-2 py-1 text-[13px] bg-secondary border border-border/20 rounded-md outline-none text-foreground placeholder:text-muted-foreground/60 focus:border-primary/30 transition-colors duration-150 min-w-0"
              />
              <button
                onClick={handleCreate}
                disabled={!newLabel.trim()}
                className="h-7 px-2 text-[13px] rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> Add
              </button>
            </div>

            <div className="p-1 max-h-[280px] overflow-y-auto">
              {uniqueLabels.length === 0 && (
                <p className="text-[13px] text-muted-foreground/30 text-center py-4">No labels yet</p>
              )}
              {uniqueLabels.map(label => (
                <div key={label}>
                  {editingLabel === label ? (
                    <div className="flex items-center gap-1.5 px-2 py-1.5">
                      <input
                        autoFocus
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit();
                          if (e.key === 'Escape') setEditingLabel(null);
                        }}
                        className="flex-1 px-2 py-0.5 text-[13px] bg-secondary border border-primary/30 rounded-md outline-none text-foreground min-w-0"
                      />
                      <button onClick={handleSaveEdit} className="p-1 hover:bg-primary/10 rounded transition-colors duration-150">
                        <Check className="h-3.5 w-3.5 text-primary" />
                      </button>
                      <button onClick={() => setEditingLabel(null)} className="p-1 hover:bg-muted/60 rounded transition-colors duration-150">
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group px-2 py-1.5 rounded-md hover:bg-muted/40 transition-colors duration-150">
                      <span className="px-2 py-0.5 rounded-full text-[11px] bg-muted/40 text-muted-foreground border border-border/20 truncate max-w-[120px]">
                        {label}
                      </span>
                      {(taskCounts?.[label] || 0) > 0 ? (
                        <span className="text-[10px] text-muted-foreground/30">{taskCounts![label]}</span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/30">0</span>
                      )}
                      <span className="flex-1" />
                      <button
                        onClick={() => handleStartEdit(label)}
                        className="p-1 opacity-0 group-hover:opacity-100 hover:bg-muted/60 rounded transition-all"
                      >
                        <Pencil className="h-3 w-3 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => { setConfirmDelete(label); setEditingLabel(null); }}
                        className="p-1 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 rounded transition-all"
                      >
                        <Trash2 className="h-3 w-3 text-destructive/60 hover:text-destructive" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setHighlightedIndex(0); }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIndex(prev => Math.min(prev + 1, filtered.length - 1)); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedIndex(prev => Math.max(prev - 1, 0)); }
                else if (e.key === 'Enter' && highlightedIndex >= 0 && filtered[highlightedIndex]) { e.preventDefault(); handleToggle(filtered[highlightedIndex]); }
              }}
              placeholder="Search..."
              className="w-full px-3 py-2 text-[13px] bg-transparent border-b border-border/20 outline-none text-foreground placeholder:text-muted-foreground/60 rounded-t-md"
            />
            <div className="p-1 max-h-[280px] overflow-y-auto">
              {filtered.map((label, idx) => {
                const isSelected = value.includes(label);
                return (
                  <button
                    key={label}
                    onClick={() => handleToggle(label)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[13px] hover:bg-muted/60 transition-colors duration-150 ${
                      isSelected ? 'bg-muted/50' : ''
                    } ${highlightedIndex === idx ? 'bg-primary/15 text-primary' : ''}`}
                  >
                    <span className="px-2 py-0.5 rounded-full text-[11px] bg-muted/40 text-muted-foreground border border-border/20 flex-shrink-0">
                      {label}
                    </span>
                    <span className="flex-1" />
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                  </button>
                );
              })}
              {filtered.length === 0 && !search && (
                <div className="px-2 py-3 text-[13px] text-muted-foreground/30 text-center">
                  No labels yet
                </div>
              )}
              {filtered.length === 0 && search && (
                <div className="px-2 py-3 text-[13px] text-muted-foreground/30 text-center">
                  No labels found
                </div>
              )}
            </div>
            <div className="border-t border-border/20">
              {value.length > 0 && (
                <button
                  onClick={() => onChange([])}
                  className="w-full px-3 py-1.5 text-[13px] text-destructive hover:bg-destructive/10 transition-colors duration-150 text-left"
                >
                  Clear selection
                </button>
              )}
              {canManage && (
                <button
                  onClick={() => setManageMode(true)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors duration-150"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  Manage labels
                </button>
              )}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
    <ConfirmDeleteDialog
      open={!!confirmDelete}
      title="Delete label"
      description={confirmDelete
        ? `Are you sure you want to delete "${confirmDelete}"?${(taskCounts?.[confirmDelete] || 0) > 0 ? ` This will remove it from ${taskCounts![confirmDelete]} task${taskCounts![confirmDelete] > 1 ? 's' : ''}.` : ''}`
        : 'This label will be permanently removed.'}
      onConfirm={() => { if (confirmDelete) handleDelete(confirmDelete); }}
      onCancel={() => setConfirmDelete(null)}
    />
    </>
  );
}
