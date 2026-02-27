'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Phone, Mail, Calendar, FileText, MessageSquare, Plus, Clock, ChevronRight, Trash2, User, Globe, Building2, Check, X, Search, ChevronDown, Pencil, BadgePoundSterling, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { PIPELINE_STAGES, getServiceStyle, SERVICE_STYLES, getAssigneeColor, getInitials } from '@/lib/constants';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { DatePicker } from '@/components/ui/date-picker';
import Link from 'next/link';

interface Prospect {
  id: string;
  name: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  stage: string;
  value?: number;
  service?: string;
  source?: string;
  assignee?: string;
  notes?: string;
  team?: string;
  created_at: string;
  updated_at?: string;
  won_at?: string;
  lost_at?: string;
  lost_reason?: string;
}

interface Activity {
  id: string;
  prospect_id: string;
  type: 'call' | 'email' | 'meeting' | 'note' | 'stage_change' | 'created' | 'won' | 'lost';
  title: string;
  description?: string;
  from_stage?: string;
  to_stage?: string;
  created_by?: string;
  created_at: string;
}

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

interface Team {
  id: string;
  name: string;
}

const ACTIVITY_TYPES = [
  { value: 'call', label: 'Phone call', icon: Phone, color: '#60a5fa' },
  { value: 'email', label: 'Email', icon: Mail, color: '#34d399' },
  { value: 'meeting', label: 'Meeting', icon: Calendar, color: '#a78bfa' },
  { value: 'note', label: 'Note', icon: FileText, color: '#fbbf24' },
] as const;

const BILLING_TYPE_STYLES: Record<string, { bg: string; text: string }> = {
  recurring: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
  'one-off': { bg: 'bg-amber-500/10', text: 'text-amber-400' },
};

