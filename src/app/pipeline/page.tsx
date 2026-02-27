'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import {
  Plus, Search, X, Phone, Mail, Building2, TrendingUp, ChevronDown, Check, Pencil,
  BarChart3, Table2, Kanban, PoundSterling, Percent, Trophy, UserPlus, Trash2,
  Calendar, FileText, MessageSquare, ChevronRight as ChevronRightIcon,
} from 'lucide-react';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import dynamic from 'next/dynamic';

const TaskDescriptionEditor = dynamic(
  () => import('@/components/board/task-description-editor').then(mod => ({ default: mod.TaskDescriptionEditor })),
  { ssr: false, loading: () => <div className="h-[80px] rounded-lg bg-muted/20 animate-pulse" /> }
);
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useUsers } from '@/hooks/use-users';
import { SearchableAssigneePopover } from '@/components/board/searchable-assignee-popover';
import { DatePicker } from '@/components/ui/date-picker';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger, PopoverClose } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { SERVICE_STYLES, PIPELINE_STAGES, LOSS_REASONS, getServiceStyle } from '@/lib/constants';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { ShortcutsDialog } from '@/components/ui/shortcuts-dialog';
import { usePersistedState } from '@/hooks/use-persisted-state';
import { FilterPopover } from '@/components/ui/filter-popover';

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
  team: string | null;
  won_at: string | null;
  lost_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ProspectFormState {
  name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  value: string;
  service: string;
  source: string;
  stage: string;
  assignee: string;
  notes: string;
  lost_reason: string | null;
  lost_reason_custom: string | null;
}

type ViewMode = 'pipeline' | 'table' | 'stats';

const emptyProspectForm: ProspectFormState = {
  name: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  value: '',
  service: '',
  source: '',
  stage: 'lead',
  assignee: '',
  notes: '',
  lost_reason: null,
  lost_reason_custom: null,
};

// ── Activity helpers ─────────────────────────────────────────────────────────
interface Activity {
  id: string;
  prospect_id: string;
  type: string;
  title: string;
  description?: string;
  created_by?: string;
  created_at: string;
}

const ACTIVITY_TYPES = [
  { value: 'call', label: 'Phone call', icon: Phone, color: '#60a5fa' },
  { value: 'email', label: 'Email', icon: Mail, color: '#34d399' },
  { value: 'meeting', label: 'Meeting', icon: Calendar, color: '#a78bfa' },
  { value: 'note', label: 'Note', icon: FileText, color: '#fbbf24' },
] as const;

function getActivityIcon(type: string) {
  switch (type) {
    case 'call': return { icon: Phone, color: '#60a5fa' };
    case 'email': return { icon: Mail, color: '#34d399' };
    case 'meeting': return { icon: Calendar, color: '#a78bfa' };
    case 'note': return { icon: FileText, color: '#fbbf24' };
    case 'stage_change': return { icon: ChevronRightIcon, color: '#818cf8' };
    case 'created': return { icon: Plus, color: '#6b7280' };
    case 'won': return { icon: Trophy, color: '#34d399' };
    case 'lost': return { icon: X, color: '#f87171' };
    default: return { icon: MessageSquare, color: '#6b7280' };
  }
}

