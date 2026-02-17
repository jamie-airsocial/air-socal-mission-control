'use client';

import { useState, useEffect, useCallback } from 'react';
import { TEAM_MEMBERS } from '@/lib/data';
import { TEAM_STYLES, SERVICE_STYLES } from '@/lib/constants';
import { Users, Search, ChevronDown, Check, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import Link from 'next/link';

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

/* ── Reusable filter popover (matches tasks page style) ───────────────── */
function FilterPopover({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string; dot?: string }[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = value !== 'all';
  const activeLabel = options.find(o => o.value === value)?.label || label;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`h-8 px-3 text-[13px] bg-secondary border rounded-lg hover:border-primary/50 transition-colors duration-150 flex items-center gap-1.5 ${
            active ? 'border-primary text-primary' : 'border-border/20 text-muted-foreground'
          }`}
        >
          {active ? activeLabel : label}
          <ChevronDown size={12} className="text-muted-foreground/40" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="start">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => { onChange(opt.value); setOpen(false); }}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[13px] transition-colors duration-150 ${
              value === opt.value ? 'bg-primary/10 text-primary' : 'hover:bg-muted/60 text-muted-foreground'
            }`}
          >
            {opt.dot && (
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: opt.dot }} />
            )}
            <span className="flex-1 text-left">{opt.label}</span>
            {value === opt.value && <Check size={14} className="text-primary shrink-0" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTeam, setFilterTeam] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterService, setFilterService] = useState<string>('all');

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
    if (filterTeam !== 'all' && client.team !== filterTeam) return false;
    if (filterStatus !== 'all' && client.status !== filterStatus) return false;
    if (filterService !== 'all' && !client.services?.includes(filterService)) return false;
    return true;
  });

  const hasFilters = filterTeam !== 'all' || filterStatus !== 'all' || filterService !== 'all' || searchQuery !== '';

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
          label="All teams"
          value={filterTeam}
          options={[
            { value: 'all', label: 'All teams' },
            { value: 'synergy', label: 'Synergy', dot: TEAM_STYLES.synergy.color },
            { value: 'ignite', label: 'Ignite', dot: TEAM_STYLES.ignite.color },
            { value: 'alliance', label: 'Alliance', dot: TEAM_STYLES.alliance.color },
          ]}
          onChange={setFilterTeam}
        />

        <FilterPopover
          label="All statuses"
          value={filterStatus}
          options={[
            { value: 'all', label: 'All statuses' },
            { value: 'active', label: 'Active' },
            { value: 'paused', label: 'Paused' },
            { value: 'churned', label: 'Churned' },
          ]}
          onChange={setFilterStatus}
        />

        <FilterPopover
          label="All services"
          value={filterService}
          options={[
            { value: 'all', label: 'All services' },
            ...Object.entries(SERVICE_STYLES).map(([key, style]) => ({
              value: key,
              label: `${style.icon} ${style.label}`,
            })),
          ]}
          onChange={setFilterService}
        />

        {hasFilters && (
          <button
            onClick={() => { setFilterTeam('all'); setFilterStatus('all'); setFilterService('all'); setSearchQuery(''); }}
            className="h-8 px-3 text-[13px] rounded-lg border border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors duration-150 flex items-center gap-1.5"
          >
            <X className="h-3 w-3" />
            Clear all
          </button>
        )}
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
            const teamStyle = TEAM_STYLES[client.team as keyof typeof TEAM_STYLES];

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
                  {(client.services || []).map((service) => {
                    const s = SERVICE_STYLES[service];
                    if (!s) return null;
                    return (
                      <span key={service} className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${s.bg} ${s.text}`}>
                        {s.icon} {s.label}
                      </span>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex -space-x-1.5">
                    {(client.assigned_members || []).slice(0, 3).map((memberId) => {
                      const member = TEAM_MEMBERS.find(m => m.id === memberId);
                      if (!member) return null;
                      return (
                        <div
                          key={memberId}
                          className="w-5 h-5 rounded-full bg-primary/20 border-[1.5px] border-card flex items-center justify-center"
                        >
                          <span className="text-[8px] leading-none font-medium text-primary">{member.name.charAt(0)}</span>
                        </div>
                      );
                    })}
                    {(client.assigned_members || []).length > 3 && (
                      <div className="w-5 h-5 rounded-full bg-muted/40 border-[1.5px] border-card flex items-center justify-center">
                        <span className="text-[8px] leading-none font-medium text-muted-foreground">+{client.assigned_members.length - 3}</span>
                      </div>
                    )}
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
    </div>
  );
}