function getActivityIcon(type: string) {
  switch (type) {
    case 'call': return { icon: Phone, color: '#60a5fa' };
    case 'email': return { icon: Mail, color: '#34d399' };
    case 'meeting': return { icon: Calendar, color: '#a78bfa' };
    case 'note': return { icon: FileText, color: '#fbbf24' };
    case 'stage_change': return { icon: ChevronRight, color: '#818cf8' };
    case 'created': return { icon: Plus, color: '#6b7280' };
    case 'won': return { icon: ChevronRight, color: '#34d399' };
    case 'lost': return { icon: ChevronRight, color: '#f87171' };
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

  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

function formatDateUK(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function toISODateString(d: string | null | undefined) {
  if (!d) return '';
  try { return new Date(d).toISOString().split('T')[0]; } catch { return ''; }
}

// ─── Line Item Dialog (same as client page, minus assignee) ─────────────────

interface LineItemFormData {
  service: string;
  description: string;
  monthly_value: string;
  billing_type: 'recurring' | 'one-off';
  start_date: string;
  end_date: string;
  is_active: boolean;
}

const emptyLineItem: LineItemFormData = {
  service: '',
  description: '',
  monthly_value: '',
  billing_type: 'recurring',
  start_date: '',
  end_date: '',
  is_active: true,
};

function LineItemDialog({
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
        is_active: initialData.is_active,
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border/20">
        <DialogHeader>
          <DialogTitle className="text-[15px]">{initialData ? 'Edit line item' : 'Add line item'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-[13px] text-muted-foreground">Service *</Label>
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
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => { setForm(f => ({ ...f, service: s.id })); setServiceOpen(false); setServiceSearch(''); }}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-[13px] hover:bg-muted/60 transition-colors ${form.service === s.id ? 'bg-muted/40' : ''}`}
                    >
                      <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: getServiceStyle(s.id).dot }} /> {s.label}</span>
                      {form.service === s.id && <Check size={14} className="text-primary" />}
                    </button>
                  ))}
                  {serviceSearch.trim() && !services.some(s => s.label.toLowerCase() === serviceSearch.toLowerCase()) && (
                    <button
                      type="button"
                      onClick={async () => {
                        const slug = serviceSearch.trim().toLowerCase().replace(/\s+/g, '-');
                        const res = await fetch('/api/services', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ id: slug, label: serviceSearch.trim() }),
                        });
                        if (res.ok) {
                          const newSvc = await res.json();
                          setServices(prev => [...prev, newSvc]);
                          setForm(f => ({ ...f, service: newSvc.id }));
                          toast.success(`Service "${serviceSearch.trim()}" created`);
                        } else { toast.error('Failed to create service'); }
                        setServiceOpen(false);
                        setServiceSearch('');
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-[13px] text-primary hover:bg-muted/60 transition-colors"
                    >
                      <Plus size={12} /> Create &ldquo;{serviceSearch.trim()}&rdquo;
                    </button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px] text-muted-foreground">Description</Label>
            <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Brief description" className="h-9 text-[13px] bg-secondary border-border/20" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px] text-muted-foreground">Billing type *</Label>
            <div className="flex items-center rounded-lg border border-border/20 bg-secondary p-0.5">
              {(['recurring', 'one-off'] as const).map(bt => (
                <button key={bt} type="button" onClick={() => setForm(f => ({ ...f, billing_type: bt }))}
                  className={`flex-1 h-8 px-3 rounded-md text-[13px] font-medium transition-all duration-150 ${
                    form.billing_type === bt ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {bt === 'recurring' ? 'Recurring' : 'One-off'}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px] text-muted-foreground">{form.billing_type === 'recurring' ? 'Monthly value' : 'Project value'} *</Label>
            <Input type="text" inputMode="numeric"
              value={form.monthly_value} onChange={e => { if (/^\d*\.?\d*$/.test(e.target.value)) setForm(f => ({ ...f, monthly_value: e.target.value })); }}
              placeholder="0.00" className="h-9 text-[13px] bg-secondary border-border/20" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[13px] text-muted-foreground">Start date</Label>
              <div className="relative">
                <DatePicker value={form.start_date} onChange={v => setForm(f => ({ ...f, start_date: v }))} placeholder="DD/MM/YYYY" />
                {form.start_date && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); setForm(f => ({ ...f, start_date: '' })); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted/60 text-muted-foreground/60 hover:text-foreground transition-colors z-10">
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] text-muted-foreground">End date</Label>
              <div className="relative">
                <DatePicker
                  value={form.end_date}
                  onChange={v => {
                    if (form.start_date && v && v < form.start_date) { toast.error('End date cannot be before start date'); return; }
                    setForm(f => ({ ...f, end_date: v }));
                  }}
                  placeholder="DD/MM/YYYY"
                />
                {form.end_date && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); setForm(f => ({ ...f, end_date: '' })); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted/60 text-muted-foreground/60 hover:text-foreground transition-colors z-10">
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
            <Label className="text-[13px] text-muted-foreground">Active</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="text-[13px] h-8 border-border/20">Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="text-[13px] h-8">
            {saving ? 'Saving...' : initialData ? 'Save changes' : 'Add line item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Convert to Client Dialog ───────────────────────────────────────────────

function ConvertDialog({
  open,
  onOpenChange,
  prospect,
  lineItems,
  onConverted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prospect: Prospect;
  lineItems: ProspectLineItem[];
  onConverted: (clientId: string) => void;
}) {
  const [team, setTeam] = useState(prospect.team || '');
  const [teams, setTeams] = useState<Team[]>([]);
  const [archiveProspect, setArchiveProspect] = useState(true);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    fetch('/api/teams').then(r => r.json()).then(d => setTeams(d || [])).catch(() => {});
  }, []);

  const totalRecurring = lineItems.filter(i => i.is_active && i.billing_type === 'recurring').reduce((s, i) => s + i.monthly_value, 0);
  const services = [...new Set(lineItems.map(i => i.service))];

  const handleConvert = async () => {
    setConverting(true);
    try {
      const res = await fetch(`/api/prospects/${prospect.id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: prospect.name,
          team: team || null,
          services,
          monthly_retainer: totalRecurring,
          sale_source: prospect.source || null,
          sold_by: prospect.assignee || null,
          archive_prospect: archiveProspect,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      toast.success('Prospect converted to client', { description: `${prospect.name} is now an active client.` });
      onConverted(data.client.id);
    } catch (err) {
      toast.error('Failed to convert', { description: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setConverting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border/20">
        <DialogHeader>
          <DialogTitle className="text-[15px]">Convert to client</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-[13px] text-muted-foreground">
            This will create <strong>{prospect.name}</strong> as an active client and mark this prospect as won.
          </p>

          {/* Summary */}
          <div className="rounded-lg border border-border/20 bg-muted/10 p-3 space-y-2">
            {services.length > 0 && (
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-muted-foreground">Services</span>
                <div className="flex items-center gap-1.5">
                  {services.map(s => {
                    const style = getServiceStyle(s);
                    return (
                      <span key={s} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${style.bg} ${style.text}`}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: style.dot }} />
                        {style.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
            {totalRecurring > 0 && (
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-muted-foreground">Monthly retainer</span>
                <span className="font-medium text-emerald-400">£{totalRecurring.toLocaleString()}/mo</span>
              </div>
            )}
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-muted-foreground">Line items</span>
              <span>{lineItems.length}</span>
            </div>
          </div>

          {/* Team selection */}
          <div className="space-y-1.5">
            <Label className="text-[13px] text-muted-foreground">Assign to team</Label>
            <select
              value={team}
              onChange={e => setTeam(e.target.value)}
              className="w-full h-9 px-3 text-[13px] bg-secondary border border-border/20 rounded-md"
            >
              <option value="">No team</option>
              {teams.map(t => (
                <option key={t.id} value={t.name.toLowerCase()}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Archive toggle */}
          <div className="flex items-center gap-3">
            <Switch checked={archiveProspect} onCheckedChange={setArchiveProspect} />
            <Label className="text-[13px] text-muted-foreground">Archive prospect after conversion</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="text-[13px] h-8 border-border/20">Cancel</Button>
          <Button onClick={handleConvert} disabled={converting} className="text-[13px] h-8 bg-emerald-600 hover:bg-emerald-700 text-white">
            {converting ? 'Converting...' : 'Convert to client'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────

export default function ProspectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [lineItems, setLineItems] = useState<ProspectLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [logOpen, setLogOpen] = useState(false);
  const [logType, setLogType] = useState<string>('call');
  const [logTitle, setLogTitle] = useState('');
  const [logDescription, setLogDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // Line item state
  const [lineItemDialogOpen, setLineItemDialogOpen] = useState(false);
  const [editingLineItem, setEditingLineItem] = useState<ProspectLineItem | null>(null);
  const [deleteLineItem, setDeleteLineItem] = useState<ProspectLineItem | null>(null);
  const [deletingLineItem, setDeletingLineItem] = useState(false);

  // Convert dialog
  const [convertOpen, setConvertOpen] = useState(false);

  const loadData = useCallback(async () => {
    const [pRes, aRes, liRes] = await Promise.all([
      fetch(`/api/prospects`).then(r => r.json()),
      fetch(`/api/prospects/${id}/activities`).then(r => r.json()),
      fetch(`/api/prospects/${id}/line-items`).then(r => r.json()),
    ]);
    const p = (pRes || []).find((pr: Prospect) => pr.id === id);
    setProspect(p || null);
    setActivities(aRes || []);
    setLineItems(Array.isArray(liRes) ? liRes : []);
    setLoading(false);
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const logActivity = async () => {
    if (!logTitle.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/prospects/${id}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: logType, title: logTitle, description: logDescription || null }),
      });
      if (!res.ok) throw new Error();
      toast.success('Activity logged');
      setLogTitle('');
      setLogDescription('');
      setLogOpen(false);
      loadData();
    } catch {
      toast.error('Failed to log activity');
    } finally {
      setSaving(false);
    }
  };

  const updateStage = async (newStage: string) => {
    if (!prospect || prospect.stage === newStage) return;
    try {
      const res = await fetch('/api/prospects', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: prospect.id, stage: newStage }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Moved to ${newStage.charAt(0).toUpperCase() + newStage.slice(1)}`);
      loadData();
    } catch {
      toast.error('Failed to update stage');
    }
  };

  const handleSaveLineItem = async (data: LineItemFormData) => {
    const payload = {
      service: data.service,
      description: data.description || null,
      monthly_value: parseFloat(data.monthly_value) || 0,
      billing_type: data.billing_type,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      is_active: data.is_active,
    };

    if (editingLineItem) {
      const res = await fetch(`/api/prospects/${id}/line-items`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingLineItem.id, ...payload }),
      });
      if (!res.ok) throw new Error('Failed to update');
      toast.success('Line item updated');
    } else {
      const res = await fetch(`/api/prospects/${id}/line-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to create');
      toast.success('Line item added');
    }
    setEditingLineItem(null);
    loadData();
  };

  const handleDeleteLineItem = async () => {
    if (!deleteLineItem) return;
    setDeletingLineItem(true);
    try {
      const res = await fetch(`/api/prospects/${id}/line-items`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteLineItem.id }),
      });
      if (!res.ok) throw new Error();
      toast.success('Line item deleted');
      setDeleteLineItem(null);
      loadData();
    } catch {
      toast.error('Failed to delete');
    } finally {
      setDeletingLineItem(false);
    }
  };

  if (loading) return (
    <div className="animate-in fade-in duration-200 p-6">
      <div className="h-6 w-32 bg-muted/30 rounded animate-pulse mb-4" />
      <div className="h-8 w-64 bg-muted/30 rounded animate-pulse mb-2" />
      <div className="h-4 w-48 bg-muted/20 rounded animate-pulse" />
    </div>
  );

  if (!prospect) return (
    <div className="p-6 text-center">
      <p className="text-muted-foreground">Prospect not found</p>
      <Button variant="ghost" onClick={() => router.push('/pipeline')} className="mt-4">Back to pipeline</Button>
    </div>
  );

  const stageInfo = PIPELINE_STAGES.find(s => s.id === prospect.stage);
  const serviceStyle = prospect.service ? getServiceStyle(prospect.service) : null;
  const totalRecurring = lineItems.filter(i => i.is_active && i.billing_type === 'recurring').reduce((s, i) => s + i.monthly_value, 0);

  return (
    <div className="animate-in fade-in duration-200">
      {/* Header */}
      <button onClick={() => router.push('/pipeline')} className="flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground transition-colors mb-4">
        <ArrowLeft size={14} /> Back
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{prospect.name}</h1>
          <div className="flex items-center gap-3 mt-1.5">
            {stageInfo && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border" style={{ borderColor: `${stageInfo.color}40`, color: stageInfo.color, backgroundColor: `${stageInfo.color}10` }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: stageInfo.color }} />
                {stageInfo.label}
              </span>
            )}
            {prospect.value && (
              <span className="text-[13px] text-muted-foreground">£{prospect.value.toLocaleString()}</span>
            )}
            {serviceStyle && (
              <span className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${serviceStyle.bg} ${serviceStyle.text}`}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: serviceStyle.dot }} />
                {serviceStyle.label}
              </span>
            )}
          </div>
        </div>
        {/* Convert to Client button — show when stage is won */}
        {prospect.stage === 'won' && (
          <Button onClick={() => setConvertOpen(true)} className="h-8 text-[13px] gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
            <ArrowRightLeft size={14} /> Convert to client
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Details + Stage + Line Items */}
        <div className="space-y-4">
          {/* Contact info */}
          <div className="rounded-lg border border-border/20 bg-card p-4">
            <h3 className="text-[13px] font-semibold mb-3">Contact details</h3>
            <div className="space-y-2">
              {prospect.contact_name && (
                <div className="flex items-center gap-2 text-[13px]">
                  <User size={13} className="text-muted-foreground/60 shrink-0" />
                  <span>{prospect.contact_name}</span>
                </div>
              )}
              {prospect.contact_email && (
                <div className="flex items-center gap-2 text-[13px]">
                  <Mail size={13} className="text-muted-foreground/60 shrink-0" />
                  <a href={`mailto:${prospect.contact_email}`} className="text-primary hover:underline">{prospect.contact_email}</a>
                </div>
              )}
              {prospect.contact_phone && (
                <div className="flex items-center gap-2 text-[13px]">
                  <Phone size={13} className="text-muted-foreground/60 shrink-0" />
                  <a href={`tel:${prospect.contact_phone}`} className="text-primary hover:underline">{prospect.contact_phone}</a>
                </div>
              )}
              {prospect.source && (
                <div className="flex items-center gap-2 text-[13px]">
                  <Globe size={13} className="text-muted-foreground/60 shrink-0" />
                  <span className="text-muted-foreground">{prospect.source}</span>
                </div>
              )}
              {prospect.assignee && (
                <div className="flex items-center gap-2 text-[13px]">
                  <Building2 size={13} className="text-muted-foreground/60 shrink-0" />
                  <span className="text-muted-foreground">{prospect.assignee}</span>
                </div>
              )}
              {!prospect.contact_name && !prospect.contact_email && !prospect.contact_phone && (
                <p className="text-[13px] text-muted-foreground/40">No contact details</p>
              )}
            </div>
          </div>

          {/* Stage pipeline */}
          <div className="rounded-lg border border-border/20 bg-card p-4">
            <h3 className="text-[13px] font-semibold mb-3">Pipeline stage</h3>
            <div className="space-y-1">
              {PIPELINE_STAGES.map(stage => {
                const isActive = prospect.stage === stage.id;
                const isPast = PIPELINE_STAGES.findIndex(s => s.id === prospect.stage) > PIPELINE_STAGES.findIndex(s => s.id === stage.id);
                return (
                  <button
                    key={stage.id}
                    onClick={() => updateStage(stage.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-[13px] transition-all duration-150 ${
                      isActive ? 'bg-primary/10 text-primary font-medium' : isPast ? 'text-muted-foreground' : 'text-muted-foreground/60 hover:bg-muted/40'
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: isActive || isPast ? stage.color : 'var(--border)' }} />
                    {stage.label}
                    {isActive && <span className="ml-auto text-[10px] text-primary/60">Current</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          {prospect.notes && (
            <div className="rounded-lg border border-border/20 bg-card p-4">
              <h3 className="text-[13px] font-semibold mb-2">Notes</h3>
              <p className="text-[13px] text-muted-foreground whitespace-pre-wrap">{prospect.notes}</p>
            </div>
          )}

          {/* Timestamps */}
          <div className="rounded-lg border border-border/20 bg-card p-4">
            <h3 className="text-[13px] font-semibold mb-2">Timeline</h3>
            <div className="space-y-1 text-[12px] text-muted-foreground/60">
              <div className="flex items-center gap-2">
                <Clock size={11} /> Created {new Date(prospect.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
              {prospect.won_at && (
                <div className="flex items-center gap-2 text-emerald-400">
                  <Clock size={11} /> Won {new Date(prospect.won_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              )}
              {prospect.lost_at && (
                <div className="flex items-center gap-2 text-red-400">
                  <Clock size={11} /> Lost {new Date(prospect.lost_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {prospect.lost_reason && <span>— {prospect.lost_reason}</span>}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Billing + Activity */}
        <div className="lg:col-span-2 space-y-4">
          {/* Billing line items */}
          <div className="rounded-lg border border-border/20 bg-card">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
              <div className="flex items-center gap-2">
                <BadgePoundSterling size={14} className="text-muted-foreground/60" />
                <h3 className="text-[13px] font-semibold">Billing</h3>
                {totalRecurring > 0 && (
                  <span className="text-[11px] text-muted-foreground/50">£{totalRecurring.toLocaleString()}/mo</span>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[12px]"
                onClick={() => { setEditingLineItem(null); setLineItemDialogOpen(true); }}
              >
                <Plus size={12} className="mr-1" /> Add line item
              </Button>
            </div>

            {lineItems.length === 0 ? (
              <div className="px-4 py-8 text-center text-[13px] text-muted-foreground/40">
                No billing line items. Add services to build the proposal.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/20 hover:bg-transparent">
                      <TableHead className="text-[12px] text-muted-foreground font-medium">Service</TableHead>
                      <TableHead className="text-[12px] text-muted-foreground font-medium">Description</TableHead>
                      <TableHead className="text-[12px] text-muted-foreground font-medium">Type</TableHead>
                      <TableHead className="text-[12px] text-muted-foreground font-medium">Value</TableHead>
                      <TableHead className="text-[12px] text-muted-foreground font-medium">Start</TableHead>
                      <TableHead className="text-[12px] text-muted-foreground font-medium">End</TableHead>
                      <TableHead className="text-[12px] text-muted-foreground font-medium">Active</TableHead>
                      <TableHead className="text-[12px] text-muted-foreground font-medium w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems.map(item => (
                      <TableRow key={item.id} className={`border-border/20 hover:bg-secondary/30 transition-colors ${!item.is_active ? 'opacity-50' : ''}`}>
                        <TableCell className="text-[13px] font-medium">{getServiceStyle(item.service).label}</TableCell>
                        <TableCell className="text-[13px] text-muted-foreground">{item.description || '—'}</TableCell>
                        <TableCell>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${BILLING_TYPE_STYLES[item.billing_type]?.bg || 'bg-muted/20'} ${BILLING_TYPE_STYLES[item.billing_type]?.text || 'text-muted-foreground'}`}>
                            {item.billing_type === 'one-off' ? 'One-off' : 'Recurring'}
                          </span>
                        </TableCell>
                        <TableCell className="text-[13px] font-semibold text-status-success">
                          £{(item.monthly_value || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          {item.billing_type === 'recurring' && <span className="text-[10px] text-muted-foreground/60 font-normal">/mo</span>}
                        </TableCell>
                        <TableCell className="text-[13px] text-muted-foreground">{formatDateUK(item.start_date)}</TableCell>
                        <TableCell className="text-[13px] text-muted-foreground">{formatDateUK(item.end_date)}</TableCell>
                        <TableCell>
                          <span className={`text-[11px] font-medium ${item.is_active ? 'text-emerald-400' : 'text-muted-foreground/40'}`}>
                            {item.is_active ? 'Yes' : 'No'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => { setEditingLineItem(item); setLineItemDialogOpen(true); }}
                              className="p-1.5 rounded hover:bg-muted/60 text-muted-foreground/60 hover:text-foreground transition-colors"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => setDeleteLineItem(item)}
                              className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground/60 hover:text-destructive transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Activity feed */}
          <div className="rounded-lg border border-border/20 bg-card">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
              <h3 className="text-[13px] font-semibold">Activity</h3>
              <Popover open={logOpen} onOpenChange={setLogOpen}>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="outline" className="h-7 text-[12px]">
                    <Plus size={12} className="mr-1" /> Log activity
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-3" align="end">
                  <p className="text-[13px] font-semibold mb-3">Log activity</p>
                  <div className="space-y-3">
                    <div className="flex gap-1">
                      {ACTIVITY_TYPES.map(t => (
                        <button
                          key={t.value}
                          onClick={() => setLogType(t.value)}
                          className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors ${
                            logType === t.value ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/40'
                          }`}
                        >
                          <t.icon size={11} /> {t.label}
                        </button>
                      ))}
                    </div>
                    <input
                      value={logTitle}
                      onChange={e => setLogTitle(e.target.value)}
                      placeholder="Activity title..."
                      className="w-full h-8 px-3 text-[13px] bg-secondary border border-border/20 rounded-md outline-none focus:border-primary/50 placeholder:text-muted-foreground/60"
                    />
                    <textarea
                      value={logDescription}
                      onChange={e => setLogDescription(e.target.value)}
                      placeholder="Details (optional)..."
                      rows={3}
                      className="w-full px-3 py-2 text-[13px] bg-secondary border border-border/20 rounded-md outline-none focus:border-primary/50 placeholder:text-muted-foreground/60 resize-none"
                    />
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setLogOpen(false)} className="h-7 text-[12px]">Cancel</Button>
                      <Button size="sm" onClick={logActivity} disabled={saving} className="h-7 text-[12px]">{saving ? 'Saving...' : 'Log'}</Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="divide-y divide-border/10">
              {activities.length === 0 ? (
                <div className="px-4 py-8 text-center text-[13px] text-muted-foreground/40">
                  No activity yet. Log your first interaction.
                </div>
              ) : activities.map(activity => {
                const { icon: Icon, color } = getActivityIcon(activity.type);
                return (
                  <div key={activity.id} className="flex gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                    <div className="shrink-0 mt-0.5">
                      <div className="h-7 w-7 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
                        <Icon size={13} style={{ color }} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-foreground">{activity.title}</span>
                        <span className="text-[11px] text-muted-foreground/40 shrink-0">{formatTimestamp(activity.created_at)}</span>
                      </div>
                      {activity.description && (
                        <p className="text-[12px] text-muted-foreground mt-0.5">{activity.description}</p>
                      )}
                      {activity.created_by && (
                        <span className="text-[11px] text-muted-foreground/40">by {activity.created_by}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Line Item Dialog */}
      <LineItemDialog
        open={lineItemDialogOpen}
        onOpenChange={v => { setLineItemDialogOpen(v); if (!v) setEditingLineItem(null); }}
        initialData={editingLineItem}
        onSave={handleSaveLineItem}
      />

      {/* Delete Line Item Confirm */}
      <AlertDialog open={!!deleteLineItem} onOpenChange={open => { if (!open) setDeleteLineItem(null); }}>
        <AlertDialogContent className="bg-card border-border/20 sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px]">Delete line item?</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-muted-foreground">
              This will permanently remove this billing line item.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-[13px] h-8 border-border/20">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLineItem}
              disabled={deletingLineItem}
              className="text-[13px] h-8 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingLineItem ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Convert to Client Dialog */}
      {prospect.stage === 'won' && (
        <ConvertDialog
          open={convertOpen}
          onOpenChange={setConvertOpen}
          prospect={prospect}
          lineItems={lineItems}
          onConverted={(clientId) => {
            router.push(`/clients/${clientId}`);
          }}
        />
      )}
    </div>
  );
}
