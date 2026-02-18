'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getTeamStyle, TEAM_STYLES } from '@/lib/constants';
import { PoundSterling, TrendingUp, Users, AlertCircle, ChevronUp, ChevronDown, ChevronsUpDown, TrendingDown, AlertTriangle, X } from 'lucide-react';
import { usePersistedState } from '@/hooks/use-persisted-state';
import { FilterPopover } from '@/components/ui/filter-popover';

interface Client {
  id: string;
  name: string;
  team: string;
  status: string;
  monthly_retainer: number;
  services: string[];
  created_at: string;
  signup_date?: string;
  churned_at?: string;
}

interface ContractLineItem {
  id: string;
  client_id: string;
  service: string;
  description: string | null;
  monthly_value: number;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
}

interface Team {
  id: string;
  name: string;
  members?: { id: string; full_name: string }[];
}

interface Prospect {
  id: string;
  name: string;
  value: number;
  stage: string;
  team: string | null;
}

type SortKey = 'name' | 'team' | 'retainer' | 'tenure' | 'status';
type SortDir = 'asc' | 'desc';

function monthsBetween(from: string, to?: string): number {
  const start = new Date(from);
  const end = to ? new Date(to) : new Date();
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown size={11} className="text-muted-foreground/30 ml-1" />;
  return sortDir === 'asc'
    ? <ChevronUp size={11} className="text-primary ml-1" />
    : <ChevronDown size={11} className="text-primary ml-1" />;
}

