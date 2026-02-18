'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { TEAM_STYLES, SERVICE_STYLES, getTeamStyle } from '@/lib/constants';
import { Users, Search, ChevronDown, Check, X, Plus, Clock, CalendarIcon, ExternalLink } from 'lucide-react';
import { FilterPopover } from '@/components/ui/filter-popover';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ServiceIcon } from '@/components/ui/service-icon';
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

interface ClientRow {
  id: string;
  name: string;
  team: string;
  status: string;
  services: string[];
  monthly_retainer: number;
  assigned_members: string[];
  color: string | null;
  created_at: string;
  signup_date?: string;
  notes?: string;
}

interface TeamOption {
  id: string;
  name: string;
}

/** Services to exclude from revenue/filter contexts */
const REVENUE_SERVICES = Object.entries(SERVICE_STYLES)
  .filter(([key]) => key !== 'account-management')
  .map(([key, style]) => ({ value: key, label: style.label }));

function monthsActive(createdAt: string): number {
  const start = new Date(createdAt);
  const now = new Date();
  return Math.max(
    0,
    Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
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

/* ── Client Sheet (new / edit) ─────────────────────────────────────────────── */
interface ClientFormState {
  name: string;
  team: string;
  assigned_members: string[];
  status: string;
  signup_date: string;
  notes: string;
}

const emptyClientForm: ClientFormState = {
  name: '',
  team: '',
  assigned_members: [],
  status: 'active',
  signup_date: '',
  notes: '',
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
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="px-6 py-5 border-b border-border/20">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-[15px]">
              {editClient ? 'Edit Client' : 'New Client'}
            </SheetTitle>
            {editClient && (
              <Link
                href={`/clients/${editClient.id}`}
                className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => onOpenChange(false)}
              >
                <ExternalLink size={12} /> View full profile
              </Link>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Company Name */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wide">Company Name *</Label>
            <Input
              autoFocus={!editClient}
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Acme Ltd"
              className="text-[13px] h-9"
            />
          </div>

          {/* Team */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wide">Team</Label>
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
            <Label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wide">Status</Label>
            <Popover open={statusOpen} onOpenChange={setStatusOpen}>
              <PopoverTrigger asChild>
                <button className="w-full h-9 px-3 text-[13px] rounded-md border border-border/20 bg-secondary flex items-center justify-between hover:border-border/40 transition-colors">
                  <span className={
                    form.status === 'active' ? 'text-emerald-400' :
                    form.status === 'paused' ? 'text-amber-400' :
                    'text-red-400'
                  }>{STATUS_OPTIONS.find(s => s.value === form.status)?.label || 'Select status…'}</span>
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
                    <span className={
                      s.value === 'active' ? 'text-emerald-400' :
                      s.value === 'paused' ? 'text-amber-400' :
                      'text-red-400'
                    }>{s.label}</span>
                    {form.status === s.value && <Check size={14} className="text-primary" />}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </div>

          {/* Assigned Members */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wide">Assigned Members</Label>
            <MembersMultiSelect
              selected={form.assigned_members}
              onChange={v => setForm(f => ({ ...f, assigned_members: v }))}
              users={users}
            />
          </div>

          {/* Start Date */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wide">Start Date</Label>
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

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wide">Notes</Label>
            <Textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Any notes about this client…"
              className="text-[13px] min-h-[80px] resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/20 flex items-center justify-end gap-2">
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

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [searchQuery, setSearchQuery] = usePersistedState('clients-search', '');
  const [filterTeam, setFilterTeam] = usePersistedState<string[]>('clients-filterTeam', []);
  const [filterStatus, setFilterStatus] = usePersistedState<string[]>('clients-filterStatus', []);
  const [filterService, setFilterService] = usePersistedState<string[]>('clients-filterService', []);
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
    if (filterService.length > 0 && !filterService.some(s => client.services?.includes(s))) return false;
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
            { value: 'active', label: 'Active' },
            { value: 'paused', label: 'Paused' },
            { value: 'churned', label: 'Churned' },
          ]}
          onSelectionChange={setFilterStatus}
        />

        <FilterPopover
          label="Service"
          selected={filterService}
          options={REVENUE_SERVICES}
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
        <Button size="sm" onClick={openNewClient}>
          <Plus className="h-4 w-4 mr-1" /> New Client
        </Button>
      </div>

      {/* Client Grid — compact cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border/20 bg-card p-3 animate-pulse">
              <div className="h-4 w-2/3 bg-muted/40 rounded mb-2" />
              <div className="h-3 w-1/2 bg-muted/30 rounded mb-2" />
              <div className="h-3 w-full bg-muted/20 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredClients.map((client) => {
            const teamStyle = getTeamStyle(client.team);
            const tenure = monthsActive(client.created_at);

            return (
              <div
                key={client.id}
                onClick={() => router.push(`/clients/${client.id}`)}
                className="block rounded-lg border border-border/20 bg-card p-3 hover:bg-muted/40 hover:border-primary/30 transition-all duration-150 cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[13px] font-semibold text-foreground truncate mr-2">{client.name}</h3>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${
                      client.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' :
                      client.status === 'paused' ? 'bg-amber-500/10 text-amber-400' :
                      'bg-red-500/10 text-red-400'
                    }`}
                  >
                    {client.status}
                  </span>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  {teamStyle && (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: teamStyle.color }} />
                      <span className="text-[11px] text-muted-foreground">{teamStyle.label}</span>
                      <span className="text-[11px] text-muted-foreground/40">·</span>
                    </>
                  )}
                  <span className="text-[11px] text-muted-foreground">
                    £{(client.monthly_retainer || 0).toLocaleString()}/mo
                  </span>
                </div>

                <div className="flex flex-wrap gap-1 mb-2">
                  {(client.services || [])
                    .filter(s => s !== 'account-management')
                    .map((service) => {
                      const s = SERVICE_STYLES[service];
                      if (!s) return null;
                      return (
                        <span key={service} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${s.bg} ${s.text}`}>
                          <ServiceIcon serviceKey={service} size={10} />
                          {s.label}
                        </span>
                      );
                    })}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {teamStyle && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium`}
                        style={{ backgroundColor: `${teamStyle.color}22`, color: teamStyle.color }}>
                        {teamStyle.label}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
                    <Clock size={10} />
                    {tenure === 1 ? '1 month' : `${tenure} months`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
