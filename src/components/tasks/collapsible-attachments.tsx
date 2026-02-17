// @deprecated — Legacy component, use board/ equivalents
'use client';

import { useState, useEffect, useRef } from 'react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { 
  ChevronDown, Paperclip, Download, Image, FileText, 
  Check, Pencil, Eye, Trash2, X
} from 'lucide-react';

export interface FileAttachment {
  id: string;
  name: string;
  size: string;
}

export interface CollapsibleAttachmentsProps {
  attachments: FileAttachment[];
  onAdd: (files: FileAttachment[]) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
}

export function CollapsibleAttachments({ attachments, onAdd, onDelete, onRename }: CollapsibleAttachmentsProps) {
  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  const [isExpanded, setIsExpanded] = useState(attachments.length <= 3);
  const [showAll, setShowAll] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Multi-select state
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  // Escape key to clear selection
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedFiles.size > 0) {
        setSelectedFiles(new Set());
        setLastSelectedId(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [selectedFiles.size]);

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    const newAttachments: FileAttachment[] = Array.from(files).map(file => ({
      id: `${Date.now()}-${file.name}`,
      name: file.name,
      size: formatFileSize(file.size),
    }));
    onAdd(newAttachments);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCheckboxClick = (fileId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const newSelected = new Set(selectedFiles);
    
    if (event.shiftKey && lastSelectedId) {
      // Range select
      const currentIndex = visibleFiles.findIndex(f => f.id === fileId);
      const lastIndex = visibleFiles.findIndex(f => f.id === lastSelectedId);
      const start = Math.min(currentIndex, lastIndex);
      const end = Math.max(currentIndex, lastIndex);
      
      for (let i = start; i <= end; i++) {
        newSelected.add(visibleFiles[i].id);
      }
    } else {
      // Toggle single
      if (newSelected.has(fileId)) {
        newSelected.delete(fileId);
      } else {
        newSelected.add(fileId);
      }
      setLastSelectedId(fileId);
    }
    
    setSelectedFiles(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedFiles.size === attachments.length) {
      setSelectedFiles(new Set());
      setLastSelectedId(null);
    } else {
      setSelectedFiles(new Set(attachments.map(f => f.id)));
    }
  };

  const handleBulkDelete = () => {
    selectedFiles.forEach(id => onDelete(id));
    setSelectedFiles(new Set());
    setLastSelectedId(null);
    setBulkDeleteConfirm(false);
  };

  const handleBulkDownload = () => {
    // TODO: Implement bulk ZIP download — currently a stub in this legacy component
    const _selectedNames = attachments.filter(f => selectedFiles.has(f.id)).map(f => f.name).join(', ');
    console.info('[collapsible-attachments] Bulk download not yet implemented for', _selectedNames);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const isImageFile = (filename: string) => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(filename);

  const toggleExpand = () => {
    const next = !isExpanded;
    setIsExpanded(next);
    if (!next) setShowAll(false);
  };

  const startRename = (file: FileAttachment) => {
    setRenamingId(file.id);
    setRenameValue(file.name);
  };

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      onRename(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

  const MAX_VISIBLE = 5;
  const visibleFiles = showAll ? attachments : attachments.slice(0, MAX_VISIBLE);
  const hasMore = attachments.length > MAX_VISIBLE;

  if (attachments.length === 0) return null;

  return (
    <>
      <div
        className="rounded-lg"
      >
        <div className="flex items-center justify-between mb-1.5">
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleExpand(); }}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors py-1 -my-1"
          >
            <ChevronDown size={11} className={`transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
            <Paperclip size={11} />
            <span>Attachments ({attachments.length})</span>
          </button>
          <div className="flex items-center gap-2">
            {/* Download all — hidden until ZIP download is implemented */}
            {false && attachments.length >= 2 && (
              <button
                onClick={(e) => { e.stopPropagation(); /* TODO: implement ZIP download */ void e; }}
                className="text-[11px] text-muted-foreground/30 hover:text-muted-foreground transition-colors flex items-center gap-1"
              >
                <Download size={11} />
                Download all
              </button>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-[11px] text-primary/50 hover:text-primary transition-colors"
            >
              + Add
            </button>
          </div>
        </div>

        <input ref={fileInputRef} type="file" multiple onChange={(e) => handleFileSelect(e.target.files)} className="hidden" />

        {/* Collapsed: compact preview strip */}
        {!isExpanded && (
          <div
            className="flex items-center gap-1.5 cursor-pointer"
            onClick={() => setIsExpanded(true)}
          >
            {attachments.slice(0, 5).map((file) => (
              <Tooltip key={file.id}>
                <TooltipTrigger asChild>
                  <div className="w-8 h-8 rounded bg-muted/20 border border-border/20 flex items-center justify-center flex-shrink-0">
                    {isImageFile(file.name)
                      ? <Image size={14} className="text-primary/60" />
                      : <FileText size={14} className="text-muted-foreground/30" />
                    }
                  </div>
                </TooltipTrigger>
                <TooltipContent>{file.name}</TooltipContent>
              </Tooltip>
            ))}
            {attachments.length > 5 && (
              <span className="text-[10px] text-muted-foreground/30 ml-0.5">+{attachments.length - 5}</span>
            )}
          </div>
        )}

        {/* Expanded: compact list */}
        {isExpanded && (
          <div className="space-y-0.5 relative">
            {/* Select all checkbox - appears in header when any selected */}
            {selectedFiles.size > 0 && (
              <div className="flex items-center gap-2 py-1 px-1.5 mb-1 -mx-1">
                <button
                  onClick={handleSelectAll}
                  className="w-4 h-4 rounded border border-border/20 flex items-center justify-center bg-primary border-primary hover:bg-primary/80 transition-colors"
                >
                  <Check size={12} className="text-primary-foreground" />
                </button>
                <span className="text-[11px] text-muted-foreground/60">
                  {selectedFiles.size === attachments.length ? 'Deselect all' : `${selectedFiles.size} selected`}
                </span>
              </div>
            )}
            
            {visibleFiles.map((file) => {
              const isSelected = selectedFiles.has(file.id);
              return (
                <div 
                  key={file.id} 
                  className={`flex items-center gap-2 py-1 px-1.5 rounded hover:bg-muted/30 group transition-colors -mx-1 ${isSelected ? 'bg-primary/5' : ''}`}
                >
                  {/* Checkbox - visible on hover or when any file selected */}
                  <button
                    onClick={(e) => handleCheckboxClick(file.id, e)}
                    className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-primary border-primary opacity-100' 
                        : 'border-border/20 opacity-30 group-hover:opacity-100 group-hover:border-border/20 hover:!border-primary hover:!opacity-100'
                    } ${selectedFiles.size > 0 ? '!opacity-100 !border-primary' : ''}`}
                  >
                    {isSelected && <Check size={10} className="text-primary-foreground" />}
                  </button>
                  
                  <div className="w-6 h-6 rounded bg-muted/20 flex items-center justify-center flex-shrink-0">
                    {isImageFile(file.name)
                      ? <Image size={14} className="text-primary/60" />
                      : <FileText size={14} className="text-muted-foreground/30" />
                    }
                  </div>

                  {renamingId === file.id ? (
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingId(null); }}
                      className="flex-1 text-[12px] bg-muted/40 border border-primary/30 rounded px-1.5 py-0.5 outline-none min-w-0"
                      autoFocus
                    />
                  ) : (
                    <span
                      className="flex-1 text-[12px] text-foreground/70 truncate min-w-0 cursor-pointer"
                      onDoubleClick={() => startRename(file)}
                    >
                      {file.name}
                    </span>
                  )}

                  <span className="text-[10px] text-muted-foreground/30 flex-shrink-0">{file.size}</span>

                  <div className={`flex items-center gap-0.5 transition-opacity flex-shrink-0 ${selectedFiles.size > 0 ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'}`}>
                    <Tooltip><TooltipTrigger asChild>
                      <button onClick={() => startRename(file)} className="p-1 rounded hover:bg-muted/40 text-muted-foreground/30 hover:text-muted-foreground transition-colors"><Pencil size={12} /></button>
                    </TooltipTrigger><TooltipContent side="top">Rename</TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild>
                      {/* TODO: Implement file preview — alert() removed, use a proper viewer */}
                      <button onClick={() => console.info('[collapsible-attachments] Preview not yet implemented for', file.name)} className="p-1 rounded hover:bg-muted/40 text-muted-foreground/30 hover:text-muted-foreground transition-colors"><Eye size={12} /></button>
                    </TooltipTrigger><TooltipContent side="top">View</TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild>
                      {/* TODO: Implement individual file download — alert() removed */}
                      <button onClick={() => console.info('[collapsible-attachments] Download not yet implemented for', file.name)} className="p-1 rounded hover:bg-muted/40 text-muted-foreground/30 hover:text-muted-foreground transition-colors"><Download size={12} /></button>
                    </TooltipTrigger><TooltipContent side="top">Download</TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild>
                      <button onClick={() => setDeleteConfirmId(file.id)} className="p-1 rounded text-destructive/40 hover:text-destructive hover:bg-destructive/10 transition-colors"><Trash2 size={12} /></button>
                    </TooltipTrigger><TooltipContent side="top">Delete</TooltipContent></Tooltip>
                  </div>
                </div>
              );
            })}
            {hasMore && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="text-[12px] text-primary/60 hover:text-primary transition-colors mt-2 ml-1"
              >
                {showAll ? 'Show less' : `Show all (${attachments.length})`}
              </button>
            )}
            
            {/* Floating action bar */}
            {selectedFiles.size > 0 && (
              <div className="mt-2 bg-card border border-border/20 rounded-lg shadow-lg px-3 py-2 flex items-center gap-3 animate-in slide-in-from-bottom duration-200">
                <span className="text-[12px] text-foreground/70 font-medium">
                  {selectedFiles.size} selected
                </span>
                <div className="flex-1" />
                <button
                  onClick={handleBulkDownload}
                  className="text-[12px] text-primary/70 hover:text-primary transition-colors flex items-center gap-1"
                >
                  <Download size={12} />
                  Download
                </button>
                <button
                  onClick={() => setBulkDeleteConfirm(true)}
                  className="text-[12px] text-destructive/70 hover:text-destructive transition-colors flex items-center gap-1"
                >
                  <Trash2 size={12} />
                  Delete
                </button>
                <button
                  onClick={() => { setSelectedFiles(new Set()); setLastSelectedId(null); }}
                  className="text-[12px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
        )}

      </div>

      <ConfirmDeleteDialog
        open={deleteConfirmId !== null}
        onCancel={() => setDeleteConfirmId(null)}
        onConfirm={() => { if (deleteConfirmId) { onDelete(deleteConfirmId); setDeleteConfirmId(null); } }}
        title="Delete attachment"
        description="This file will be permanently removed. This action cannot be undone."
      />
      
      <ConfirmDeleteDialog
        open={bulkDeleteConfirm}
        onCancel={() => setBulkDeleteConfirm(false)}
        onConfirm={handleBulkDelete}
        title={`Delete ${selectedFiles.size} attachment${selectedFiles.size > 1 ? 's' : ''}`}
        description="These files will be permanently removed. This action cannot be undone."
      />
    </>
  );
}
