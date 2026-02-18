'use client';

import { useEffect, useState, useMemo } from 'react';
import { TEAM_STYLES } from '@/lib/constants';
import { PoundSterling, TrendingUp, Users, AlertCircle, ChevronUp, ChevronDown, ChevronsUpDown, TrendingDown } from 'lucide-react';

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

type SortKey = 'name' | 'team' | 'retainer' | 'tenure' | 'status';
type SortDir = 'asc' | 'desc';

function monthsBetween(from: string, to?: string): number {
  const start = new Date(from);
  const end = to ? new Date(to) : new Date();
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown size={11} className="text-muted-foreground/30 ml-1" />;
  return sortDir === 'asc'
    ? <ChevronUp size={11} className="text-primary ml-1" />
    : <ChevronDown size={11} className="text-primary ml-1" />;
}

export default function XeroPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('retainer');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [tableTeamFilter, setTableTeamFilter] = useState<string>('');
  // No date picker — churn is always based on last 12 months

  useEffect(() => {
    fetch('/api/clients')
      .then(r => r.json())
      .then(data => setClients(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const allClients = clients;
  const activeClients = allClients.filter(c => c.status === 'active');
  const churnedClients = allClients.filter(c => c.status === 'churned');

  const totalRevenue = activeClients.reduce((sum, c) => sum + (c.monthly_retainer || 0), 0);
  const avgRetainer = activeClients.length > 0 ? Math.round(totalRevenue / activeClients.length) : 0;

  // Churn rate: based on clients who churned in the last 12 months
  const twelveMonthsAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
  const recentlyChurned = churnedClients.filter(c => c.churned_at && c.churned_at >= twelveMonthsAgo);
  const overallChurnRate = allClients.length > 0
    ? Math.round((recentlyChurned.length / allClients.length) * 100)
    : 0;

  // Revenue by team
  const revenueByTeam = (['synergy', 'ignite', 'alliance'] as const).map(team => {
    const teamClients = activeClients.filter(c => c.team === team);
    const revenue = teamClients.reduce((sum, c) => sum + (c.monthly_retainer || 0), 0);
    const allTeamClients = allClients.filter(c => c.team === team);
    const churnedTeam = allTeamClients.filter(c => c.status === 'churned' && c.churned_at && c.churned_at >= twelveMonthsAgo);
    const churnRate = allTeamClients.length > 0 ? Math.round((churnedTeam.length / allTeamClients.length) * 100) : 0;
    return { team, revenue, count: teamClients.length, churnRate, allCount: allTeamClients.length };
  });

  const maxTeamRevenue = Math.max(...revenueByTeam.map(t => t.revenue), 1);

  // Sorted combined table (active + churned)
  const sortedClients = useMemo(() => {
    const sorted = [...allClients];
    sorted.sort((a, b) => {
      let va: string | number, vb: string | number;
      switch (sortKey) {
        case 'name': va = a.name.toLowerCase(); vb = b.name.toLowerCase(); break;
        case 'team': va = a.team; vb = b.team; break;
        case 'retainer': va = a.monthly_retainer || 0; vb = b.monthly_retainer || 0; break;
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
    if (tableTeamFilter) return sorted.filter(c => c.team === tableTeamFilter);
    return sorted;
  }, [allClients, sortKey, sortDir, tableTeamFilter]);

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
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Xero</h1>
        <p className="text-[13px] text-muted-foreground/60 mt-1">Revenue &amp; billing overview</p>
        <p className="text-[11px] text-amber-400/60 mt-2 flex items-center gap-1">
          <AlertCircle size={10} />
          Not connected to Xero — showing retainer data from clients
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="p-4 rounded-lg border border-border/20 bg-card">
          <div className="flex items-center gap-2 mb-2">
            <PoundSterling size={14} className="text-emerald-400" />
            <span className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">Monthly Revenue</span>
          </div>
          <p className="text-2xl font-bold text-emerald-400">£{totalRevenue.toLocaleString()}</p>
        </div>
        <div className="p-4 rounded-lg border border-border/20 bg-card">
          <div className="flex items-center gap-2 mb-2">
            <Users size={14} className="text-blue-400" />
            <span className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">Active Clients</span>
          </div>
          <p className="text-2xl font-bold text-blue-400">{activeClients.length}</p>
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
            <span className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">Churn (12 Months)</span>
          </div>
          <p className="text-2xl font-bold text-red-400">{overallChurnRate}%</p>
          <p className="text-[11px] text-muted-foreground/40 mt-0.5">{churnedClients.length} churned</p>
        </div>
      </div>

      {/* Revenue by Team + Churn */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Team Billing */}
        <div className="p-4 rounded-lg border border-border/20 bg-card">
          <h3 className="text-[13px] font-semibold mb-4">Team Billing</h3>
          <div className="space-y-4">
            {revenueByTeam.map(({ team, revenue, count }) => {
              const style = TEAM_STYLES[team];
              const pct = Math.max((revenue / maxTeamRevenue) * 100, 3);
              return (
                <div key={team}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: style.color }} />
                      <span className="text-[13px] font-medium">{style.label}</span>
                      <span className="text-[11px] text-muted-foreground/40">{count} clients</span>
                    </div>
                    <span className="text-[13px] font-semibold">£{revenue.toLocaleString()}<span className="text-[11px] font-normal text-muted-foreground/40">/mo</span></span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: style.color, opacity: 0.7 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Churn by Team */}
        <div className="p-4 rounded-lg border border-border/20 bg-card">
          <h3 className="text-[13px] font-semibold mb-4">Churn by Team (Last 12 Months)</h3>
          <div className="space-y-3 mb-4">
            {revenueByTeam.map(({ team, churnRate, allCount }) => {
              const style = TEAM_STYLES[team];
              const churnedCount = allClients.filter(c => c.team === team && c.status === 'churned').length;
              return (
                <div key={team} className="flex items-center gap-3">
                  <div className="flex items-center gap-2 w-20 shrink-0">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: style.color }} />
                    <span className="text-[13px] font-medium">{style.label}</span>
                  </div>
                  <div className="flex-1 h-2 rounded-full bg-muted/30 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-red-500 opacity-60 transition-all duration-500"
                      style={{ width: `${Math.max(churnRate, churnRate > 0 ? 3 : 0)}%` }}
                    />
                  </div>
                  <span className="text-[13px] font-medium w-12 text-right">{churnRate}%</span>
                  <span className="text-[11px] text-muted-foreground/40 w-16 text-right">{churnedCount}/{allCount}</span>
                </div>
              );
            })}
          </div>

          {/* Churned clients detail */}
          {churnedClients.length > 0 && (
            <div className="pt-3 border-t border-border/10">
              <p className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-2">Churned Clients</p>
              <div className="space-y-1.5">
                {churnedClients.map(c => {
                  const style = TEAM_STYLES[c.team as keyof typeof TEAM_STYLES];
                  const lifespan = monthsBetween(c.signup_date || c.created_at, c.churned_at);
                  return (
                    <div key={c.id} className="flex items-center justify-between text-[13px]">
                      <div className="flex items-center gap-2">
                        {style && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: style.color }} />}
                        <span>{c.name}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground/60">
                        <span>{lifespan} months as client</span>
                        <span>£{(c.monthly_retainer || 0).toLocaleString()}/mo</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sortable Client Table */}
      <div className="rounded-lg border border-border/20 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/10 bg-muted/20 flex items-center justify-between">
          <div>
            <h3 className="text-[13px] font-semibold">All Clients</h3>
            <p className="text-[11px] text-muted-foreground/40 mt-0.5">Click column headers to sort</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setTableTeamFilter('')}
              className={`h-7 px-2.5 text-[11px] rounded-md border transition-colors duration-150 ${
                !tableTeamFilter ? 'border-primary bg-primary/10 text-primary' : 'border-border/20 bg-secondary text-muted-foreground hover:border-primary/30'
              }`}
            >All</button>
            {Object.entries(TEAM_STYLES).map(([key, style]) => (
              <button
                key={key}
                onClick={() => setTableTeamFilter(tableTeamFilter === key ? '' : key)}
                className={`h-7 px-2.5 text-[11px] rounded-md border transition-colors duration-150 flex items-center gap-1.5 ${
                  tableTeamFilter === key ? 'border-primary bg-primary/10 text-primary' : 'border-border/20 bg-secondary text-muted-foreground hover:border-primary/30'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: style.color }} />
                {style.label}
              </button>
            ))}
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
                  { key: 'retainer', label: 'Monthly Retainer' },
                  { key: 'tenure', label: 'Tenure' },
                ] as { key: SortKey; label: string }[]).map(col => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className="text-left text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider px-3 py-2.5 cursor-pointer hover:text-foreground select-none transition-colors duration-150"
                  >
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
                <tr><td colSpan={5} className="text-center py-8 text-[13px] text-muted-foreground/40">No clients in this period</td></tr>
              ) : sortedClients.map(c => {
                const style = c.team && TEAM_STYLES[c.team as keyof typeof TEAM_STYLES];
                const tenure = monthsBetween(c.signup_date || c.created_at, c.churned_at);
                return (
                  <tr key={c.id} className={`border-b border-border/10 hover:bg-muted/20 transition-colors duration-150 ${c.status === 'churned' ? 'opacity-60' : ''}`}>
                    <td className="px-3 py-2.5 text-[13px] font-medium">{c.name}</td>
                    <td className="px-3 py-2.5">
                      {style ? (
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${style.bg} ${style.text}`}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: style.color }} />
                          {style.label}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        c.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' :
                        c.status === 'paused' ? 'bg-amber-500/10 text-amber-400' :
                        'bg-red-500/10 text-red-400'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[13px] font-medium">
                      {c.monthly_retainer ? `£${c.monthly_retainer.toLocaleString()}/mo` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-[13px] text-muted-foreground">
                      {tenure === 1 ? '1 month' : `${tenure} months`}
                      {c.status === 'churned' && <span className="ml-1 text-[11px] text-red-400/60">(churned)</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {activeClients.length > 0 && (
              <tfoot>
                <tr className="border-t border-border/20 bg-muted/20">
                  <td colSpan={3} className="px-3 py-2.5 text-[12px] font-semibold text-muted-foreground/60">
                    Total ({activeClients.length} active)
                  </td>
                  <td className="px-3 py-2.5 text-[13px] font-bold text-emerald-400">
                    £{totalRevenue.toLocaleString()}/mo
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
    </div>
  );
}
