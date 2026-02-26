'use client';

import { useState, useEffect, useMemo } from 'react';
import { getTeamStyle, getAssigneeColor, getServiceStyle } from '@/lib/constants';
import Link from 'next/link';
import { ArrowUpDown, ChevronRight, Users } from 'lucide-react';
import { format, startOfMonth, endOfMonth, addMonths } from 'date-fns';

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

interface CapacityTargets {
  [service: string]: number;
}

/** Services excluded from revenue breakdowns */
const REVENUE_EXCLUDED_SERVICES = new Set(['account-management']);

/** Calculate how much of a project (one-off) line item falls in a given month, pro-rata by day */
function projectAllocationForMonth(item: ContractLineItem, month: Date): number {
  if (!item.start_date || !item.end_date) {
    return 0;
  }
  const projectStart = new Date(item.start_date);
  const projectEnd = new Date(item.end_date);
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);

  if (projectStart > monthEnd || projectEnd < monthStart) return 0;

  const totalDays = Math.max(1, Math.round((projectEnd.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
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
  return item.is_active || (item.end_date != null);
}

interface ServiceCapacity {
  service: string;
  actual: number;
  target: number;
  percentage: number;
  clients: Array<{ clientId: string; clientName: string }>;
}

interface MonthlyCapacity {
  services: ServiceCapacity[];
  totalActual: number;
  totalTarget: number;
  totalPercentage: number;
}

function calcMonthlyCapacity(
  teamClients: Client[],
  contractItems: ContractLineItem[],
  month: Date,
  capacityTargets: CapacityTargets
): MonthlyCapacity {
  const byService: Record<string, { actual: number; clients: Set<string> }> = {};

  for (const client of teamClients) {
    const clientItems = contractItems.filter(i => i.client_id === client.id);
    for (const item of clientItems) {
      if (REVENUE_EXCLUDED_SERVICES.has(item.service)) continue;
      
      let amount = 0;
      if (item.billing_type === 'one-off') {
        if (item.start_date && item.end_date) {
          amount = projectAllocationForMonth(item, month);
        }
      } else {
        if (recurringActiveInMonth(item, month)) {
          amount = item.monthly_value || 0;
        }
      }

      if (amount > 0) {
        if (!byService[item.service]) {
          byService[item.service] = { actual: 0, clients: new Set() };
        }
        byService[item.service].actual += amount;
        byService[item.service].clients.add(client.name);
      }
    }
  }

  const services: ServiceCapacity[] = Object.entries(byService).map(([service, { actual, clients }]) => {
    const target = capacityTargets[service] || 1;
    const percentage = (actual / target) * 100;
    return {
      service,
      actual,
      target,
      percentage,
      clients: Array.from(clients).map(name => ({
        clientId: teamClients.find(c => c.name === name)?.id || '',
        clientName: name
      }))
    };
  }).sort((a, b) => b.actual - a.actual);

  const totalActual = services.reduce((sum, s) => sum + s.actual, 0);
  const totalTarget = Object.values(capacityTargets).reduce((sum, t) => sum + t, 0);
  const totalPercentage = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0;

  return { services, totalActual, totalTarget, totalPercentage };
}

function getCapacityColor(percentage: number): string {
  if (percentage < 80) return 'text-emerald-500';
  if (percentage < 95) return 'text-amber-500';
  return 'text-red-500';
}

function getCapacityBg(percentage: number): string {
  if (percentage < 80) return 'bg-emerald-500/20';
  if (percentage < 95) return 'bg-amber-500/20';
  return 'bg-red-500/20';
}

function ServiceCapacityRow({ row, teamColor }: { row: ServiceCapacity; teamColor: string }) {
  const [expanded, setExpanded] = useState(false);
  const s = getServiceStyle(row.service);
  const capacityColor = getCapacityColor(row.percentage);

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
          <span className={`text-[11px] font-medium ${capacityColor}`}>
            {Math.round(row.percentage)}%
          </span>
        </div>
        <div className="h-1 rounded-full bg-muted/30 overflow-hidden ml-4">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(Math.max(row.percentage, 3), 100)}%`,
              backgroundColor: teamColor,
              opacity: 0.6
            }}
          />
        </div>
      </button>
      {expanded && row.clients.length > 0 && (
        <div className="ml-5 mt-1 mb-1 space-y-0.5">
          {row.clients.map((c, i) => (
            <Link
              key={i}
              href={`/clients/${c.clientId}`}
              className="flex items-center py-0.5 -mx-1 px-1 rounded hover:bg-muted/30 transition-colors group/client"
            >
              <span className="text-[10px] text-muted-foreground/50 truncate group-hover/client:text-foreground transition-colors">
                {c.clientName}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function MonthlyCapacitySection({
  teamClients,
  contractItems,
  capacityTargets,
  teamColor
}: {
  teamClients: Client[];
  contractItems: ContractLineItem[];
  capacityTargets: CapacityTargets;
  teamColor: string;
}) {
  const [viewingNext, setViewingNext] = useState(false);
  const currentMonth = useMemo(() => startOfMonth(new Date()), []);
  const nextMonth = useMemo(() => addMonths(currentMonth, 1), [currentMonth]);

  const currentCapacity = useMemo(
    () => calcMonthlyCapacity(teamClients, contractItems, currentMonth, capacityTargets),
    [teamClients, contractItems, currentMonth, capacityTargets]
  );

  const nextCapacity = useMemo(
    () => calcMonthlyCapacity(teamClients, contractItems, nextMonth, capacityTargets),
    [teamClients, contractItems, nextMonth, capacityTargets]
  );

  const capacity = viewingNext ? nextCapacity : currentCapacity;
  const capacityColor = getCapacityColor(capacity.totalPercentage);
  const capacityBg = getCapacityBg(capacity.totalPercentage);

  const diff = nextCapacity.totalPercentage - currentCapacity.totalPercentage;

  return (
    <div className="px-4 py-3 border-b border-border/10 bg-muted/10">
      {/* Month tabs */}
      <div className="flex items-center gap-1 mb-3 rounded-md bg-muted/30 p-0.5">
        <button
          onClick={() => setViewingNext(false)}
          className={`flex-1 text-center py-1 rounded text-[11px] font-medium transition-all duration-150 ${!viewingNext ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground/50 hover:text-muted-foreground'}`}
        >
          {format(currentMonth, 'MMM yyyy')} · {Math.round(currentCapacity.totalPercentage)}%
        </button>
        <button
          onClick={() => setViewingNext(true)}
          className={`flex-1 text-center py-1 rounded text-[11px] font-medium transition-all duration-150 ${viewingNext ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground/50 hover:text-muted-foreground'}`}
        >
          {format(nextMonth, 'MMM yyyy')} · {Math.round(nextCapacity.totalPercentage)}%
          {Math.abs(diff) > 1 && (
            <span className={`text-[9px] ml-1 ${diff > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {diff > 0 ? '↑' : '↓'}{Math.abs(Math.round(diff))}%
            </span>
          )}
        </button>
      </div>

      {/* Total capacity */}
      <div className={`rounded-lg p-3 mb-3 ${capacityBg}`}>
        <p className="text-[11px] text-muted-foreground/60 mb-1">Team Capacity</p>
        <p className={`text-[18px] font-bold leading-tight ${capacityColor}`}>
          {Math.round(capacity.totalPercentage)}%
        </p>
      </div>

      {/* Service breakdown */}
      {capacity.services.length > 0 ? (
        <div className="space-y-1">
          {capacity.services.map(row => (
            <ServiceCapacityRow key={row.service} row={row} teamColor={teamColor} />
          ))}
        </div>
      ) : (
        <p className="text-[12px] text-muted-foreground/40 italic">No billing this month</p>
      )}
    </div>
  );
}

function ClientList({ clients }: { clients: Client[] }) {
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const toggleSort = () => setSortDir(d => d === 'asc' ? 'desc' : 'asc');
  
  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...clients].sort((a, b) => dir * a.name.localeCompare(b.name));
  }, [clients, sortDir]);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <button
          onClick={toggleSort}
          className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium"
        >
          Client <ArrowUpDown size={9} className={sortDir === 'desc' ? 'rotate-180' : ''} />
        </button>
      </div>
      <div className="space-y-0.5">
        {sorted.map(client => (
          <Link
            key={client.id}
            href={`/clients/${client.id}`}
            className="flex items-center py-1.5 rounded-lg hover:bg-muted/40 transition-colors duration-150"
          >
            <span className="text-[13px] truncate">{client.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function DeliveryPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [contractItems, setContractItems] = useState<ContractLineItem[]>([]);
  const [capacityTargets, setCapacityTargets] = useState<CapacityTargets>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/teams').then(r => r.json()).catch(() => []),
      fetch('/api/clients').then(r => r.json()).catch(() => []),
      fetch('/api/admin/capacity').then(r => r.json()).catch(() => ({ targets: {} })),
    ]).then(async ([teamsData, clientsData, capacityData]) => {
      setTeams(teamsData || []);
      setClients(clientsData || []);
      setCapacityTargets(capacityData.targets || {});

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

  const activeClients = clients.filter(c => c.status === 'active');
  const totalMembers = teams.reduce((sum, t) => sum + (t.members?.length ?? 0), 0);

  const maxMembers = Math.max(...teams.map(t => t.members?.length ?? 0), 0);

  const teamRows = teams.map(team => {
    const slug = team.name.toLowerCase();
    const style = getTeamStyle(slug);
    const teamClients = activeClients.filter(c => c.team === slug);
    const members = team.members || [];

    return { team, slug, style, clients: teamClients, members };
  });

  return (
    <div className="animate-in fade-in duration-200">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Delivery</h1>
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
                  <span className="text-[11px] text-muted-foreground/60">
                    {teamClients.length} client{teamClients.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {/* Monthly capacity breakdown */}
              <MonthlyCapacitySection
                teamClients={teamClients}
                contractItems={contractItems}
                capacityTargets={capacityTargets}
                teamColor={style?.color || 'var(--primary)'}
              />

              {/* Members */}
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

              {/* Clients — no billing amounts shown */}
              <div className="p-4 flex-1">
                <p className="text-[11px] font-medium text-muted-foreground/60 mb-2">Active Clients</p>
                {teamClients.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground/40">No active clients</p>
                ) : (
                  <ClientList clients={teamClients} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
