'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { TEAM_STYLES, SERVICE_STYLES, getTeamStyle, CLIENT_STATUS_STYLES, getServiceStyle, getAssigneeColor, getInitials } from '@/lib/constants';
import { Users, Search, ChevronDown, Check, X, Plus, Clock, CalendarIcon, ExternalLink, LayoutGrid, Table2, ArrowUp, ArrowDown, Pencil, Trash2, BadgePoundSterling } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { FilterPopover } from '@/components/ui/filter-popover';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import Link from 'next/link';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { usePersistedState } from '@/hooks/use-persisted-state';
import { ShortcutsDialog } from '@/components/ui/shortcuts-dialog';
import { useUsers } from '@/hooks/use-users';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import dynamic from 'next/dynamic';

const TaskDescriptionEditor = dynamic(
  () => import('@/components/board/task-description-editor').then(mod => ({ default: mod.TaskDescriptionEditor })),
  { ssr: false, loading: () => <div className="h-[100px] rounded-lg bg-muted/20 animate-pulse" /> }
);

interface ClientRow {
  id: string;
  name: string;
  team: string;
  status: string;
  services: string[];
  derived_services?: string[];
  monthly_retainer: number;
  calculated_retainer?: number;
  assigned_members: string[];
  color: string | null;
  created_at: string;
  signup_date?: string;
  churned_at?: string;
  notes?: string;
}

interface TeamOption {
  id: string;
  name: string;
}

/** Derive unique services from client data (dynamic, not hardcoded) */
function deriveServiceOptions(clients: ClientRow[]): { value: string; label: string; dot: string }[] {
  const serviceSet = new Set<string>();
  clients.forEach(c => {
    (c.derived_services || c.services || []).forEach((s: string) => {
      if (s !== 'account-management') serviceSet.add(s);
    });
  });
  return Array.from(serviceSet).sort().map(slug => { const s = getServiceStyle(slug); return { value: slug, label: s.label, dot: s.dot }; });
}

function monthsActive(from: string, to?: string | null): number {
  const start = new Date(from);
  const end = to ? new Date(to) : new Date();
  return Math.max(
    0,
    Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
  );
}

