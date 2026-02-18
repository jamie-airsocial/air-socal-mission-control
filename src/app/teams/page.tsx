'use client';

import { useState, useEffect } from 'react';
import { TEAM_MEMBERS } from '@/lib/data';
import { TEAM_STYLES, SERVICE_STYLES } from '@/lib/constants';
import type { Team } from '@/lib/types';
import { Mail, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { ServiceIcon } from '@/components/ui/service-icon';

interface Client {
  id: string;
  name: string;
  team: string;
  status: string;
  services: string[];
  monthly_retainer: number;
  assigned_members: string[];
}

/** Services excluded from revenue breakdowns — all clients include AM implicitly */
const REVENUE_EXCLUDED_SERVICES = new Set(['account-management']);

function calcRevenueByService(clients: Client[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const client of clients) {
    const billable = (client.services || []).filter(s => !REVENUE_EXCLUDED_SERVICES.has(s));
    if (billable.length === 0) continue;
    const perService = (client.monthly_retainer || 0) / billable.length;
    for (const s of billable) {
      totals[s] = (totals[s] || 0) + perService;
    }
  }
  return totals;
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function TeamsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/clients')
      .then(r => r.json())
      .then(data => setClients(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const teams = (['synergy', 'ignite', 'alliance'] as Team[]).map(teamId => {
    const style = TEAM_STYLES[teamId];
    const teamClients = clients.filter(c => c.team === teamId && c.status === 'active');
    const members = TEAM_MEMBERS.filter(m => m.team === teamId);
    const revenue = teamClients.reduce((sum, c) => sum + (c.monthly_retainer || 0), 0);
    const revenueByService = calcRevenueByService(teamClients);

    return { id: teamId, style, clients: teamClients, members, revenue, revenueByService };
  });

  return (
    <div className="animate-in fade-in duration-200">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Teams</h1>
        <p className="text-[13px] text-muted-foreground/60 mt-1">{TEAM_MEMBERS.length} members across 3 teams</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-64 bg-muted/20 rounded-lg animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {teams.map(team => (
            <div key={team.id} className="rounded-lg border border-border/20 bg-card overflow-hidden flex flex-col">
              {/* Team header */}
              <div className="p-4 border-b border-border/10" style={{ borderTopColor: team.style.color, borderTopWidth: 3 }}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: team.style.color }} />
                    <h2 className="text-[13px] font-semibold">{team.style.label}</h2>
                  </div>
                  <span className="text-[11px] text-muted-foreground/60">{team.clients.length} clients</span>
                </div>
                <p className="text-[18px] font-bold">£{team.revenue.toLocaleString()}<span className="text-[13px] font-normal text-muted-foreground/60">/mo</span></p>
              </div>

              {/* Revenue by Service */}
              {Object.keys(team.revenueByService).length > 0 && (
                <div className="px-4 py-3 border-b border-border/10 bg-muted/10">
                  <p className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-2">Revenue by Service</p>
                  <div className="space-y-1.5">
                    {Object.entries(team.revenueByService)
                      .sort(([, a], [, b]) => b - a)
                      .map(([service, amount]) => {
                        const s = SERVICE_STYLES[service];
                        if (!s) return null;
                        const pct = team.revenue > 0 ? (amount / team.revenue) * 100 : 0;
                        return (
                          <div key={service}>
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-[11px] text-muted-foreground/80 flex items-center gap-1">
                                <ServiceIcon serviceKey={service} size={10} /> {s.label}
                              </span>
                              <span className="text-[11px] font-medium">£{Math.round(amount).toLocaleString()}</span>
                            </div>
                            <div className="h-1 rounded-full bg-muted/30 overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: team.style.color, opacity: 0.6 }}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Members — styled as user cards */}
              <div className="p-4 border-b border-border/10">
                <p className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-2">Members</p>
                <div className="space-y-1.5">
                  {team.members.map(member => (
                    <div
                      key={member.id}
                      className="flex items-center gap-2.5 p-2 -mx-2 rounded-lg border border-transparent hover:border-border/20 hover:bg-muted/30 transition-all duration-150 cursor-pointer group"
                      title={member.email}
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold"
                        style={{ backgroundColor: `${team.style.color}22`, color: team.style.color }}
                      >
                        {getInitials(member.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium truncate">{member.name}</p>
                        <p className="text-[11px] text-muted-foreground/60">{member.role}</p>
                      </div>
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                        {member.email && (
                          <a
                            href={`mailto:${member.email}`}
                            onClick={e => e.stopPropagation()}
                            className="p-1 rounded hover:bg-muted/60 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                            title={member.email}
                          >
                            <Mail size={12} />
                          </a>
                        )}
                        <ChevronRight size={12} className="text-muted-foreground/30" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Clients */}
              <div className="p-4 flex-1">
                <p className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-2">Clients</p>
                {team.clients.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground/40">No active clients</p>
                ) : (
                  <div className="space-y-1.5">
                    {team.clients.map(client => (
                      <Link
                        key={client.id}
                        href={`/clients/${client.id}`}
                        className="flex items-center justify-between py-1.5 px-2 -mx-2 rounded-lg hover:bg-muted/40 transition-colors duration-150"
                      >
                        <span className="text-[13px] truncate">{client.name}</span>
                        <span className="text-[11px] text-muted-foreground/60 shrink-0 ml-2">
                          £{(client.monthly_retainer || 0).toLocaleString()}/mo
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
