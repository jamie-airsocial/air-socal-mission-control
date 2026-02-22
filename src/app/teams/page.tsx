'use client';

import { useState, useEffect, useMemo } from 'react';
import { getTeamStyle, SERVICE_STYLES, getAssigneeColor, getServiceStyle } from '@/lib/constants';
import Link from 'next/link';
import { ArrowUpDown, ChevronRight, Users } from 'lucide-react';

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
}

/** Services excluded from revenue breakdowns */
const REVENUE_EXCLUDED_SERVICES = new Set(['account-management']);

function ClientList({ clients, contractRevenueByClient }: { clients: Client[]; contractRevenueByClient: Record<string, number> }) {
  const [sortBy, setSortBy] = useState<'name' | 'amount'>('name');
  const sorted = useMemo(() => {
    return [...clients].sort((a, b) => {
      if (sortBy === 'amount') {
        return (contractRevenueByClient[b.id] || 0) - (contractRevenueByClient[a.id] || 0);
      }
      return a.name.localeCompare(b.name);
    });
  }, [clients, contractRevenueByClient, sortBy]);

  return (
    <div>
      <div className="flex items-center gap-1 mb-1">
        <button
          onClick={() => setSortBy(s => s === 'name' ? 'amount' : 'name')}
          className="flex items-center gap-1 text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition-colors"
        >
          <ArrowUpDown size={10} /> Sort by {sortBy === 'name' ? 'amount' : 'name'}
        </button>
      </div>
      <div className="space-y-1">
        {sorted.map(client => {
          const rev = contractRevenueByClient[client.id] || 0;
          return (
            <Link
              key={client.id}
              href={`/clients/${client.id}`}
              className="flex items-center justify-between py-1.5 px-2 -mx-2 rounded-lg hover:bg-muted/40 transition-colors duration-150 group"
            >
              <span className="text-[13px] truncate">{client.name}</span>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <span className="text-[11px] text-muted-foreground/60">
                  {rev > 0 ? `£${rev.toLocaleString()}/mo` : '—'}
                </span>
                <ChevronRight size={12} className="text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
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

  // Build contract revenue by service for a team's clients
  function calcRevenueByService(teamClients: Client[]): Record<string, number> {
    const totals: Record<string, number> = {};
    // Revenue from active recurring contract line items only
    for (const client of teamClients) {
      for (const item of contractItems.filter(i => i.client_id === client.id && i.is_active && i.billing_type !== 'one-off')) {
        if (!REVENUE_EXCLUDED_SERVICES.has(item.service)) {
          totals[item.service] = (totals[item.service] || 0) + (item.monthly_value || 0);
        }
      }
    }
    return totals;
  }

  const activeClients = clients.filter(c => c.status === 'active');
  const totalMembers = teams.reduce((sum, t) => sum + (t.members?.length ?? 0), 0);

  // Calculate max counts for consistent section heights across cards
  const maxServices = Math.max(...teams.map(t => {
    const slug = t.name.toLowerCase();
    const tc = activeClients.filter(c => c.team === slug);
    return Object.keys(calcRevenueByService(tc)).length;
  }), 0);
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
    const revenue = teamClients.reduce((sum, c) => {
      return sum + (contractRevenueByClient[c.id] || 0);
    }, 0);

    const revenueByService = calcRevenueByService(teamClients);

    return { team, slug, style, clients: teamClients, members, revenue, revenueByService };
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
          {teamRows.map(({ team, slug, style, clients: teamClients, members, revenue, revenueByService }) => (
            <div key={team.id} className="rounded-lg border border-border/20 bg-card overflow-hidden flex flex-col">
              {/* Colour top bar */}
              <div
                className="h-1 w-full"
                style={{ backgroundColor: style?.color || 'var(--border)' }}
              />

              {/* Team header */}
              <div className="p-4 border-b border-border/10">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {style && <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: style.color }} />}
                    <h2 className="text-[13px] font-semibold">{team.name}</h2>
                  </div>
                  <span className="text-[11px] text-muted-foreground/60">{teamClients.length} client{teamClients.length !== 1 ? 's' : ''}</span>
                </div>
                <p className="text-[18px] font-bold">
                  £{revenue.toLocaleString()}
                  <span className="text-[13px] font-normal text-muted-foreground/60">/mo</span>
                </p>
              </div>

              {/* Revenue by Service — consistent height across cards */}
              <div className="px-4 py-3 border-b border-border/10 bg-muted/10">
                <p className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-2">Revenue by Service</p>
                <div style={{ minHeight: `${maxServices * 28}px` }}>
                  {Object.keys(revenueByService).length > 0 ? (
                    <div className="space-y-1.5">
                      {Object.entries(revenueByService)
                        .sort(([, a], [, b]) => b - a)
                        .map(([service, amount]) => {
                          const s = getServiceStyle(service);
                          const label = s.label;
                          const pct = revenue > 0 ? (amount / revenue) * 100 : 0;
                          return (
                            <div key={service}>
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-[11px] text-muted-foreground/80 flex items-center gap-1">
                                  <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: getServiceStyle(service).dot }} /> {label}
                                </span>
                                <span className="text-[11px] font-medium">£{Math.round(amount).toLocaleString()}</span>
                              </div>
                              <div className="h-1 rounded-full bg-muted/30 overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${Math.max(pct, 3)}%`,
                                    backgroundColor: style?.color || 'var(--primary)',
                                    opacity: 0.6,
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <p className="text-[12px] text-muted-foreground/40 italic">No revenue data</p>
                  )}
                </div>
              </div>

              {/* Members — consistent height across cards */}
              <div className="p-4 border-b border-border/10">
                <p className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-2">
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
                <p className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-2">Active Clients</p>
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