/* ── Services multi-select ─────────────────────────────────────────────────── */
/* ── Members multi-select ──────────────────────────────────────────────────── */
function MembersMultiSelect({
  selected,
  onChange,
  users,
}: {
  selected: string[];
  onChange: (v: string[]) => void;
  users: Array<{ id: string; full_name: string; team?: string | null }>;
}) {
  const [open, setOpen] = useState(false);

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(v => v !== id) : [...selected, id]);
  };

  const selectedUsers = users.filter(u => selected.includes(u.id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full h-9 px-3 text-[13px] rounded-md border border-border/20 bg-secondary flex items-center justify-between hover:border-border/40 transition-colors text-left"
        >
          {selectedUsers.length === 0 ? (
            <span className="text-muted-foreground/40">Select members…</span>
          ) : (
            <span className="truncate">{selectedUsers.map(u => u.full_name).join(', ')}</span>
          )}
          <ChevronDown size={14} className="text-muted-foreground/60 shrink-0 ml-2" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1 max-h-64 overflow-y-auto" align="start">
        {users.map(u => {
          const isSelected = selected.includes(u.id);
          return (
            <button
              key={u.id}
              onClick={() => toggle(u.id)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[13px] transition-colors duration-150 ${
                isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted/60 text-muted-foreground'
              }`}
            >
              <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                isSelected ? 'border-primary bg-primary' : 'border-border/40'
              }`}>
                {isSelected && <Check size={10} className="text-primary-foreground" />}
              </div>
              <span>{u.full_name}</span>
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

const BILLING_TYPE_STYLES: Record<string, { bg: string; text: string }> = {
  recurring: { bg: 'bg-emerald-500/10', text: 'text-emerald-500' },
  'one-off': { bg: 'bg-amber-500/10', text: 'text-amber-500' },
};

function LineItemDialog({
  open,
  onOpenChange,
  initialData,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialData?: LineItemDraft | null;
  onSave: (data: LineItemDraft) => void;
}) {
  const [form, setForm] = useState<LineItemDraft>(emptyLineItem);
  const [services, setServices] = useState<{ id: string; label: string }[]>([]);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [serviceSearch, setServiceSearch] = useState('');
  const [users, setUsers] = useState<Array<{ id: string; full_name: string; team: string | null; is_active: boolean; role?: { name: string } | null }>>([]);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState('');

  const SERVICE_TO_ROLES: Record<string, string[]> = {
    'paid-advertising': ['Paid Ads Manager'],
    'social-media': ['Social Media Manager'],
    'seo': ['SEO'],
    'creative': ['Creative'],
  };
  const roleFiltered = form.service && SERVICE_TO_ROLES[form.service]
    ? users.filter(u => u.role?.name && SERVICE_TO_ROLES[form.service].includes(u.role.name))
    : users;
  const filteredUsers = roleFiltered.length > 0 ? roleFiltered : users;

  useEffect(() => {
    fetch('/api/services').then(r => r.json()).then(d => { if (Array.isArray(d)) setServices(d); }).catch(() => {});
    fetch('/api/users').then(r => r.json()).then(d => { if (Array.isArray(d)) setUsers(d.filter((u: { is_active: boolean }) => u.is_active)); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (open) {
      setForm(initialData || { ...emptyLineItem });
      setServiceSearch('');
    }
  }, [open, initialData]);

  const handleSave = () => {
    if (!form.service) { toast.error('Service is required'); return; }
    if (!form.monthly_value || parseFloat(form.monthly_value) <= 0) { toast.error('Value is required'); return; }
    onSave(form);
    onOpenChange(false);
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
            <Label className="text-[13px] text-muted-foreground">Delivery person</Label>
            <Popover open={assigneeOpen} onOpenChange={(open) => { setAssigneeOpen(open); if (!open) setAssigneeSearch(''); }}>
              <PopoverTrigger asChild>
                <button type="button" className="w-full h-9 px-3 text-left text-[13px] bg-secondary border border-border/20 rounded-md flex items-center justify-between hover:bg-muted/40 transition-colors">
                  {form.assignee_id ? (() => {
                    const selectedUser = users.find(u => u.id === form.assignee_id);
                    if (!selectedUser) return 'Unknown';
                    const colorClass = getAssigneeColor(selectedUser.full_name, selectedUser.team);
                    return (
                      <div className="flex items-center gap-2">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-medium shrink-0 ${colorClass}`}>
                          {getInitials(selectedUser.full_name)}
                        </div>
                        <span>{selectedUser.full_name}</span>
                      </div>
                    );
                  })() : <span className="text-muted-foreground/40">Unassigned</span>}
                  <ChevronDown size={14} className="text-muted-foreground/40" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-1 bg-card border-border/20">
                <div className="px-1 pb-1">
                  <div className="relative">
                    <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
                    <input
                      type="text"
                      value={assigneeSearch}
                      onChange={e => setAssigneeSearch(e.target.value)}
                      placeholder="Search"
                      className="w-full h-8 pl-7 pr-2 text-[13px] bg-secondary border border-border/20 rounded-md outline-none focus:border-primary/40 transition-colors"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="max-h-[200px] overflow-y-auto">
                  {(!assigneeSearch || 'unassigned'.includes(assigneeSearch.toLowerCase())) && (
                    <button
                      type="button"
                      onClick={() => { setForm(f => ({ ...f, assignee_id: '' })); setAssigneeOpen(false); setAssigneeSearch(''); }}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-[13px] hover:bg-muted/60 transition-colors ${!form.assignee_id ? 'bg-muted/40' : ''}`}
                    >
                      <span className="text-muted-foreground/60">Unassigned</span>
                      {!form.assignee_id && <Check size={14} className="text-primary" />}
                    </button>
                  )}
                  {filteredUsers
                    .filter(u => !assigneeSearch || u.full_name.toLowerCase().includes(assigneeSearch.toLowerCase()))
                    .map(u => {
                      const colorClass = getAssigneeColor(u.full_name, u.team);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => { setForm(f => ({ ...f, assignee_id: u.id })); setAssigneeOpen(false); setAssigneeSearch(''); }}
                          className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-[13px] hover:bg-muted/60 transition-colors ${form.assignee_id === u.id ? 'bg-muted/40' : ''}`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-medium shrink-0 ${colorClass}`}>
                              {getInitials(u.full_name)}
                            </div>
                            <span>{u.full_name}</span>
                          </div>
                          {form.assignee_id === u.id && <Check size={14} className="text-primary" />}
                        </button>
                      );
                    })}
                </div>
              </PopoverContent>
            </Popover>
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
            <Input type="text" inputMode="numeric"
              value={form.monthly_value} onChange={e => { if (/^\d*\.?\d*$/.test(e.target.value)) setForm(f => ({ ...f, monthly_value: e.target.value })); }}
              placeholder="0.00" className="h-9 text-[13px] bg-secondary border-border/20" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="text-[13px] h-8 border-border/20">Cancel</Button>
          <Button onClick={handleSave} className="text-[13px] h-8">
            {initialData ? 'Save changes' : 'Add line item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BillingSection({
  lineItems,
  onChange,
}: {
  lineItems: LineItemDraft[];
  onChange: (items: LineItemDraft[]) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const totalAll = lineItems.reduce((s, i) => s + (parseFloat(i.monthly_value) || 0), 0);
  const recurringTotal = lineItems.filter(i => i.billing_type === 'recurring').reduce((s, i) => s + (parseFloat(i.monthly_value) || 0), 0);
  const oneOffTotal = lineItems.filter(i => i.billing_type === 'one-off').reduce((s, i) => s + (parseFloat(i.monthly_value) || 0), 0);

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground/60">Services & Pricing</Label>
          {totalAll > 0 && (
            <span className="text-[13px] font-semibold text-emerald-400">
              £{totalAll.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          )}
        </div>

        {/* Line item cards */}
        {lineItems.length > 0 && (
          <div className="space-y-1.5">
            {lineItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-border/20 bg-muted/20">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate">{getServiceStyle(item.service).label || item.service}</p>
                  <p className="text-[11px] text-muted-foreground/60">
                    <span className={item.billing_type === 'one-off' ? 'text-amber-400' : 'text-emerald-400'}>
                      £{parseFloat(item.monthly_value || '0').toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                    </span>
                    {item.billing_type === 'recurring' ? '/mo' : ' one-off'}
                  </p>
                </div>
                <button onClick={() => { setEditingIdx(idx); setDialogOpen(true); }}
                  className="p-1 rounded hover:bg-muted/60 text-muted-foreground/40 hover:text-foreground transition-colors">
                  <Pencil size={12} />
                </button>
                <button onClick={() => onChange(lineItems.filter((_, i) => i !== idx))}
                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive transition-colors">
                  <X size={12} />
                </button>
              </div>
            ))}
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
          onClick={() => { setEditingIdx(null); setDialogOpen(true); }}
          className="w-full h-8 px-3 text-[11px] rounded-lg border border-dashed border-border/30 text-muted-foreground/60 hover:border-primary/40 hover:text-muted-foreground transition-colors flex items-center justify-center gap-1"
        >
          <Plus size={12} /> Add line item
        </button>

        {/* Deal value */}
        {lineItems.length > 0 && (
          <div className="flex items-center justify-between px-2.5 py-2 rounded-lg border border-border/20 bg-muted/10">
            <span className="text-[12px] text-muted-foreground/60 font-medium">Total value</span>
            <span className="text-[13px] font-semibold text-foreground">
              £{totalAll.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        )}
      </div>

      <LineItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialData={editingIdx !== null ? lineItems[editingIdx] : null}
        onSave={(data) => {
          if (editingIdx !== null) {
            const updated = [...lineItems];
            updated[editingIdx] = data;
            onChange(updated);
          } else {
            onChange([...lineItems, data]);
          }
        }}
      />
    </>
  );
}

function AccountManagerSelect({
  selected,
  onChange,
  users,
}: {
  selected: string | null;
  onChange: (v: string | null) => void;
  users: Array<{ id: string; full_name: string; team?: string | null }>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedUser = users.find(u => u.id === selected);
  const filtered = users.filter(u => u.full_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Popover open={open} onOpenChange={v => { setOpen(v); if (!v) setSearch(''); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full h-9 px-3 text-[13px] rounded-md border border-border/20 bg-secondary flex items-center justify-between hover:border-border/40 transition-colors text-left"
        >
          {selectedUser ? (
            <span className="flex items-center gap-2">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${getAssigneeColor(selectedUser.full_name, selectedUser.team)}`}>
                {getInitials(selectedUser.full_name)}
              </span>
              <span className="truncate">{selectedUser.full_name}</span>
            </span>
          ) : (
            <span className="text-muted-foreground/40">Select account manager…</span>
          )}
          <ChevronDown size={14} className="text-muted-foreground/60 shrink-0 ml-2" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1" align="start">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search…"
          className="w-full px-2 py-1.5 text-[13px] bg-transparent border-b border-border/10 outline-none mb-1"
          autoFocus
        />
        <div className="max-h-[200px] overflow-y-auto">
          {filtered.map(u => (
            <button
              key={u.id}
              onClick={() => { onChange(u.id); setOpen(false); setSearch(''); }}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[13px] hover:bg-muted/60 transition-colors ${selected === u.id ? 'bg-muted/40' : ''}`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${getAssigneeColor(u.full_name, u.team)}`}>
                {getInitials(u.full_name)}
              </span>
              <span className="truncate">{u.full_name}</span>
              {selected === u.id && <Check size={14} className="text-primary ml-auto shrink-0" />}
            </button>
          ))}
          {filtered.length === 0 && <p className="text-[12px] text-muted-foreground/40 text-center py-2">No results</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ── Client Sheet (new / edit) ─────────────────────────────────────────────── */
interface LineItemDraft {
  service: string;
  description: string;
  monthly_value: string;
  billing_type: 'recurring' | 'one-off';
  assignee_id: string;
}

interface ClientFormState {
  name: string;
  team: string;
  assigned_members: string[];
  status: string;
  signup_date: string;
  notes: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  website: string;
  line_items: LineItemDraft[];
}

const emptyLineItem: LineItemDraft = { service: '', description: '', monthly_value: '', billing_type: 'recurring', assignee_id: '' };

const emptyClientForm: ClientFormState = {
  name: '',
  team: '',
  assigned_members: [],
  status: 'active',
  signup_date: '',
  notes: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  website: '',
  line_items: [],
};

function ClientSheet({
  open,
  onOpenChange,
  editClient,
  teams,
  users,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editClient: ClientRow | null;
  teams: TeamOption[];
  users: Array<{ id: string; full_name: string; team?: string | null }>;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ClientFormState>(emptyClientForm);
  const [saving, setSaving] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  useEffect(() => {
    if (open) {
      if (editClient) {
        setForm({
          name: editClient.name,
          team: editClient.team || '',
          assigned_members: editClient.assigned_members || [],
          status: editClient.status || 'active',
          signup_date: editClient.signup_date || '',
          notes: editClient.notes || '',
          contact_name: (editClient as unknown as { contact_name?: string }).contact_name || '',
          contact_email: (editClient as unknown as { contact_email?: string }).contact_email || '',
          contact_phone: (editClient as unknown as { contact_phone?: string }).contact_phone || '',
          website: (editClient as unknown as { website?: string }).website || '',
          line_items: [],
        });
      } else {
        setForm(emptyClientForm);
      }
    }
  }, [open, editClient]);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Company name is required'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        team: form.team || null,
        assigned_members: form.assigned_members,
        status: form.status,
        signup_date: form.signup_date || null,
        notes: form.notes || null,
        contact_name: form.contact_name.trim() || null,
        contact_email: form.contact_email.trim() || null,
        contact_phone: form.contact_phone.trim() || null,
        website: form.website.trim() || null,
      };

      if (editClient) {
        const res = await fetch(`/api/clients/${editClient.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) { toast.error('Failed to update client'); return; }
        toast.success(`${form.name} updated`);
      } else {
        const res = await fetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) { toast.error('Failed to create client'); return; }
        const newClient = await res.json();

        // Create billing line items if any
        const validItems = form.line_items.filter(li => li.service && parseFloat(li.monthly_value) > 0);
        if (validItems.length > 0 && newClient.id) {
          await Promise.all(validItems.map(li =>
            fetch(`/api/clients/${newClient.id}/contracts`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                service: li.service,
                description: li.description || null,
                monthly_value: parseFloat(li.monthly_value),
                billing_type: li.billing_type,
                is_active: true,
              }),
            })
          ));
        }

        toast.success(`${form.name} added to clients`);
      }
      onOpenChange(false);
      onSaved();
    } catch { toast.error('Something went wrong'); }
    finally { setSaving(false); }
  };

  const selectedTeam = teams.find(t => t.name.toLowerCase() === form.team.toLowerCase());
  const teamStyle = form.team ? getTeamStyle(form.team) : null;

  const STATUS_OPTIONS = [
    { value: 'active', label: 'Active' },
    { value: 'paused', label: 'Paused' },
    { value: 'churned', label: 'Churned' },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        className="bg-card border-l border-border/20 p-0 overflow-y-auto [&>button]:hidden rounded-none md:rounded-tl-2xl md:rounded-bl-2xl !w-full md:!w-[560px] md:!max-w-[700px] md:!top-3 md:!bottom-3 md:!h-auto flex flex-col"
        showCloseButton={false}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Header — matches task/prospect sheet */}
        <div className="px-5 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground/30">
              {editClient?.created_at && (
                <span>Created {new Date(editClient.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              )}
              {!editClient && <span>New client</span>}
            </div>
            <div className="flex items-center gap-0.5">
              {editClient && (
                <Link
                  href={`/clients/${editClient.id}`}
                  className="p-1.5 rounded-md hover:bg-muted/60 text-muted-foreground/30 hover:text-muted-foreground transition-colors duration-150"
                  onClick={() => onOpenChange(false)}
                >
                  <ExternalLink size={14} />
                </Link>
              )}
              <button 
                onClick={() => onOpenChange(false)} 
                className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted/40 transition-colors duration-150 text-muted-foreground hover:text-foreground"
              >
                <X size={11} />
              </button>
            </div>
          </div>

          {/* Title input */}
          <div className="mt-2">
            <input
              autoFocus={!editClient}
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Company name"
              className="w-full text-[17px] font-semibold bg-transparent border border-transparent outline-none placeholder:text-muted-foreground/60 text-foreground leading-snug px-2 py-1 rounded hover:bg-muted/40 focus:bg-muted/40 focus:border-primary/30 transition-colors duration-150 -mx-1"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Team */}
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground/60">Team</Label>
            <Popover open={teamOpen} onOpenChange={setTeamOpen}>
              <PopoverTrigger asChild>
                <button className="w-full h-9 px-3 text-[13px] rounded-md border border-border/20 bg-secondary flex items-center justify-between hover:border-border/40 transition-colors">
                  {selectedTeam ? (
                    <span className={teamStyle?.text || ''}>{selectedTeam.name}</span>
                  ) : (
                    <span className="text-muted-foreground/40">Select team…</span>
                  )}
                  <ChevronDown size={14} className="text-muted-foreground/60" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-1" align="start">
                {teams.map(t => {
                  const ts = getTeamStyle(t.name.toLowerCase());
                  return (
                    <button
                      key={t.id}
                      onClick={() => { setForm(f => ({ ...f, team: t.name.toLowerCase() })); setTeamOpen(false); }}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-[13px] hover:bg-muted/60 transition-colors ${form.team === t.name.toLowerCase() ? 'bg-muted/40' : ''}`}
                    >
                      <span className={ts?.text || ''}>{t.name}</span>
                      {form.team === t.name.toLowerCase() && <Check size={14} className="text-primary" />}
                    </button>
                  );
                })}
              </PopoverContent>
            </Popover>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground/60">Status</Label>
            <Popover open={statusOpen} onOpenChange={setStatusOpen}>
              <PopoverTrigger asChild>
                <button className="w-full h-9 px-3 text-[13px] rounded-md border border-border/20 bg-secondary flex items-center justify-between hover:border-border/40 transition-colors">
                  <span className={CLIENT_STATUS_STYLES[form.status]?.text || 'text-muted-foreground'}>
                    {STATUS_OPTIONS.find(s => s.value === form.status)?.label || 'Select status…'}
                  </span>
                  <ChevronDown size={14} className="text-muted-foreground/60" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1" align="start">
                {STATUS_OPTIONS.map(s => (
                  <button
                    key={s.value}
                    onClick={() => { setForm(f => ({ ...f, status: s.value })); setStatusOpen(false); }}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-[13px] hover:bg-muted/60 transition-colors ${form.status === s.value ? 'bg-muted/40' : ''}`}
                  >
                    <span className={CLIENT_STATUS_STYLES[s.value]?.text || 'text-muted-foreground'}>{s.label}</span>
                    {form.status === s.value && <Check size={14} className="text-primary" />}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </div>

          {/* Account Manager */}
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground/60">Account Manager</Label>
            <AccountManagerSelect
              selected={form.assigned_members[0] || null}
              onChange={v => setForm(f => ({ ...f, assigned_members: v ? [v] : [] }))}
              users={users}
            />
          </div>

          {/* Start Date */}
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground/60">Start Date</Label>
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger asChild>
                <button className="w-full h-9 px-3 text-[13px] rounded-md border border-border/20 bg-secondary flex items-center justify-between hover:border-border/40 transition-colors">
                  <span className={form.signup_date ? 'text-foreground' : 'text-muted-foreground/40'}>
                    {form.signup_date ? format(new Date(form.signup_date), 'dd/MM/yyyy') : 'Select date…'}
                  </span>
                  <CalendarIcon size={14} className="text-muted-foreground/60" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={form.signup_date ? new Date(form.signup_date) : undefined}
                  onSelect={date => {
                    if (date) { setForm(f => ({ ...f, signup_date: date.toISOString().split('T')[0] })); setDateOpen(false); }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Divider */}
          <div className="border-t border-border/20 -mx-5 my-4" />

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

          {/* Website */}
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground/60">Website</Label>
            <Input
              type="url"
              value={form.website}
              onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
              placeholder="https://..."
              className="text-[13px] h-9"
            />
          </div>

          {/* Divider */}
          <div className="border-t border-border/20 -mx-5 my-4" />

          {/* Billing Line Items */}
          {!editClient && (
            <BillingSection
              lineItems={form.line_items}
              onChange={items => setForm(f => ({ ...f, line_items: items }))}
            />
          )}

          {/* Divider */}
          <div className="border-t border-border/20 -mx-5 my-4" />

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground/60">Notes</Label>
            <TaskDescriptionEditor
              content={form.notes}
              onChange={v => setForm(f => ({ ...f, notes: v }))}
              placeholder="Any notes about this client…"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border/20 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="text-[13px] h-8 border-border/20">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !form.name.trim()} className="text-[13px] h-8">
            {saving ? 'Saving…' : editClient ? 'Save changes' : 'Create Client'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ── Main page ─────────────────────────────────────────────────────────────── */

function ClientsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [searchQuery, setSearchQuery] = usePersistedState('clients-search', '');
  const [filterTeam, setFilterTeam] = usePersistedState<string[]>('clients-filterTeam', []);
  const [filterStatus, setFilterStatus] = usePersistedState<string[]>('clients-filterStatus', []);
  const [filterService, setFilterService] = usePersistedState<string[]>('clients-filterService', []);
  const [viewMode, setViewMode] = usePersistedState<'grid' | 'table'>('clients-viewMode', 'grid');
  const [sortField, setSortField] = useState<'name' | 'team' | 'status' | 'retainer' | 'tenure'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientRow | null>(null);

  const { users } = useUsers();

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch('/api/clients');
      if (res.ok) setClients(await res.json());
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  useEffect(() => {
    fetch('/api/teams')
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        setTeams(data);
        // Clean up stale team filters that reference renamed/deleted teams
        if (data.length > 0 && filterTeam.length > 0) {
          const validSlugs = new Set(data.map((t: { name: string }) => t.name.toLowerCase()));
          const cleaned = filterTeam.filter(f => validSlugs.has(f));
          if (cleaned.length !== filterTeam.length) setFilterTeam(cleaned);
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredClients = clients.filter(client => {
    if (searchQuery && !client.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterTeam.length > 0 && !filterTeam.includes(client.team)) return false;
    if (filterStatus.length > 0 && !filterStatus.includes(client.status)) return false;
    if (filterService.length > 0 && !filterService.some(s => (client.derived_services || client.services || []).includes(s))) return false;
    return true;
  });

  const hasFilters = filterTeam.length > 0 || filterStatus.length > 0 || filterService.length > 0 || searchQuery !== '';

  const openNewClient = () => {
    setEditingClient(null);
    setSheetOpen(true);
  };

  const openEditClient = (client: ClientRow) => {
    setEditingClient(client);
    setSheetOpen(true);
  };

  // Dynamic team filter options
  const teamFilterOptions = teams.map(t => {
    const ts = getTeamStyle(t.name.toLowerCase());
    return { value: t.name.toLowerCase(), label: t.name, dot: ts?.color };
  });

  // ── Quick action from global search (?action=new-client) ──────────────────
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'new-client' && !sheetOpen) {
      openNewClient();
      router.replace('/clients', { scroll: false });
    }
  }, [searchParams, sheetOpen, router]);

  // Keyboard shortcuts
  const PAGE_SHORTCUTS = [
    { key: 'N', description: 'New client' },
    { key: 'Esc', description: 'Close sheet' },
    { key: '?', description: 'Show shortcuts' },
  ];

  useKeyboardShortcuts([
    { key: 'n', description: 'New client', action: () => { if (!sheetOpen) openNewClient(); } },
    { key: 'Escape', description: 'Close sheet', action: () => { setSheetOpen(false); setShowShortcuts(false); }, skipInInput: false },
    { key: '?', description: 'Show shortcuts', action: () => setShowShortcuts(v => !v) },
  ]);

  return (
    <div className="animate-in fade-in duration-200">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
        <p className="text-[13px] text-muted-foreground/60 mt-1">{filteredClients.length} clients</p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="h-8 w-full sm:w-[180px] pl-8 pr-3 text-[13px] bg-secondary border border-border/20 rounded-lg outline-none focus:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors duration-150 placeholder:text-muted-foreground/60"
          />
        </div>

        <FilterPopover
          label="Team"
          selected={filterTeam}
          options={teamFilterOptions}
          onSelectionChange={setFilterTeam}
        />

        <FilterPopover
          label="Status"
          selected={filterStatus}
          options={[
            { value: 'active', label: 'Active', dot: '#34d399' },
            { value: 'paused', label: 'Paused', dot: '#fbbf24' },
            { value: 'churned', label: 'Churned', dot: '#f87171' },
          ]}
          onSelectionChange={setFilterStatus}
        />

        <FilterPopover
          label="Service"
          selected={filterService}
          options={deriveServiceOptions(clients)}
          onSelectionChange={setFilterService}
        />

        {hasFilters && (
          <button
            onClick={() => { setFilterTeam([]); setFilterStatus([]); setFilterService([]); setSearchQuery(''); }}
            className="h-8 px-3 text-[13px] rounded-lg border border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors duration-150 flex items-center gap-1.5"
          >
            <X className="h-3 w-3" />
            Clear all
          </button>
        )}

        <div className="flex-1" />
        <ToggleGroup type="single" value={viewMode} onValueChange={(v) => { if (v) setViewMode(v as 'grid' | 'table'); }}>
          <ToggleGroupItem value="grid" aria-label="Grid view" className="focus-visible:ring-2 focus-visible:ring-primary/50">
            <LayoutGrid className="h-4 w-4 mr-1" aria-hidden="true" />
            <span className="text-[13px]">Grid</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="table" aria-label="Table view" className="focus-visible:ring-2 focus-visible:ring-primary/50">
            <Table2 className="h-4 w-4 mr-1" aria-hidden="true" />
            <span className="text-[13px]">Table</span>
          </ToggleGroupItem>
        </ToggleGroup>
        <Button size="sm" onClick={openNewClient}>
          <Plus className="h-4 w-4 mr-1" /> New Client
        </Button>
      </div>

      {/* Client views */}
      {(() => {
        const toggleSort = (field: typeof sortField) => {
          if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
          else { setSortField(field); setSortDir('asc'); }
        };
        const SortIcon = ({ field }: { field: typeof sortField }) => sortField === field ? (sortDir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : null;
        const sorted = [...filteredClients].sort((a, b) => {
          const dir = sortDir === 'asc' ? 1 : -1;
          switch (sortField) {
            case 'name': return dir * a.name.localeCompare(b.name);
            case 'team': return dir * (a.team || 'zzz').localeCompare(b.team || 'zzz');
            case 'status': return dir * (a.status || '').localeCompare(b.status || '');
            case 'retainer': return dir * ((a.calculated_retainer ?? a.monthly_retainer ?? 0) - (b.calculated_retainer ?? b.monthly_retainer ?? 0));
            case 'tenure': return dir * (monthsActive(a.signup_date || a.created_at, a.churned_at) - monthsActive(b.signup_date || b.created_at, b.churned_at));
            default: return 0;
          }
        });

        if (loading) return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border/20 bg-card p-3 animate-pulse">
                <div className="h-4 w-2/3 bg-muted/40 rounded mb-2" />
                <div className="h-3 w-1/2 bg-muted/30 rounded mb-2" />
                <div className="h-3 w-full bg-muted/20 rounded" />
              </div>
            ))}
          </div>
        );

        if (viewMode === 'table') return (
          <div className="rounded-lg border border-border/20 bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border/20 bg-muted/30">
                    {([['name', 'Name'], ['team', 'Team'], ['status', 'Status'], ['retainer', 'Retainer'], ['tenure', 'Tenure']] as const).map(([field, label]) => (
                      <th key={field} onClick={() => toggleSort(field)} className="text-left px-4 py-3 text-[11px] font-medium text-muted-foreground/60 cursor-pointer hover:text-foreground transition-colors select-none">
                        <span className="inline-flex items-center gap-1">{label} <SortIcon field={field} /></span>
                      </th>
                    ))}
                    <th className="text-left px-4 py-3 text-[11px] font-medium text-muted-foreground/60">Services</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((client) => {
                    const teamStyle = getTeamStyle(client.team);
                    const tenure = monthsActive(client.signup_date || client.created_at, client.churned_at);
                    return (
                      <tr key={client.id} onClick={() => router.push(`/clients/${client.id}`)} className="border-b border-border/10 hover:bg-muted/40 cursor-pointer transition-colors">
                        <td className="px-4 py-2.5 font-medium text-foreground">{client.name}</td>
                        <td className="px-4 py-2.5">
                          {teamStyle ? (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: teamStyle.color }} />
                              <span className="text-muted-foreground">{teamStyle.label}</span>
                            </span>
                          ) : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${CLIENT_STATUS_STYLES[client.status]?.bg || 'bg-muted/20'} ${CLIENT_STATUS_STYLES[client.status]?.text || 'text-muted-foreground'}`}>
                            {client.status.charAt(0).toUpperCase() + client.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground tabular-nums">£{(client.calculated_retainer ?? client.monthly_retainer ?? 0).toLocaleString()}/mo</td>
                        <td className="px-4 py-2.5 text-muted-foreground/60">{tenure === 1 ? '1 month' : `${tenure} months`}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {(client.derived_services || client.services || []).filter((s: string) => s !== 'account-management').map((service: string) => {
                              const s = getServiceStyle(service);
                              return (
                                <span key={service} className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${s.bg} ${s.text}`}>
                                  <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: s.dot }} />
                                  {s.label}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );

        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {sorted.map((client) => {
              const teamStyle = getTeamStyle(client.team);
              const tenure = monthsActive(client.signup_date || client.created_at, client.churned_at);
              return (
                <div key={client.id} onClick={() => router.push(`/clients/${client.id}`)} className="block rounded-lg border border-border/20 bg-card p-3 hover:bg-muted/40 hover:border-primary/30 transition-all duration-150 cursor-pointer">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[13px] font-semibold text-foreground truncate mr-2">{client.name}</h3>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${CLIENT_STATUS_STYLES[client.status]?.bg || 'bg-muted/20'} ${CLIENT_STATUS_STYLES[client.status]?.text || 'text-muted-foreground'}`}>{(client.status.charAt(0).toUpperCase() + client.status.slice(1))}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    {teamStyle && (<><span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: teamStyle.color }} /><span className="text-[11px] text-muted-foreground">{teamStyle.label}</span><span className="text-[11px] text-muted-foreground/40">·</span></>)}
                    <span className="text-[11px] text-muted-foreground">£{(client.calculated_retainer ?? client.monthly_retainer ?? 0).toLocaleString()}/mo</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {(client.derived_services || client.services || []).filter((s: string) => s !== 'account-management').map((service: string) => {
                      const s = getServiceStyle(service);
                      return (
                        <span key={service} className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${s.bg} ${s.text}`}>
                          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: s.dot }} />{s.label}
                        </span>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {teamStyle && (<span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: `${teamStyle.color}22`, color: teamStyle.color }}>{teamStyle.label}</span>)}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground/50"><Clock size={10} />{tenure === 1 ? '1 month' : `${tenure} months`}</div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {!loading && filteredClients.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users size={32} className="text-muted-foreground/30 mb-3" />
          <p className="text-[13px] font-medium text-muted-foreground">No clients found</p>
          <p className="text-[13px] text-muted-foreground/60 mt-1">Try adjusting your filters</p>
        </div>
      )}

      {/* Client Sheet */}
      <ClientSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        editClient={editingClient}
        teams={teams}
        users={users}
        onSaved={fetchClients}
      />

      {/* Shortcuts Dialog */}
      <ShortcutsDialog
        open={showShortcuts}
        onClose={() => setShowShortcuts(false)}
        shortcuts={PAGE_SHORTCUTS}
        pageName="Clients"
      />
    </div>
  );
}

export default function ClientsPage() {
  return (
    <Suspense fallback={
      <div className="animate-in fade-in duration-200">
        <div className="mb-6">
          <div className="h-8 w-32 rounded bg-muted/30 animate-pulse" />
          <div className="h-4 w-24 rounded bg-muted/20 animate-pulse mt-2" />
        </div>
      </div>
    }>
      <ClientsPageContent />
    </Suspense>
  );
}
