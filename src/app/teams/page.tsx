'use client';

import { useState, useEffect, useMemo } from 'react';
import { getTeamStyle, getAssigneeColor, getServiceStyle } from '@/lib/constants';
import Link from 'next/link';
import { AlertTriangle, ArrowUpDown, ChevronRight, Users } from 'lucide-react';
import { format, startOfMonth, endOfMonth, addMonths, differenceInCalendarMonths, isSameMonth } from 'date-fns';
import { ForecastChart } from '@/components/forecast-chart';
import { MemberDrillDownSheet } from '@/components/member-drill-down-sheet';

interface TeamMember {
  id: string;
  full_name: string;
  team: string | null;
  is_active: boolean;
  role?: { id: string; name: string } | null;
}

interface Team {
  id: string;
  name: string;
  members?: TeamMember[];
}

interface Client {
  id: string;
  name: string;
  team: string;
  status: string;
  services: string[];
  monthly_retainer: number;
}

interface ContractLineItem {
  id: string;
  client_id: string;
  monthly_value: number;
  service: string;
  is_active: boolean;
  billing_type: string;
  start_date: string | null;
  end_date: string | null;
  assignee_id: string | null;
}

/** Services excluded from revenue breakdowns */
const REVENUE_EXCLUDED_SERVICES = new Set(['account-management']);

interface CapacityTargets {
  [service: string]: number;
}