export default function XeroPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [contractItems, setContractItems] = useState<ContractLineItem[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>('retainer');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filterTeams, setFilterTeams] = usePersistedState<string[]>('xero-filterTeams', []);
  const [activeSection, setActiveSection] = usePersistedState<'overview' | 'projections'>('xero-section', 'overview');

  useEffect(() => {
    Promise.all([
      fetch('/api/clients').then(r => r.json()).catch(() => []),
      fetch('/api/teams').then(r => r.json()).catch(() => []),
      fetch('/api/prospects').then(r => r.json()).catch(() => []),
    ]).then(async ([clientsData, teamsData, prospectsData]) => {
      setClients(clientsData || []);
      setTeams(teamsData || []);
      setProspects((prospectsData || []).filter((p: Prospect) => !['won', 'lost'].includes(p.stage)));

      const activeClients: Client[] = (clientsData || []).filter((c: Client) => c.status === 'active');
      const items = await Promise.all(
        activeClients.map((c: Client) =>
          fetch(`/api/clients/${c.id}/contracts`, { cache: 'no-store' })
            .then(r => r.ok ? r.json() : [])
            .catch(() => [])
        )
      );
      setContractItems(items.flat());
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const allClients = clients;
  const activeClients = allClients.filter(c => c.status === 'active');
  const churnedClients = allClients.filter(c => c.status === 'churned');

  const hasContractData = contractItems.length > 0;

  // Build contract revenue map by client
  const contractRevenueByClient = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of contractItems) {
      if (item.is_active) {
        map[item.client_id] = (map[item.client_id] || 0) + (item.monthly_value || 0);
      }
    }
    return map;
  }, [contractItems]);

  // Revenue by service
  const revenueByService = useMemo(() => {
    if (!hasContractData) return [];
    const map: Record<string, number> = {};
    for (const item of contractItems) {
      if (item.is_active) {
        map[item.service] = (map[item.service] || 0) + (item.monthly_value || 0);
      }
    }
    return Object.entries(map)
      .map(([service, revenue]) => ({ service, revenue }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [contractItems, hasContractData]);

  const clientRevenue = (c: Client) => hasContractData
    ? (contractRevenueByClient[c.id] || 0)
    : (c.monthly_retainer || 0);

  const totalRevenue = activeClients.reduce((sum, c) => sum + clientRevenue(c), 0);
  const avgRetainer = activeClients.length > 0 ? Math.round(totalRevenue / activeClients.length) : 0;

  const twelveMonthsAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
  const recentlyChurned = churnedClients.filter(c => c.churned_at && c.churned_at >= twelveMonthsAgo);
  const overallChurnRate = allClients.length > 0
    ? Math.round((recentlyChurned.length / allClients.length) * 100)
    : 0;

  // ── Team data (dynamic from DB) ──────────────────────────────────────────
  // Get unique team slugs from clients (not just teams table, in case of orphaned clients)
  const teamSlugs = useMemo(() => {
    const slugs = new Set<string>();
    allClients.forEach(c => { if (c.team) slugs.add(c.team); });
    // Also add teams from the teams table
    teams.forEach(t => { if (t.name) slugs.add(t.name.toLowerCase()); });
    return Array.from(slugs).sort();
  }, [allClients, teams]);

  const revenueByTeam = useMemo(() => {
    return teamSlugs.map(slug => {
      const teamObj = teams.find(t => t.name.toLowerCase() === slug);
      const style = getTeamStyle(slug);
      const label = teamObj?.name || style.label || slug;
      const teamClients = activeClients.filter(c => c.team === slug);
      const revenue = teamClients.reduce((sum, c) => sum + clientRevenue(c), 0);
      const allTeamClients = allClients.filter(c => c.team === slug);
      const churnedTeam = allTeamClients.filter(c => c.status === 'churned' && c.churned_at && c.churned_at >= twelveMonthsAgo);
      const churnRate = allTeamClients.length > 0 ? Math.round((churnedTeam.length / allTeamClients.length) * 100) : 0;
      const memberCount = teamObj?.members?.length ?? 0;

      // Expiring contracts (active line items with end_date in next 90 days)
      const teamClientIds = new Set(teamClients.map(c => c.id));
      const expiringItems = contractItems.filter(item => {
        if (!item.is_active || !item.end_date || !teamClientIds.has(item.client_id)) return false;
        const days = daysUntil(item.end_date);
        return days !== null && days >= 0 && days <= 90;
      });
      const expiringValue = expiringItems.reduce((sum, i) => sum + (i.monthly_value || 0), 0);

      return {
        slug, label, style, revenue, count: teamClients.length, churnRate,
        allCount: allTeamClients.length, memberCount, expiringItems, expiringValue,
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamSlugs, teams, activeClients, allClients, contractItems, contractRevenueByClient]);

  const maxTeamRevenue = Math.max(...revenueByTeam.map(t => t.revenue), 1);
  const maxServiceRevenue = revenueByService.length > 0 ? Math.max(...revenueByService.map(s => s.revenue), 1) : 1;

  // ── Expiring contracts — next 30/60/90 days ───────────────────────────────
  const expiringByBucket = useMemo(() => {
    const buckets = { d30: [] as ContractLineItem[], d60: [] as ContractLineItem[], d90: [] as ContractLineItem[] };
    for (const item of contractItems) {
      if (!item.is_active || !item.end_date) continue;
      const days = daysUntil(item.end_date);
      if (days === null || days < 0) continue;
      if (days <= 30) buckets.d30.push(item);
      else if (days <= 60) buckets.d60.push(item);
      else if (days <= 90) buckets.d90.push(item);
    }
    return buckets;
  }, [contractItems]);

  const clientMap = useMemo(() => {
    const m: Record<string, Client> = {};
    for (const c of allClients) m[c.id] = c;
    return m;
  }, [allClients]);

  // ── Pipeline value per team ────────────────────────────────────────────────
  // Prospects don't currently have team assigned, so group all active pipeline together
  const pipelineByStage = useMemo(() => {
    const stages: Record<string, number> = {};
    for (const p of prospects) {
      stages[p.stage] = (stages[p.stage] || 0) + (p.value || 0);
    }
    return stages;
  }, [prospects]);

  const totalPipeline = prospects.reduce((sum, p) => sum + (p.value || 0), 0);

  // ── Sorted client table ───────────────────────────────────────────────────
  const sortedClients = useMemo(() => {
    const sorted = [...allClients];
    sorted.sort((a, b) => {
      let va: string | number, vb: string | number;
      switch (sortKey) {
        case 'name': va = a.name.toLowerCase(); vb = b.name.toLowerCase(); break;
        case 'team': va = a.team; vb = b.team; break;
        case 'retainer': va = clientRevenue(a); vb = clientRevenue(b); break;
        case 'tenure':
          va = monthsBetween(a.signup_date || a.created_at, a.churned_at);
          vb = monthsBetween(b.signup_date || b.created_at, b.churned_at);
          break;
        case 'status': va = a.status; vb = b.status; break;
        default: va = 0; vb = 0;
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    if (filterTeams.length > 0) return sorted.filter(c => filterTeams.includes(c.team));
    return sorted;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allClients, sortKey, sortDir, filterTeams, contractRevenueByClient]);

  if (loading) {
    return (
      <div className="animate-in fade-in duration-200">
        <div className="mb-6">
          <div className="h-8 w-48 bg-muted/30 rounded animate-pulse" />
          <div className="h-4 w-64 bg-muted/20 rounded animate-pulse mt-2" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted/20 rounded-lg animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-200">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Xero</h1>
          <p className="text-[13px] text-muted-foreground/60 mt-1">Revenue &amp; billing overview</p>
          {!hasContractData && (
            <p className="text-[11px] text-amber-400/60 mt-2 flex items-center gap-1">
              <AlertCircle size={10} />
              No contract line items — showing retainer data. Add line items in each client&apos;s Billing tab.
            </p>
          )}
        </div>
        {/* Section tabs */}
        <div className="flex items-center rounded-lg border border-border/20 bg-secondary p-0.5">
          {(['overview', 'projections'] as const).map(s => (
            <button
              key={s}
              onClick={() => setActiveSection(s)}
              className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-all duration-150 capitalize ${
                activeSection === s ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="p-4 rounded-lg border border-border/20 bg-card">
          <div className="flex items-center gap-2 mb-2">
            <PoundSterling size={14} className="text-emerald-400" />
            <span className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">Monthly Revenue</span>
          </div>
          <p className="text-2xl font-bold text-emerald-400">£{totalRevenue.toLocaleString()}</p>
          <p className="text-[11px] text-muted-foreground/40 mt-0.5">ARR £{(totalRevenue * 12).toLocaleString()}</p>
        </div>
        <div className="p-4 rounded-lg border border-border/20 bg-card">
          <div className="flex items-center gap-2 mb-2">
            <Users size={14} className="text-blue-400" />
            <span className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">Active Clients</span>
          </div>
          <p className="text-2xl font-bold text-blue-400">{activeClients.length}</p>
          <p className="text-[11px] text-muted-foreground/40 mt-0.5">{churnedClients.length} churned</p>
        </div>
        <div className="p-4 rounded-lg border border-border/20 bg-card">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-purple-400" />
            <span className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">Avg Retainer</span>
          </div>
          <p className="text-2xl font-bold text-purple-400">£{avgRetainer.toLocaleString()}</p>
        </div>
        <div className="p-4 rounded-lg border border-border/20 bg-card">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={14} className="text-red-400" />
            <span className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">Churn (12mo)</span>
          </div>
          <p className="text-2xl font-bold text-red-400">{overallChurnRate}%</p>
        </div>
      </div>

      {/* ── Overview section ──────────────────────────────────────────────── */}
      {activeSection === 'overview' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {/* Team Billing */}
            <div className="p-4 rounded-lg border border-border/20 bg-card">
              <h3 className="text-[13px] font-semibold mb-4">Team Billing</h3>
              <div className="space-y-3">
                {revenueByTeam.map(({ slug, label, style, revenue, count }) => {
                  const pct = Math.max((revenue / maxTeamRevenue) * 100, 3);
                  return (
                    <div key={slug} className="flex items-center gap-3">
                      <div className="flex items-center gap-2 w-20 shrink-0">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: style.color }} />
                        <span className="text-[13px] font-medium truncate">{label}</span>
                      </div>
                      <div className="flex-1 h-2 rounded-full bg-muted/30 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: style.color, opacity: 0.7 }} />
                      </div>
                      <span className="text-[13px] font-semibold w-24 text-right">
                        £{revenue.toLocaleString()}<span className="text-[11px] font-normal text-muted-foreground/40">/mo</span>
                      </span>
                      <span className="text-[11px] text-muted-foreground/40 w-16 text-right">{count} clients</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Revenue by Service OR Churn by Team */}
            {hasContractData && revenueByService.length > 0 ? (
              <div className="p-4 rounded-lg border border-border/20 bg-card">
                <h3 className="text-[13px] font-semibold mb-4">Revenue by Service</h3>
                <div className="space-y-3">
                  {revenueByService.map(({ service, revenue }) => {
                    const pct = Math.max((revenue / maxServiceRevenue) * 100, 3);
                    return (
                      <div key={service} className="flex items-center gap-3">
                        <div className="w-28 shrink-0">
                          <span className="text-[13px] font-medium truncate block">{service}</span>
                        </div>
                        <div className="flex-1 h-2 rounded-full bg-muted/30 overflow-hidden">
                          <div className="h-full rounded-full bg-primary/60 transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[13px] font-semibold w-24 text-right">
                          £{revenue.toLocaleString()}<span className="text-[11px] font-normal text-muted-foreground/40">/mo</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-lg border border-border/20 bg-card">
                <h3 className="text-[13px] font-semibold mb-4">Churn by Team (Last 12 Months)</h3>
                <div className="space-y-3">
                  {revenueByTeam.map(({ slug, label, style, churnRate, allCount }) => {
                    const churnedCount = allClients.filter(c => c.team === slug && c.status === 'churned').length;
                    return (
                      <div key={slug} className="flex items-center gap-3">
                        <div className="flex items-center gap-2 w-20 shrink-0">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: style.color }} />
                          <span className="text-[13px] font-medium">{label}</span>
                        </div>
                        <div className="flex-1 h-2 rounded-full bg-muted/30 overflow-hidden">
                          <div className="h-full rounded-full bg-red-500 opacity-60 transition-all duration-500"
                            style={{ width: `${Math.max(churnRate, churnRate > 0 ? 3 : 0)}%` }} />
                        </div>
                        <span className="text-[13px] font-medium w-12 text-right">{churnRate}%</span>
                        <span className="text-[11px] text-muted-foreground/40 w-16 text-right">{churnedCount}/{allCount}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Sortable Client Table */}
          <div className="rounded-lg border border-border/20 overflow-hidden">
            <div className="px-4 py-3 border-b border-border/10 bg-muted/20 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-[13px] font-semibold">All Clients</h3>
                <p className="text-[11px] text-muted-foreground/40 mt-0.5">Click column headers to sort</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <FilterPopover
                  label="Team"
                  options={teamSlugs.map(slug => {
                    const style = getTeamStyle(slug);
                    const teamObj = teams.find(t => t.name.toLowerCase() === slug);
                    const label = teamObj?.name || style.label || slug;
                    return { value: slug, label, dot: style.color };
                  })}
                  selected={filterTeams}
                  onSelectionChange={setFilterTeams}
                />
                {filterTeams.length > 0 && (
                  <button
                    onClick={() => setFilterTeams([])}
                    className="h-8 px-3 text-[13px] rounded-lg border border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors flex items-center gap-1.5"
                  >
                    <X size={12} /> Clear
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/20 bg-muted/10">
                    {([
                      { key: 'name', label: 'Client' },
                      { key: 'team', label: 'Team' },
                      { key: 'status', label: 'Status' },
                      { key: 'retainer', label: hasContractData ? 'Monthly (Contract)' : 'Monthly Retainer' },
                      { key: 'tenure', label: 'Tenure' },
                    ] as { key: SortKey; label: string }[]).map(col => (
                      <th key={col.key} onClick={() => toggleSort(col.key)}
                        className="text-left text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider px-3 py-2.5 cursor-pointer hover:text-foreground select-none transition-colors">
                        <span className="inline-flex items-center">
                          {col.label}
                          <SortIcon col={col.key} sortKey={sortKey} sortDir={sortDir} />
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedClients.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-[13px] text-muted-foreground/40">No clients</td></tr>
                  ) : sortedClients.map(c => {
                    const style = getTeamStyle(c.team);
                    const teamObj = teams.find(t => t.name.toLowerCase() === c.team);
                    const teamLabel = teamObj?.name || style.label || c.team;
                    const tenure = monthsBetween(c.signup_date || c.created_at, c.churned_at);
                    const revenue = clientRevenue(c);
                    return (
                      <tr key={c.id} onClick={() => router.push(`/clients/${c.id}`)}
                        className={`border-b border-border/10 hover:bg-muted/20 transition-colors cursor-pointer ${c.status === 'churned' ? 'opacity-60' : ''}`}>
                        <td className="px-3 py-2.5 text-[13px] font-medium">{c.name}</td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium`}
                            style={{ backgroundColor: style.color + '22', color: style.color }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: style.color }} />
                            {teamLabel}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            c.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' :
                            c.status === 'paused' ? 'bg-amber-500/10 text-amber-400' :
                            'bg-red-500/10 text-red-400'
                          }`}>{c.status}</span>
                        </td>
                        <td className="px-3 py-2.5 text-[13px] font-medium">
                          {revenue > 0 ? `£${revenue.toLocaleString()}/mo` : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-[13px] text-muted-foreground">
                          {tenure === 1 ? '1 month' : `${tenure} months`}
                          {c.status === 'churned' && <span className="ml-1 text-[11px] text-red-400/60">(churned)</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {sortedClients.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-border/20 bg-muted/20">
                      <td colSpan={3} className="px-3 py-2.5 text-[12px] font-semibold text-muted-foreground/60">
                        Total ({sortedClients.filter(c => c.status === 'active').length} active{filterTeams.length === 1 ? ` · ${teams.find(t => t.name.toLowerCase() === filterTeams[0])?.name || filterTeams[0]}` : filterTeams.length > 1 ? ` · ${filterTeams.length} teams` : ''})
                      </td>
                      <td className="px-3 py-2.5 text-[13px] font-bold text-emerald-400">
                        £{sortedClients.reduce((sum, c) => sum + (c.status === 'active' ? clientRevenue(c) : 0), 0).toLocaleString()}/mo
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-muted-foreground/40">
                        ARR £{(totalRevenue * 12).toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Projections section ───────────────────────────────────────────── */}
      {activeSection === 'projections' && (
        <>
          {/* Team Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {revenueByTeam.map(({ slug, label, style, revenue, count, memberCount, expiringItems, expiringValue }) => {
              const netProjected = revenue - expiringValue;
              return (
                <div key={slug} className="rounded-lg border border-border/20 bg-card overflow-hidden">
                  <div className="h-1 w-full" style={{ backgroundColor: style.color }} />
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: style.color }} />
                        <h3 className="text-[14px] font-semibold">{label}</h3>
                      </div>
                      <span className="text-[11px] text-muted-foreground/50">{memberCount} staff · {count} clients</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <p className="text-[11px] text-muted-foreground/60">Current MRR</p>
                        <p className="text-[16px] font-bold text-emerald-400">£{revenue.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground/60">Net Projected</p>
                        <p className={`text-[16px] font-bold ${netProjected < revenue ? 'text-amber-400' : 'text-emerald-400'}`}>
                          £{Math.max(netProjected, 0).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {expiringItems.length > 0 ? (
                      <div className="mt-2 pt-2 border-t border-border/10">
                        <p className="text-[11px] text-amber-400/80 flex items-center gap-1 mb-1">
                          <AlertTriangle size={10} />
                          {expiringItems.length} contract{expiringItems.length !== 1 ? 's' : ''} expiring (90 days)
                          — £{expiringValue.toLocaleString()}/mo at risk
                        </p>
                        <div className="space-y-0.5 max-h-24 overflow-y-auto">
                          {expiringItems.slice(0, 4).map(item => {
                            const client = clientMap[item.client_id];
                            const days = daysUntil(item.end_date);
                            return (
                              <div key={item.id} className="flex items-center justify-between text-[11px]">
                                <span className="text-muted-foreground/70 truncate">{client?.name || '—'}</span>
                                <span className={`shrink-0 ml-1 ${days !== null && days <= 30 ? 'text-red-400' : 'text-amber-400/70'}`}>
                                  {days !== null ? `${days}d` : '—'}
                                </span>
                              </div>
                            );
                          })}
                          {expiringItems.length > 4 && (
                            <p className="text-[10px] text-muted-foreground/40">+{expiringItems.length - 4} more</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 pt-2 border-t border-border/10">
                        <p className="text-[11px] text-emerald-400/60">✓ No contracts expiring in 90 days</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Expiring Contracts Timeline */}
          {(expiringByBucket.d30.length + expiringByBucket.d60.length + expiringByBucket.d90.length) > 0 && (
            <div className="rounded-lg border border-border/20 bg-card p-4 mb-6">
              <h3 className="text-[13px] font-semibold mb-4">Expiring Contracts Timeline</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Next 30 days', items: expiringByBucket.d30, color: 'text-red-400', bg: 'bg-red-500/10' },
                  { label: '31–60 days', items: expiringByBucket.d60, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                  { label: '61–90 days', items: expiringByBucket.d90, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
                ].map(({ label, items, color, bg }) => {
                  const value = items.reduce((s, i) => s + (i.monthly_value || 0), 0);
                  return (
                    <div key={label} className={`rounded-lg p-3 ${bg}`}>
                      <p className={`text-[12px] font-semibold ${color} mb-1`}>{label}</p>
                      <p className={`text-[18px] font-bold ${color}`}>£{value.toLocaleString()}</p>
                      <p className="text-[11px] text-muted-foreground/60 mb-2">{items.length} contract{items.length !== 1 ? 's' : ''}</p>
                      {items.length > 0 && (
                        <div className="space-y-1">
                          {items.slice(0, 5).map(item => {
                            const client = clientMap[item.client_id];
                            const days = daysUntil(item.end_date);
                            const teamStyle = client ? getTeamStyle(client.team) : null;
                            return (
                              <div key={item.id} className="flex items-center justify-between text-[11px]">
                                <div className="flex items-center gap-1 truncate">
                                  {teamStyle && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: teamStyle.color }} />}
                                  <span className="text-foreground/70 truncate">{client?.name || '—'}</span>
                                </div>
                                <div className="shrink-0 ml-1 flex items-center gap-1">
                                  <span className="text-muted-foreground/50">£{(item.monthly_value || 0).toLocaleString()}</span>
                                  <span className={`${color} opacity-70`}>· {days}d</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pipeline Summary */}
          <div className="rounded-lg border border-border/20 bg-card p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[13px] font-semibold">Pipeline Value</h3>
              <p className="text-[13px] font-bold text-primary">£{totalPipeline.toLocaleString()} total</p>
            </div>
            {prospects.length === 0 ? (
              <p className="text-[13px] text-muted-foreground/40">No active pipeline</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries(pipelineByStage).map(([stage, value]) => (
                  <div key={stage} className="p-3 rounded-lg bg-muted/20 border border-border/10">
                    <p className="text-[11px] text-muted-foreground/60 capitalize mb-1">{stage}</p>
                    <p className="text-[15px] font-bold">£{value.toLocaleString()}</p>
                    <p className="text-[11px] text-muted-foreground/40">
                      {prospects.filter(p => p.stage === stage).length} prospects
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
