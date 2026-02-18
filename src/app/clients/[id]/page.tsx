'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { SERVICE_STYLES, STATUS_STYLES, PRIORITY_STYLES, getTeamStyle, toDisplayName } from '@/lib/constants';
import { formatDueDate, getDueDateColor } from '@/lib/date';
import { ArrowLeft, Tag, Calendar, FileText, BadgePoundSterling, Clock, Edit2, Check, X, Plus, Pencil, Trash2, User, Phone, Globe, MapPin, Mail, ChevronRight, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { NAME_TO_SLUG } from '@/lib/constants';
import Link from 'next/link';
import { toast } from 'sonner';
import { ServiceIcon } from '@/components/ui/service-icon';
import { TaskSheet } from '@/components/board/task-sheet';
import type { Task, Project } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
import { DatePicker } from '@/components/ui/date-picker';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Client {
  id: string;
  name: string;
  team: string;
  status: string;
  services: string[];
  monthly_retainer: number;
  assigned_members: string[];
  color: string | null;
  created_at: string;
  updated_at?: string;
  contract_value?: number;
  contract_start?: string;
  contract_end?: string;
  contract_renewal?: string;
  sale_source?: string;
  sold_by?: string;
  sale_closed_at?: string;
  notes?: string;
  signup_date?: string;
  churned_at?: string;
  lost_reason?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  website?: string;
  address?: string;
}

interface ClientTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignee: string | null;
  due_date: string | null;
  service: string | null;
  is_recurring: boolean;
  client_id: string | null;
}

