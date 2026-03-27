'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Plus, Search, X, Kanban, Table2, BarChart3, Mail, Phone,
  PoundSterling, Trophy, Percent, TrendingUp,
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { FilterPopover } from '@/components/ui/filter-popover';
import { KanbanFrame } from '@/components/ui/kanban-frame';
import { usePersistedState } from '@/hooks/use-persisted-state';
import { usePipelineStages } from '@/hooks/use-pipeline-stages';
import { useUsers } from '@/hooks/use-users';
import { getServiceStyle, LOSS_REASONS } from '@/lib/constants';
import { ShortcutsDialog } from '@/components/ui/shortcuts-dialog';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';

interface Prospect {
  id: string;
  name: string;
  stage: string;
  value?: number | null;
  service?: string | null;
  source?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  assignee?: string | null;
  created_at: string;
}

type ViewMode = 'pipeline' | 'table' | 'stats';


function ProspectSheet({
  open,
  onOpenChange,
  defaultStage,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStage: string;
  onCreated: () => Promise<void> | void;
}) {
  const [form, setForm] = useState({
    name: '',
    value: '',
    service: '',
    source: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      name: '',
      value: '',
      service: '',
      source: '',
      contact_name: '',
      contact_email: '',
      contact_phone: '',
      notes: '',
    });
    setSaving(false);
  }, [open, defaultStage]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error('Prospect name required');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/prospects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          stage: defaultStage || 'lead',
          value: form.value.trim() ? Number(form.value.replace(/[^0-9.]/g, '')) : null,
          service: form.service.trim() || null,
          source: form.source.trim() || null,
          contact_name: form.contact_name.trim() || null,
          contact_email: form.contact_email.trim() || null,
          contact_phone: form.contact_phone.trim() || null,
          notes: form.notes.trim() || null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to create prospect');

      await onCreated();
      onOpenChange(false);
      toast.success('Prospect created');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create prospect');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => onOpenChange(false)}>
      <div className="w-full max-w-xl rounded-xl border border-border/20 bg-card p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold">New prospect</h3>
        <p className="mt-1 text-[13px] text-muted-foreground">Add a new prospect to the {defaultStage || 'lead'} stage.</p>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <label className="block text-[12px] text-muted-foreground mb-1">Prospect name</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Company or opportunity name"
              className="h-9 w-full rounded-lg border border-border/20 bg-background px-3 text-[13px] outline-none focus:border-primary/50"
            />
          </div>
          <div>
            <label className="block text-[12px] text-muted-foreground mb-1">Value</label>
            <input
              value={form.value}
              onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
              placeholder="e.g. 5000"
              inputMode="decimal"
              className="h-9 w-full rounded-lg border border-border/20 bg-background px-3 text-[13px] outline-none focus:border-primary/50"
            />
          </div>
          <div>
            <label className="block text-[12px] text-muted-foreground mb-1">Source</label>
            <input
              value={form.source}
              onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
              placeholder="Referral, website, etc."
              className="h-9 w-full rounded-lg border border-border/20 bg-background px-3 text-[13px] outline-none focus:border-primary/50"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-[12px] text-muted-foreground mb-1">Service</label>
            <input
              value={form.service}
              onChange={e => setForm(f => ({ ...f, service: e.target.value }))}
              placeholder="SEO, Paid Advertising, Social Media..."
              className="h-9 w-full rounded-lg border border-border/20 bg-background px-3 text-[13px] outline-none focus:border-primary/50"
            />
          </div>
          <div>
            <label className="block text-[12px] text-muted-foreground mb-1">Contact name</label>
            <input
              value={form.contact_name}
              onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
              placeholder="Primary contact"
              className="h-9 w-full rounded-lg border border-border/20 bg-background px-3 text-[13px] outline-none focus:border-primary/50"
            />
          </div>
          <div>
            <label className="block text-[12px] text-muted-foreground mb-1">Contact phone</label>
            <input
              value={form.contact_phone}
              onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))}
              placeholder="07xxx xxxxxx"
              className="h-9 w-full rounded-lg border border-border/20 bg-background px-3 text-[13px] outline-none focus:border-primary/50"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-[12px] text-muted-foreground mb-1">Contact email</label>
            <input
              value={form.contact_email}
              onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))}
              placeholder="email@company.com"
              className="h-9 w-full rounded-lg border border-border/20 bg-background px-3 text-[13px] outline-none focus:border-primary/50"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-[12px] text-muted-foreground mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Any context about this prospect..."
              className="min-h-[96px] w-full rounded-lg border border-border/20 bg-background px-3 py-2 text-[13px] outline-none focus:border-primary/50 resize-none"
            />
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2">
          <Button size="sm" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Creating...' : 'Create prospect'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

