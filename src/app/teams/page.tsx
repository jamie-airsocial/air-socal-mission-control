'use client';

import { useState, useEffect, useMemo } from 'react';
import { getTeamStyle, getAssigneeColor, getServiceStyle } from '@/lib/constants';
import Link from 'next/link';
import { ArrowUpDown, ChevronRight, Users } from 'lucide-react';
import { format, startOfMonth, endOfMonth, addMonths, differenceInCalendarMonths, isSameMonth } from 'date-fns';

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
}

/** Services excluded from revenue breakdowns */
const REVENUE_EXCLUDED_SERVICES = new Set(['account-management']);

/** Calculate how much of a project (one-off) line item falls in a given month */
function projectAllocationForMonth(item: ContractLineItem, month: Date): number {
  if (!item.start_date || !item.end_date) {
    // No dates set — show full value in current month only
    if (isSameMonth(month, new Date())) return item.monthly_value || 0;
    return 0;
  }
  const start = startOfMonth(new Date(item.start_date));
  const end = startOfMonth(new Date(item.end_date));
  const target = startOfMonth(month);
  if (target < start || target > end) return 0;
  const spanMonths = differenceInCalendarMonths(end, start) + 1;
  return (item.monthly_value || 0) / spanMonths;
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
}

interface ServiceRow {
  service: string;
  amount: number;
  clients: ServiceClientDetail[];
}

interface MonthlyBreakdown {
  recurring: ServiceRow[];
  project: ServiceRow[];
  recurringTotal: number;
  projectTotal: number;
}