interface ContractLineItem {
  id: string;
  client_id: string;
  service: string;
  description: string | null;
  monthly_value: number;
  billing_type: 'recurring' | 'one-off';
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const ALL_SERVICES = Object.entries(SERVICE_STYLES).map(([key, style]) => ({
  value: key,
  label: style.label,
}));

function monthsActive(from: string, to?: string): number {
  const start = new Date(from);
  const end = to ? new Date(to) : new Date();
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
}

function contractDuration(startDate: string | null, endDate: string | null): string {
  if (!startDate && !endDate) return '—';
  if (startDate && !endDate) return 'Ongoing';
  if (!startDate && endDate) return '—';
  const start = new Date(startDate!);
  const end = new Date(endDate!);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return '—';
  const months = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
  if (months <= 0) return '—';
  if (months === 1) return '1 month';
  if (months < 12) return `${months} months`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (rem === 0) return years === 1 ? '1 year' : `${years} years`;
  return `${years}y ${rem}m`;
}

function formatDateUK(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function toISODateString(iso?: string | null): string {
  if (!iso) return '';
  return iso.split('T')[0];
}

function EditableField({
  label, value, onSave, type = 'text', placeholder = '', icon,
}: {
  label: string; value: string; onSave: (v: string) => void; type?: string; placeholder?: string; icon?: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const save = () => { onSave(draft); setEditing(false); };
  const cancel = () => { setDraft(value); setEditing(false); };

  // UK-format display for date fields
  const displayValue = type === 'date' && value
    ? (() => {
        try {
          return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch { return value; }
      })()
    : value;

  return (
    <div>
      <p className="text-[11px] text-muted-foreground/60 mb-1">{label}</p>
      {editing ? (
        type === 'date' ? (
          <div className="flex items-center gap-1.5">
            <DatePicker
              value={draft}
              onChange={v => { setDraft(v); }}
              placeholder="DD/MM/YYYY"
              className="flex-1"
            />
            <button onClick={save} className="p-1 rounded hover:bg-emerald-500/10 text-emerald-400"><Check size={12} /></button>
            <button onClick={cancel} className="p-1 rounded hover:bg-muted/60 text-muted-foreground"><X size={12} /></button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <input autoFocus type={type} value={draft} onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
              placeholder={placeholder}
              className="flex-1 h-7 px-2 text-[13px] bg-secondary border border-border/30 rounded outline-none focus:border-primary/50 transition-colors"
            />
            <button onClick={save} className="p-1 rounded hover:bg-emerald-500/10 text-emerald-400"><Check size={12} /></button>
            <button onClick={cancel} className="p-1 rounded hover:bg-muted/60 text-muted-foreground"><X size={12} /></button>
          </div>
        )
      ) : (
        <div className="flex items-center gap-2 group">
          {icon && <span className="shrink-0">{icon}</span>}
          <p className="text-[13px]">{displayValue || <span className="text-muted-foreground/40">{placeholder || 'Not set'}</span>}</p>
          <button onClick={() => { setDraft(value); setEditing(true); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted/60 text-muted-foreground/40 hover:text-muted-foreground">
            <Edit2 size={10} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Contract line item dialog ───────────────────────────────────────────────
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
  initialData?: ContractLineItem | null;
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
                  {form.service ? (services.find(s => s.id === form.service)?.label || form.service) : <span className="text-muted-foreground/40">Select service…</span>}
                  <ChevronDown size={14} className="text-muted-foreground/40" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-1 bg-card border-border/20">
                <input
                  value={serviceSearch}
                  onChange={e => setServiceSearch(e.target.value)}
                  placeholder="Search or create…"
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
                      <span className="flex items-center gap-2"><ServiceIcon serviceKey={s.id} size={12} /> {s.label}</span>
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
            <Label className="text-[13px] text-muted-foreground">{form.billing_type === 'recurring' ? 'Monthly value (£) *' : 'Project value (£) *'}</Label>
            <Input type="number" min="0" step="0.01"
              value={form.monthly_value} onChange={e => setForm(f => ({ ...f, monthly_value: e.target.value }))}
              placeholder="0.00" className="h-9 text-[13px] bg-secondary border-border/20" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[13px] text-muted-foreground">Start date</Label>
              <div className="flex items-center gap-1">
                <DatePicker
                  value={form.start_date}
                  onChange={v => setForm(f => ({ ...f, start_date: v }))}
                  placeholder="DD/MM/YYYY"
                />
                {form.start_date && (
                  <button type="button" onClick={() => setForm(f => ({ ...f, start_date: '' }))}
                    className="p-1 rounded hover:bg-muted/60 text-muted-foreground/60 hover:text-foreground transition-colors shrink-0">
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] text-muted-foreground">End date</Label>
              <div className="flex items-center gap-1">
                <DatePicker
                  value={form.end_date}
                  onChange={v => {
                    if (form.start_date && v && v < form.start_date) {
                      toast.error('End date cannot be before start date');
                      return;
                    }
                    setForm(f => ({ ...f, end_date: v }));
                  }}
                  placeholder="DD/MM/YYYY"
                />
                {form.end_date && (
                  <button type="button" onClick={() => setForm(f => ({ ...f, end_date: '' }))}
                    className="p-1 rounded hover:bg-muted/60 text-muted-foreground/60 hover:text-foreground transition-colors shrink-0">
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
            {saving ? 'Saving…' : initialData ? 'Save changes' : 'Add line item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [tasks, setTasks] = useState<ClientTask[]>([]);
  const [contractItems, setContractItems] = useState<ContractLineItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'service' | 'month'>('service');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'billing' | 'sale' | 'notes'>('overview');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Task sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Contract line item dialog state
  const [lineItemDialogOpen, setLineItemDialogOpen] = useState(false);
  const [editingLineItem, setEditingLineItem] = useState<ContractLineItem | null>(null);

  const fetchContractItems = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${clientId}/contracts`, { cache: 'no-store' });
      if (res.ok) {
        const items = await res.json();
        const now = new Date();
        // Auto-deactivate items with expired end dates
        const toDeactivate = items.filter((i: ContractLineItem) => i.is_active && i.end_date && new Date(i.end_date) < now);
        if (toDeactivate.length > 0) {
          await Promise.all(toDeactivate.map((i: ContractLineItem) =>
            fetch(`/api/contracts/${i.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: false }) })
          ));
          // Re-fetch after deactivation
          const res2 = await fetch(`/api/clients/${clientId}/contracts`, { cache: 'no-store' });
          if (res2.ok) { setContractItems(await res2.json()); return; }
        }
        setContractItems(items);
      }
    } catch { /* silent */ }
  }, [clientId]);

  const fetchData = useCallback(async () => {
    try {
      const [clientRes, tasksRes, projectsRes] = await Promise.all([
        fetch(`/api/clients/${clientId}`),
        fetch(`/api/tasks`),
        fetch('/api/clients'),
      ]);
      if (clientRes.ok) {
        const data = await clientRes.json();
        if (Array.isArray(data)) {
          setClient(data.find((c: Client) => c.id === clientId) || null);
        } else {
          setClient(data);
        }
      }
      if (tasksRes.ok) {
        const allTasks = await tasksRes.json();
        setTasks(allTasks.filter((t: ClientTask) => t.client_id === clientId));
      }
      if (projectsRes.ok) {
        const allClients = await projectsRes.json();
        setProjects(allClients.map((c: Client) => ({ id: c.id, name: c.name, color: c.color || '', created_at: c.created_at })));
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [clientId]);

  useEffect(() => {
    fetchData();
    fetchContractItems();
  }, [fetchData, fetchContractItems]);

  const patchClient = useCallback(async (updates: Partial<Client>) => {
    if (!client) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error();
      setClient(await res.json());
      toast.success('Changes saved');
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  }, [client, clientId]);

  // ── Task sheet handlers ───────────────────────────────────────────────────
  const openNewTask = () => {
    setIsNew(true);
    setSelectedTask({
      id: '',
      title: '',
      description: null,
      status: 'todo',
      priority: 'P2',
      assignee: null,
      project_id: clientId,
      client_id: clientId,
      service: null,
      parent_id: null,
      due_date: null,
      completed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    setSheetOpen(true);
  };

  const handleTaskClick = (task: Task) => {
    setIsNew(false);
    setSelectedTask(task);
    setSheetOpen(true);
  };

  const handleTaskSave = useCallback(async (data: Partial<Task>, opts?: { optimistic?: boolean; taskId?: string }) => {
    if (opts?.optimistic && opts.taskId) return; // ignore optimistic updates for now
    if (isNew) {
      const res = await fetch('/api/tasks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, client_id: clientId }),
      });
      if (!res.ok) { toast.error('Failed to create task'); return; }
      toast.success('Task created');
    } else if (selectedTask) {
      const res = await fetch(`/api/tasks/${selectedTask.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) { toast.error('Failed to save task'); return; }
    }
    setSheetOpen(false);
    setSelectedTask(null);
    fetchData();
  }, [isNew, selectedTask, clientId, fetchData]);

  const handleTaskDelete = useCallback(async () => {
    if (!selectedTask) return;
    const res = await fetch(`/api/tasks/${selectedTask.id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('Failed to delete task'); return; }
    setSheetOpen(false);
    setSelectedTask(null);
    toast.success('Task deleted');
    fetchData();
  }, [selectedTask, fetchData]);

  // ── Contract line item handlers ───────────────────────────────────────────
  const handleLineItemSave = async (data: LineItemFormData) => {
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
      const res = await fetch(`/api/contracts/${editingLineItem.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to update line item');
      toast.success('Line item updated');
    } else {
      const res = await fetch(`/api/clients/${clientId}/contracts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to create line item');
      toast.success('Line item added');
    }
    fetchContractItems();
  };

  const handleLineItemDelete = async (item: ContractLineItem) => {
    const res = await fetch(`/api/contracts/${item.id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('Failed to delete line item'); return; }
    toast.success('Line item deleted');
    fetchContractItems();
  };

  const handleToggleActive = async (item: ContractLineItem) => {
    const res = await fetch(`/api/contracts/${item.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !item.is_active }),
    });
    if (!res.ok) { toast.error('Failed to update'); return; }
    fetchContractItems();
  };

  if (loading) {
    return (
      <div className="animate-in fade-in duration-200">
        <div className="h-6 w-24 bg-muted/30 rounded animate-pulse mb-4" />
        <div className="h-48 bg-muted/20 rounded-lg animate-pulse mb-6" />
        <div className="h-64 bg-muted/20 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-[13px] text-muted-foreground">Client not found</p>
        <Link href="/clients" className="text-[13px] text-primary hover:underline mt-2">Back to clients</Link>
      </div>
    );
  }

  const teamStyle = getTeamStyle(client.team);
  const tenure = monthsActive(client.signup_date || client.created_at, client.churned_at);

  const groupedTasks = view === 'service'
    ? tasks.reduce<Record<string, ClientTask[]>>((acc, t) => {
        const key = t.service || 'none';
        (acc[key] ??= []).push(t);
        return acc;
      }, {})
    : tasks.reduce<Record<string, ClientTask[]>>((acc, t) => {
        const key = !t.due_date ? 'No date' : new Date(t.due_date).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
        (acc[key] ??= []).push(t);
        return acc;
      }, {});

  const totalMonthlyValue = contractItems.filter(i => i.is_active && i.billing_type !== 'one-off').reduce((sum, i) => sum + (i.monthly_value || 0), 0);

  // Derive active services from billing line items (not client.services)
  const derivedServices = [...new Set(contractItems.filter(i => i.is_active).map(i => i.service).filter(Boolean))];

  return (
    <div className="animate-in fade-in duration-200">
      <button
        onClick={() => { if (window.history.length > 1) router.back(); else router.push('/clients'); }}
        className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors duration-150 mb-4"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      {/* Client Header */}
      <div className="rounded-lg border border-border/20 bg-card p-6 mb-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">{client.name}</h1>
            <div className="flex items-center gap-3 flex-wrap">
              {teamStyle && (
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: teamStyle.color }} />
                  <span className="text-[13px] text-muted-foreground">{teamStyle.label}</span>
                </div>
              )}
              <span className="text-muted-foreground/30">·</span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                client.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' :
                client.status === 'paused' ? 'bg-amber-500/10 text-amber-400' :
                'bg-red-500/10 text-red-400'
              }`}>
                {client.status}
              </span>
              <span className="text-muted-foreground/30">·</span>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
                <Clock size={11} />
                {tenure === 1 ? '1 month' : `${tenure} months`} active
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="mb-1">
              <p className="text-[11px] text-muted-foreground/60">Monthly Retainer</p>
              <p className="text-xl font-semibold">
                £{totalMonthlyValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            {saving && <p className="text-[11px] text-muted-foreground/40">Saving…</p>}
          </div>
        </div>

        {derivedServices.length > 0 && (
          <div className="mb-4">
            <p className="text-[11px] text-muted-foreground/60 mb-2">Services</p>
            <div className="flex flex-wrap gap-2">
              {derivedServices.map((service) => {
                const s = SERVICE_STYLES[service];
                return (
                  <span key={service} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] font-medium ${s?.bg || 'bg-muted/20'} ${s?.text || 'text-muted-foreground'}`}>
                    <ServiceIcon serviceKey={service} size={12} /> {s?.label || service}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Team is shown via the team badge above */}
      </div>

      {/* Detail tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-border/20 overflow-x-auto">
        {([
          { id: 'overview', label: 'Overview', icon: <Tag size={13} /> },
          { id: 'tasks', label: 'Tasks', icon: <FileText size={13} /> },
          { id: 'billing', label: 'Billing', icon: <BadgePoundSterling size={13} /> },
          { id: 'sale', label: 'Sale Details', icon: <BadgePoundSterling size={13} /> },
          { id: 'notes', label: 'Notes', icon: <Edit2 size={13} /> },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors duration-150 whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Overview — Key Details & Contact */}
      {activeTab === 'overview' && (
        <div className="rounded-lg border border-border/20 bg-card p-6 space-y-6">
          {/* Contact Details */}
          <div>
            <h3 className="text-[13px] font-semibold mb-3">Contact Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <EditableField label="Contact Name" value={client.contact_name || ''} onSave={v => patchClient({ contact_name: v || undefined })} placeholder="Primary contact" icon={<User size={13} className="text-muted-foreground/60" />} />
              <EditableField label="Email" value={client.contact_email || ''} onSave={v => patchClient({ contact_email: v || undefined })} placeholder="email@company.com" type="email" icon={<Mail size={13} className="text-muted-foreground/60" />} />
              <EditableField label="Phone" value={client.contact_phone || ''} onSave={v => patchClient({ contact_phone: v || undefined })} placeholder="07xxx xxxxxx" icon={<Phone size={13} className="text-muted-foreground/60" />} />
              <EditableField label="Website" value={client.website || ''} onSave={v => patchClient({ website: v || undefined })} placeholder="https://..." icon={<Globe size={13} className="text-muted-foreground/60" />} />
            </div>
          </div>

          {/* Key Details */}
          <div>
            <h3 className="text-[13px] font-semibold mb-3">Key Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] text-muted-foreground/60 mb-1">Team</p>
                <p className="text-[13px]">{teamStyle ? teamStyle.label : '—'}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground/60 mb-1">Status</p>
                <p className={`text-[13px] font-medium ${
                  client.status === 'active' ? 'text-emerald-400' : client.status === 'paused' ? 'text-amber-400' : 'text-red-400'
                }`}>{client.status}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground/60 mb-1">Monthly Retainer</p>
                <p className="text-[13px] font-semibold">£{totalMonthlyValue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}/mo</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground/60 mb-1">Active Since</p>
                <p className="text-[13px]">{client.signup_date ? new Date(client.signup_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground/60 mb-1">Tenure</p>
                <p className="text-[13px]">{tenure === 1 ? '1 month' : `${tenure} months`}</p>
              </div>
              {(client.assigned_members || []).length > 0 && (
                <div>
                  <p className="text-[11px] text-muted-foreground/60 mb-1">Assigned Members</p>
                  <p className="text-[13px]">{client.assigned_members.map(m => toDisplayName(m)).join(', ')}</p>
                </div>
              )}
            </div>
          </div>

          {/* Services */}
          {derivedServices.length > 0 && (
            <div>
              <h3 className="text-[13px] font-semibold mb-3">Services</h3>
              <div className="flex flex-wrap gap-2">
                {derivedServices.map((service) => {
                  const s = SERVICE_STYLES[service];
                  return (
                    <span key={service} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] font-medium ${s?.bg || 'bg-muted/20'} ${s?.text || 'text-muted-foreground'}`}>
                      <ServiceIcon serviceKey={service} size={12} /> {s?.label || service}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Tasks */}
      {activeTab === 'tasks' && (
        <div className="rounded-lg border border-border/20 bg-card p-6">
          <div className="flex items-center justify-end mb-4">
            <div className="flex items-center rounded-lg border border-border/20 bg-secondary p-0.5">
              {(['service', 'month'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-2.5 py-1 rounded-md text-[13px] font-medium transition-all duration-150 ${
                    view === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  By {v === 'service' ? 'Service' : 'Month'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            {Object.entries(groupedTasks).map(([group, groupTasks]) => {
              if (!groupTasks?.length) return null;
              const serviceStyle = view === 'service' && group !== 'none' ? SERVICE_STYLES[group] : null;
              const groupLabel = serviceStyle ? serviceStyle.label : view === 'service' ? 'No Service' : group;
              const isCollapsed = collapsedGroups.has(group);
              const toggleCollapse = () => setCollapsedGroups(prev => {
                const next = new Set(prev);
                if (next.has(group)) next.delete(group); else next.add(group);
                return next;
              });
              return (
                <div key={group}>
                  <div className="flex items-center gap-2 mb-3">
                    <button onClick={toggleCollapse} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                      {isCollapsed ? <ChevronRight size={14} className="text-muted-foreground/60" /> : <ChevronDown size={14} className="text-muted-foreground/60" />}
                      {view === 'service' && group !== 'none' ? (
                        <ServiceIcon serviceKey={group} size={14} />
                      ) : (
                        <span className="text-muted-foreground/60">{view === 'service' ? <Tag size={14} /> : <Calendar size={14} />}</span>
                      )}
                      <h3 className="text-[13px] font-semibold">{groupLabel}</h3>
                      <span className="text-[11px] text-muted-foreground/60">({groupTasks.length})</span>
                    </button>
                    <button
                      onClick={() => { setIsNew(true); setSelectedTask({ id: '', title: '', description: null, status: 'todo', priority: 'P2', assignee: null, project_id: clientId, client_id: clientId, service: view === 'service' && group !== 'none' ? group : null, parent_id: null, due_date: null, completed_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as unknown as Task); setSheetOpen(true); }}
                      className="p-1 rounded hover:bg-muted/60 text-muted-foreground/40 hover:text-foreground transition-colors"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  {!isCollapsed && <div className="space-y-2">
                    {groupTasks.map((task) => {
                      const statusStyle = STATUS_STYLES[task.status];
                      const priorityStyle = task.priority && PRIORITY_STYLES[task.priority];
                      return (
                        <button
                          key={task.id}
                          onClick={() => handleTaskClick(task as unknown as Task)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border/20 bg-muted/20 hover:bg-muted/40 transition-colors duration-150 text-left"
                        >
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: statusStyle?.dot }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium truncate">{task.title}</p>
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground/60">
                              {task.assignee && <span>{toDisplayName(task.assignee)}</span>}
                              {task.is_recurring && (
                                <>
                                  <span>·</span>
                                  <span className="flex items-center gap-1"><Calendar size={10} /> Recurring</span>
                                </>
                              )}
                            </div>
                          </div>
                          {priorityStyle && (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium shrink-0 ${priorityStyle.bg} ${priorityStyle.text}`}>
                              {task.priority}
                            </span>
                          )}
                          {task.due_date && (
                            <span className={`text-[11px] whitespace-nowrap shrink-0 ${getDueDateColor(task.due_date)}`}>
                              {formatDueDate(task.due_date)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>}
                </div>
              );
            })}
          </div>

          {tasks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Tag size={32} className="text-muted-foreground/30 mb-3" />
              <p className="text-[13px] font-medium text-muted-foreground">No tasks yet</p>
              <p className="text-[13px] text-muted-foreground/60 mt-1">Tasks assigned to this client will appear here</p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Contract */}
      {/* Tab: Billing (Contract Line Items + Contract Details) */}
      {activeTab === 'billing' && (
        <div className="rounded-lg border border-border/20 bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[13px] font-semibold">Billing</h2>
              <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                Monthly recurring: <span className="text-emerald-400 font-semibold">£{totalMonthlyValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => { setEditingLineItem(null); setLineItemDialogOpen(true); }}
              className="h-8 text-[13px] gap-1"
            >
              <Plus size={14} /> Add line item
            </Button>
          </div>

          {contractItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <BadgePoundSterling size={32} className="text-muted-foreground/30 mb-3" />
              <p className="text-[13px] font-medium text-muted-foreground">No billing items yet</p>
              <p className="text-[13px] text-muted-foreground/60 mt-1">Add contract line items to track revenue for this client</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/20 hover:bg-transparent">
                    <TableHead className="text-[12px] text-muted-foreground font-medium">Service</TableHead>
                    <TableHead className="text-[12px] text-muted-foreground font-medium">Description</TableHead>
                    <TableHead className="text-[12px] text-muted-foreground font-medium">Type</TableHead>
                    <TableHead className="text-[12px] text-muted-foreground font-medium">Value (£)</TableHead>
                    <TableHead className="text-[12px] text-muted-foreground font-medium">Start</TableHead>
                    <TableHead className="text-[12px] text-muted-foreground font-medium">End</TableHead>
                    <TableHead className="text-[12px] text-muted-foreground font-medium">Duration</TableHead>
                    <TableHead className="text-[12px] text-muted-foreground font-medium">Active</TableHead>
                    <TableHead className="text-[12px] text-muted-foreground font-medium w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contractItems.map(item => (
                    <TableRow key={item.id} className={`border-border/20 hover:bg-secondary/30 transition-colors ${!item.is_active ? 'opacity-50' : ''}`}>
                      <TableCell className="text-[13px] font-medium">{item.service}</TableCell>
                      <TableCell className="text-[13px] text-muted-foreground">{item.description || '—'}</TableCell>
                      <TableCell>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          item.billing_type === 'one-off' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'
                        }`}>
                          {item.billing_type === 'one-off' ? 'One-off' : 'Recurring'}
                        </span>
                      </TableCell>
                      <TableCell className="text-[13px] font-semibold text-emerald-400">
                        £{(item.monthly_value || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        {item.billing_type === 'recurring' && <span className="text-[10px] text-muted-foreground/60 font-normal">/mo</span>}
                      </TableCell>
                      <TableCell className="text-[13px] text-muted-foreground">{formatDateUK(item.start_date)}</TableCell>
                      <TableCell className="text-[13px] text-muted-foreground">{formatDateUK(item.end_date)}</TableCell>
                      <TableCell className="text-[13px] text-muted-foreground/60">
                        {contractDuration(item.start_date, item.end_date)}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const expired = item.end_date && new Date(item.end_date) < new Date();
                          return expired ? (
                            <TooltipProvider delayDuration={0}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-block">
                                    <Switch checked={false} disabled />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-[12px]">
                                  End date has passed — cannot reactivate
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <Switch
                              checked={item.is_active}
                              onCheckedChange={() => handleToggleActive(item)}
                            />
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { setEditingLineItem(item); setLineItemDialogOpen(true); }}
                            className="p-1.5 rounded hover:bg-muted/60 text-muted-foreground/60 hover:text-foreground transition-colors"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => handleLineItemDelete(item)}
                            className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground/60 hover:text-destructive transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Total row */}
              {(() => {
                const active = contractItems.filter(i => i.is_active);
                const recurringTotal = active.filter(i => i.billing_type !== 'one-off').reduce((s, i) => s + (i.monthly_value || 0), 0);
                const oneOffTotal = active.filter(i => i.billing_type === 'one-off').reduce((s, i) => s + (i.monthly_value || 0), 0);
                return (
                  <div className="mt-3 pt-3 border-t border-border/10 flex items-center justify-between px-1">
                    <span className="text-[12px] text-muted-foreground/60">
                      {active.length} active of {contractItems.length} total
                    </span>
                    <div className="flex items-center gap-6">
                      {recurringTotal > 0 && (
                        <div className="text-right">
                          <p className="text-[11px] text-muted-foreground/60">Monthly recurring</p>
                          <p className="text-lg font-bold text-emerald-400">
                            £{recurringTotal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                          <p className="text-[11px] text-muted-foreground/40">
                            ARR £{(recurringTotal * 12).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      )}
                      {oneOffTotal > 0 && (
                        <div className="text-right">
                          <p className="text-[11px] text-muted-foreground/60">Project work</p>
                          <p className="text-lg font-bold text-amber-400">
                            £{oneOffTotal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Tab: Sale Details */}
      {activeTab === 'sale' && (
        <div className="rounded-lg border border-border/20 bg-card p-6">
          <h2 className="text-[13px] font-semibold mb-4">Sale Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <EditableField
              label="How We Won Them"
              value={client.sale_source || ''}
              onSave={v => patchClient({ sale_source: v || undefined })}
              placeholder="e.g. Referral, LinkedIn, Cold outreach"
            />
            <EditableField
              label="Sold By"
              value={client.sold_by || ''}
              onSave={v => patchClient({ sold_by: v || undefined })}
              placeholder="e.g. Jamie Ludlow"
            />
            <EditableField
              label="Date Closed"
              value={toISODateString(client.sale_closed_at)}
              onSave={v => patchClient({ sale_closed_at: v || undefined })}
              type="date"
            />
          </div>

          {/* Lost Reason — always visible so you can add/edit/remove */}
          <div className="mt-5 pt-5 border-t border-border/10">
            <EditableField
              label="Lost Reason"
              value={client.lost_reason || ''}
              onSave={v => patchClient({ lost_reason: v || undefined })}
              placeholder="Why was this client lost? (leave empty to remove)"
            />
          </div>

          {/* Contract Details */}
          <div className="mt-5 pt-5 border-t border-border/10">
            <h3 className="text-[13px] font-semibold mb-4">Contract Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <EditableField
                label="Contract Start"
                value={toISODateString(client.contract_start)}
                onSave={v => patchClient({ contract_start: v || undefined })}
                type="date"
              />
              <EditableField
                label="Contract End"
                value={toISODateString(client.contract_end)}
                onSave={v => patchClient({ contract_end: v || undefined })}
                type="date"
              />
              <EditableField
                label="Renewal Date"
                value={toISODateString(client.contract_renewal)}
                onSave={v => patchClient({ contract_renewal: v || undefined })}
                type="date"
              />
              <EditableField
                label="Sign-up Date"
                value={toISODateString(client.signup_date)}
                onSave={v => patchClient({ signup_date: v || undefined })}
                type="date"
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab: Notes */}
      {activeTab === 'notes' && (
        <div className="rounded-lg border border-border/20 bg-card p-6">
          <h2 className="text-[13px] font-semibold mb-4">Notes</h2>
          <NotesEditor value={client.notes || ''} onSave={v => patchClient({ notes: v })} />
        </div>
      )}

      {/* Task Sheet */}
      <TaskSheet
        task={selectedTask}
        open={sheetOpen}
        onClose={() => { setSheetOpen(false); setSelectedTask(null); }}
        onSave={handleTaskSave}
        onDelete={handleTaskDelete}
        projects={projects}
        isNew={isNew}
        allTasks={tasks as unknown as Task[]}
        onTaskClick={handleTaskClick}
        allLabels={[]}
      />

      {/* Line item dialog */}
      <LineItemDialog
        open={lineItemDialogOpen}
        onOpenChange={setLineItemDialogOpen}
        initialData={editingLineItem}
        onSave={handleLineItemSave}
      />
    </div>
  );
}

function NotesEditor({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [saved, setSaved] = useState(false);
  const changed = draft !== value;
  const handleSave = () => { onSave(draft); setSaved(true); setTimeout(() => setSaved(false), 2000); };
  return (
    <div className="space-y-3">
      <textarea
        value={draft}
        onChange={e => { setDraft(e.target.value); setSaved(false); }}
        placeholder="Add notes about this client..."
        rows={8}
        className="w-full p-3 text-[13px] bg-secondary border border-border/20 rounded-lg outline-none focus:border-primary/50 transition-colors duration-150 resize-y"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={!changed}
          className={`h-7 px-3 text-[13px] rounded-md transition-colors ${
            changed
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          }`}
        >
          {saved ? 'Saved' : 'Save notes'}
        </button>
        {changed && (
          <button
            onClick={() => setDraft(value)}
            className="h-7 px-3 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
