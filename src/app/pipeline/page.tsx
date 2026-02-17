'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { Plus, Search, X, Phone, Mail, Building2, TrendingUp, ChevronDown, Check, BarChart3, Table2, Kanban, DollarSign, Percent, Trophy } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { SERVICE_STYLES, PIPELINE_STAGES, LOSS_REASONS } from '@/lib/constants';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

// ── Types ────────────────────────────────────────────────────────────────────
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
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  lost_reason: string | null;
  lost_reason_custom: string | null;
  won_at: string | null;
  lost_at: string | null;
  created_at: string;
  updated_at: string;
}

type ViewMode = 'pipeline' | 'table' | 'stats';

// ── Main Component ───────────────────────────────────────────────────────────
export default function PipelinePage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('pipeline');
  const [editingProspect, setEditingProspect] = useState<Prospect | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [lossModalProspect, setLossModalProspect] = useState<string | null>(null);
  const [lossReason, setLossReason] = useState('');
  const [lossReasonCustom, setLossReasonCustom] = useState('');

  // New prospect form
  const [filterService, setFilterService] = useState<string[]>([]);

  const [formName, setFormName] = useState('');
  const [formCompany, setFormCompany] = useState('');
  const [formContactName, setFormContactName] = useState('');
  const [formContactEmail, setFormContactEmail] = useState('');
  const [formContactPhone, setFormContactPhone] = useState('');
  const [formValue, setFormValue] = useState('');
  const [formService, setFormService] = useState('');
  const [formSource, setFormSource] = useState('');
  const [formStage, setFormStage] = useState('lead');
  const [creating, setCreating] = useState(false);

  const fetchProspects = useCallback(async () => {
    try {
      const res = await fetch('/api/prospects');
      if (res.ok) setProspects(await res.json());
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProspects(); }, [fetchProspects]);

  const filtered = useMemo(() => {
    return prospects.filter(p => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!p.name.toLowerCase().includes(q) &&
            !p.company?.toLowerCase().includes(q) &&
            !p.contact_name?.toLowerCase().includes(q) &&
            !p.contact_email?.toLowerCase().includes(q)) return false;
      }
      if (filterService.length > 0 && (!p.service || !filterService.includes(p.service))) return false;
      return true;
    });
  }, [prospects, searchQuery, filterService]);

  const hasFilters = filterService.length > 0 || searchQuery !== '';

  const resetForm = () => {
    setFormName(''); setFormCompany(''); setFormContactName('');
    setFormContactEmail(''); setFormContactPhone(''); setFormValue('');
    setFormService(''); setFormSource(''); setFormStage('lead');
  };

  const createProspect = async () => {
    if (!formName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/prospects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          company: formCompany.trim() || null,
          contact_name: formContactName.trim() || null,
          contact_email: formContactEmail.trim() || null,
          contact_phone: formContactPhone.trim() || null,
          value: formValue ? parseFloat(formValue) : null,
          service: formService || null,
          source: formSource.trim() || null,
          stage: formStage,
        }),
      });
      if (!res.ok) { toast.error('Failed to create prospect'); return; }
      toast.success('Prospect added');
      resetForm();
      setShowNewForm(false);
      fetchProspects();
    } catch { toast.error('Failed to create prospect'); }
    finally { setCreating(false); }
  };

  const updateProspect = async (id: string, updates: Partial<Prospect>) => {
    const prev = prospects.find(p => p.id === id);
    setProspects(ps => ps.map(p => p.id === id ? { ...p, ...updates } : p));

    // Confetti on won!
    if (updates.stage === 'won' && prev?.stage !== 'won') {
      updates.won_at = new Date().toISOString();
      setTimeout(() => {
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      }, 200);
      toast.success('🎉 Deal won!');
    }

    // Show loss reason modal
    if (updates.stage === 'lost' && prev?.stage !== 'lost') {
      setLossModalProspect(id);
    }

    try {
      const res = await fetch('/api/prospects', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      });
      if (!res.ok) { toast.error('Failed to update'); fetchProspects(); }
    } catch { toast.error('Failed to update'); fetchProspects(); }
  };

  const submitLossReason = async () => {
    if (!lossModalProspect) return;
    await updateProspect(lossModalProspect, {
      lost_reason: lossReason || null,
      lost_reason_custom: lossReason === 'other' ? lossReasonCustom : null,
      lost_at: new Date().toISOString(),
    });
    setLossModalProspect(null);
    setLossReason('');
    setLossReasonCustom('');
    toast('Deal marked as lost');
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
    if (newStage !== 'won' && newStage !== 'lost') {
      const stageLabel = PIPELINE_STAGES.find(s => s.id === newStage)?.label || newStage;
      toast.success(`Moved to ${stageLabel}`);
    }
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = prospects.length;
    const won = prospects.filter(p => p.stage === 'won');
    const lost = prospects.filter(p => p.stage === 'lost');
    const active = prospects.filter(p => !['won', 'lost'].includes(p.stage));
    const pipelineValue = active.reduce((s, p) => s + (p.value || 0), 0);
    const wonValue = won.reduce((s, p) => s + (p.value || 0), 0);
    const conversionRate = total > 0 ? Math.round((won.length / total) * 100) : 0;
    const avgDealValue = won.length > 0 ? Math.round(wonValue / won.length) : 0;

    // Loss reasons breakdown
    const lossReasons: Record<string, number> = {};
    lost.forEach(p => {
      const reason = p.lost_reason || 'unspecified';
      lossReasons[reason] = (lossReasons[reason] || 0) + 1;
    });

    // Stage distribution
    const stageCount: Record<string, number> = {};
    PIPELINE_STAGES.forEach(s => { stageCount[s.id] = prospects.filter(p => p.stage === s.id).length; });

    // Value by stage
    const stageValue: Record<string, number> = {};
    PIPELINE_STAGES.forEach(s => {
      stageValue[s.id] = prospects.filter(p => p.stage === s.id).reduce((sum, p) => sum + (p.value || 0), 0);
    });

    return { total, won: won.length, lost: lost.length, active: active.length, pipelineValue, wonValue, conversionRate, avgDealValue, lossReasons, stageCount, stageValue };
  }, [prospects]);

  // ── Shared Header ──────────────────────────────────────────────────────────
  const viewButtons: { mode: ViewMode; icon: typeof Kanban; label: string }[] = [
    { mode: 'pipeline', icon: Kanban, label: 'Pipeline' },
    { mode: 'table', icon: Table2, label: 'Table' },
    { mode: 'stats', icon: BarChart3, label: 'Stats' },
  ];

  return (
    <div className="animate-in fade-in duration-200">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Sales Pipeline</h1>
        <p className="text-[13px] text-muted-foreground/60 mt-1">
          {prospects.length} prospects · £{stats.pipelineValue.toLocaleString()} pipeline · £{stats.wonValue.toLocaleString()} won
        </p>
      </div>

      {/* Toolbar */}
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

        {/* Service filter */}
        <Popover>
          <PopoverTrigger asChild>
            <button className={`h-8 px-3 text-[13px] bg-secondary border rounded-lg hover:border-primary/50 transition-colors duration-150 flex items-center gap-1.5 ${
              filterService.length > 0 ? 'border-primary text-primary' : 'border-border/20 text-muted-foreground'
            }`}>
              {filterService.length > 0 ? `Service (${filterService.length})` : 'Service'}
              <ChevronDown size={12} className="text-muted-foreground/40" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1" align="start">
            {Object.entries(SERVICE_STYLES).map(([key, s]) => {
              const isSelected = filterService.includes(key);
              return (
                <button
                  key={key}
                  onClick={() => setFilterService(prev => isSelected ? prev.filter(v => v !== key) : [...prev, key])}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[13px] transition-colors duration-150 ${
                    isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted/60 text-muted-foreground'
                  }`}
                >
                  <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                    isSelected ? 'border-primary bg-primary' : 'border-border/40'
                  }`}>
                    {isSelected && <Check size={10} className="text-primary-foreground" />}
                  </div>
                  <span className="flex-1 text-left">{s.icon} {s.label}</span>
                </button>
              );
            })}
            {filterService.length > 0 && (
              <button onClick={() => setFilterService([])} className="w-full mt-1 pt-1 border-t border-border/10 px-2 py-1.5 rounded text-[13px] text-muted-foreground/60 hover:text-foreground transition-colors duration-150 text-left">Clear</button>
            )}
          </PopoverContent>
        </Popover>

        {hasFilters && (
          <button
            onClick={() => { setFilterService([]); setSearchQuery(''); }}
            className="h-8 px-3 text-[13px] rounded-lg border border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors duration-150 flex items-center gap-1.5"
          >
            <X className="h-3 w-3" /> Clear all
          </button>
        )}

        {/* View toggle */}
        <div className="flex items-center rounded-lg border border-border/20 bg-secondary p-0.5">
          {viewButtons.map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] font-medium transition-all duration-150 ${
                viewMode === mode
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1" />
        <Button size="sm" onClick={() => setShowNewForm(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Prospect
        </Button>
      </div>

      {/* New Prospect Form */}
      {showNewForm && (
        <div className="mb-6 p-4 rounded-lg border border-primary/30 bg-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-semibold">New Prospect</h3>
            <button onClick={() => { setShowNewForm(false); resetForm(); }} className="text-muted-foreground hover:text-foreground transition-colors duration-150">
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input autoFocus value={formName} onChange={e => setFormName(e.target.value)} placeholder="Company / Deal name *" className="h-8 px-3 text-[13px] bg-secondary border border-border/20 rounded-lg outline-none focus:border-primary/50 transition-colors duration-150" />
            <input value={formCompany} onChange={e => setFormCompany(e.target.value)} placeholder="Company" className="h-8 px-3 text-[13px] bg-secondary border border-border/20 rounded-lg outline-none focus:border-primary/50 transition-colors duration-150" />
            <input value={formContactName} onChange={e => setFormContactName(e.target.value)} placeholder="Contact name" className="h-8 px-3 text-[13px] bg-secondary border border-border/20 rounded-lg outline-none focus:border-primary/50 transition-colors duration-150" />
            <input value={formContactEmail} onChange={e => setFormContactEmail(e.target.value)} placeholder="Contact email" type="email" className="h-8 px-3 text-[13px] bg-secondary border border-border/20 rounded-lg outline-none focus:border-primary/50 transition-colors duration-150" />
            <input value={formContactPhone} onChange={e => setFormContactPhone(e.target.value)} placeholder="Contact phone" type="tel" className="h-8 px-3 text-[13px] bg-secondary border border-border/20 rounded-lg outline-none focus:border-primary/50 transition-colors duration-150" />
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">£</span>
              <input value={formValue} onChange={e => setFormValue(e.target.value)} placeholder="Deal value" type="number" className="h-8 w-full pl-7 pr-3 text-[13px] bg-secondary border border-border/20 rounded-lg outline-none focus:border-primary/50 transition-colors duration-150" />
            </div>
            <select value={formService} onChange={e => setFormService(e.target.value)} className="h-8 px-2 text-[13px] bg-secondary border border-border/20 rounded-lg outline-none">
              <option value="">Service...</option>
              {Object.entries(SERVICE_STYLES).map(([key, s]) => (
                <option key={key} value={key}>{s.icon} {s.label}</option>
              ))}
            </select>
            <input value={formSource} onChange={e => setFormSource(e.target.value)} placeholder="Source (e.g. Referral, LinkedIn)" className="h-8 px-3 text-[13px] bg-secondary border border-border/20 rounded-lg outline-none focus:border-primary/50 transition-colors duration-150" />
          </div>
          <div className="flex items-center gap-3 mt-3">
            <select value={formStage} onChange={e => setFormStage(e.target.value)} className="h-8 px-2 text-[13px] bg-secondary border border-border/20 rounded-lg outline-none">
              {PIPELINE_STAGES.filter(s => s.id !== 'won' && s.id !== 'lost').map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            <div className="flex-1" />
            <Button size="sm" variant="ghost" onClick={() => { setShowNewForm(false); resetForm(); }}>Cancel</Button>
            <Button size="sm" onClick={createProspect} disabled={creating || !formName.trim()}>
              {creating ? 'Adding...' : 'Add Prospect'}
            </Button>
          </div>
        </div>
      )}

      {/* Loss Reason Modal */}
      {lossModalProspect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in duration-150">
          <div className="w-full max-w-md p-6 rounded-xl border border-border/20 bg-card shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold mb-1">Why was this deal lost?</h3>
            <p className="text-[13px] text-muted-foreground/60 mb-4">This helps track patterns and improve conversion.</p>
            <div className="space-y-2 mb-4">
              {LOSS_REASONS.map(r => (
                <button
                  key={r.id}
                  onClick={() => setLossReason(r.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-[13px] border transition-colors duration-150 ${
                    lossReason === r.id
                      ? 'border-primary/50 bg-primary/10 text-foreground'
                      : 'border-border/20 bg-secondary hover:border-primary/30'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {lossReason === 'other' && (
              <input
                autoFocus
                value={lossReasonCustom}
                onChange={e => setLossReasonCustom(e.target.value)}
                placeholder="Describe the reason..."
                className="w-full h-8 px-3 mb-4 text-[13px] bg-secondary border border-border/20 rounded-lg outline-none focus:border-primary/50 transition-colors duration-150"
              />
            )}
            <div className="flex items-center justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setLossModalProspect(null); setLossReason(''); setLossReasonCustom(''); }}>Skip</Button>
              <Button size="sm" onClick={submitLossReason}>Save Reason</Button>
            </div>
          </div>
        </div>
      )}

      {/* Views */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[300px] rounded-lg bg-muted/20 animate-pulse" />
          ))}
        </div>
      ) : viewMode === 'pipeline' ? (
        <PipelineView prospects={filtered} onDragEnd={onDragEnd} onUpdate={updateProspect} onDelete={deleteProspect} setShowNewForm={setShowNewForm} setFormStage={setFormStage} onEdit={setEditingProspect} />
      ) : viewMode === 'table' ? (
        <TableView prospects={filtered} onUpdate={updateProspect} onDelete={deleteProspect} onEdit={setEditingProspect} />
      ) : (
        <StatsView stats={stats} prospects={prospects} />
      )}

      {/* Prospect Detail Sheet */}
      {editingProspect && (
        <ProspectSheet
          prospect={editingProspect}
          onClose={() => setEditingProspect(null)}
          onUpdate={(updates) => {
            updateProspect(editingProspect.id, updates);
            setEditingProspect(prev => prev ? { ...prev, ...updates } : null);
          }}
          onDelete={() => { deleteProspect(editingProspect.id); setEditingProspect(null); }}
        />
      )}
    </div>
  );
}

// ── Pipeline (Kanban) View ───────────────────────────────────────────────────
function PipelineView({ prospects, onDragEnd, onUpdate, onDelete, setShowNewForm, setFormStage, onEdit }: {
  prospects: Prospect[];
  onDragEnd: (result: DropResult) => void;
  onUpdate: (id: string, updates: Partial<Prospect>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  setShowNewForm: (v: boolean) => void;
  setFormStage: (s: string) => void;
  onEdit: (p: Prospect) => void;
}) {
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '60vh' }}>
        {PIPELINE_STAGES.map(stage => {
          const columnProspects = prospects.filter(p => p.stage === stage.id);
          const columnValue = columnProspects.reduce((sum, p) => sum + (p.value || 0), 0);

          return (
            <div key={stage.id} className="flex-shrink-0 w-[280px]">
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className={`w-2 h-2 rounded-full ${stage.dotClass}`} />
                <span className="text-[13px] font-semibold">{stage.label}</span>
                <span className="text-[11px] text-muted-foreground/60 ml-auto">
                  {columnProspects.length}{columnValue > 0 ? ` · £${columnValue.toLocaleString()}` : ''}
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
                            onClick={() => onEdit(prospect)}
                            className={`mb-2 p-3 rounded-lg border border-border/20 bg-card hover:bg-muted/40 transition-all duration-150 cursor-pointer ${
                              snapshot.isDragging ? 'shadow-lg ring-1 ring-primary/30' : ''
                            }`}
                          >
                            <div className="flex items-start justify-between mb-1.5">
                              <h3 className="text-[13px] font-semibold truncate mr-2">{prospect.name}</h3>
                              {prospect.value != null && prospect.value > 0 && (
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
                            {prospect.contact_name && (
                              <div className="text-[11px] text-muted-foreground/60 mb-1">{prospect.contact_name}</div>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              {prospect.service && SERVICE_STYLES[prospect.service] && (
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${SERVICE_STYLES[prospect.service].bg} ${SERVICE_STYLES[prospect.service].text}`}>
                                  {SERVICE_STYLES[prospect.service].label}
                                </span>
                              )}
                              {prospect.contact_email && <Mail size={10} className="text-muted-foreground/40" />}
                              {prospect.contact_phone && <Phone size={10} className="text-muted-foreground/40" />}
                              {prospect.source && (
                                <span className="text-[10px] text-muted-foreground/40 ml-auto">{prospect.source}</span>
                              )}
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    <button
                      onClick={() => { setFormStage(stage.id); setShowNewForm(true); }}
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
  );
}

// ── Table View ───────────────────────────────────────────────────────────────
function TableView({ prospects, onUpdate, onDelete, onEdit }: {
  prospects: Prospect[];
  onUpdate: (id: string, updates: Partial<Prospect>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onEdit: (p: Prospect) => void;
}) {
  return (
    <div className="rounded-lg border border-border/20 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/20 bg-muted/30">
              {['Name', 'Company', 'Contact', 'Stage', 'Value', 'Service', 'Source', 'Created'].map(h => (
                <th key={h} className="text-left text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider px-3 py-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {prospects.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-[13px] text-muted-foreground/40">No prospects yet</td></tr>
            ) : prospects.map(p => {
              const stage = PIPELINE_STAGES.find(s => s.id === p.stage);
              return (
                <tr key={p.id} onClick={() => onEdit(p)} className="border-b border-border/10 hover:bg-muted/20 transition-colors duration-150 cursor-pointer">
                  <td className="px-3 py-2.5 text-[13px] font-medium">{p.name}</td>
                  <td className="px-3 py-2.5 text-[13px] text-muted-foreground">{p.company || '—'}</td>
                  <td className="px-3 py-2.5">
                    <div className="text-[13px]">{p.contact_name || '—'}</div>
                    {p.contact_email && <div className="text-[11px] text-muted-foreground/60">{p.contact_email}</div>}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      p.stage === 'won' ? 'bg-emerald-500/10 text-emerald-400' :
                      p.stage === 'lost' ? 'bg-red-500/10 text-red-400' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${stage?.dotClass || 'bg-muted-foreground'}`} />
                      {stage?.label || p.stage}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-[13px] font-medium">{p.value ? `£${p.value.toLocaleString()}` : '—'}</td>
                  <td className="px-3 py-2.5">
                    {p.service && SERVICE_STYLES[p.service] ? (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${SERVICE_STYLES[p.service].bg} ${SERVICE_STYLES[p.service].text}`}>
                        {SERVICE_STYLES[p.service].label}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-[13px] text-muted-foreground/60">{p.source || '—'}</td>
                  <td className="px-3 py-2.5 text-[11px] text-muted-foreground/40">
                    {new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Stats View ───────────────────────────────────────────────────────────────
function StatsView({ stats, prospects }: { stats: ReturnType<typeof Object>; prospects: Prospect[] }) {
  const s = stats as {
    total: number; won: number; lost: number; active: number;
    pipelineValue: number; wonValue: number; conversionRate: number; avgDealValue: number;
    lossReasons: Record<string, number>; stageCount: Record<string, number>; stageValue: Record<string, number>;
  };

  const maxStageCount = Math.max(...Object.values(s.stageCount), 1);
  const maxStageValue = Math.max(...Object.values(s.stageValue), 1);
  const totalLost = Object.values(s.lossReasons).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Pipeline Value', value: `£${s.pipelineValue.toLocaleString()}`, icon: DollarSign, color: 'text-primary' },
          { label: 'Won Revenue', value: `£${s.wonValue.toLocaleString()}`, icon: Trophy, color: 'text-emerald-400' },
          { label: 'Conversion Rate', value: `${s.conversionRate}%`, icon: Percent, color: 'text-amber-400' },
          { label: 'Avg Deal Value', value: `£${s.avgDealValue.toLocaleString()}`, icon: TrendingUp, color: 'text-blue-400' },
        ].map(kpi => (
          <div key={kpi.label} className="p-4 rounded-lg border border-border/20 bg-card">
            <div className="flex items-center gap-2 mb-2">
              <kpi.icon size={14} className={`${kpi.color}`} />
              <span className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">{kpi.label}</span>
            </div>
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Stage Funnel + Loss Reasons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Pipeline Funnel */}
        <div className="p-4 rounded-lg border border-border/20 bg-card">
          <h3 className="text-[13px] font-semibold mb-4">Pipeline Funnel</h3>
          <div className="space-y-3">
            {PIPELINE_STAGES.map(stage => {
              const count = s.stageCount[stage.id] || 0;
              const value = s.stageValue[stage.id] || 0;
              const widthPercent = Math.max((count / maxStageCount) * 100, 4);
              return (
                <div key={stage.id}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${stage.dotClass}`} />
                      <span className="text-[13px] font-medium">{stage.label}</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground/60">{count} · £{value.toLocaleString()}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${stage.dotClass} opacity-80 transition-all duration-500`}
                      style={{ width: `${widthPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Loss Reasons */}
        <div className="p-4 rounded-lg border border-border/20 bg-card">
          <h3 className="text-[13px] font-semibold mb-4">Loss Reasons</h3>
          {Object.keys(s.lossReasons).length === 0 ? (
            <div className="flex items-center justify-center h-[200px] text-[13px] text-muted-foreground/40">
              No lost deals yet — keep winning! 🏆
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(s.lossReasons)
                .sort(([, a], [, b]) => b - a)
                .map(([reason, count]) => {
                  const label = LOSS_REASONS.find(r => r.id === reason)?.label || reason;
                  const pct = Math.round((count / totalLost) * 100);
                  return (
                    <div key={reason}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[13px]">{label}</span>
                        <span className="text-[11px] text-muted-foreground/60">{count} ({pct}%)</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                        <div className="h-full rounded-full bg-red-400/60 transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* Value by Stage */}
      <div className="p-4 rounded-lg border border-border/20 bg-card">
        <h3 className="text-[13px] font-semibold mb-4">Value by Stage</h3>
        <div className="flex items-end gap-3 h-[200px]">
          {PIPELINE_STAGES.map(stage => {
            const value = s.stageValue[stage.id] || 0;
            const heightPercent = Math.max((value / maxStageValue) * 100, 2);
            return (
              <div key={stage.id} className="flex-1 flex flex-col items-center justify-end h-full">
                <span className="text-[10px] text-muted-foreground/60 mb-1">
                  {value > 0 ? `£${(value / 1000).toFixed(value >= 1000 ? 0 : 1)}k` : '£0'}
                </span>
                <div
                  className={`w-full rounded-t-lg ${stage.dotClass} opacity-70 transition-all duration-500`}
                  style={{ height: `${heightPercent}%` }}
                />
                <span className="text-[10px] text-muted-foreground/60 mt-2">{stage.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Prospect Detail Sheet ────────────────────────────────────────────────────
function ProspectSheet({ prospect, onClose, onUpdate, onDelete }: {
  prospect: Prospect;
  onClose: () => void;
  onUpdate: (updates: Partial<Prospect>) => void;
  onDelete: () => void;
}) {
  const [notes, setNotes] = useState(prospect.notes || '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50 animate-in fade-in duration-150" onClick={onClose} />

      {/* Sheet */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-card border-l border-border/20 shadow-2xl animate-in slide-in-from-right duration-200 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/10">
          <h2 className="text-lg font-semibold truncate">{prospect.name}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors duration-150">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Stage */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-1.5 block">Stage</label>
            <div className="flex flex-wrap gap-1.5">
              {PIPELINE_STAGES.map(s => (
                <button
                  key={s.id}
                  onClick={() => onUpdate({ stage: s.id })}
                  className={`px-2.5 py-1 rounded-lg text-[13px] font-medium border transition-colors duration-150 ${
                    prospect.stage === s.id
                      ? `${s.dotClass.replace('bg-', 'bg-').replace('-400', '-500/20')} border-current`
                      : 'border-border/20 bg-secondary hover:border-primary/30'
                  }`}
                >
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${s.dotClass} mr-1.5`} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Company', value: prospect.company, field: 'company', icon: Building2 },
              { label: 'Contact', value: prospect.contact_name, field: 'contact_name' },
              { label: 'Email', value: prospect.contact_email, field: 'contact_email', icon: Mail },
              { label: 'Phone', value: prospect.contact_phone, field: 'contact_phone', icon: Phone },
            ].map(f => (
              <div key={f.field}>
                <label className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-1 block">{f.label}</label>
                <input
                  defaultValue={f.value || ''}
                  onBlur={e => { if (e.target.value !== (f.value || '')) onUpdate({ [f.field]: e.target.value || null }); }}
                  placeholder={`Add ${f.label.toLowerCase()}...`}
                  className="w-full h-8 px-3 text-[13px] bg-secondary border border-border/20 rounded-lg outline-none focus:border-primary/50 transition-colors duration-150"
                />
              </div>
            ))}
          </div>

          {/* Value */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-1 block">Deal Value</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">£</span>
              <input
                type="number"
                defaultValue={prospect.value || ''}
                onBlur={e => { const v = parseFloat(e.target.value); onUpdate({ value: isNaN(v) ? null : v }); }}
                placeholder="0"
                className="w-full h-8 pl-7 pr-3 text-[13px] bg-secondary border border-border/20 rounded-lg outline-none focus:border-primary/50 transition-colors duration-150"
              />
            </div>
          </div>

          {/* Service */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-1.5 block">Service</label>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(SERVICE_STYLES).map(([key, s]) => (
                <button
                  key={key}
                  onClick={() => onUpdate({ service: prospect.service === key ? null : key })}
                  className={`px-2.5 py-1 rounded-lg text-[13px] border transition-colors duration-150 ${
                    prospect.service === key
                      ? `${s.bg} ${s.text} border-current`
                      : 'border-border/20 bg-secondary hover:border-primary/30'
                  }`}
                >
                  {s.icon} {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Source */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-1 block">Source</label>
            <input
              defaultValue={prospect.source || ''}
              onBlur={e => { if (e.target.value !== (prospect.source || '')) onUpdate({ source: e.target.value || null }); }}
              placeholder="e.g. Referral, LinkedIn, Website..."
              className="w-full h-8 px-3 text-[13px] bg-secondary border border-border/20 rounded-lg outline-none focus:border-primary/50 transition-colors duration-150"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-1 block">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onBlur={() => { if (notes !== (prospect.notes || '')) onUpdate({ notes: notes || null }); }}
              placeholder="Add notes about this prospect..."
              rows={4}
              className="w-full px-3 py-2 text-[13px] bg-secondary border border-border/20 rounded-lg outline-none focus:border-primary/50 transition-colors duration-150 resize-none"
            />
          </div>

          {/* Loss reason (if lost) */}
          {prospect.stage === 'lost' && prospect.lost_reason && (
            <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10">
              <span className="text-[11px] font-medium text-red-400 uppercase tracking-wider">Lost Reason</span>
              <p className="text-[13px] mt-1">
                {LOSS_REASONS.find(r => r.id === prospect.lost_reason)?.label || prospect.lost_reason}
                {prospect.lost_reason_custom && ` — ${prospect.lost_reason_custom}`}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border/10 flex items-center justify-between">
          <div className="text-[11px] text-muted-foreground/40">
            Created {new Date(prospect.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-destructive">Delete?</span>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              <Button size="sm" variant="destructive" onClick={onDelete}>Delete</Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>Delete</Button>
          )}
        </div>
      </div>
    </>
  );
}