function formatTimestamp(date: string) {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ── Prospect Sheet ───────────────────────────────────────────────────────────
function ProspectSheet({
  open,
  onOpenChange,
  editProspect,
  defaultStage,
  users,
  sourceOptions,
  onSaved,
  onDelete,
  onConvert,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editProspect: Prospect | null;
  defaultStage?: string;
  users: Array<{ id: string; full_name: string; is_active: boolean }>;
  sourceOptions: string[];
  onSaved: () => void;
  onDelete?: () => void;
  onConvert?: () => void;
}) {
  const [form, setForm] = useState<ProspectFormState>(emptyProspectForm);
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'activity'>('details');

  // Activities
  const [activities, setActivities] = useState<Activity[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const [logType, setLogType] = useState('call');
  const [logTitle, setLogTitle] = useState('');
  const [logDescription, setLogDescription] = useState('');
  const [logSaving, setLogSaving] = useState(false);

  const fetchActivities = useCallback(async (prospectId: string) => {
    try {
      const res = await fetch(`/api/prospects/${prospectId}/activities`);
      if (res.ok) setActivities(await res.json());
    } catch { /* silent */ }
  }, []);

  const logActivity = async () => {
    if (!editProspect || !logTitle.trim()) { toast.error('Title is required'); return; }
    setLogSaving(true);
    try {
      await fetch(`/api/prospects/${editProspect.id}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: logType, title: logTitle.trim(), description: logDescription.trim() || null }),
      });
      toast.success('Activity logged');
      setLogTitle('');
      setLogDescription('');
      setLogOpen(false);
      fetchActivities(editProspect.id);
    } catch { toast.error('Failed to log activity'); }
    finally { setLogSaving(false); }
  };
  const [serviceOpen, setServiceOpen] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [sourceSearch, setSourceSearch] = useState('');
  const [lostReasonOpen, setLostReasonOpen] = useState(false);

  // Line items
  interface LineItem { id: string; service: string; description: string | null; monthly_value: number; billing_type: 'recurring' | 'one-off'; start_date: string | null; end_date: string | null; is_active: boolean; }
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [lineItemDialogOpen, setLineItemDialogOpen] = useState(false);
  const [editingLineItem, setEditingLineItem] = useState<LineItem | null>(null);
  interface LineItemForm { service: string; description: string; monthly_value: string; billing_type: 'recurring' | 'one-off'; start_date: string; end_date: string; is_active: boolean; }
  const emptyLIForm: LineItemForm = { service: '', description: '', monthly_value: '', billing_type: 'recurring', start_date: '', end_date: '', is_active: true };
  const [liForm, setLiForm] = useState<LineItemForm>(emptyLIForm);

  const fetchLineItems = useCallback(async (prospectId: string): Promise<LineItem[]> => {
    try {
      const res = await fetch(`/api/prospects/${prospectId}/line-items`);
      if (res.ok) {
        const items: LineItem[] = await res.json();
        setLineItems(items);
        return items;
      }
    } catch { /* silent */ }
    return [];
  }, []);

  const syncDealValue = useCallback(async (prospectId: string, items: LineItem[]) => {
    const active = items.filter(i => i.is_active && (!i.end_date || new Date(i.end_date) >= new Date()));
    const total = active.reduce((s, i) => s + (i.monthly_value || 0), 0);
    try {
      await fetch('/api/prospects', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: prospectId, value: total || null }),
      });
    } catch { /* silent */ }
  }, []);

  const openAddLineItem = () => { setEditingLineItem(null); setLiForm(emptyLIForm); setLineItemDialogOpen(true); };
  const openEditLineItem = (item: LineItem) => {
    setEditingLineItem(item);
    setLiForm({ service: item.service, description: item.description || '', monthly_value: String(item.monthly_value), billing_type: item.billing_type, start_date: item.start_date || '', end_date: item.end_date || '', is_active: item.is_active });
    setLineItemDialogOpen(true);
  };

  const saveLineItem = async () => {
    if (!editProspect || !liForm.service.trim()) { toast.error('Service is required'); return; }
    const payload = { service: liForm.service.trim(), description: liForm.description || null, monthly_value: parseFloat(liForm.monthly_value) || 0, billing_type: liForm.billing_type, start_date: liForm.start_date || null, end_date: liForm.end_date || null, is_active: liForm.is_active };
    if (editingLineItem) {
      await fetch(`/api/prospect-line-items/${editingLineItem.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    } else {
      await fetch(`/api/prospects/${editProspect.id}/line-items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    }
    const items = await fetchLineItems(editProspect.id);
    await syncDealValue(editProspect.id, items);
    setLineItemDialogOpen(false);
  };

  const deleteLineItem = async (itemId: string) => {
    if (!editProspect) return;
    await fetch(`/api/prospect-line-items/${itemId}`, { method: 'DELETE' });
    const items = await fetchLineItems(editProspect.id);
    await syncDealValue(editProspect.id, items);
  };

  const toggleLineItemActive = async (item: LineItem) => {
    if (!editProspect) return;
    await fetch(`/api/prospect-line-items/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !item.is_active }) });
    const items = await fetchLineItems(editProspect.id);
    await syncDealValue(editProspect.id, items);
  };

  const activeLineItems = lineItems.filter(i => i.is_active && (!i.end_date || new Date(i.end_date) >= new Date()));
  const recurringTotal = activeLineItems.filter(i => i.billing_type !== 'one-off').reduce((s, i) => s + (i.monthly_value || 0), 0);
  const oneOffTotal = activeLineItems.filter(i => i.billing_type === 'one-off').reduce((s, i) => s + (i.monthly_value || 0), 0);
  const lineItemsTotal = recurringTotal + oneOffTotal;

  useEffect(() => {
    if (open) {
      setDeleteDialogOpen(false);
      setLineItems([]);
      setLineItemDialogOpen(false);
      setActivities([]);
      setLogOpen(false);
      setActiveTab('details');
      if (editProspect) {
        fetchLineItems(editProspect.id);
        fetchActivities(editProspect.id);
        setForm({
          name: editProspect.name || '',
          contact_name: editProspect.contact_name || '',
          contact_email: editProspect.contact_email || '',
          contact_phone: editProspect.contact_phone || '',
          value: editProspect.value != null ? String(editProspect.value) : '',
          service: editProspect.service || '',
          source: editProspect.source || '',
          stage: editProspect.stage || 'lead',
          assignee: editProspect.assignee || '',
          notes: editProspect.notes || '',
          lost_reason: editProspect.lost_reason || null,
          lost_reason_custom: editProspect.lost_reason_custom || null,
        });
      } else {
        setForm({ ...emptyProspectForm, stage: defaultStage || 'lead' });
      }
    }
  }, [open, editProspect, defaultStage]);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Company name is required'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        contact_name: form.contact_name.trim() || null,
        contact_email: form.contact_email.trim() || null,
        contact_phone: form.contact_phone.trim() || null,
        value: lineItemsTotal || null,
        service: form.service || null,
        source: form.source.trim() || null,
        stage: form.stage,
        assignee: form.assignee || null,
        notes: form.notes.trim() || null,
        lost_reason: form.stage === 'lost' ? (form.lost_reason || null) : null,
        lost_reason_custom: form.stage === 'lost' ? (form.lost_reason_custom || null) : null,
      };

      if (editProspect) {
        const res = await fetch('/api/prospects', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editProspect.id, ...payload }),
        });
        if (!res.ok) { toast.error('Failed to update prospect'); return; }

        // Handle stage transitions
        if (payload.stage === 'won' && editProspect.stage !== 'won') {
          setTimeout(() => confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } }), 200);
          toast.success('Deal won!');
        } else {
          toast.success(`${form.name} updated`);
        }
      } else {
        const res = await fetch('/api/prospects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) { toast.error('Failed to create prospect'); return; }
        toast.success('Prospect added to pipeline');
      }

      onOpenChange(false);
      onSaved();
    } catch { toast.error('Something went wrong'); }
    finally { setSaving(false); }
  };

  const activeUsers = users.filter(u => u.is_active);
  const currentStage = PIPELINE_STAGES.find(s => s.id === form.stage);

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="bg-card border-l border-border/20 p-0 overflow-y-auto [&>button]:hidden rounded-none md:rounded-tl-2xl md:rounded-bl-2xl !w-full md:!w-[560px] md:!max-w-[700px] md:!top-3 md:!bottom-3 md:!h-auto flex flex-col"
        showCloseButton={false}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Header — matches task sheet */}
        <div className="px-5 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground/30">
              {editProspect?.created_at && <span>Created {new Date(editProspect.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
              {editProspect?.stage && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${PIPELINE_STAGES.find(s => s.id === editProspect.stage)?.dotClass || ''}`} />
                    {PIPELINE_STAGES.find(s => s.id === editProspect.stage)?.label}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-0.5">
              {editProspect && onDelete && (
                <button onClick={() => setDeleteDialogOpen(true)} className="p-1.5 rounded-md hover:bg-destructive/20 text-muted-foreground/30 hover:text-destructive transition-colors duration-150">
                  <Trash2 size={14} />
                </button>
              )}
              <button onClick={() => onOpenChange(false)} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted/40 transition-colors duration-150 text-muted-foreground hover:text-foreground">
                <X size={11} />
              </button>
            </div>
          </div>

          {/* Title */}
          <div className="mt-2">
            <input
              autoFocus={!editProspect}
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Company name"
              className="w-full text-[17px] font-semibold bg-transparent border border-transparent outline-none placeholder:text-muted-foreground/60 text-foreground leading-snug px-2 py-1 rounded hover:bg-muted/40 focus:bg-muted/40 focus:border-primary/30 transition-colors duration-150 -mx-1"
            />
          </div>
        </div>

        {/* Tabs */}
        {editProspect && (
          <div className="px-5 flex items-center gap-0 border-b border-border/10">
            {(['details', 'activity'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-2 text-[12px] font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground/50 hover:text-muted-foreground'}`}
              >
                {tab === 'details' ? 'Details' : `Activity${activities.length > 0 ? ` (${activities.length})` : ''}`}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {(activeTab === 'details' || !editProspect) && (<>
          {/* Won banner */}
          {editProspect?.stage === 'won' && onConvert && (
            <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[13px] font-semibold text-emerald-400">Deal Won!</p>
                  <p className="text-[12px] text-muted-foreground/60 mt-0.5">Ready to onboard this client?</p>
                </div>
                <Button
                  size="sm"
                  onClick={onConvert}
                  className="h-8 text-[13px] gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white shrink-0"
                >
                  <UserPlus size={14} />
                  Convert to Client
                </Button>
              </div>
            </div>
          )}

          {/* Lost reason — editable */}
          {form.stage === 'lost' && (
            <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/10 space-y-2">
              <span className="text-[11px] font-medium text-destructive">Lost Reason</span>
              <Popover open={lostReasonOpen} onOpenChange={setLostReasonOpen}>
                <PopoverTrigger asChild>
                  <button className="w-full h-8 px-3 text-[13px] rounded-md border border-border/20 bg-secondary flex items-center justify-between hover:border-border/40 transition-colors">
                    <span className={form.lost_reason ? 'text-foreground' : 'text-muted-foreground/40'}>
                      {LOSS_REASONS.find(r => r.id === form.lost_reason)?.label || 'No reason selected'}
                    </span>
                    <ChevronDown size={14} className="text-muted-foreground/60" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-1" align="start">
                  {LOSS_REASONS.map(r => (
                    <button
                      key={r.id}
                      onClick={() => { setForm(f => ({ ...f, lost_reason: r.id })); setLostReasonOpen(false); }}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-[13px] transition-colors duration-150 ${
                        form.lost_reason === r.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted/60 text-muted-foreground'
                      }`}
                    >
                      <span>{r.label}</span>
                      {form.lost_reason === r.id && <Check size={12} />}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
              {form.lost_reason === 'other' && (
                <Input
                  value={form.lost_reason_custom || ''}
                  onChange={e => setForm(f => ({ ...f, lost_reason_custom: e.target.value }))}
                  placeholder="Custom reason..."
                  className="h-8 text-[13px] bg-secondary border-border/20"
                />
              )}
            </div>
          )}

          {/* Contact Name */}
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground/60">Contact Name</Label>
            <Input
              value={form.contact_name}
              onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
              placeholder="Jane Smith"
              className="text-[13px] h-9"
            />
          </div>

          {/* Contact Email */}
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground/60">Contact Email</Label>
            <Input
              type="email"
              value={form.contact_email}
              onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))}
              placeholder="jane@company.com"
              className="text-[13px] h-9"
            />
          </div>

          {/* Contact Phone */}
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground/60">Contact Phone</Label>
            <Input
              type="tel"
              value={form.contact_phone}
              onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))}
              placeholder="07xxx xxxxxx"
              className="text-[13px] h-9"
            />
          </div>

          {/* Services & Pricing (Line Items) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] text-muted-foreground/60">Services & Pricing</Label>
              {lineItemsTotal > 0 && (
                <span className="text-[13px] font-semibold text-emerald-400">
                  £{lineItemsTotal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              )}
            </div>

            {/* Existing line items */}
            {lineItems.length > 0 && (
              <div className="space-y-1.5">
                {lineItems.map(item => {
                  const expired = item.end_date && new Date(item.end_date) < new Date();
                  return (
                    <div key={item.id} className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border border-border/20 bg-muted/20 ${!item.is_active || expired ? 'opacity-50' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium truncate">{item.service}</p>
                        <p className="text-[11px] text-muted-foreground/60">
                          <span className={item.billing_type === 'one-off' ? 'text-amber-400' : 'text-emerald-400'}>
                            £{(item.monthly_value || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                          </span>
                          {item.billing_type === 'recurring' ? '/mo' : ' one-off'}
                          {!item.is_active && ' · Inactive'}
                          {expired && ' · Expired'}
                        </p>
                      </div>
                      <button onClick={() => openEditLineItem(item)}
                        className="p-1 rounded hover:bg-muted/60 text-muted-foreground/40 hover:text-foreground transition-colors">
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => deleteLineItem(item.id)}
                        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive transition-colors">
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}
                {recurringTotal > 0 && oneOffTotal > 0 && (
                  <div className="flex items-center gap-3 px-2.5 text-[11px] text-muted-foreground/60">
                    <span>Recurring: <span className="text-emerald-400">£{recurringTotal.toLocaleString('en-GB', { minimumFractionDigits: 2 })}/mo</span></span>
                    <span>One-off: <span className="text-amber-400">£{oneOffTotal.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span></span>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={openAddLineItem}
              className="w-full h-8 px-3 text-[11px] rounded-lg border border-dashed border-border/30 text-muted-foreground/60 hover:border-primary/40 hover:text-muted-foreground transition-colors flex items-center justify-center gap-1"
            >
              <Plus size={12} /> Add line item
            </button>

            {/* Deal value — read-only, computed from active line items */}
            <div className="flex items-center justify-between px-2.5 py-2 rounded-lg border border-border/20 bg-muted/10">
              <span className="text-[12px] text-muted-foreground/60 font-medium">Deal value</span>
              <span className="text-[13px] font-semibold text-foreground">
                £{lineItemsTotal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Source */}
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground/60">Source</Label>
            <Popover open={sourceOpen} onOpenChange={(o) => { setSourceOpen(o); if (o) setSourceSearch(''); }}>
              <PopoverTrigger asChild>
                <button className="w-full h-9 px-3 text-[13px] rounded-md border border-border/20 bg-secondary flex items-center justify-between hover:border-border/40 transition-colors">
                  {form.source ? (
                    <span>{form.source}</span>
                  ) : (
                    <span className="text-muted-foreground/40">Select source…</span>
                  )}
                  <ChevronDown size={14} className="text-muted-foreground/60" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-0" align="start">
                <input
                  type="text"
                  value={sourceSearch}
                  onChange={e => setSourceSearch(e.target.value)}
                  placeholder="Search or add new…"
                  className="w-full px-3 py-2 text-[13px] bg-transparent border-b border-border/20 outline-none text-foreground placeholder:text-muted-foreground/60 rounded-t-md"
                  autoFocus
                />
                <div className="p-1 max-h-[200px] overflow-y-auto">
                  {form.source && !sourceSearch && (
                    <>
                      <PopoverClose asChild>
                        <button
                          onClick={() => setForm(f => ({ ...f, source: '' }))}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-[13px] text-muted-foreground/30 hover:text-muted-foreground/60 hover:bg-muted/40 transition-colors"
                        >
                          Clear source
                        </button>
                      </PopoverClose>
                      <div className="border-t border-border/20 my-1" />
                    </>
                  )}
                  {sourceOptions
                    .filter(s => s.toLowerCase().includes(sourceSearch.toLowerCase()))
                    .map(s => (
                      <PopoverClose asChild key={s}>
                        <button
                          onClick={() => setForm(f => ({ ...f, source: s }))}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[13px] hover:bg-muted/60 transition-colors ${form.source === s ? 'bg-muted/50' : ''}`}
                        >
                          <span className="flex-1 text-left">{s}</span>
                          {form.source === s && <Check size={12} className="text-primary" />}
                        </button>
                      </PopoverClose>
                    ))}
                  {sourceSearch.trim() && !sourceOptions.some(s => s.toLowerCase() === sourceSearch.trim().toLowerCase()) && (
                    <PopoverClose asChild>
                      <button
                        onClick={() => setForm(f => ({ ...f, source: sourceSearch.trim() }))}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-[13px] text-primary hover:bg-primary/10 transition-colors"
                      >
                        <Plus size={12} />
                        <span>Add &ldquo;{sourceSearch.trim()}&rdquo;</span>
                      </button>
                    </PopoverClose>
                  )}
                  {sourceOptions.filter(s => s.toLowerCase().includes(sourceSearch.toLowerCase())).length === 0 && !sourceSearch.trim() && (
                    <div className="px-2 py-3 text-[13px] text-muted-foreground/30 text-center">No sources yet</div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Stage */}
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground/60">Stage</Label>
            <Popover open={stageOpen} onOpenChange={setStageOpen}>
              <PopoverTrigger asChild>
                <button className="w-full h-9 px-3 text-[13px] rounded-md border border-border/20 bg-secondary flex items-center gap-1.5 hover:border-border/40 transition-colors">
                  {currentStage ? (
                    <>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${currentStage.dotClass}`} />
                      <span className="flex-1 text-left">{currentStage.label}</span>
                    </>
                  ) : (
                    <span className="flex-1 text-left text-muted-foreground/40">Select stage…</span>
                  )}
                  <ChevronDown size={14} className="text-muted-foreground/60 shrink-0" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-44 p-1" align="start">
                {PIPELINE_STAGES.map(s => (
                  <button
                    key={s.id}
                    onClick={() => { setForm(f => ({ ...f, stage: s.id })); setStageOpen(false); }}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[13px] transition-colors ${
                      form.stage === s.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted/60 text-muted-foreground'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${s.dotClass}`} />
                    <span className="flex-1 text-left">{s.label}</span>
                    {form.stage === s.id && <Check size={12} />}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </div>

          {/* Assignee */}
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground/60">Assignee</Label>
            <SearchableAssigneePopover
              value={form.assignee}
              onChange={(v) => setForm(f => ({ ...f, assignee: v }))}
              open={assigneeOpen}
              onOpenChange={setAssigneeOpen}
              trigger={
                <button className="w-full h-9 px-3 text-[13px] rounded-md border border-border/20 bg-secondary flex items-center gap-1.5 hover:border-border/40 transition-colors">
                  {form.assignee ? (
                    <>
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] leading-none font-medium bg-muted/40 text-muted-foreground`}>
                        {form.assignee.charAt(0)}
                      </span>
                      <span className="flex-1 text-left">{form.assignee}</span>
                    </>
                  ) : (
                    <span className="flex-1 text-left text-muted-foreground/40">Select assignee…</span>
                  )}
                  <ChevronDown size={14} className="text-muted-foreground/60" />
                </button>
              }
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground/60">Notes</Label>
            <TaskDescriptionEditor
              content={form.notes}
              onChange={v => setForm(f => ({ ...f, notes: v }))}
              placeholder="Any notes about this prospect…"
            />
          </div>

          </>)}

          {/* Activity Tab */}
          {activeTab === 'activity' && editProspect && (
            <>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[13px] font-semibold">Activity</p>
                <Popover open={logOpen} onOpenChange={setLogOpen}>
                  <PopoverTrigger asChild>
                    <Button size="sm" variant="outline" className="h-7 text-[11px] border-border/20 px-2.5">
                      <Plus size={11} className="mr-1" /> Log activity
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-4" align="end">
                    <p className="text-[13px] font-semibold mb-3">Log activity</p>
                    <div className="space-y-3">
                      <div className="flex items-center gap-1 rounded-lg border border-border/20 bg-secondary p-0.5">
                        {ACTIVITY_TYPES.map(at => (
                          <button key={at.value} onClick={() => setLogType(at.value)}
                            className={`flex-1 h-7 rounded-md text-[11px] font-medium transition-all ${logType === at.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground/60 hover:text-foreground'}`}
                          >
                            {at.label.split(' ').pop()}
                          </button>
                        ))}
                      </div>
                      <Input value={logTitle} onChange={e => setLogTitle(e.target.value)} placeholder="Activity title..." className="h-9 text-[13px]" />
                      <Textarea value={logDescription} onChange={e => setLogDescription(e.target.value)} placeholder="Details (optional)" className="text-[13px] min-h-[80px] resize-none" />
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setLogOpen(false)} className="h-8 text-[12px]">Cancel</Button>
                        <Button size="sm" onClick={logActivity} disabled={logSaving} className="h-8 text-[12px]">{logSaving ? 'Saving...' : 'Log'}</Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-0">
                {activities.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground/40 italic py-6 text-center">No activity yet. Log your first interaction.</p>
                ) : activities.map(activity => {
                  const { icon: Icon, color } = getActivityIcon(activity.type);
                  return (
                    <div key={activity.id} className="flex gap-3 py-2.5 hover:bg-muted/20 -mx-2 px-2 rounded-lg transition-colors">
                      <div className="shrink-0 mt-0.5">
                        <div className="h-7 w-7 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
                          <Icon size={13} style={{ color }} />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium text-foreground truncate">{activity.title}</span>
                          <span className="text-[11px] text-muted-foreground/40 shrink-0" title={new Date(activity.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}>{formatTimestamp(activity.created_at)}</span>
                        </div>
                        {activity.description && <p className="text-[12px] text-muted-foreground/60 mt-0.5">{activity.description}</p>}
                        {activity.created_by && <span className="text-[11px] text-muted-foreground/30">by {activity.created_by}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border/20 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="text-[13px] h-8 border-border/20">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
            className="text-[13px] h-8"
          >
            {saving ? 'Saving…' : editProspect ? 'Save changes' : 'Add Prospect'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>

    {/* Delete confirmation */}
    {editProspect && onDelete && (
      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onCancel={() => setDeleteDialogOpen(false)}
        title="Delete prospect"
        description={`Are you sure you want to delete "${editProspect.name}"? This action cannot be undone.`}
        onConfirm={() => { onDelete(); setDeleteDialogOpen(false); }}
      />
    )}

    {/* Line Item Dialog */}
    <Dialog open={lineItemDialogOpen} onOpenChange={setLineItemDialogOpen}>
      <DialogContent className="sm:max-w-md bg-card border-border/20">
        <DialogHeader>
          <DialogTitle className="text-[15px]">{editingLineItem ? 'Edit line item' : 'Add line item'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-[13px] text-muted-foreground">Service *</Label>
            <Input value={liForm.service} onChange={e => setLiForm(f => ({ ...f, service: e.target.value }))}
              placeholder="e.g. SEO, Paid Ads, Social Media" className="h-9 text-[13px] bg-secondary border-border/20" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px] text-muted-foreground">Description</Label>
            <Input value={liForm.description} onChange={e => setLiForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Brief description" className="h-9 text-[13px] bg-secondary border-border/20" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px] text-muted-foreground">Billing type *</Label>
            <div className="flex items-center rounded-lg border border-border/20 bg-secondary p-0.5">
              {(['recurring', 'one-off'] as const).map(bt => (
                <button key={bt} type="button" onClick={() => setLiForm(f => ({ ...f, billing_type: bt }))}
                  className={`flex-1 h-8 px-3 rounded-md text-[13px] font-medium transition-all duration-150 ${
                    liForm.billing_type === bt ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {bt === 'recurring' ? 'Recurring' : 'One-off'}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px] text-muted-foreground">{liForm.billing_type === 'recurring' ? 'Monthly value (£) *' : 'Project value (£) *'}</Label>
            <Input type="text" inputMode="numeric"
              value={liForm.monthly_value} onChange={e => { if (/^\d*\.?\d{0,2}$/.test(e.target.value)) setLiForm(f => ({ ...f, monthly_value: e.target.value })); }}
              placeholder="0.00" className="h-9 text-[13px] bg-secondary border-border/20" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[13px] text-muted-foreground">Start date</Label>
              <div className="relative">
                <DatePicker value={liForm.start_date} onChange={v => setLiForm(f => ({ ...f, start_date: v }))} placeholder="DD/MM/YYYY" />
                {liForm.start_date && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); setLiForm(f => ({ ...f, start_date: '' })); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted/60 text-muted-foreground/60 hover:text-foreground transition-colors z-10">
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] text-muted-foreground">End date</Label>
              <div className="relative">
                <DatePicker value={liForm.end_date} onChange={v => {
                  if (liForm.start_date && v && v < liForm.start_date) { toast.error('End date cannot be before start date'); return; }
                  setLiForm(f => ({ ...f, end_date: v }));
                }} placeholder="DD/MM/YYYY" />
                {liForm.end_date && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); setLiForm(f => ({ ...f, end_date: '' })); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted/60 text-muted-foreground/60 hover:text-foreground transition-colors z-10">
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={liForm.is_active} onCheckedChange={v => setLiForm(f => ({ ...f, is_active: v }))} />
            <Label className="text-[13px] text-muted-foreground">Active</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setLineItemDialogOpen(false)} className="text-[13px] h-8 border-border/20">Cancel</Button>
          <Button onClick={saveLineItem} className="text-[13px] h-8">
            {editingLineItem ? 'Save changes' : 'Add line item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function PipelinePage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = usePersistedState('pipeline-search', '');
  const [viewMode, setViewMode] = useState<ViewMode>('pipeline');

  // Derive unique source options from existing prospects
  const sourceOptions = useMemo(() => {
    const sources = prospects.map(p => p.source).filter((s): s is string => !!s && s.trim() !== '');
    return [...new Set(sources)].sort((a, b) => a.localeCompare(b));
  }, [prospects]);

  // Sheet state — single unified sheet for new + edit
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingProspect, setEditingProspect] = useState<Prospect | null>(null);
  const [sheetDefaultStage, setSheetDefaultStage] = useState('lead');

  // Loss + Convert dialogs
  const [lossModalProspect, setLossModalProspect] = useState<string | null>(null);
  const [lossReason, setLossReason] = useState('');
  const [lossReasonCustom, setLossReasonCustom] = useState('');
  const [convertProspect, setConvertProspect] = useState<Prospect | null>(null);

  // Filters
  const [filterService, setFilterService] = usePersistedState<string[]>('pipeline-filterService', []);
  const [filterStage, setFilterStage] = usePersistedState<string[]>('pipeline-filterStage', []);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const { users } = useUsers();

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
        if (
          !p.name.toLowerCase().includes(q) &&
          !p.company?.toLowerCase().includes(q) &&
          !p.contact_name?.toLowerCase().includes(q) &&
          !p.contact_email?.toLowerCase().includes(q)
        ) return false;
      }
      if (filterService.length > 0 && (!p.service || !filterService.includes(p.service))) return false;
      if (filterStage.length > 0 && !filterStage.includes(p.stage)) return false;
      return true;
    });
  }, [prospects, searchQuery, filterService, filterStage]);

  const hasFilters = filterService.length > 0 || filterStage.length > 0 || searchQuery !== '';

  const openNewProspect = (stage?: string) => {
    setEditingProspect(null);
    setSheetDefaultStage(stage || 'lead');
    setSheetOpen(true);
  };

  const openEditProspect = (prospect: Prospect) => {
    setEditingProspect(prospect);
    setSheetOpen(true);
  };

  const updateProspect = async (id: string, updates: Partial<Prospect>) => {
    const prev = prospects.find(p => p.id === id);
    setProspects(ps => ps.map(p => p.id === id ? { ...p, ...updates } : p));

    if (updates.stage === 'won' && prev?.stage !== 'won') {
      updates.won_at = new Date().toISOString();
      setTimeout(() => {
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      }, 200);
      toast.success('Deal won!');
    }

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
    setSheetOpen(false);
    try {
      const res = await fetch(`/api/prospects?id=${id}`, { method: 'DELETE' });
      if (!res.ok) { toast.error('Failed to delete'); fetchProspects(); return; }
      toast.success('Prospect removed from pipeline');
    } catch { toast.error('Failed to delete'); fetchProspects(); }
  };

  const onDragEnd = (result: DropResult) => {
    const { draggableId, destination } = result;
    if (!destination) return;
    const newStage = destination.droppableId;
    const clearLoss = newStage !== 'won' && newStage !== 'lost'
      ? { lost_reason: null, lost_reason_custom: null, lost_at: null }
      : {};
    updateProspect(draggableId, { stage: newStage, ...clearLoss });
    if (newStage !== 'won' && newStage !== 'lost') {
      const stageLabel = PIPELINE_STAGES.find(s => s.id === newStage)?.label || newStage;
      toast.success(`Moved to ${stageLabel}`);
    }
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = filtered.length;
    const won = filtered.filter(p => p.stage === 'won');
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const wonRecent = won.filter(p => p.won_at && p.won_at >= thirtyDaysAgo);
    const lost = filtered.filter(p => p.stage === 'lost');
    const active = filtered.filter(p => !['won', 'lost'].includes(p.stage));
    const pipelineValue = active.reduce((s, p) => s + (p.value || 0), 0);
    const wonValue = wonRecent.reduce((s, p) => s + (p.value || 0), 0);
    const conversionRate = total > 0 ? Math.round((won.length / total) * 100) : 0;
    const avgDealValue = won.length > 0 ? Math.round(wonValue / won.length) : 0;

    const lossReasons: Record<string, number> = {};
    lost.forEach(p => {
      const reason = p.lost_reason || 'unspecified';
      lossReasons[reason] = (lossReasons[reason] || 0) + 1;
    });

    const stageCount: Record<string, number> = {};
    PIPELINE_STAGES.forEach(s => { stageCount[s.id] = filtered.filter(p => p.stage === s.id).length; });

    const stageValue: Record<string, number> = {};
    PIPELINE_STAGES.forEach(s => {
      stageValue[s.id] = filtered.filter(p => p.stage === s.id).reduce((sum, p) => sum + (p.value || 0), 0);
    });

    return { total, won: won.length, lost: lost.length, active: active.length, pipelineValue, wonValue, conversionRate, avgDealValue, lossReasons, stageCount, stageValue };
  }, [filtered]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
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

  return (
    <div className="animate-in fade-in duration-200">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Sales Pipeline</h1>
        <p className="text-[13px] text-muted-foreground/60 mt-1">
          {filtered.length} prospects · £{stats.pipelineValue.toLocaleString()} pipeline · £{stats.wonValue.toLocaleString()} won
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
            className="h-8 w-full sm:w-[180px] pl-8 pr-3 text-[13px] bg-secondary border border-border/20 rounded-lg outline-none focus:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors duration-150 placeholder:text-muted-foreground/60"
          />
        </div>

        {/* Stage filter — only in table/stats view (kanban already separates by stage) */}
        {viewMode !== 'pipeline' && (
          <FilterPopover
            label="Stage"
            options={PIPELINE_STAGES.map(s => ({ value: s.id, label: s.label, dot: s.id === 'lead' ? '#fbbf24' : s.id === 'won' ? '#34d399' : s.color }))}
            selected={filterStage}
            onSelectionChange={setFilterStage}
            width="w-48"
          />
        )}

        {/* Service filter */}
        <FilterPopover
          label="Service"
          options={Object.entries(SERVICE_STYLES).map(([key]) => { const s = getServiceStyle(key); return { value: key, label: s.label, dot: s.dot }; })}
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
        <Button size="sm" onClick={() => openNewProspect()}>
          <Plus className="h-4 w-4 mr-1" /> New Prospect
        </Button>
      </div>

      {/* Unified Prospect Sheet */}
      <ProspectSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        editProspect={editingProspect}
        defaultStage={sheetDefaultStage}
        users={users}
        sourceOptions={sourceOptions}
        onSaved={fetchProspects}
        onDelete={editingProspect ? () => deleteProspect(editingProspect.id) : undefined}
        onConvert={editingProspect?.stage === 'won' ? () => {
          setConvertProspect(editingProspect);
          setSheetOpen(false);
        } : undefined}
      />

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
        <PipelineView
          prospects={filtered}
          onDragEnd={onDragEnd}
          onUpdate={updateProspect}
          onDelete={deleteProspect}
          openNewProspect={openNewProspect}
          onEdit={openEditProspect}
        />
      ) : viewMode === 'table' ? (
        <TableView
          prospects={filtered}
          onUpdate={updateProspect}
          onDelete={deleteProspect}
          onEdit={openEditProspect}
        />
      ) : (
        <StatsView stats={stats} prospects={prospects} />
      )}

      {/* Convert to Client Dialog */}
      {convertProspect && (
        <ConvertToClientDialog
          prospect={convertProspect}
          onClose={() => setConvertProspect(null)}
          onConverted={() => {
            setConvertProspect(null);
            fetchProspects();
            toast.success('Client created!', { description: `${convertProspect.name} is now a client.` });
          }}
        />
      )}

      {/* Shortcuts Dialog */}
      <ShortcutsDialog
        open={showShortcuts}
        onClose={() => setShowShortcuts(false)}
        shortcuts={PAGE_SHORTCUTS}
        pageName="Pipeline"
      />
    </div>
  );
}

// ── Pipeline (Kanban) View ───────────────────────────────────────────────────
function PipelineView({ prospects, onDragEnd, onUpdate, onDelete, openNewProspect, onEdit }: {
  prospects: Prospect[];
  onDragEnd: (result: DropResult) => void;
  onUpdate: (id: string, updates: Partial<Prospect>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  openNewProspect: (stage?: string) => void;
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
                            {prospect.contact_name && (
                              <div className="text-[11px] text-muted-foreground/60 mb-1">{prospect.contact_name}</div>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              {prospect.service && (() => { const ss = getServiceStyle(prospect.service); return (
                                <span className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${ss.bg} ${ss.text}`}>
                                  <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: ss.dot }} />{ss.label}
                                </span>
                              ); })()}
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
  );
}

// ── Table View ───────────────────────────────────────────────────────────────
function TableView({ prospects, onUpdate, onDelete, onEdit }: {
  prospects: Prospect[];
  onUpdate: (id: string, updates: Partial<Prospect>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onEdit: (p: Prospect) => void;
}) {
  const [sortField, setSortField] = useState<string>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortIcon = ({ field }: { field: string }) => (
    <span className="ml-1 text-[9px]">
      {sortField === field ? (sortDir === 'asc' ? '▲' : '▼') : ''}
    </span>
  );

  const sorted = [...prospects].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    switch (sortField) {
      case 'name': return dir * (a.name || '').localeCompare(b.name || '');
      case 'value': return dir * ((a.value || 0) - (b.value || 0));
      case 'stage': return dir * (a.stage || '').localeCompare(b.stage || '');
      case 'created_at': return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      case 'assignee': return dir * (a.assignee || '').localeCompare(b.assignee || '');
      default: return 0;
    }
  });

  const columns: { key: string; label: string; sortable?: boolean }[] = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'contact', label: 'Contact' },
    { key: 'stage', label: 'Stage', sortable: true },
    { key: 'value', label: 'Value', sortable: true },
    { key: 'service', label: 'Service' },
    { key: 'source', label: 'Source' },
    { key: 'assignee', label: 'Assignee', sortable: true },
    { key: 'created_at', label: 'Created', sortable: true },
  ];

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/20 bg-muted/30">
                {columns.map(col => (
                  <th
                    key={col.key}
                    onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                    className={`text-left text-[11px] font-semibold text-muted-foreground/60 px-3 py-2 ${col.sortable ? 'cursor-pointer hover:text-foreground select-none' : ''}`}
                  >
                    {col.label}
                    {col.sortable && <SortIcon field={col.key} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-[13px] text-muted-foreground/40">
                    {prospects.length === 0 ? 'No prospects yet' : 'No prospects match filters'}
                  </td>
                </tr>
              ) : sorted.map(p => {
                const stage = PIPELINE_STAGES.find(s => s.id === p.stage);
                return (
                  <tr
                    key={p.id}
                    onClick={() => onEdit(p)}
                    className="border-b border-border/10 hover:bg-muted/20 transition-colors duration-150 cursor-pointer"
                  >
                    <td className="px-3 py-2.5 text-[13px] font-medium">{p.name}</td>
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
                      {p.service ? (() => { const ss = getServiceStyle(p.service); return (
                        <span className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${ss.bg} ${ss.text}`}>
                          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: ss.dot }} />{ss.label}
                        </span>
                      ); })() : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-[13px] text-muted-foreground/60">{p.source || '—'}</td>
                    <td className="px-3 py-2.5 text-[13px] text-muted-foreground/60">{p.assignee || '—'}</td>
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
  const totalLost = Object.values(s.lossReasons).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Pipeline Value', value: `£${s.pipelineValue.toLocaleString()}`, icon: PoundSterling, color: 'text-primary' },
          { label: 'Won (Last 30 Days)', value: `£${s.wonValue.toLocaleString()}`, icon: Trophy, color: 'text-emerald-400' },
          { label: 'Conversion Rate', value: `${s.conversionRate}%`, icon: Percent, color: 'text-amber-400' },
          { label: 'Avg Deal Value', value: `£${s.avgDealValue.toLocaleString()}`, icon: TrendingUp, color: 'text-blue-400' },
        ].map(kpi => (
          <div key={kpi.label} className="p-4 rounded-lg border border-border/20 bg-card">
            <div className="flex items-center gap-2 mb-2">
              <kpi.icon size={14} className={kpi.color} />
              <span className="text-[11px] font-medium text-muted-foreground/60">{kpi.label}</span>
            </div>
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Stage Funnel + Loss Reasons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
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
    </div>
  );
}

// ── Convert to Client Dialog ─────────────────────────────────────────────────
function ConvertToClientDialog({ prospect, onClose, onConverted }: {
  prospect: Prospect;
  onClose: () => void;
  onConverted: () => void;
}) {
  const [name, setName] = useState(prospect.name);
  const [monthlyRetainer, setMonthlyRetainer] = useState(prospect.value?.toString() || '');
  const [signupDate, setSignupDate] = useState(new Date().toISOString().split('T')[0]);
  const [saleSource, setSaleSource] = useState(prospect.source || '');
  const [archiveProspect, setArchiveProspect] = useState(false);
  const [converting, setConverting] = useState(false);

  const handleConvert = async () => {
    if (!name.trim()) { toast.error('Client name is required'); return; }
    setConverting(true);
    try {
      const res = await fetch(`/api/prospects/${prospect.id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          services: prospect.service ? [prospect.service] : [],
          monthly_retainer: monthlyRetainer ? parseFloat(monthlyRetainer) : null,
          signup_date: signupDate,
          sale_source: saleSource || null,
          sold_by: prospect.assignee || null,
          team: prospect.team || null,
          notes: prospect.notes || null,
          archive_prospect: archiveProspect,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Conversion failed');
      }
      onConverted();
    } catch (err) {
      toast.error('Conversion failed', { description: err instanceof Error ? err.message : 'Something went wrong' });
    } finally {
      setConverting(false);
    }
  };

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md bg-card border-border/20">
        <DialogHeader>
          <DialogTitle className="text-[15px] flex items-center gap-2">
            <UserPlus size={16} className="text-emerald-400" />
            Convert to Client
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-[13px] text-muted-foreground/70">
            This will create a new client record and mark the prospect as won.
          </p>

          <div className="space-y-1.5">
            <Label className="text-[13px] text-muted-foreground">Client name *</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              className="h-9 text-[13px] bg-secondary border-border/20"
            />
          </div>

          {prospect.contact_name && (
            <div className="space-y-1 text-[13px]">
              <Label className="text-[13px] text-muted-foreground">Contact</Label>
              <div className="h-9 px-3 rounded-md border border-border/20 bg-secondary/50 flex items-center text-muted-foreground">
                {prospect.contact_name}
                {prospect.contact_email && (
                  <span className="ml-2 text-muted-foreground/60">· {prospect.contact_email}</span>
                )}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-[13px] text-muted-foreground">Monthly retainer (£)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">£</span>
              <Input
                type="text"
                inputMode="numeric"
                value={monthlyRetainer}
                onChange={e => { if (/^\d*\.?\d{0,2}$/.test(e.target.value)) setMonthlyRetainer(e.target.value); }}
                className="h-9 pl-7 text-[13px] bg-secondary border-border/20"
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[13px] text-muted-foreground">Sign-up date</Label>
            <DatePicker
              value={signupDate}
              onChange={setSignupDate}
              placeholder="DD/MM/YYYY"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[13px] text-muted-foreground">Sale source</Label>
            <Input
              value={saleSource}
              onChange={e => setSaleSource(e.target.value)}
              placeholder="e.g. Referral, LinkedIn..."
              className="h-9 text-[13px] bg-secondary border-border/20"
            />
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={archiveProspect}
              onChange={e => setArchiveProspect(e.target.checked)}
              className="w-4 h-4 rounded border-border/40 accent-primary"
            />
            <span className="text-[13px] text-muted-foreground">Hide prospect from active pipeline view</span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="text-[13px] h-8 border-border/20">
            Cancel
          </Button>
          <Button
            onClick={handleConvert}
            disabled={converting || !name.trim()}
            className="text-[13px] h-8 bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5"
          >
            <UserPlus size={14} />
            {converting ? 'Converting…' : 'Create Client'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
