'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { TEAM_MEMBERS } from '@/lib/data';
import { TEAM_STYLES, SERVICE_STYLES } from '@/lib/constants';
import { Users, Search, ChevronDown, Check, X, Plus, Clock, CalendarIcon } from 'lucide-react';
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

/* ── Multi-select filter popover ───────────────────────────────────────── */
function MultiFilterPopover({
  label,
  selected,
  options,
  onChange,
}: {
  label: string;
  selected: string[];
  options: { value: string; label: string; dot?: string }[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = selected.length > 0;

  const toggle = (val: string) => {
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`h-8 px-3 text-[13px] bg-secondary border rounded-lg hover:border-primary/50 transition-colors duration-150 flex items-center gap-1.5 ${
            active ? 'border-primary text-primary' : 'border-border/20 text-muted-foreground'
          }`}
        >
          {active ? `${label} (${selected.length})` : label}
          <ChevronDown size={12} className="text-muted-foreground/40" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="start">
        {options.map(opt => {
          const isSelected = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              onClick={() => toggle(opt.value)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[13px] transition-colors duration-150 ${
                isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted/60 text-muted-foreground'
              }`}
            >
              <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                isSelected ? 'border-primary bg-primary' : 'border-border/40'
              }`}>
                {isSelected && <Check size={10} className="text-primary-foreground" />}
              </div>
              {opt.dot && (
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: opt.dot }} />
              )}
              <span className="flex-1 text-left">{opt.label}</span>
            </button>
          );
        })}
        {selected.length > 0 && (
          <button
            onClick={() => onChange([])}
            className="w-full mt-1 pt-1 border-t border-border/10 px-2 py-1.5 rounded text-[13px] text-muted-foreground/60 hover:text-foreground transition-colors duration-150 text-left"
          >
            Clear
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ── Services multi-select for the new client form ─────────────────────── */
function ServicesMultiSelect({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [services, setServices] = React.useState(REVENUE_SERVICES);
  const [adding, setAdding] = React.useState(false);
  const [newServiceName, setNewServiceName] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    fetch('/api/services')
      .then(r => r.ok ? r.json() : null)
      .then((data: Array<{ id: string; label: string }> | null) => {
        if (!data) return;
        const apiServices = data
          .filter((s) => s.id !== 'account-management')
          .map((s) => ({ value: s.id, label: s.label }));
        // Merge: keep hardcoded order, append new ones not in hardcoded list
        const hardcodedIds = new Set(REVENUE_SERVICES.map(s => s.value));
        const extras = apiServices.filter(s => !hardcodedIds.has(s.value));
        setServices([...REVENUE_SERVICES, ...extras]);
      })
      .catch(() => {});
  }, []);

  const toggle = (val: string) => {
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);
  };

  const handleAddService = async () => {
    if (!newServiceName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newServiceName.trim() }),
      });
      if (res.ok) {
        const created = await res.json() as { id: string; label: string };
        setServices(prev => [...prev, { value: created.id, label: created.label }]);
        setNewServiceName('');
        setAdding(false);
      }
    } catch { /* silent */ }
    finally { setSaving(false); }
  };

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {services.map(s => {
        const active = selected.includes(s.value);
        return (
          <button
            key={s.value}
            type="button"
            onClick={() => toggle(s.value)}
            className={`h-7 px-2.5 text-[11px] rounded-md border transition-colors duration-150 flex items-center gap-1 ${
              active
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border/20 bg-secondary text-muted-foreground hover:border-primary/40'
            }`}
          >
            {active && <Check size={10} />}
            {s.label}
          </button>
        );
      })}
      {adding ? (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            value={newServiceName}
            onChange={e => setNewServiceName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAddService();
              if (e.key === 'Escape') { setAdding(false); setNewServiceName(''); }
            }}
            placeholder="Service name..."
            className="h-7 px-2 text-[11px] bg-secondary border border-border/20 rounded-md outline-none focus:border-primary/50 w-32"
          />
          <button
            type="button"
            onClick={handleAddService}
            disabled={saving || !newServiceName.trim()}
            className="h-7 px-2 text-[11px] rounded-md border border-primary/50 bg-primary/10 text-primary hover:bg-primary/20 transition-colors duration-150 disabled:opacity-50"
          >
            {saving ? '...' : 'Add'}
          </button>
          <button
            type="button"
            onClick={() => { setAdding(false); setNewServiceName(''); }}
            className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors duration-150"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="h-7 px-2.5 text-[11px] rounded-md border border-dashed border-border/30 text-muted-foreground/60 hover:border-primary/40 hover:text-muted-foreground transition-colors duration-150 flex items-center gap-1"
        >
          <Plus size={10} /> Add Service
        </button>
      )}

    </div>
  );
}

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = usePersistedState('clients-search', '');
  const [filterTeam, setFilterTeam] = usePersistedState<string[]>('clients-filterTeam', []);
  const [filterStatus, setFilterStatus] = usePersistedState<string[]>('clients-filterStatus', []);
  const [filterService, setFilterService] = usePersistedState<string[]>('clients-filterService', []);

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch('/api/clients');
      if (res.ok) setClients(await res.json());
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const filteredClients = clients.filter(client => {
    if (searchQuery && !client.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterTeam.length > 0 && !filterTeam.includes(client.team)) return false;
    if (filterStatus.length > 0 && !filterStatus.includes(client.status)) return false;
    if (filterService.length > 0 && !filterService.some(s => client.services?.includes(s))) return false;
    return true;
  });

  const hasFilters = filterTeam.length > 0 || filterStatus.length > 0 || filterService.length > 0 || searchQuery !== '';

  // New client form state
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientTeam, setNewClientTeam] = useState('synergy');
  const [newClientRetainer, setNewClientRetainer] = useState('');
  const [newClientServices, setNewClientServices] = useState<string[]>([]);
  const [newClientSignupDate, setNewClientSignupDate] = useState('');
  const [newClientContactName, setNewClientContactName] = useState('');
  const [newClientContactEmail, setNewClientContactEmail] = useState('');
  const [newClientContactPhone, setNewClientContactPhone] = useState('');
  const [creating, setCreating] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const resetForm = () => {
    setNewClientName('');
    setNewClientTeam('synergy');
    setNewClientRetainer('');
    setNewClientServices([]);
    setNewClientSignupDate('');
    setNewClientContactName('');
    setNewClientContactEmail('');
    setNewClientContactPhone('');
    setShowNewClient(false);
  };

  const createClient = async () => {
    if (!newClientName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newClientName.trim(),
          team: newClientTeam,
          status: 'active',
          services: newClientServices,
          monthly_retainer: newClientRetainer ? parseFloat(newClientRetainer) : 0,
          assigned_members: [],
          signup_date: newClientSignupDate || new Date().toISOString().split('T')[0],
          contact_name: newClientContactName.trim() || null,
          contact_email: newClientContactEmail.trim() || null,
          contact_phone: newClientContactPhone.trim() || null,
        }),
      });
      if (!res.ok) { toast.error('Failed to create client'); return; }
      toast.success(newClientName + ' added to clients');
      resetForm();
      fetchClients();
    } catch { toast.error('Failed to create client'); }
    finally { setCreating(false); }
  };

  // Keyboard shortcuts
  const PAGE_SHORTCUTS = [
    { key: 'N', description: 'New client' },
    { key: 'Esc', description: 'Close form' },
    { key: '?', description: 'Show shortcuts' },
  ];

  useKeyboardShortcuts([
    { key: 'n', description: 'New client', action: () => { if (!showNewClient) setShowNewClient(true); } },
    { key: 'Escape', description: 'Close form', action: () => { if (showNewClient) resetForm(); setShowShortcuts(false); }, skipInInput: false },
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

        <MultiFilterPopover
          label="Team"
          selected={filterTeam}
          options={[
            { value: 'synergy', label: 'Synergy', dot: TEAM_STYLES.synergy.color },
            { value: 'ignite', label: 'Ignite', dot: TEAM_STYLES.ignite.color },
            { value: 'alliance', label: 'Alliance', dot: TEAM_STYLES.alliance.color },
          ]}
          onChange={setFilterTeam}
        />

        <MultiFilterPopover
          label="Status"
          selected={filterStatus}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'paused', label: 'Paused' },
            { value: 'churned', label: 'Churned' },
          ]}
          onChange={setFilterStatus}
        />

        <MultiFilterPopover
          label="Service"
          selected={filterService}
          options={REVENUE_SERVICES}
          onChange={setFilterService}
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
        <Button size="sm" onClick={() => setShowNewClient(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Client
        </Button>
      </div>

      {/* New client form */}
      {showNewClient && (
        <div className="mb-4 p-5 rounded-lg border border-primary/30 bg-card space-y-4">
          <p className="text-[15px] font-semibold">New Client</p>

          {/* Row 1: Company + Team */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground/60 mb-1 block">Company Name *</label>
              <input
                autoFocus
                value={newClientName}
                onChange={e => setNewClientName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') resetForm(); }}
                placeholder="e.g. Acme Ltd"
                className="w-full h-8 px-3 text-[13px] bg-secondary border border-border/20 rounded-lg outline-none focus:border-primary/50 transition-colors duration-150"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground/60 mb-1 block">Team</label>
              <div className="flex gap-1.5">
                {Object.entries(TEAM_STYLES).map(([key, style]) => (
                  <button
                    key={key}
                    onClick={() => setNewClientTeam(key)}
                    className={`flex-1 h-8 rounded-lg text-[13px] font-medium border transition-colors duration-150 flex items-center justify-center gap-1.5 ${
                      newClientTeam === key
                        ? `${style.bg} ${style.text} border-current`
                        : 'border-border/20 bg-secondary text-muted-foreground hover:border-primary/30'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: style.color }} />
                    {style.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Row 2: Contact details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground/60 mb-1 block">Contact Name</label>
              <input
                value={newClientContactName}
                onChange={e => setNewClientContactName(e.target.value)}
                placeholder="e.g. John Smith"
                className="w-full h-8 px-3 text-[13px] bg-secondary border border-border/20 rounded-lg outline-none focus:border-primary/50 transition-colors duration-150"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground/60 mb-1 block">Email</label>
              <input
                value={newClientContactEmail}
                onChange={e => setNewClientContactEmail(e.target.value)}
                placeholder="john@company.com"
                type="email"
                className="w-full h-8 px-3 text-[13px] bg-secondary border border-border/20 rounded-lg outline-none focus:border-primary/50 transition-colors duration-150"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground/60 mb-1 block">Phone</label>
              <input
                value={newClientContactPhone}
                onChange={e => setNewClientContactPhone(e.target.value)}
                placeholder="07xxx xxxxxx"
                type="tel"
                className="w-full h-8 px-3 text-[13px] bg-secondary border border-border/20 rounded-lg outline-none focus:border-primary/50 transition-colors duration-150"
              />
            </div>
          </div>

          {/* Row 3: Retainer + Start Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground/60 mb-1 block">Monthly Retainer</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">£</span>
                <input
                  value={newClientRetainer}
                  onChange={e => setNewClientRetainer(e.target.value)}
                  placeholder="0"
                  type="number"
                  className="w-full h-8 pl-7 pr-3 text-[13px] bg-secondary border border-border/20 rounded-lg outline-none focus:border-primary/50 transition-colors duration-150"
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground/60 mb-1 block">Start Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="w-full h-8 px-3 text-[13px] bg-secondary border border-border/20 rounded-lg outline-none hover:border-primary/50 transition-colors duration-150 flex items-center justify-between text-left">
                    <span className={newClientSignupDate ? 'text-foreground' : 'text-muted-foreground/40'}>
                      {newClientSignupDate ? format(new Date(newClientSignupDate), 'dd/MM/yyyy') : 'Select date...'}
                    </span>
                    <CalendarIcon size={14} className="text-muted-foreground/40" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={newClientSignupDate ? new Date(newClientSignupDate) : undefined}
                    onSelect={(date) => { if (date) setNewClientSignupDate(date.toISOString().split('T')[0]); }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Row 4: Services */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground/60 mb-1.5 block">Services</label>
            <ServicesMultiSelect selected={newClientServices} onChange={setNewClientServices} />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" onClick={createClient} disabled={creating || !newClientName.trim()}>
              {creating ? 'Creating...' : 'Create Client'}
            </Button>
            <button onClick={resetForm} className="h-8 px-3 text-[13px] text-muted-foreground hover:text-foreground transition-colors duration-150 flex items-center gap-1">
              <X size={14} /> Cancel
            </button>
          </div>
        </div>
      )}

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
            const teamStyle = TEAM_STYLES[client.team as keyof typeof TEAM_STYLES];
            const tenure = monthsActive(client.created_at);

            return (
              <Link
                key={client.id}
                href={`/clients/${client.id}`}
                className="block rounded-lg border border-border/20 bg-card p-3 hover:bg-muted/40 hover:border-primary/30 transition-all duration-150"
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
                      <span
                        className="h-1.5 w-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: teamStyle.color }}
                      />
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
                  <TooltipProvider delayDuration={200}>
                  <div className="flex -space-x-1.5">
                    {(client.assigned_members || []).slice(0, 3).map((memberId) => {
                      const member = TEAM_MEMBERS.find(m => m.id === memberId);
                      if (!member) return null;
                      return (
                        <Tooltip key={memberId}>
                          <TooltipTrigger asChild>
                            <div
                              className="w-5 h-5 rounded-full bg-primary/20 border-[1.5px] border-card flex items-center justify-center"
                            >
                              <span className="text-[8px] leading-none font-medium text-primary">{member.name.charAt(0)}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="text-xs">
                            <p>{member.name}</p>
                            <p className="text-muted-foreground">{member.role}</p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                    {(client.assigned_members || []).length > 3 && (
                      <div className="w-5 h-5 rounded-full bg-muted/40 border-[1.5px] border-card flex items-center justify-center">
                        <span className="text-[8px] leading-none font-medium text-muted-foreground">+{client.assigned_members.length - 3}</span>
                      </div>
                    )}
                  </div>
                  </TooltipProvider>
                  {/* Tenure badge */}
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
                    <Clock size={10} />
                    {tenure === 1 ? '1 month' : `${tenure} months`}
                  </div>
                </div>
              </Link>
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
