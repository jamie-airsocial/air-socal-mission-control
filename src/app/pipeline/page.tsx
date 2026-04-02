'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Plus, Search, X, Kanban, Table2, BarChart3, Mail, Phone, Check, ChevronDown,
  PoundSterling, Trophy, Percent, TrendingUp, User, Globe, Tag, Calendar,
  MessageSquare, Pencil, Trash2, ArrowRight,
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { FilterPopover } from '@/components/ui/filter-popover';
import { DatePicker } from '@/components/ui/date-picker';
import { KanbanFrame } from '@/components/ui/kanban-frame';
import { EnhancedDatePicker, formatRelativeDate } from '@/components/board/enhanced-date-picker';
import { usePersistedState } from '@/hooks/use-persisted-state';
import { usePipelineStages } from '@/hooks/use-pipeline-stages';
import { useUsers } from '@/hooks/use-users';
import { getServiceStyle, LOSS_REASONS } from '@/lib/constants';
import { ShortcutsDialog } from '@/components/ui/shortcuts-dialog';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';

const TaskDescriptionEditor = dynamic(
  () => import('@/components/board/task-description-editor').then(mod => ({ default: mod.TaskDescriptionEditor })),
  { ssr: false, loading: () => <div className="h-32 bg-secondary rounded-lg animate-pulse" /> }
);

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
  notes?: string | null;
  team?: string | null;
  website?: string | null;
  won_at?: string | null;
  lost_at?: string | null;
  lost_reason?: string | null;
  updated_at?: string | null;
  created_at: string;
}

type ViewMode = 'pipeline' | 'table' | 'stats';

interface ProspectLineItem {
  id: string;
  prospect_id: string;
  service: string;
  description: string | null;
  monthly_value: number;
  billing_type: 'recurring' | 'one-off';
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
}

interface ClientOption {
  id: string;
  name: string;
  status?: string | null;
  team?: string | null;
  services?: string[] | null;
}

interface ConversionLineItemDraft {
  id: string;
  service: string;
  description: string;
  monthly_value: string;
  billing_type: 'recurring' | 'one-off';
  start_date: string;
  end_date: string;
  selected: boolean;
}

interface Activity {
  id: string;
  prospect_id: string;
  type: 'call' | 'email' | 'meeting' | 'note' | 'stage_change' | 'created' | 'won' | 'lost';
  title: string;
  description?: string;
  from_stage?: string;
  to_stage?: string;
  created_at: string;
}

interface LineItemFormData {
  service: string;
  description: string;
  monthly_value: string;
  billing_type: 'recurring' | 'one-off';
  start_date: string;
  end_date: string;
}

const emptyLineItem: LineItemFormData = {
  service: '',
  description: '',
  monthly_value: '',
  billing_type: 'recurring',
  start_date: '',
  end_date: '',
};