function TableView({ prospects }: { prospects: Prospect[] }) {
  return (
    <div className="rounded-lg border border-border/20 bg-card overflow-hidden h-[calc(100vh-170px)]">
      <div className="overflow-auto h-full">
        <table className="w-full text-left" aria-label="Pipeline table">
          <thead className="sticky top-0 bg-card z-10">
            <tr className="border-b border-border/20">
              <th className="px-5 py-3 text-[11px] font-medium text-muted-foreground/60">Prospect</th>
              <th className="px-4 py-3 text-[11px] font-medium text-muted-foreground/60">Stage</th>
              <th className="px-4 py-3 text-[11px] font-medium text-muted-foreground/60">Service</th>
              <th className="px-4 py-3 text-[11px] font-medium text-muted-foreground/60">Contact</th>
              <th className="px-4 py-3 text-[11px] font-medium text-muted-foreground/60">Source</th>
              <th className="px-4 py-3 text-[11px] font-medium text-muted-foreground/60 text-right">Value</th>
            </tr>
          </thead>
          <tbody>
            {prospects.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-[13px] text-muted-foreground/60">No prospects found</td>
              </tr>
            ) : prospects.map((prospect) => {
              const serviceStyle = prospect.service ? getServiceStyle(prospect.service) : null;
              return (
                <tr key={prospect.id} className="border-b border-border/10 last:border-b-0 hover:bg-muted/20 transition-colors duration-150">
                  <td className="px-5 py-3">
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-foreground truncate">{prospect.name}</div>
                      {prospect.assignee && <div className="text-[11px] text-muted-foreground/60 mt-0.5">{prospect.assignee}</div>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-foreground">{prospect.stage}</td>
                  <td className="px-4 py-3">
                    {serviceStyle ? (
                      <span className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${serviceStyle.bg} ${serviceStyle.text}`}>
                        <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: serviceStyle.dot }} />
                        {serviceStyle.label}
                      </span>
                    ) : (
                      <span className="text-[13px] text-muted-foreground/60">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-[13px] text-foreground">{prospect.contact_name || '—'}</div>
                    {prospect.contact_email && <div className="text-[11px] text-muted-foreground/60 mt-0.5">{prospect.contact_email}</div>}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-muted-foreground/80">{prospect.source || '—'}</td>
                  <td className="px-4 py-3 text-[13px] text-foreground text-right tabular-nums">{prospect.value ? `£${prospect.value.toLocaleString()}` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatsView({ stats, prospects }: { stats: { pipelineValue: number; wonValue: number }; prospects: Prospect[] }) {
  const openCount = prospects.filter(p => p.stage !== 'won' && p.stage !== 'lost').length;
  const wonCount = prospects.filter(p => p.stage === 'won').length;
  const lostCount = prospects.filter(p => p.stage === 'lost').length;
  const totalTracked = wonCount + lostCount;
  const winRate = totalTracked > 0 ? Math.round((wonCount / totalTracked) * 100) : 0;
  const averageValue = prospects.length > 0
    ? Math.round(prospects.reduce((sum, p) => sum + (p.value || 0), 0) / prospects.length)
    : 0;

  const cards = [
    { label: 'Open pipeline', value: `£${stats.pipelineValue.toLocaleString()}`, icon: PoundSterling },
    { label: 'Won value', value: `£${stats.wonValue.toLocaleString()}`, icon: Trophy },
    { label: 'Win rate', value: `${winRate}%`, icon: Percent },
    { label: 'Average prospect value', value: `£${averageValue.toLocaleString()}`, icon: TrendingUp },
    { label: 'Open prospects', value: String(openCount), icon: BarChart3 },
    { label: 'Lost prospects', value: String(lostCount), icon: X },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="rounded-lg border border-border/20 bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[13px] text-muted-foreground/60">{card.label}</p>
                <p className="mt-2 text-2xl font-semibold text-foreground tracking-tight">{card.value}</p>
              </div>
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Icon className="h-4 w-4" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PipelineView({ prospects, stages, onDragEnd, openNewProspect, onEdit }: {
  prospects: Prospect[];
  stages: { id: string; label: string; color: string; dotClass?: string | null }[];
  onDragEnd: (result: DropResult) => void;
  openNewProspect: (stage?: string) => void;
  onEdit: (p: Prospect) => void;
}) {
  return (
    <div className="relative flex flex-col min-h-0 overflow-hidden" style={{ height: 'calc(100vh - 200px)' }}>
      <KanbanFrame>
        <div className="flex flex-col min-w-max h-full">
          <div className="flex gap-4 shrink-0 pb-2">
            {stages.map(stage => {
              const columnProspects = prospects.filter(p => p.stage === stage.id);
              const columnValue = columnProspects.reduce((sum, p) => sum + (p.value || 0), 0);
              return (
                <div key={`${stage.id}-header`} className="flex-shrink-0 w-[280px] flex items-center gap-2 px-1">
                  <span
                    className={`w-2 h-2 rounded-full ${stage.dotClass || ''}`}
                    style={!stage.dotClass && stage.color ? { backgroundColor: stage.color } : undefined}
                  />
                  <span className="text-[13px] font-semibold">{stage.label}</span>
                  <span className="text-[11px] text-muted-foreground/60 ml-auto">
                    {columnProspects.length}{columnValue > 0 ? ` · £${columnValue.toLocaleString()}` : ''}
                  </span>
                </div>
              );
            })}
          </div>

          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-4 pb-2 min-h-0 flex-1">
              {stages.map(stage => {
                const columnProspects = prospects.filter(p => p.stage === stage.id);
                return (
                  <div key={stage.id} className="flex-shrink-0 w-[280px] min-h-0 h-full flex flex-col">
                    <Droppable droppableId={stage.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`min-h-0 flex-1 rounded-lg p-1.5 overflow-y-auto overflow-x-hidden scrollbar-thin transition-colors duration-150 ${
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
                                  style={provided.draggableProps.style}
                                  onClick={() => onEdit(prospect)}
                                  className={`mb-2 p-3 rounded-lg border border-border/20 bg-card hover:bg-muted/40 transition-all duration-150 cursor-pointer ${
                                    snapshot.isDragging ? 'shadow-lg ring-1 ring-primary/30' : ''
                                  }`}
                                >
                                  <div className="flex items-start justify-between mb-1.5">
                                    <h3 className="text-[13px] font-semibold truncate mr-2">{prospect.name}</h3>
                                    {prospect.value != null && prospect.value > 0 && (
                                      <span className="text-[11px] font-medium text-emerald-400 shrink-0">£{prospect.value.toLocaleString()}</span>
                                    )}
                                  </div>
                                  {prospect.contact_name && <div className="text-[11px] text-muted-foreground/60 mb-1">{prospect.contact_name}</div>}
                                  <div className="flex items-center gap-2 mt-2">
                                    {prospect.service && (() => { const ss = getServiceStyle(prospect.service); return (
                                      <span className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${ss.bg} ${ss.text}`}>
                                        <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: ss.dot }} />{ss.label}
                                      </span>
                                    ); })()}
                                    {prospect.contact_email && <Mail size={10} className="text-muted-foreground/40" />}
                                    {prospect.contact_phone && <Phone size={10} className="text-muted-foreground/40" />}
                                    {prospect.source && <span className="text-[10px] text-muted-foreground/40 ml-auto">{prospect.source}</span>}
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                          <button
                            onClick={() => openNewProspect(stage.id)}
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
      </KanbanFrame>
    </div>
  );
}

export default function PipelinePage() {
  const { stages: PIPELINE_STAGES } = usePipelineStages();
  const { users } = useUsers();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = usePersistedState<ViewMode>('pipeline-view', 'pipeline');
  const [filterService, setFilterService] = usePersistedState<string[]>('pipeline-filterService', []);
  const [filterStage, setFilterStage] = usePersistedState<string[]>('pipeline-filterStage', []);
  const [searchQuery, setSearchQuery] = usePersistedState('pipeline-search', '');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingProspect, setEditingProspect] = useState<Prospect | null>(null);
  const [sheetDefaultStage, setSheetDefaultStage] = useState<string>('lead');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [convertProspect, setConvertProspect] = useState<Prospect | null>(null);
  const [lossModalProspect, setLossModalProspect] = useState<Prospect | null>(null);
  const [lossReason, setLossReason] = useState('');
  const [lossReasonCustom, setLossReasonCustom] = useState('');

  useEffect(() => {
    fetch('/api/prospects')
      .then(r => r.ok ? r.json() : [])
      .then(data => setProspects(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => prospects.filter(p => {
    if (searchQuery && !`${p.name} ${p.contact_name || ''} ${p.contact_email || ''}`.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterService.length && (!p.service || !filterService.includes(p.service))) return false;
    if (filterStage.length && !filterStage.includes(p.stage)) return false;
    return true;
  }), [prospects, searchQuery, filterService, filterStage]);

  const availableServices = useMemo(() => {
    const map = new Map<string, { value: string; label: string; dot?: string }>();
    prospects.forEach(p => {
      if (!p.service || map.has(p.service)) return;
      const ss = getServiceStyle(p.service);
      map.set(p.service, { value: p.service, label: ss.label, dot: ss.dot });
    });
    return Array.from(map.values());
  }, [prospects]);

  const stats = useMemo(() => {
    const pipelineValue = filtered.filter(p => p.stage !== 'won' && p.stage !== 'lost').reduce((sum, p) => sum + (p.value || 0), 0);
    const wonValue = filtered.filter(p => p.stage === 'won').reduce((sum, p) => sum + (p.value || 0), 0);
    return { pipelineValue, wonValue };
  }, [filtered]);

  const openNewProspect = useCallback((stage = 'lead') => {
    setEditingProspect(null);
    setSheetDefaultStage(stage);
    setSheetOpen(true);
  }, []);

  const openEditProspect = useCallback((p: Prospect) => {
    setEditingProspect(p);
    setSheetOpen(true);
  }, []);

  const fetchProspects = useCallback(async () => {
    const res = await fetch('/api/prospects');
    const data = await res.json();
    setProspects(Array.isArray(data) ? data : []);
  }, []);

  const onDragEnd = useCallback(async (result: DropResult) => {
    if (!result.destination) return;
    if (result.source.droppableId === result.destination.droppableId && result.source.index === result.destination.index) return;
    const prospect = filtered.filter(p => p.stage === result.source.droppableId)[result.source.index];
    if (!prospect) return;
    const newStage = result.destination.droppableId;
    setProspects(prev => prev.map(p => p.id === prospect.id ? { ...p, stage: newStage } : p));
    await fetch(`/api/prospects`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: prospect.id, stage: newStage }),
    });
  }, [filtered]);

  const PAGE_SHORTCUTS = [
    { key: 'N', description: 'New prospect' },
    { key: 'Esc', description: 'Close sheet' },
    { key: '1', description: 'Kanban view' },
    { key: '2', description: 'Table view' },
    { key: '3', description: 'Stats view' },
    { key: '?', description: 'Show shortcuts' },
  ];

  useKeyboardShortcuts([
    { key: 'n', description: 'New prospect', action: () => { if (!sheetOpen) openNewProspect(); } },
    { key: 'Escape', description: 'Close', action: () => { setSheetOpen(false); setShowShortcuts(false); }, skipInInput: false },
    { key: '1', description: 'Kanban view', action: () => setViewMode('pipeline') },
    { key: '2', description: 'Table view', action: () => setViewMode('table') },
    { key: '3', description: 'Stats view', action: () => setViewMode('stats') },
    { key: '?', description: 'Show shortcuts', action: () => setShowShortcuts(v => !v) },
  ]);

  const viewButtons: { mode: ViewMode; icon: typeof Kanban; label: string }[] = [
    { mode: 'pipeline', icon: Kanban, label: 'Kanban' },
    { mode: 'table', icon: Table2, label: 'Table' },
    { mode: 'stats', icon: BarChart3, label: 'Stats' },
  ];

  const hasFilters = !!searchQuery || filterService.length > 0 || filterStage.length > 0;
  const sourceOptions = [{ value: 'referral', label: 'Referral' }, { value: 'website', label: 'Website' }];

  return (
    <div className="animate-in fade-in duration-200 h-full min-h-0 overflow-hidden flex flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Sales Pipeline</h1>
        <p className="text-[13px] text-muted-foreground/60 mt-1">
          {filtered.length} prospects · £{stats.pipelineValue.toLocaleString()} pipeline · £{stats.wonValue.toLocaleString()} won
        </p>
      </div>

      <div className="mb-4 flex items-center gap-1.5 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="h-7.5 w-full sm:w-[160px] pl-7 pr-2.5 text-[12px] bg-secondary border border-border/20 rounded-lg outline-none focus:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors duration-150 placeholder:text-muted-foreground/60"
          />
        </div>

        {viewMode !== 'pipeline' && (
          <FilterPopover
            label="Stage"
            options={PIPELINE_STAGES.map(s => ({ value: s.id, label: s.label, dot: s.id === 'lead' ? '#fbbf24' : s.id === 'won' ? '#34d399' : s.color }))}
            selected={filterStage}
            onSelectionChange={setFilterStage}
            width="w-48"
          />
        )}

        <FilterPopover
          label="Service"
          options={availableServices}
          selected={filterService}
          onSelectionChange={setFilterService}
          width="w-52"
        />

        {hasFilters && (
          <button
            onClick={() => { setFilterService([]); setFilterStage([]); setSearchQuery(''); }}
            className="h-8 px-3 text-[13px] rounded-lg border border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors duration-150 flex items-center gap-1.5"
          >
            <X className="h-3 w-3" /> Clear all
          </button>
        )}

        <div className="flex items-center rounded-lg border border-border/20 bg-secondary p-0.5">
          {viewButtons.map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] font-medium transition-all duration-150 ${
                viewMode === mode ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1" />
        <Button size="sm" onClick={() => openNewProspect()}>
          <Plus className="h-4 w-4 mr-1" /> New Prospect
        </Button>
      </div>

      <ProspectSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        defaultStage={sheetDefaultStage}
        onCreated={fetchProspects}
      />

      {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[300px] rounded-lg bg-muted/20 animate-pulse" />
            ))}
          </div>
        ) : viewMode === 'pipeline' ? (
          <div className="animate-in fade-in duration-200 min-h-0 flex-1 overflow-hidden h-[calc(100vh-170px)]">
          <PipelineView
            prospects={filtered}
            stages={PIPELINE_STAGES}
            onDragEnd={onDragEnd}
            openNewProspect={openNewProspect}
            onEdit={openEditProspect}
          />
          </div>
        ) : viewMode === 'table' ? (
          <div className="animate-in fade-in duration-200 min-h-0 flex-1 overflow-hidden h-[calc(100vh-170px)]">
            <TableView prospects={filtered} />
          </div>
        ) : (
          <div className="animate-in fade-in duration-200 min-h-0 flex-1 overflow-auto h-[calc(100vh-170px)]">
            <StatsView stats={stats} prospects={filtered} />
          </div>
        )}

      {lossModalProspect && <div />}
      <ShortcutsDialog open={showShortcuts} onClose={() => setShowShortcuts(false)} shortcuts={PAGE_SHORTCUTS} pageName="Pipeline" />
    </div>
  );
}