function calcMonthlyBreakdown(teamClients: Client[], contractItems: ContractLineItem[], month: Date): MonthlyBreakdown {
  const recurringByService: Record<string, ServiceClientDetail[]> = {};
  const projectByService: Record<string, ServiceClientDetail[]> = {};

  for (const client of teamClients) {
    const clientItems = contractItems.filter(i => i.client_id === client.id);
    for (const item of clientItems) {
      if (REVENUE_EXCLUDED_SERVICES.has(item.service)) continue;
      if (item.billing_type === 'one-off') {
        const alloc = projectAllocationForMonth(item, month);
        if (alloc > 0) {
          if (!projectByService[item.service]) projectByService[item.service] = [];
          projectByService[item.service].push({ clientId: client.id, clientName: client.name, amount: alloc, start_date: item.start_date, end_date: item.end_date });
        }
      } else {
        if (recurringActiveInMonth(item, month)) {
          if (!recurringByService[item.service]) recurringByService[item.service] = [];
          recurringByService[item.service].push({ clientId: client.id, clientName: client.name, amount: item.monthly_value || 0 });
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
  };
}

function ServiceBreakdownRow({ row, total, teamColor, isProject }: { row: ServiceRow; total: number; teamColor: string; isProject?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const s = getServiceStyle(row.service);
  const pct = total > 0 ? (row.amount / total) * 100 : 0;

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
          <span className="text-[11px] font-medium">£{Math.round(row.amount).toLocaleString()}</span>
        </div>
        <div className="h-1 rounded-full bg-muted/30 overflow-hidden ml-4">
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: teamColor, opacity: 0.6 }}
          />
        </div>
      </button>
      {expanded && row.clients.length > 0 && (
        <div className="ml-5 mt-1 mb-1 space-y-0.5">
          {row.clients.map((c, i) => (
            <Link key={i} href={`/clients/${c.clientId}`} className="flex items-center justify-between group/client py-0.5 -mx-1 px-1 rounded hover:bg-muted/30 transition-colors">
              <span className="text-[10px] text-muted-foreground/50 truncate mr-2 group-hover/client:text-foreground transition-colors">
                {c.clientName}
                {isProject && (
                  <span className="text-muted-foreground/30 ml-1 group-hover/client:text-muted-foreground/50">
                    {c.start_date && c.end_date
                      ? `(${format(new Date(c.start_date), 'dd MMM yy')} – ${format(new Date(c.end_date), 'dd MMM yy')})`
                      : '(no dates set)'}
                  </span>
                )}
              </span>
              <span className="text-[10px] text-muted-foreground/40 shrink-0 group-hover/client:text-foreground transition-colors">£{Math.round(c.amount).toLocaleString()}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function MonthlyBillingSection({ teamClients, contractItems, teamColor }: {
  teamClients: Client[];
  contractItems: ContractLineItem[];
  teamColor: string;
}) {
  const currentMonth = useMemo(() => startOfMonth(new Date()), []);
  const nextMonth = useMemo(() => addMonths(currentMonth, 1), [currentMonth]);

  const breakdown = useMemo(
    () => calcMonthlyBreakdown(teamClients, contractItems, currentMonth),
    [teamClients, contractItems, currentMonth]
  );

  const nextMonthBreakdown = useMemo(
    () => calcMonthlyBreakdown(teamClients, contractItems, nextMonth),
    [teamClients, contractItems, nextMonth]
  );

  const total = breakdown.recurringTotal + breakdown.projectTotal;
  const nextTotal = nextMonthBreakdown.recurringTotal + nextMonthBreakdown.projectTotal;
  const diff = nextTotal - total;

  return (
    <div className="px-4 py-3 border-b border-border/10 bg-muted/10">
      {/* Current + forecast */}
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <p className="text-[10px] text-muted-foreground/40 mb-0.5">{format(currentMonth, 'MMMM')}</p>
          <p className="text-[18px] font-bold leading-tight">£{Math.round(total).toLocaleString()}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-muted-foreground/40 mb-0.5">{format(nextMonth, 'MMMM')}</p>
          <p className="text-[14px] font-semibold">£{Math.round(nextTotal).toLocaleString()}</p>
          {diff !== 0 && (
            <p className={`text-[10px] ${diff > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {diff > 0 ? '↑' : '↓'} £{Math.abs(Math.round(diff)).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {/* Recurring */}
      {breakdown.recurring.length > 0 && (
        <div className="mb-2">
          <p className="text-[11px] font-semibold text-muted-foreground/60 mb-1.5">
            Recurring · £{Math.round(breakdown.recurringTotal).toLocaleString()}
          </p>
          <div className="space-y-1">
            {breakdown.recurring.map(row => (
              <ServiceBreakdownRow key={row.service} row={row} total={total} teamColor={teamColor} />
            ))}
          </div>
        </div>
      )}

      {/* Project work */}
      {breakdown.project.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground/60 mb-1.5">
            Project · £{Math.round(breakdown.projectTotal).toLocaleString()}
          </p>
          <div className="space-y-1">
            {breakdown.project.map(row => (
              <ServiceBreakdownRow key={row.service} row={row} total={total} teamColor={teamColor} isProject />
            ))}
          </div>
        </div>
      )}

      {breakdown.recurring.length === 0 && breakdown.project.length === 0 && (
        <p className="text-[12px] text-muted-foreground/40 italic">No billing this month</p>
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/teams').then(r => r.json()).catch(() => []),
      fetch('/api/clients').then(r => r.json()).catch(() => []),
    ]).then(async ([teamsData, clientsData]) => {
      setTeams(teamsData || []);
      setClients(clientsData || []);

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

  // Build team display data
  const teamRows = teams.map(team => {
    const slug = team.name.toLowerCase();
    const style = getTeamStyle(slug);
    const teamClients = activeClients.filter(c => c.team === slug);
    const members = team.members || [];

    // Revenue: from active recurring contract line items only
    return { team, slug, style, clients: teamClients, members };
  });

  return (
    <div className="animate-in fade-in duration-200">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Teams</h1>
        <p className="text-[13px] text-muted-foreground/60 mt-1">
          {totalMembers} member{totalMembers !== 1 ? 's' : ''} across {teams.length} team{teams.length !== 1 ? 's' : ''}
        </p>
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
          {teamRows.map(({ team, slug, style, clients: teamClients, members }) => (
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
                teamColor={style?.color || 'var(--primary)'}
              />

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
                    return (
                      <div
                        key={member.id}
                        className="flex items-center gap-2.5 p-2 -mx-2 rounded-lg border border-transparent hover:border-border/20 hover:bg-muted/30 transition-all duration-150"
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold ${colorClass}`}
                        >
                          {getInitials(member.full_name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium truncate">{member.full_name}</p>
                          <p className="text-[11px] text-muted-foreground/60">{member.role?.name || 'Team Member'}</p>
                        </div>
                      </div>
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
    </div>
  );
}
