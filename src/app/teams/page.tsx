'use client';

import { TEAM_MEMBERS, CLIENTS, TASKS } from '@/lib/data';
import { TEAM_STYLES } from '@/lib/constants';
import type { Team } from '@/lib/legacy-types';
import { Users, Briefcase, ListChecks, TrendingUp } from 'lucide-react';
import Link from 'next/link';

export default function TeamsPage() {
  const teams: Team[] = ['synergy', 'ignite', 'alliance'];

  const teamData = teams.map(team => {
    const members = TEAM_MEMBERS.filter(m => m.team === team);
    const teamClients = CLIENTS.filter(c => c.team === team && c.status === 'active');
    const teamTasks = TASKS.filter(t => {
      const client = CLIENTS.find(c => c.id === t.client_id);
      return client?.team === team;
    });
    const activeTaskCount = teamTasks.filter(t => t.status !== 'done').length;
    const completedTaskCount = teamTasks.filter(t => t.status === 'done').length;
    const completionRate = teamTasks.length > 0 
      ? Math.round((completedTaskCount / teamTasks.length) * 100) 
      : 0;

    return {
      team,
      members,
      clientCount: teamClients.length,
      activeTaskCount,
      completedTaskCount,
      completionRate,
    };
  });

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Teams</h1>
        <p className="text-sm text-muted-foreground mt-1">Performance and overview of each team</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {teamData.map(({ team, members, clientCount, activeTaskCount, completedTaskCount, completionRate }) => {
          const teamStyle = TEAM_STYLES[team];

          return (
            <div
              key={team}
              className="rounded-lg border border-border/20 bg-card p-6"
            >
              {/* Team Header */}
              <div className="flex items-center gap-3 mb-6">
                <div 
                  className="w-12 h-12 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${teamStyle.color}20` }}
                >
                  <Users size={24} style={{ color: teamStyle.color }} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{teamStyle.label}</h2>
                  <p className="text-xs text-muted-foreground">{members.length} members</p>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="rounded-lg bg-muted/20 p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Briefcase size={12} className="text-muted-foreground/60" />
                    <p className="text-xs text-muted-foreground/60">Clients</p>
                  </div>
                  <p className="text-lg font-semibold text-foreground">{clientCount}</p>
                </div>

                <div className="rounded-lg bg-muted/20 p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <ListChecks size={12} className="text-muted-foreground/60" />
                    <p className="text-xs text-muted-foreground/60">Active Tasks</p>
                  </div>
                  <p className="text-lg font-semibold text-foreground">{activeTaskCount}</p>
                </div>

                <div className="rounded-lg bg-muted/20 p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <TrendingUp size={12} className="text-emerald-400" />
                    <p className="text-xs text-muted-foreground/60">Completed</p>
                  </div>
                  <p className="text-lg font-semibold text-emerald-400">{completedTaskCount}</p>
                </div>

                <div className="rounded-lg bg-muted/20 p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <TrendingUp size={12} className="text-muted-foreground/60" />
                    <p className="text-xs text-muted-foreground/60">Rate</p>
                  </div>
                  <p className="text-lg font-semibold text-foreground">{completionRate}%</p>
                </div>
              </div>

              {/* Completion Bar */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs text-muted-foreground/60">Task Completion</p>
                  <p className="text-xs font-medium text-foreground">{completionRate}%</p>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-300"
                    style={{ 
                      width: `${completionRate}%`,
                      backgroundColor: teamStyle.color,
                    }}
                  />
                </div>
              </div>

              {/* Team Members */}
              <div>
                <p className="text-xs font-medium text-muted-foreground/60 mb-3">Team Members</p>
                <div className="space-y-2">
                  {members.map(member => (
                    <div key={member.id} className="flex items-center gap-3 py-2">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
                        style={{ 
                          backgroundColor: `${teamStyle.color}20`,
                          color: teamStyle.color,
                        }}
                      >
                        {member.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-foreground">{member.name}</p>
                        <p className="text-xs text-muted-foreground/60">{member.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 pt-4 border-t border-border/20 flex gap-2">
                <Link
                  href={`/clients?team=${team}`}
                  className="flex-1 px-3 py-2 rounded-lg text-xs font-medium text-center border border-border/20 hover:bg-muted/40 transition-colors text-foreground"
                >
                  View Clients
                </Link>
                <Link
                  href={`/tasks?team=${team}`}
                  className="flex-1 px-3 py-2 rounded-lg text-xs font-medium text-center border border-border/20 hover:bg-muted/40 transition-colors text-foreground"
                >
                  View Tasks
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
