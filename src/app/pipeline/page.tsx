'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { Plus, Search, X, Phone, Mail, Building2, ChevronDown, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { SERVICE_STYLES, ASSIGNEE_COLORS } from '@/lib/constants';
import { toast } from 'sonner';

interface Prospect {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  stage: string;
  value: number | null;
  notes: string | null;
  service: string | null;
  assignee: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
}

const STAGES = [
  { id: 'lead', label: 'Lead', color: 'var(--status-warning)', dotClass: 'bg-amber-400' },
  { id: 'contacted', label: 'Contacted', color: '#60a5fa', dotClass: 'bg-blue-400' },
  { id: 'proposal', label: 'Proposal', color: '#a78bfa', dotClass: 'bg-purple-400' },
  { id: 'negotiation', label: 'Negotiation', color: '#f97316', dotClass: 'bg-orange-400' },
  { id: 'won', label: 'Won', color: 'var(--status-success)', dotClass: 'bg-emerald-400' },
  { id: 'lost', label: 'Lost', color: '#ef4444', dotClass: 'bg-red-400' },
];

export default function PipelinePage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewProspect, setShowNewProspect] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [newStage, setNewStage] = useState('lead');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Prospect>>({});

  const fetchProspects = useCallback(async () => {
    try {
      const res = await fetch('/api/prospects');
      if (res.ok) setProspects(await res.json());
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProspects(); }, [fetchProspects]);

  const filtered = useMemo(() => {
    if (!searchQuery) return prospects;
    const q = searchQuery.toLowerCase();
    return prospects.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.company?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q)
    );
  }, [prospects, searchQuery]);

  const createProspect = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/prospects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), company: newCompany.trim() || null, stage: newStage }),
      });
      if (!res.ok) { toast.error('Failed to create prospect'); return; }
      toast.success('Prospect added');
      setNewName(''); setNewCompany(''); setShowNewProspect(false);
      fetchProspects();
    } catch { toast.error('Failed to create prospect'); }
    finally { setCreating(false); }
  };

  const updateProspect = async (id: string, updates: Partial<Prospect>) => {
    setProspects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    try {
      const res = await fetch('/api/prospects', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      });
      if (!res.ok) { toast.error('Failed to update'); fetchProspects(); }
    } catch { toast.error('Failed to update'); fetchProspects(); }
  };

  const deleteProspect = async (id: string) => {
    setProspects(prev => prev.filter(p => p.id !== id));
    try {
      const res = await fetch(`/api/prospects?id=${id}`, { method: 'DELETE' });
      if (!res.ok) { toast.error('Failed to delete'); fetchProspects(); return; }
      toast.success('Prospect deleted');
    } catch { toast.error('Failed to delete'); fetchProspects(); }
  };

  const onDragEnd = (result: DropResult) => {
    const { draggableId, destination } = result;
    if (!destination) return;
    const newStage = destination.droppableId;
    updateProspect(draggableId, { stage: newStage });
    const stageLabel = STAGES.find(s => s.id === newStage)?.label || newStage;
    toast.success(`Moved to ${stageLabel}`);
  };

  const getColumnProspects = (stageId: string) =>
    filtered.filter(p => p.stage === stageId);

  // Pipeline totals
  const totalValue = prospects.filter(p => p.stage !== 'lost').reduce((sum, p) => sum + (p.value || 0), 0);
  const wonValue = prospects.filter(p => p.stage === 'won').reduce((sum, p) => sum + (p.value || 0), 0);

  return (
    <div className="animate-in fade-in duration-200">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales Pipeline</h1>
          <p className="text-[13px] text-muted-foreground/60 mt-1">
            {prospects.length} prospects · £{totalValue.toLocaleString()} pipeline · £{wonValue.toLocaleString()} won
          </p>
        </div>
      </div>

      {/* Filters + New */}
      <div className="mb-6 flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="h-8 w-full sm:w-[180px] pl-8 pr-3 text-[13px] bg-secondary border border-border/20 rounded-lg outline-none focus:border-primary/50 transition-colors duration-150 placeholder:text-muted-foreground/60"
          />
        </div>
        <div className="flex-1" />
        <Button size="sm" onClick={() => setShowNewProspect(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Prospect
        </Button>
      </div>

      {/* New prospect inline form */}
      {showNewProspect && (
        <div className="mb-4 p-3 rounded-lg border border-primary/30 bg-card flex items-center gap-3">
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createProspect(); if (e.key === 'Escape') setShowNewProspect(false); }}
            placeholder="Contact name..."
            className="flex-1 h-8 px-3 text-[13px] bg-secondary border border-border/20 rounded-lg outline-none focus:border-primary/50 transition-colors duration-150"
          />
          <input
            value={newCompany}
            onChange={e => setNewCompany(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createProspect(); }}
            placeholder="Company..."
            className="flex-1 h-8 px-3 text-[13px] bg-secondary border border-border/20 rounded-lg outline-none focus:border-primary/50 transition-colors duration-150"
          />
          <select
            value={newStage}
            onChange={e => setNewStage(e.target.value)}
            className="h-8 px-2 text-[13px] bg-secondary border border-border/20 rounded-lg outline-none"
          >
            {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <Button size="sm" onClick={createProspect} disabled={creating || !newName.trim()}>
            {creating ? 'Adding...' : 'Add'}
          </Button>
          <button onClick={() => setShowNewProspect(false)} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Kanban Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '60vh' }}>
          {STAGES.map(stage => {
            const columnProspects = getColumnProspects(stage.id);
            const columnValue = columnProspects.reduce((sum, p) => sum + (p.value || 0), 0);

            return (
              <div key={stage.id} className="flex-shrink-0 w-[280px]">
                {/* Column header */}
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className={`w-2 h-2 rounded-full ${stage.dotClass}`} />
                  <span className="text-[13px] font-semibold">{stage.label}</span>
                  <span className="text-[11px] text-muted-foreground/60 ml-auto">
                    {columnProspects.length} · £{columnValue.toLocaleString()}
                  </span>
                </div>

                <Droppable droppableId={stage.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-h-[200px] rounded-lg p-1.5 transition-colors duration-150 ${
                        snapshot.isDraggingOver ? 'bg-primary/5 ring-1 ring-primary/20' : 'bg-muted/20'
                      }`}
                    >
                      {columnProspects.map((prospect, index) => (
                        <Draggable key={prospect.id} draggableId={prospect.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`mb-2 p-3 rounded-lg border border-border/20 bg-card hover:bg-muted/40 transition-all duration-150 ${
                                snapshot.isDragging ? 'shadow-lg ring-1 ring-primary/30' : ''
                              }`}
                            >
                              <div className="flex items-start justify-between mb-1.5">
                                <h3 className="text-[13px] font-semibold truncate mr-2">{prospect.name}</h3>
                                {prospect.value && (
                                  <span className="text-[11px] font-medium text-emerald-400 shrink-0">
                                    £{prospect.value.toLocaleString()}
                                  </span>
                                )}
                              </div>
                              {prospect.company && (
                                <div className="flex items-center gap-1 mb-1">
                                  <Building2 size={10} className="text-muted-foreground/40" />
                                  <span className="text-[11px] text-muted-foreground truncate">{prospect.company}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-2 mt-2">
                                {prospect.service && SERVICE_STYLES[prospect.service] && (
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${SERVICE_STYLES[prospect.service].bg} ${SERVICE_STYLES[prospect.service].text}`}>
                                    {SERVICE_STYLES[prospect.service].icon} {SERVICE_STYLES[prospect.service].label}
                                  </span>
                                )}
                                {prospect.email && <Mail size={10} className="text-muted-foreground/40" />}
                                {prospect.phone && <Phone size={10} className="text-muted-foreground/40" />}
                                {prospect.source && (
                                  <span className="text-[10px] text-muted-foreground/40 ml-auto">{prospect.source}</span>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}

                      {/* Add prospect to column */}
                      <button
                        onClick={() => { setNewStage(stage.id); setShowNewProspect(true); }}
                        className="w-full mt-1 p-2 rounded-lg border border-dashed border-border/20 text-[13px] text-muted-foreground/40 hover:text-muted-foreground/60 hover:border-primary/30 hover:bg-primary/5 transition-colors duration-150 flex items-center justify-center gap-1"
                      >
                        <Plus size={12} /> Add prospect
                      </button>
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}
