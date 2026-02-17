'use client';

import { useState, useEffect, useCallback } from 'react';
import { TEAM_MEMBERS } from '@/lib/data';
import { TEAM_STYLES, SERVICE_STYLES } from '@/lib/constants';
import type { Team } from '@/lib/types';
import { Users, Briefcase } from 'lucide-react';
import Link from 'next/link';

interface Client {
  id: string;
  name: string;
  team: string;
  status: string;
  services: string[];
  monthly_retainer: number;
  assigned_members: string[];
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

    return { id: teamId, style, clients: teamClients, members, revenue };
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
            <div key={team.id} className="rounded-lg border border-border/20 bg-card overflow-hidden">
              {/* Team header */}
              <div className="p-4 border-b border-border/10" style={{ borderTopColor: team.style.color, borderTopWidth: 3 }}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: team.style.color }} />
                    <h2 className="text-[13px] font-semibold">{team.style.label}</h2>
                  </div>
                  <span className="text-[11px] text-muted-foreground/60">{team.clients.length} clients</span>
                </div>
                <p className="text-[13px] font-medium">£{team.revenue.toLocaleString()}/mo</p>
              </div>

              {/* Members */}
              <div className="p-4 border-b border-border/10">
                <p className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-2">Members</p>
                <div className="space-y-2">
                  {team.members.map(member => (
                    <div key={member.id} className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                        <span className="text-[10px] leading-none font-semibold text-primary">{member.name.charAt(0)}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium truncate">{member.name}</p>
                        <p className="text-[11px] text-muted-foreground/60">{member.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Clients */}
              <div className="p-4">
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