function formatTimestamp(date: string) {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

function toISODateString(d: string | null | undefined) {
  if (!d) return '';
  try { return new Date(d).toISOString().split('T')[0]; } catch { return ''; }
}

function ProspectLineItemDialog({
  open,
  onOpenChange,
  initialData,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialData?: ProspectLineItem | null;
  onSave: (data: LineItemFormData) => Promise<void>;
}) {
  const [form, setForm] = useState<LineItemFormData>(emptyLineItem);
  const [saving, setSaving] = useState(false);
  const [services, setServices] = useState<{ id: string; label: string }[]>([]);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [serviceSearch, setServiceSearch] = useState('');

  useEffect(() => {
    fetch('/api/services').then(r => r.json()).then(d => { if (Array.isArray(d)) setServices(d); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (open) {
      setForm(initialData ? {
        service: initialData.service,
        description: initialData.description || '',
        monthly_value: String(initialData.monthly_value),
        billing_type: initialData.billing_type || 'recurring',
        start_date: toISODateString(initialData.start_date),
        end_date: toISODateString(initialData.end_date),
      } : emptyLineItem);
      setServiceSearch('');
    }
  }, [open, initialData]);

  const handleSave = async () => {
    if (!form.service) { toast.error('Service is required'); return; }
    setSaving(true);
    try { await onSave(form); onOpenChange(false); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to save'); }
    finally { setSaving(false); }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[520px] bg-card border-border/20 p-0 overflow-y-auto">
        <div className="px-5 py-4 border-b border-border/20">
          <h3 className="text-[15px] font-semibold">{initialData ? 'Edit line item' : 'Add line item'}</h3>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[13px] text-muted-foreground">Service *</label>
            <Popover open={serviceOpen} onOpenChange={setServiceOpen}>
              <PopoverTrigger asChild>
                <button type="button" className="w-full h-9 px-3 text-left text-[13px] bg-secondary border border-border/20 rounded-md flex items-center justify-between hover:bg-muted/40 transition-colors">
                  {form.service ? (services.find(s => s.id === form.service)?.label || form.service) : <span className="text-muted-foreground/40">Select service...</span>}
                  <ChevronDown size={14} className="text-muted-foreground/40" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-1 bg-card border-border/20">
                <input
                  value={serviceSearch}
                  onChange={e => setServiceSearch(e.target.value)}
                  placeholder="Search or create..."
                  className="w-full px-2 py-1.5 text-[13px] bg-transparent border-b border-border/10 outline-none mb-1"
                  autoFocus
                />
                <div className="max-h-[200px] overflow-y-auto">
                  {services.filter(s => s.label.toLowerCase().includes(serviceSearch.toLowerCase())).map(s => (
                    <button key={s.id} type="button" onClick={() => { setForm(f => ({ ...f, service: s.id })); setServiceOpen(false); setServiceSearch(''); }} className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-[13px] hover:bg-muted/60 transition-colors ${form.service === s.id ? 'bg-muted/40' : ''}`}>
                      <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: getServiceStyle(s.id).dot }} /> {s.label}</span>
                      {form.service === s.id && <Check size={14} className="text-primary" />}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] text-muted-foreground">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="min-h-[96px] w-full rounded-lg border border-border/20 bg-background px-3 py-2 text-[13px] outline-none focus:border-primary/50 resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[13px] text-muted-foreground">Value</label>
              <input value={form.monthly_value} onChange={e => setForm(f => ({ ...f, monthly_value: e.target.value }))} inputMode="decimal" className="h-9 w-full rounded-lg border border-border/20 bg-background px-3 text-[13px] outline-none focus:border-primary/50" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] text-muted-foreground">Billing type</label>
              <div className="flex rounded-lg border border-border/20 bg-secondary p-0.5">
                {(['recurring', 'one-off'] as const).map(type => (
                  <button key={type} type="button" onClick={() => setForm(f => ({ ...f, billing_type: type }))} className={`flex-1 px-3 py-1.5 rounded-md text-[13px] transition-colors ${form.billing_type === type ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                    {type === 'recurring' ? 'Recurring' : 'One-off'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[13px] text-muted-foreground">Start date</label>
              <DatePicker value={form.start_date} onChange={value => setForm(f => ({ ...f, start_date: value }))} placeholder="DD/MM/YYYY" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] text-muted-foreground">End date</label>
              <DatePicker value={form.end_date} onChange={value => setForm(f => ({ ...f, end_date: value }))} placeholder="DD/MM/YYYY" />
            </div>
          </div>

        </div>
        <div className="px-5 py-3 border-t border-border/20 flex items-center justify-end gap-2 sticky bottom-0 bg-card">
          <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : (initialData ? 'Save changes' : 'Add line item')}</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ProspectSheet({
  open,
  onOpenChange,
  defaultStage,
  onCreated,
  prospect,
  stageOptions,
  assigneeOptions,
  leadSourceOptions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStage: string;
  onCreated: () => Promise<void> | void;
  prospect: Prospect | null;
  stageOptions: { id: string; label: string; color: string; dotClass?: string | null }[];
  assigneeOptions: { slug: string; full_name: string }[];
  leadSourceOptions: string[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    stage: 'lead',
    source: '',
    assignee: '',
    website: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    notes: '',
    lost_reason: '',
  });
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'billing' | 'activity'>('details');
  const [lineItems, setLineItems] = useState<ProspectLineItem[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [lineItemDialogOpen, setLineItemDialogOpen] = useState(false);
  const [editingLineItem, setEditingLineItem] = useState<ProspectLineItem | null>(null);
  const [deleteLineItem, setDeleteLineItem] = useState<ProspectLineItem | null>(null);
  const [deleteProspectOpen, setDeleteProspectOpen] = useState(false);
  const [deletingProspect, setDeletingProspect] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [convertMode, setConvertMode] = useState<'new' | 'existing'>('new');
  const [convertTargetClientId, setConvertTargetClientId] = useState('');
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [convertLineItems, setConvertLineItems] = useState<ConversionLineItemDraft[]>([]);
  const [converting, setConverting] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [sourceSearch, setSourceSearch] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm({
      name: prospect?.name || '',
      stage: prospect?.stage || defaultStage || 'lead',
      source: prospect?.source || '',
      assignee: prospect?.assignee || '',
      website: prospect?.website || '',
      contact_name: prospect?.contact_name || '',
      contact_email: prospect?.contact_email || '',
      contact_phone: prospect?.contact_phone || '',
      notes: prospect?.notes || '',
      lost_reason: prospect?.lost_reason || '',
    });
    setSaving(false);
    setActiveTab('details');
  }, [open, defaultStage, prospect]);

  useEffect(() => {
    if (!open || !prospect?.id) {
      setLineItems([]);
      setActivities([]);
      return;
    }
    fetch(`/api/prospects/${prospect.id}/line-items`).then(r => r.json()).then(d => setLineItems(Array.isArray(d) ? d : [])).catch(() => setLineItems([]));
    fetch(`/api/prospects/${prospect.id}/activities`).then(r => r.json()).then(d => setActivities(Array.isArray(d) ? d : [])).catch(() => setActivities([]));
  }, [open, prospect?.id]);

  useEffect(() => {
    if (!open) return;
    fetch('/api/clients')
      .then(r => r.json())
      .then(d => setClientOptions(Array.isArray(d) ? d : []))
      .catch(() => setClientOptions([]));
  }, [open]);

  const persistProspect = async () => {
    if (!form.name.trim()) {
      toast.error('Prospect name required');
      return null;
    }
    const res = await fetch('/api/prospects', {
      method: prospect ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(prospect ? { id: prospect.id } : {}),
        name: form.name.trim(),
        stage: form.stage || defaultStage || 'lead',
        value: recurringTotal > 0 ? recurringTotal : null,
        service: convertedServices[0] || null,
        source: form.source.trim() || null,
        assignee: form.assignee || null,
        website: form.website.trim() || null,
        contact_name: form.contact_name.trim() || null,
        contact_email: form.contact_email.trim() || null,
        contact_phone: form.contact_phone.trim() || null,
        notes: form.notes || null,
        lost_reason: form.stage === 'lost' ? (form.lost_reason.trim() || null) : null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Failed to save prospect');
    return data as Prospect;
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await persistProspect();
      await onCreated();
      onOpenChange(false);
      toast.success(prospect ? 'Prospect updated' : 'Prospect created');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save prospect');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLineItem = async (lineForm: LineItemFormData) => {
    const targetProspect = prospect || await persistProspect();
    if (!targetProspect?.id) throw new Error('Save the prospect first');

    const payload = {
      ...(editingLineItem ? { id: editingLineItem.id } : {}),
      service: lineForm.service,
      description: lineForm.description || null,
      monthly_value: Number(lineForm.monthly_value || 0),
      billing_type: lineForm.billing_type,
      start_date: lineForm.start_date || null,
      end_date: lineForm.end_date || null,
      is_active: true,
    };

    const res = await fetch(`/api/prospects/${targetProspect.id}/line-items`, {
      method: editingLineItem ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Failed to save line item');
    const refresh = await fetch(`/api/prospects/${targetProspect.id}/line-items`).then(r => r.json()).catch(() => []);
    setLineItems(Array.isArray(refresh) ? refresh : []);
    await onCreated();
    toast.success(editingLineItem ? 'Line item updated' : 'Line item added');
  };

  const handleDeleteLineItem = async () => {
    if (!prospect?.id || !deleteLineItem) return;
    const res = await fetch(`/api/prospects/${prospect.id}/line-items`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: deleteLineItem.id }),
    });
    if (!res.ok) {
      toast.error('Failed to delete line item');
      return;
    }
    setLineItems(prev => prev.filter(item => item.id !== deleteLineItem.id));
    setDeleteLineItem(null);
    await onCreated();
    toast.success('Line item deleted');
  };

  const handleDeleteProspect = async () => {
    if (!prospect?.id) return;
    setDeletingProspect(true);
    try {
      const res = await fetch(`/api/prospects?id=${prospect.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to delete prospect');
      toast.success('Prospect deleted');
      setDeleteProspectOpen(false);
      onOpenChange(false);
      await onCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete prospect');
    } finally {
      setDeletingProspect(false);
    }
  };

  const openConvertDialog = async () => {
    const targetProspect = prospect || await persistProspect();
    if (!targetProspect?.id) return;

    const latestItems = await fetch(`/api/prospects/${targetProspect.id}/line-items`).then(r => r.json()).catch(() => []);
    const mappedItems = (Array.isArray(latestItems) ? latestItems : []).map((item: ProspectLineItem) => ({
      id: item.id,
      service: item.service,
      description: item.description || '',
      monthly_value: String(item.monthly_value || 0),
      billing_type: item.billing_type,
      start_date: toISODateString(item.start_date),
      end_date: toISODateString(item.end_date),
      selected: item.is_active ?? true,
    }));
    setConvertMode('new');
    setConvertTargetClientId('');
    setClientSearch('');
    setConvertLineItems(mappedItems);
    setConvertDialogOpen(true);
  };

  const handleConvert = async () => {
    const targetProspect = prospect || await persistProspect();
    if (!targetProspect?.id) return;

    const selectedItems = convertLineItems
      .filter(item => item.selected)
      .map(item => ({
        service: item.service,
        description: item.description.trim() || null,
        monthly_value: Number(item.monthly_value || 0),
        billing_type: item.billing_type,
        start_date: item.start_date || null,
        end_date: item.end_date || null,
        is_active: true,
      }))
      .filter(item => item.service && !Number.isNaN(item.monthly_value));

    if (convertMode === 'existing' && !convertTargetClientId) {
      toast.error('Choose an existing client');
      return;
    }

    setConverting(true);
    try {
      const payload = {
        mode: convertMode,
        ...(convertMode === 'existing' ? { client_id: convertTargetClientId } : {}),
        line_items: selectedItems,
      };

      const res = await fetch(`/api/prospects/${targetProspect.id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to convert prospect');
      await onCreated();
      setConvertDialogOpen(false);
      onOpenChange(false);
      toast.success(convertMode === 'existing' ? 'Prospect merged into existing client' : 'Prospect converted to client');
      if (data?.client?.id && convertMode === 'existing') {
        router.push(`/clients/${data.client.id}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to convert prospect');
    } finally {
      setConverting(false);
    }
  };

  const recurringTotal = lineItems.filter(item => item.is_active && item.billing_type === 'recurring').reduce((sum, item) => sum + (item.monthly_value || 0), 0);
  const projectTotal = lineItems.filter(item => item.is_active && item.billing_type === 'one-off').reduce((sum, item) => sum + (item.monthly_value || 0), 0);
  const convertedServices = [...new Set(lineItems.filter(item => item.is_active).map(item => item.service).filter(Boolean))];
  const calculatedValue = [
    recurringTotal > 0 ? `Recurring £${recurringTotal.toLocaleString()}` : null,
    projectTotal > 0 ? `Project £${projectTotal.toLocaleString()}` : null,
  ].filter(Boolean).join(' · ') || 'Calculated from billing';

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="top-2 bottom-2 right-2 h-auto rounded-l-2xl border border-border/20 bg-card p-0 overflow-hidden shadow-2xl sm:max-w-[760px]">
          <div className="flex h-full flex-col">
            <div className="px-5 py-4 border-b border-border/20">
              <div className="flex items-center justify-between gap-3 mb-3 pr-10">
                <div className="text-[11px] text-muted-foreground/60">
                  {prospect ? `Created ${new Date(prospect.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'New prospect'}
                  {prospect?.updated_at ? ` · Updated ${formatTimestamp(prospect.updated_at)}` : ''}
                  {prospect?.won_at ? ` · Won ${new Date(prospect.won_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}
                </div>
                <div className="flex items-center gap-2">
                  {prospect && (
                    <Button size="sm" variant="outline" onClick={() => setDeleteProspectOpen(true)} className="h-8 border-border/20 text-destructive hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-4 w-4 mr-1" /> Delete prospect
                    </Button>
                  )}
                  {prospect && (
                    <Button size="sm" onClick={openConvertDialog} disabled={converting} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white">
                      Convert to client
                    </Button>
                  )}
                </div>
              </div>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Prospect name" className="w-full bg-transparent text-[24px] font-semibold tracking-tight outline-none ring-0 border-0 shadow-none placeholder:text-muted-foreground/30 focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:outline-none selection:bg-transparent" />
            </div>

            <div className="px-5 py-3 border-b border-border/20 grid grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
              <div>
                <div className="text-muted-foreground/60 mb-1 flex items-center gap-1.5"><Tag size={13} /> Stage</div>
                <Popover open={stageOpen} onOpenChange={setStageOpen}><PopoverTrigger asChild><button className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-muted/40 border border-border/10">{stageOptions.find(s => s.id === form.stage)?.label || form.stage || 'Select stage'}</button></PopoverTrigger><PopoverContent className="w-56 p-1" align="start">{stageOptions.map(stage => <button key={stage.id} onClick={() => { setForm(f => ({ ...f, stage: stage.id })); setStageOpen(false); }} className="w-full text-left px-2 py-1.5 rounded text-[13px] hover:bg-muted/60">{stage.label}</button>)}</PopoverContent></Popover>
              </div>
              <div>
                <div className="text-muted-foreground/60 mb-1 flex items-center gap-1.5"><PoundSterling size={13} /> Total value</div>
                <div className="px-2.5 py-2 rounded-lg border border-border/10 bg-muted/20 text-foreground">{calculatedValue}</div>
              </div>
              <div>
                <div className="text-muted-foreground/60 mb-1 flex items-center gap-1.5"><MessageSquare size={13} /> Lead source</div>
                <Popover open={sourceOpen} onOpenChange={setSourceOpen}>
                  <PopoverTrigger asChild>
                    <button className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-muted/40 border border-border/10">{form.source || 'Select or add lead source'}</button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-1" align="start">
                    <input
                      value={sourceSearch}
                      onChange={e => setSourceSearch(e.target.value)}
                      placeholder="Search or create..."
                      className="w-full px-2 py-1.5 text-[13px] bg-transparent border-b border-border/10 outline-none mb-1"
                      autoFocus
                    />
                    <div className="max-h-[220px] overflow-y-auto">
                      {leadSourceOptions.filter(source => source.toLowerCase().includes(sourceSearch.toLowerCase())).map(source => (
                        <button key={source} onClick={() => { setForm(f => ({ ...f, source })); setSourceOpen(false); setSourceSearch(''); }} className="w-full text-left px-2 py-1.5 rounded text-[13px] hover:bg-muted/60">{source}</button>
                      ))}
                      {sourceSearch.trim() && !leadSourceOptions.some(source => source.toLowerCase() === sourceSearch.trim().toLowerCase()) && (
                        <button onClick={() => { setForm(f => ({ ...f, source: sourceSearch.trim() })); setSourceOpen(false); setSourceSearch(''); }} className="w-full text-left px-2 py-1.5 rounded text-[13px] text-primary hover:bg-primary/10">Create “{sourceSearch.trim()}”</button>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <div className="text-muted-foreground/60 mb-1 flex items-center gap-1.5"><User size={13} /> Sale owner</div>
                <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}><PopoverTrigger asChild><button className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-muted/40 border border-border/10">{assigneeOptions.find(a => a.slug === form.assignee)?.full_name || 'Unassigned'}</button></PopoverTrigger><PopoverContent className="w-56 p-1" align="start">{assigneeOptions.map(user => <button key={user.slug} onClick={() => { setForm(f => ({ ...f, assignee: user.slug })); setAssigneeOpen(false); }} className="w-full text-left px-2 py-1.5 rounded text-[13px] hover:bg-muted/60">{user.full_name}</button>)}</PopoverContent></Popover>
              </div>

            </div>

            <div className="px-5 py-2 border-b border-border/20 flex items-center gap-1.5">
              {(['details', 'billing', 'activity'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`px-2.5 py-1.5 rounded-md text-[13px] transition-colors ${activeTab === tab ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'}`}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {activeTab === 'details' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[12px] text-muted-foreground mb-1">Primary contact</label>
                      <input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} className="h-9 w-full rounded-lg border border-border/20 bg-background px-3 text-[13px] outline-none focus:border-primary/50" />
                    </div>
                    <div>
                      <label className="block text-[12px] text-muted-foreground mb-1">Website</label>
                      <input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} className="h-9 w-full rounded-lg border border-border/20 bg-background px-3 text-[13px] outline-none focus:border-primary/50" />
                    </div>
                    <div>
                      <label className="block text-[12px] text-muted-foreground mb-1">Contact email</label>
                      <input value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} className="h-9 w-full rounded-lg border border-border/20 bg-background px-3 text-[13px] outline-none focus:border-primary/50" />
                    </div>
                    <div>
                      <label className="block text-[12px] text-muted-foreground mb-1">Contact phone</label>
                      <input value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} className="h-9 w-full rounded-lg border border-border/20 bg-background px-3 text-[13px] outline-none focus:border-primary/50" />
                    </div>
                  </div>
                  {form.stage === 'lost' && (
                    <div>
                      <label className="block text-[12px] text-muted-foreground mb-1">Lost reason</label>
                      <input value={form.lost_reason} onChange={e => setForm(f => ({ ...f, lost_reason: e.target.value }))} className="h-9 w-full rounded-lg border border-border/20 bg-background px-3 text-[13px] outline-none focus:border-primary/50" />
                    </div>
                  )}
                  <div>
                    <label className="block text-[12px] text-muted-foreground mb-2">Notes</label>
                    <TaskDescriptionEditor
                      content={form.notes}
                      onChange={(content) => setForm(f => ({ ...f, notes: content }))}
                      placeholder="Deal context, next steps, objections, handover notes..."
                    />
                  </div>
                </div>
              )}

              {activeTab === 'billing' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-end gap-3">
                    <Button size="sm" onClick={() => { setEditingLineItem(null); setLineItemDialogOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Add line item</Button>
                  </div>
                  <div className="rounded-lg border border-border/20 overflow-hidden">
                    {lineItems.length === 0 ? (
                      <div className="px-4 py-8 text-center text-[13px] text-muted-foreground/60">No line items yet</div>
                    ) : (
                      <table className="w-full text-left">
                        <thead className="bg-muted/20 border-b border-border/20">
                          <tr>
                            <th className="px-4 py-2 text-[11px] text-muted-foreground/60">Service</th>
                            <th className="px-4 py-2 text-[11px] text-muted-foreground/60">Description</th>
                            <th className="px-4 py-2 text-[11px] text-muted-foreground/60">Billing</th>
                            <th className="px-4 py-2 text-[11px] text-muted-foreground/60 text-right">Value</th>
                            <th className="px-4 py-2" />
                          </tr>
                        </thead>
                        <tbody>
                          {lineItems.map(item => (
                            <tr key={item.id} className="border-b border-border/10 last:border-b-0">
                              <td className="px-4 py-3 text-[13px]">{getServiceStyle(item.service).label}</td>
                              <td className="px-4 py-3 text-[13px] text-muted-foreground/80">{item.description || '—'}</td>
                              <td className="px-4 py-3 text-[13px] text-muted-foreground/80">{item.billing_type === 'recurring' ? 'Recurring' : 'One-off'}</td>
                              <td className="px-4 py-3 text-[13px] text-right">£{item.monthly_value.toLocaleString()}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-1">
                                  <button onClick={() => { setEditingLineItem(item); setLineItemDialogOpen(true); }} className="p-1 rounded hover:bg-muted/40"><Pencil size={12} /></button>
                                  <button onClick={() => setDeleteLineItem(item)} className="p-1 rounded hover:bg-destructive/10 text-destructive/70"><Trash2 size={12} /></button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                  <div className="rounded-lg border border-border/20 bg-muted/10 p-4 text-[13px]">
                    <div className="flex items-center justify-between"><span className="text-muted-foreground/60">Totals</span><span className="font-medium">Recurring £{recurringTotal.toLocaleString()} · Project £{projectTotal.toLocaleString()}</span></div>
                  </div>
                </div>
              )}

              {activeTab === 'activity' && (
                <div className="space-y-3">
                  {activities.length === 0 ? <div className="text-[13px] text-muted-foreground/60">No activity yet</div> : activities.map(activity => (
                    <div key={activity.id} className="rounded-lg border border-border/20 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[13px] font-medium">{activity.title}</div>
                        <div className="text-[11px] text-muted-foreground/40">{formatTimestamp(activity.created_at)}</div>
                      </div>
                      {activity.description && <div className="text-[13px] text-muted-foreground/70 mt-1">{activity.description}</div>}
                    </div>
                  ))}
                </div>
              )}


            </div>

            <div className="px-5 py-3 border-t border-border/20 flex items-center justify-between sticky bottom-0 bg-card">
              <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving || converting}>Close</Button>
              <Button size="sm" onClick={handleSubmit} disabled={saving || converting}>{saving ? (prospect ? 'Saving...' : 'Creating...') : (prospect ? 'Save changes' : 'Create prospect')}</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <ProspectLineItemDialog open={lineItemDialogOpen} onOpenChange={(v) => { setLineItemDialogOpen(v); if (!v) setEditingLineItem(null); }} initialData={editingLineItem} onSave={handleSaveLineItem} />

      {prospect && (
        <Sheet open={deleteProspectOpen} onOpenChange={setDeleteProspectOpen}>
          <SheetContent side="right" className="top-2 bottom-2 right-2 h-auto rounded-l-2xl border border-border/20 bg-card p-0 shadow-2xl sm:max-w-[420px]">
            <div className="px-5 py-4 border-b border-border/20"><h3 className="text-[15px] font-semibold">Delete prospect</h3></div>
            <div className="px-5 py-4 text-[13px] text-muted-foreground/70">This will permanently delete {prospect.name}, including its billing items and activity history. This cannot be undone.</div>
            <div className="px-5 py-3 border-t border-border/20 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setDeleteProspectOpen(false)} disabled={deletingProspect}>Cancel</Button>
              <Button size="sm" variant="destructive" onClick={handleDeleteProspect} disabled={deletingProspect}>{deletingProspect ? 'Deleting...' : 'Delete prospect'}</Button>
            </div>
          </SheetContent>
        </Sheet>
      )}

      {deleteLineItem && (
        <Sheet open={!!deleteLineItem} onOpenChange={(open) => { if (!open) setDeleteLineItem(null); }}>
          <SheetContent side="right" className="top-2 bottom-2 right-2 h-auto rounded-l-2xl border border-border/20 bg-card p-0 shadow-2xl sm:max-w-[420px]">
            <div className="px-5 py-4 border-b border-border/20"><h3 className="text-[15px] font-semibold">Delete line item</h3></div>
            <div className="px-5 py-4 text-[13px] text-muted-foreground/70">Remove this line item from the prospect?</div>
            <div className="px-5 py-3 border-t border-border/20 flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => setDeleteLineItem(null)}>Cancel</Button><Button size="sm" variant="destructive" onClick={handleDeleteLineItem}>Delete</Button></div>
          </SheetContent>
        </Sheet>
      )}

      <Sheet open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <SheetContent side="right" className="top-2 bottom-2 right-2 h-auto rounded-l-2xl border border-border/20 bg-card p-0 shadow-2xl sm:max-w-[620px]">
          <div className="flex h-full flex-col">
            <div className="px-5 py-4 border-b border-border/20">
              <h3 className="text-[15px] font-semibold">Convert to client</h3>
              <p className="mt-1 text-[13px] text-muted-foreground/70">Choose whether this prospect becomes a new client or rolls into an existing one, then review the billing items you actually want to carry across.</p>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setConvertMode('new')}
                  className={`rounded-lg border p-4 text-left transition-colors ${convertMode === 'new' ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-border/20 hover:bg-muted/20'}`}
                >
                  <div className="text-[13px] font-medium">Convert to new client</div>
                  <div className="mt-1 text-[12px] text-muted-foreground/70">Creates a brand new client from this prospect.</div>
                </button>
                <button
                  type="button"
                  onClick={() => setConvertMode('existing')}
                  className={`rounded-lg border p-4 text-left transition-colors ${convertMode === 'existing' ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-border/20 hover:bg-muted/20'}`}
                >
                  <div className="text-[13px] font-medium">Convert into existing client</div>
                  <div className="mt-1 text-[12px] text-muted-foreground/70">Use this for upsells or additional work without duplicating the client.</div>
                </button>
              </div>

              <div className="rounded-lg border border-border/20 bg-muted/10 p-4 space-y-2 text-[13px]">
                <div className="flex items-center justify-between"><span className="text-muted-foreground/60">Prospect</span><span>{form.name || '—'}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground/60">Lead source</span><span>{form.source || '—'}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground/60">Sale owner</span><span>{assigneeOptions.find(a => a.slug === form.assignee)?.full_name || '—'}</span></div>
              </div>

              {convertMode === 'existing' && (
                <div className="rounded-lg border border-border/20 p-4 space-y-3">
                  <div>
                    <label className="block text-[12px] text-muted-foreground mb-1">Existing client</label>
                    <input
                      value={clientSearch}
                      onChange={e => setClientSearch(e.target.value)}
                      placeholder="Search clients..."
                      className="h-9 w-full rounded-lg border border-border/20 bg-background px-3 text-[13px] outline-none focus:border-primary/50"
                    />
                  </div>
                  <div className="max-h-[220px] overflow-y-auto rounded-lg border border-border/20 divide-y divide-border/10">
                    {clientOptions
                      .filter(client => client.name.toLowerCase().includes(clientSearch.toLowerCase()))
                      .map(client => (
                        <button
                          key={client.id}
                          type="button"
                          onClick={() => setConvertTargetClientId(client.id)}
                          className={`w-full px-3 py-2.5 text-left transition-colors ${convertTargetClientId === client.id ? 'bg-emerald-500/10' : 'hover:bg-muted/20'}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-[13px] font-medium text-foreground">{client.name}</div>
                              <div className="mt-0.5 text-[11px] text-muted-foreground/60">{client.team || 'No team'}{client.services?.length ? ` · ${client.services.join(', ')}` : ''}</div>
                            </div>
                            {convertTargetClientId === client.id && <Check size={14} className="text-emerald-400 shrink-0" />}
                          </div>
                        </button>
                      ))}
                    {clientOptions.filter(client => client.name.toLowerCase().includes(clientSearch.toLowerCase())).length === 0 && (
                      <div className="px-3 py-4 text-[13px] text-muted-foreground/60">No matching clients</div>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <div className="text-[13px] font-medium">Billing items to move</div>
                  <div className="text-[12px] text-muted-foreground/60">Only selected items will be copied into the client during conversion.</div>
                </div>
                {convertLineItems.length === 0 ? (
                  <div className="text-[13px] text-muted-foreground/60">No line items to convert</div>
                ) : convertLineItems.map((item, index) => (
                  <div key={item.id} className={`rounded-lg border p-4 space-y-3 ${item.selected ? 'border-border/20' : 'border-border/10 opacity-70'}`}>
                    <label className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                      <input type="checkbox" checked={item.selected} onChange={e => setConvertLineItems(prev => prev.map((row, rowIndex) => rowIndex === index ? { ...row, selected: e.target.checked } : row))} />
                      <span>{getServiceStyle(item.service).label}</span>
                      <span className="text-[11px] text-muted-foreground/60">{item.billing_type === 'recurring' ? 'Recurring' : 'One-off'}</span>
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[12px] text-muted-foreground mb-1">Amount</label>
                        <input value={item.monthly_value} onChange={e => setConvertLineItems(prev => prev.map((row, rowIndex) => rowIndex === index ? { ...row, monthly_value: e.target.value } : row))} className="h-9 w-full rounded-lg border border-border/20 bg-background px-3 text-[13px] outline-none focus:border-primary/50" />
                      </div>
                      <div>
                        <label className="block text-[12px] text-muted-foreground mb-1">Start date</label>
                        <DatePicker value={item.start_date} onChange={value => setConvertLineItems(prev => prev.map((row, rowIndex) => rowIndex === index ? { ...row, start_date: value } : row))} placeholder="DD/MM/YYYY" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[12px] text-muted-foreground mb-1">Description</label>
                      <input value={item.description} onChange={e => setConvertLineItems(prev => prev.map((row, rowIndex) => rowIndex === index ? { ...row, description: e.target.value } : row))} className="h-9 w-full rounded-lg border border-border/20 bg-background px-3 text-[13px] outline-none focus:border-primary/50" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-5 py-3 border-t border-border/20 flex items-center justify-between bg-card">
              <Button size="sm" variant="ghost" onClick={() => setConvertDialogOpen(false)} disabled={converting}>Cancel</Button>
              <Button size="sm" onClick={handleConvert} disabled={converting || !form.name.trim() || (convertMode === 'existing' && !convertTargetClientId)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {converting ? 'Converting...' : convertMode === 'existing' ? 'Mark won and merge into client' : 'Mark won and create client'}
                {!converting && <ArrowRight className="ml-1 h-4 w-4" />}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
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
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setEditingProspect(null);
        }}
        defaultStage={sheetDefaultStage}
        onCreated={fetchProspects}
        prospect={editingProspect}
        stageOptions={PIPELINE_STAGES}
        assigneeOptions={users.map(user => ({ slug: user.full_name.toLowerCase().replace(/\s+/g, '-'), full_name: user.full_name }))}
        leadSourceOptions={[...new Set(prospects.map(prospect => prospect.source).filter((source): source is string => !!source && source.trim().length > 0))]}
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