/** Calculate how much of a project (one-off) line item falls in a given month, pro-rata by day */
function projectAllocationForMonth(item: ContractLineItem, month: Date): number {
  if (!item.start_date || !item.end_date) {
    return 0; // Undated projects excluded from monthly totals
  }
  const projectStart = new Date(item.start_date);
  const projectEnd = new Date(item.end_date);
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);

  // No overlap
  if (projectStart > monthEnd || projectEnd < monthStart) return 0;

  // Total project days (inclusive)
  const totalDays = Math.max(1, Math.round((projectEnd.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);

  // Days in this month that overlap with the project
  const overlapStart = projectStart > monthStart ? projectStart : monthStart;
  const overlapEnd = projectEnd < monthEnd ? projectEnd : monthEnd;
  const daysInMonth = Math.round((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  return (item.monthly_value || 0) * (daysInMonth / totalDays);
}

/** Check if a recurring item is active during a given month */
function recurringActiveInMonth(item: ContractLineItem, month: Date): boolean {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  if (item.start_date && new Date(item.start_date) > monthEnd) return false;
  if (item.end_date && new Date(item.end_date) < monthStart) return false;
  return item.is_active || (item.end_date != null); // include ended items if they have an end_date (historical)
}

interface ServiceClientDetail {
  clientId: string;
  clientName: string;
  amount: number;
  start_date?: string | null;
  end_date?: string | null;
  billingType?: 'recurring' | 'one-off';
}

interface ServiceRow {
  service: string;
  amount: number;
  clients: ServiceClientDetail[];
}

interface UndatedProject {
  clientId: string;
  clientName: string;
  service: string;
  amount: number;
}

interface MonthlyBreakdown {
  recurring: ServiceRow[];
  project: ServiceRow[];
  recurringTotal: number;
  projectTotal: number;
  undated: UndatedProject[];
}

function calcMonthlyBreakdown(teamClients: Client[], contractItems: ContractLineItem[], month: Date): MonthlyBreakdown {
  const recurringByService: Record<string, ServiceClientDetail[]> = {};
  const projectByService: Record<string, ServiceClientDetail[]> = {};
  const undated: UndatedProject[] = [];

  for (const client of teamClients) {
    const clientItems = contractItems.filter(i => i.client_id === client.id);
    for (const item of clientItems) {
      if (REVENUE_EXCLUDED_SERVICES.has(item.service)) continue;
      if (item.billing_type === 'one-off') {
        if (!item.start_date || !item.end_date) {
          undated.push({ clientId: client.id, clientName: client.name, service: item.service, amount: item.monthly_value || 0 });
          continue;
        }
        const alloc = projectAllocationForMonth(item, month);
        if (alloc > 0) {
          if (!projectByService[item.service]) projectByService[item.service] = [];
          projectByService[item.service].push({ clientId: client.id, clientName: client.name, amount: alloc, start_date: item.start_date, end_date: item.end_date, billingType: 'one-off' });
        }
      } else {
        if (recurringActiveInMonth(item, month)) {
          if (!recurringByService[item.service]) recurringByService[item.service] = [];
          recurringByService[item.service].push({ clientId: client.id, clientName: client.name, amount: item.monthly_value || 0, billingType: 'recurring' });
        }
      }
    }
  }

  const toRows = (map: Record<string, ServiceClientDetail[]>): ServiceRow[] =>
    Object.entries(map)
      .map(([service, clients]) => ({ service, amount: clients.reduce((s, c) => s + c.amount, 0), clients: clients.sort((a, b) => b.amount - a.amount) }))
      .sort((a, b) => b.amount - a.amount);

  const recurring = toRows(recurringByService);
  const project = toRows(projectByService);

  return {
    recurring,
    project,
    recurringTotal: recurring.reduce((s, r) => s + r.amount, 0),
    projectTotal: project.reduce((s, p) => s + p.amount, 0),
    undated,
  };
}

function ServiceBreakdownRow({ row, total, teamColor, capacityTotal, capacityTargets }: { row: ServiceRow; total: number; teamColor: string; capacityTotal?: number; capacityTargets?: Record<string, number> }) {
  const [expanded, setExpanded] = useState(false);
  const s = getServiceStyle(row.service);
  // Use per-service capacity target if available, else fall back to total
  const svcTarget = capacityTargets?.[row.service] || capacityTotal || 0;
  const capacityPct = svcTarget > 0 ? (row.amount / svcTarget) * 100 : 0;

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left group"
      >
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[11px] text-muted-foreground/80 flex items-center gap-1">
            <ChevronRight size={10} className={`text-muted-foreground/30 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`} />
            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: s.dot }} /> {s.label}
          </span>
          <span className="text-[11px] font-medium flex items-center gap-1.5">
            £{Math.round(row.amount).toLocaleString()}
            {svcTarget > 0 && (
              <span className={`text-[10px] font-normal ${capacityPct < 80 ? 'text-emerald-500' : capacityPct <= 95 ? 'text-amber-500' : 'text-red-500'}`}>
                {Math.round(capacityPct)}%
              </span>
            )}
          </span>
        </div>
        <div className="h-1 rounded-full bg-muted/30 overflow-hidden ml-4">
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.min(Math.max(capacityPct, 3), 100)}%`, backgroundColor: teamColor, opacity: 0.6 }}
          />
        </div>
      </button>
      {expanded && row.clients.length > 0 && (() => {
        const recurringClients = row.clients.filter(c => c.billingType !== 'one-off');
        const projectClients = row.clients.filter(c => c.billingType === 'one-off');

        const renderClient = (c: ServiceClientDetail, i: number, showCapacity: boolean) => {
          const clientCapPct = svcTarget > 0 ? (c.amount / svcTarget) * 100 : 0;
          return (
            <Link key={i} href={`/clients/${c.clientId}`} className="flex items-center justify-between group/client py-0.5 -mx-1 px-1 rounded hover:bg-muted/30 transition-colors">
              <span className="text-[10px] text-muted-foreground/50 truncate mr-2 group-hover/client:text-foreground transition-colors">
                {c.clientName}
                {c.billingType === 'one-off' && c.start_date && c.end_date && (
                  <span className="text-muted-foreground/30 ml-1 group-hover/client:text-muted-foreground/50">
                    ({format(new Date(c.start_date), 'dd MMM yy')} – {format(new Date(c.end_date), 'dd MMM yy')})
                  </span>
                )}
              </span>
              <span className="text-[10px] text-muted-foreground/40 shrink-0 group-hover/client:text-foreground transition-colors">
                £{Math.round(c.amount).toLocaleString()}
                {showCapacity && svcTarget > 0 && (
                  <span className="ml-1 text-muted-foreground/30">{Math.round(clientCapPct)}%</span>
                )}
              </span>
            </Link>
          );
        };

        const hasBoth = recurringClients.length > 0 && projectClients.length > 0;
        const recurringSubtotal = recurringClients.reduce((s, c) => s + c.amount, 0);
        const projectSubtotal = projectClients.reduce((s, c) => s + c.amount, 0);

        return (
          <div className="ml-5 mt-1 mb-1 space-y-0.5">
            {hasBoth && (
              <div className="flex items-center justify-between">
                <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wider">Recurring</p>
                <span className="text-[9px] text-muted-foreground/30">£{Math.round(recurringSubtotal).toLocaleString()}</span>
              </div>
            )}
            {recurringClients.map((c, i) => renderClient(c, i, true))}
            {projectClients.length > 0 && (
              <>
                {hasBoth && <div className="h-px bg-border/10 my-1" />}
                <div className="flex items-center justify-between">
                  <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wider">Project</p>
                  {hasBoth && <span className="text-[9px] text-muted-foreground/30">£{Math.round(projectSubtotal).toLocaleString()}</span>}
                </div>
                {projectClients.map((c, i) => renderClient(c, i + recurringClients.length, false))}
              </>
            )}
          </div>
        );
      })()}
    </div>
  );
}

function MonthlyBillingSection({ teamClients, contractItems, teamColor, capacityTargets }: {
  teamClients: Client[];
  contractItems: ContractLineItem[];
  teamColor: string;
  capacityTargets: CapacityTargets;
}) {
  const [viewingNext, setViewingNext] = useState(false);
  const currentMonth = useMemo(() => startOfMonth(new Date()), []);
  const nextMonth = useMemo(() => addMonths(currentMonth, 1), [currentMonth]);

  const currentBreakdown = useMemo(
    () => calcMonthlyBreakdown(teamClients, contractItems, currentMonth),
    [teamClients, contractItems, currentMonth]
  );

  const nextBreakdown = useMemo(
    () => calcMonthlyBreakdown(teamClients, contractItems, nextMonth),
    [teamClients, contractItems, nextMonth]
  );

  const currentTotal = currentBreakdown.recurringTotal + currentBreakdown.projectTotal;
  const nextTotal = nextBreakdown.recurringTotal + nextBreakdown.projectTotal;
  const diff = nextTotal - currentTotal;

  const breakdown = viewingNext ? nextBreakdown : currentBreakdown;
  const total = viewingNext ? nextTotal : currentTotal;

  // Calculate capacity
  const totalTarget = Object.values(capacityTargets).reduce((sum, t) => sum + t, 0);
  const capacityPercentage = totalTarget > 0 ? (total / totalTarget) * 100 : 0;
  const capacityColor = capacityPercentage < 80 ? 'text-emerald-500' : capacityPercentage <= 95 ? 'text-amber-500' : 'text-red-500';

  return (
    <div className="px-4 py-3 border-b border-border/10 bg-muted/10">
      {/* Month tabs */}
      <div className="flex items-center gap-1 mb-3 rounded-md bg-muted/30 p-0.5">
        <button
          onClick={() => setViewingNext(false)}
          className={`flex-1 text-center py-1 rounded text-[11px] font-medium transition-all duration-150 ${!viewingNext ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground/50 hover:text-muted-foreground'}`}
        >
          {format(currentMonth, 'MMM yyyy')} · £{Math.round(currentTotal).toLocaleString()}
        </button>
        <button
          onClick={() => setViewingNext(true)}
          className={`flex-1 text-center py-1 rounded text-[11px] font-medium transition-all duration-150 ${viewingNext ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground/50 hover:text-muted-foreground'}`}
        >
          {format(nextMonth, 'MMM yyyy')} · £{Math.round(nextTotal).toLocaleString()}
          {diff !== 0 && (
            <span className={`text-[9px] ml-1 ${diff > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {diff > 0 ? '↑' : '↓'}£{Math.abs(Math.round(diff)).toLocaleString()}
            </span>
          )}
        </button>
      </div>

      {/* Total with capacity */}
      <div className="mb-3">
        <p className="text-[18px] font-bold leading-tight">£{Math.round(total).toLocaleString()}</p>
        {totalTarget > 0 && (
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1 rounded-full bg-muted/30 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(capacityPercentage, 100)}%`,
                  backgroundColor: teamColor,
                  opacity: 0.6
                }}
              />
            </div>
            <span className={`text-[10px] font-medium ${capacityColor}`}>
              {Math.round(capacityPercentage)}%
            </span>
          </div>
        )}
      </div>

      {/* Combined services */}
      {(() => {
        // Merge recurring and project by service
        const combined: Record<string, ServiceRow> = {};
        for (const row of breakdown.recurring) {
          if (!combined[row.service]) combined[row.service] = { service: row.service, amount: 0, clients: [] };
          combined[row.service].amount += row.amount;
          combined[row.service].clients.push(...row.clients);
        }
        for (const row of breakdown.project) {
          if (!combined[row.service]) combined[row.service] = { service: row.service, amount: 0, clients: [] };
          combined[row.service].amount += row.amount;
          combined[row.service].clients.push(...row.clients);
        }
        const combinedRows = Object.values(combined).sort((a, b) => b.amount - a.amount);

        return combinedRows.length > 0 ? (
          <div className="space-y-1">
            {combinedRows.map(row => (
              <ServiceBreakdownRow key={row.service} row={row} total={total} teamColor={teamColor} capacityTotal={totalTarget} capacityTargets={capacityTargets} />
            ))}
          </div>
        ) : breakdown.undated.length === 0 ? (
          <p className="text-[12px] text-muted-foreground/40 italic">No billing this month</p>
        ) : null;
      })()}

      {/* Undated projects warning */}
      {breakdown.undated.length > 0 && (
        <div className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <AlertTriangle size={11} className="text-amber-400 shrink-0" />
            <p className="text-[10px] font-medium text-amber-400">
              {breakdown.undated.length} project{breakdown.undated.length !== 1 ? 's' : ''} without dates · £{Math.round(breakdown.undated.reduce((s, u) => s + u.amount, 0)).toLocaleString()} unallocated
            </p>
          </div>
          <div className="space-y-0.5">
            {breakdown.undated.map((u, i) => {
              const s = getServiceStyle(u.service);
              return (
                <Link key={i} href={`/clients/${u.clientId}`} className="flex items-center justify-between group/undated py-0.5">
                  <span className="text-[10px] text-muted-foreground/50 group-hover/undated:text-foreground transition-colors flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: s.dot }} />
                    {u.clientName} · {s.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground/40 group-hover/undated:text-foreground transition-colors">£{Math.round(u.amount).toLocaleString()}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ClientList({ clients, contractRevenueByClient }: { clients: Client[]; contractRevenueByClient: Record<string, number> }) {
  const [sortBy, setSortBy] = useState<'name' | 'amount'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const toggleSort = (field: 'name' | 'amount') => {
    if (sortBy === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir(field === 'name' ? 'asc' : 'desc');
    }
  };
  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...clients].sort((a, b) => {
      if (sortBy === 'amount') {
        return dir * ((contractRevenueByClient[a.id] || 0) - (contractRevenueByClient[b.id] || 0));
      }
      return dir * a.name.localeCompare(b.name);
    });
  }, [clients, contractRevenueByClient, sortBy, sortDir]);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <button
          onClick={() => toggleSort('name')}
          className={`flex items-center gap-1 text-[10px] transition-colors ${sortBy === 'name' ? 'text-muted-foreground font-medium' : 'text-muted-foreground/40 hover:text-muted-foreground'}`}
        >
          Client {sortBy === 'name' && <ArrowUpDown size={9} className={sortDir === 'desc' ? 'rotate-180' : ''} />}
        </button>
        <button
          onClick={() => toggleSort('amount')}
          className={`flex items-center gap-1 text-[10px] transition-colors tabular-nums ${sortBy === 'amount' ? 'text-muted-foreground font-medium' : 'text-muted-foreground/40 hover:text-muted-foreground'}`}
        >
          Amount {sortBy === 'amount' && <ArrowUpDown size={9} className={sortDir === 'desc' ? 'rotate-180' : ''} />}
        </button>
      </div>
      <div className="space-y-0.5">
        {sorted.map(client => {
          const rev = contractRevenueByClient[client.id] || 0;
          return (
            <Link
              key={client.id}
              href={`/clients/${client.id}`}
              className="flex items-center justify-between py-1.5 rounded-lg hover:bg-muted/40 transition-colors duration-150 group"
            >
              <span className="text-[13px] truncate mr-2">{client.name}</span>
              <span className="text-[11px] text-muted-foreground/60 tabular-nums shrink-0">
                {rev > 0 ? `£${rev.toLocaleString()}/mo` : '—'}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [contractItems, setContractItems] = useState<ContractLineItem[]>([]);
  const [capacityTargets, setCapacityTargets] = useState<CapacityTargets>({});
  const [loading, setLoading] = useState(true);
  const [drillDownOpen, setDrillDownOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<{ id: string; name: string; team: string; roleName?: string } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/teams').then(r => r.json()).catch(() => []),
      fetch('/api/clients').then(r => r.json()).catch(() => []),
      fetch('/api/admin/capacity').then(r => r.json()).catch(() => ({ targets: {} })),
    ]).then(async ([teamsData, clientsData, capacityData]) => {
      setTeams(teamsData || []);
      setClients(clientsData || []);
      setCapacityTargets(capacityData.targets || {});

      // Fetch contract line items for active clients
      const activeClients = (clientsData || []).filter((c: Client) => c.status === 'active');
      const items = await Promise.all(
        activeClients.map((c: Client) =>
          fetch(`/api/clients/${c.id}/contracts`)
            .then(r => r.ok ? r.json() : [])
            .catch(() => [])
        )
      );
      setContractItems(items.flat());
    }).finally(() => setLoading(false));
  }, []);

  // Build contract revenue by client
  const contractRevenueByClient = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of contractItems) {
      if (item.is_active && item.billing_type !== 'one-off') {
        map[item.client_id] = (map[item.client_id] || 0) + (item.monthly_value || 0);
      }
    }
    return map;
  }, [contractItems]);

  const activeClients = clients.filter(c => c.status === 'active');
  const totalMembers = teams.reduce((sum, t) => sum + (t.members?.length ?? 0), 0);

  const maxMembers = Math.max(...teams.map(t => t.members?.length ?? 0), 0);
  const maxClients = Math.max(...teams.map(t => {
    const slug = t.name.toLowerCase();
    return activeClients.filter(c => c.team === slug).length;
  }), 0);

  // Calculate 6-month forecast for a team
  const calcForecastData = (teamClients: Client[]) => {
    const months = Array.from({ length: 6 }, (_, i) => addMonths(startOfMonth(new Date()), i));
    return months.map(month => {
      const breakdown = calcMonthlyBreakdown(teamClients, contractItems, month);
      const total = breakdown.recurringTotal + breakdown.projectTotal;
      
      // Service breakdown for tooltip
      const serviceBreakdown = [
        ...breakdown.recurring.map(r => ({ service: r.service, amount: r.amount })),
        ...breakdown.project.map(p => ({ service: p.service, amount: p.amount })),
      ];

      return { month, total, breakdown: serviceBreakdown };
    });
  };

  // Build team display data
  const teamRows = teams.map(team => {
    const slug = team.name.toLowerCase();
    const style = getTeamStyle(slug);
    const teamClients = activeClients.filter(c => c.team === slug);
    const members = team.members || [];
    const forecastData = calcForecastData(teamClients);

    // Revenue: from active recurring contract line items only
    return { team, slug, style, clients: teamClients, members, forecastData };
  });

  return (
    <div className="animate-in fade-in duration-200">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Teams</h1>
        <div className="flex items-center justify-between mt-1">
          <p className="text-[13px] text-muted-foreground/60">
            {totalMembers} member{totalMembers !== 1 ? 's' : ''} across {teams.length} team{teams.length !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground/50">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Under 80%</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> 80–95%</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Over 95%</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-64 bg-muted/20 rounded-lg animate-pulse" />)}
        </div>
      ) : teams.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users size={40} className="text-muted-foreground/30 mb-3" />
          <p className="text-[13px] font-medium text-muted-foreground">No teams yet</p>
          <p className="text-[13px] text-muted-foreground/60 mt-1">Create teams in Admin → Teams</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {teamRows.map(({ team, slug, style, clients: teamClients, members, forecastData }) => (
            <div key={team.id} className="rounded-lg border border-border/20 bg-card overflow-hidden flex flex-col">
              {/* Colour top bar */}
              <div
                className="h-1 w-full"
                style={{ backgroundColor: style?.color || 'var(--border)' }}
              />

              {/* Team header */}
              <div className="px-4 py-3 border-b border-border/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {style && <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: style.color }} />}
                    <h2 className="text-[13px] font-semibold">{team.name}</h2>
                  </div>
                  <span className="text-[11px] text-muted-foreground/60">{teamClients.length} client{teamClients.length !== 1 ? 's' : ''}</span>
                </div>
              </div>

              {/* Monthly billing breakdown */}
              <MonthlyBillingSection
                teamClients={teamClients}
                contractItems={contractItems}
                capacityTargets={capacityTargets}
                teamColor={style?.color || 'var(--primary)'}
              />

              {/* 6-month forecast */}
              <div className="px-4 py-3 border-b border-border/10">
                <ForecastChart
                  data={forecastData}
                  color={style?.color || 'var(--primary)'}
                  mode="currency"
                  capacityTarget={Object.values(capacityTargets).reduce((sum, t) => sum + t, 0)}
                />
              </div>

              {/* Members — consistent height across cards */}
              <div className="p-4 border-b border-border/10">
                <p className="text-[11px] font-medium text-muted-foreground/60 mb-2">
                  Members ({members.length})
                </p>
                <div className="space-y-1" style={{ minHeight: `${maxMembers * 48}px` }}>
                  {members.length === 0 ? (
                    <p className="text-[12px] text-muted-foreground/40 italic">No members assigned</p>
                  ) : members.map(member => {
                    const colorClass = getAssigneeColor(member.full_name, slug);
                    const ROLE_TO_SERVICE: Record<string, string> = { 'Paid Ads Manager': 'Paid Advertising', 'Social Media Manager': 'Social Media', 'SEO': 'SEO', 'Creative': 'Creative' };
                    const memberItems = contractItems.filter(i => i.assignee_id === member.id && i.is_active && i.billing_type === 'recurring');
                    const memberTotal = memberItems.reduce((s, i) => s + (i.monthly_value || 0), 0);
                    const roleService = member.role?.name ? ROLE_TO_SERVICE[member.role.name] : undefined;
                    const memberTarget = roleService ? (capacityTargets[roleService] || 0) : 0;
                    const memberPct = memberTarget > 0 ? (memberTotal / memberTarget) * 100 : 0;
                    return (
                      <button
                        key={member.id}
                        onClick={() => {
                          setSelectedMember({ id: member.id, name: member.full_name, team: slug, roleName: member.role?.name });
                          setDrillDownOpen(true);
                        }}
                        className="w-full flex items-center gap-2.5 p-2 -mx-2 rounded-lg border border-transparent hover:border-border/20 hover:bg-muted/30 transition-all duration-150 cursor-pointer"
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold ${colorClass}`}
                        >
                          {getInitials(member.full_name)}
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                          <p className="text-[13px] font-medium truncate">{member.full_name}</p>
                          <p className="text-[11px] text-muted-foreground/60">{member.role?.name || 'Team Member'}</p>
                        </div>
                        {memberTotal > 0 && (
                          <div className="text-right shrink-0">
                            <p className="text-[12px] font-medium">£{Math.round(memberTotal).toLocaleString()}</p>
                            {memberTarget > 0 && (
                              <p className={`text-[10px] ${memberPct < 80 ? 'text-emerald-500' : memberPct <= 95 ? 'text-amber-500' : 'text-red-500'}`}>
                                {Math.round(memberPct)}%
                              </p>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Clients — consistent height across cards */}
              <div className="p-4 flex-1">
                <p className="text-[11px] font-medium text-muted-foreground/60 mb-2">Active Clients</p>
                {teamClients.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground/40">No active clients</p>
                ) : (
                  <ClientList clients={teamClients} contractRevenueByClient={contractRevenueByClient} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Member drill-down sheet */}
      {selectedMember && (
        <MemberDrillDownSheet
          open={drillDownOpen}
          onOpenChange={setDrillDownOpen}
          memberId={selectedMember.id}
          memberName={selectedMember.name}
          memberTeam={selectedMember.team}
          memberRole={selectedMember.roleName}
          mode="currency"
          capacityTargets={capacityTargets}
        />
      )}
    </div>
  );
}
