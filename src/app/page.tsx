'use client';

import { CLIENTS, TASKS, TEAM_MEMBERS } from '@/lib/data';
import { TEAM_STYLES } from '@/lib/constants';
import { formatDueDate, getDueDateColor } from '@/lib/date';
import { Users, ListChecks, AlertCircle, TrendingUp, Calendar } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const activeClients = CLIENTS.filter(c => c.status === 'active').length;
  const activeTasks = TASKS.filter(t => t.status !== 'done').length;
  const overdueTasks = TASKS.filter(t => {
    if (!t.due_date || t.status === 'done') return false;
    return new Date(t.due_date) < new Date();
  }).length;
  const completedTasks = TASKS.filter(t => t.status === 'done').length;
  const completionRate = TASKS.length > 0 
    ? Math.round((completedTasks / TASKS.length) * 100) 
    : 0;

  // Recent activity
  const recentActivity = [
    ...TASKS.filter(t => t.status === 'done' && t.completed_at)
      .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())
      .slice(0, 3)
      .map(t => ({
        id: t.id,
        text: `${t.assignee} completed "${t.title}"`,
        time: t.completed_at!,
        type: 'completed' as const,
      })),
    ...TASKS.filter(t => t.status !== 'done')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 2)
      .map(t => ({
        id: t.id,
        text: `${t.assignee} created "${t.title}"`,
        time: t.created_at,
        type: 'created' as const,
      })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 5);

  // Team performance
  const teamPerformance = ['synergy', 'ignite', 'alliance'].map(team => {
    const teamClients = CLIENTS.filter(c => c.team === team && c.status === 'active');
    const teamTasks = TASKS.filter(t => {
      const client = CLIENTS.find(c => c.id === t.client_id);
      return client?.team === team;
    });
    const completedTeamTasks = teamTasks.filter(t => t.status === 'done').length;
    const teamRate = teamTasks.length > 0 ? Math.round((completedTeamTasks / teamTasks.length) * 100) : 0;

    return {
      team,
      clientCount: teamClients.length,
      activeTaskCount: teamTasks.filter(t => t.status !== 'done').length,
      completionRate: teamRate,
    };
  });

  // Upcoming deadlines
  const upcomingTasks = TASKS
    .filter(t => t.due_date && t.status !== 'done')
    .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
    .slice(0, 5);

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Overview of your agency performance</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="rounded-lg border border-border/20 bg-card px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <Users size={14} className="text-muted-foreground/60" />
            <p className="text-xs text-muted-foreground">Total Clients</p>
          </div>
          <p className="text-xl font-semibold text-foreground">{activeClients}</p>
        </div>

        <div className="rounded-lg border border-border/20 bg-card px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <ListChecks size={14} className="text-muted-foreground/60" />
            <p className="text-xs text-muted-foreground">Active Tasks</p>
          </div>
          <p className="text-xl font-semibold text-foreground">{activeTasks}</p>
        </div>

        <div className="rounded-lg border border-border/20 bg-card px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle size={14} className="text-red-400" />
            <p className="text-xs text-muted-foreground">Overdue Tasks</p>
          </div>
          <p className="text-xl font-semibold text-red-400">{overdueTasks}</p>
        </div>

        <div className="rounded-lg border border-border/20 bg-card px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={14} className="text-emerald-400" />
            <p className="text-xs text-muted-foreground">Completion Rate</p>
          </div>
          <p className="text-xl font-semibold text-foreground">{completionRate}%</p>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Recent Activity + Upcoming Deadlines */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Activity */}
          <div className="rounded-lg border border-border/20 bg-card p-5">
            <h3 className="text-lg font-semibold text-foreground mb-4">Recent Activity</h3>
            <div className="space-y-3">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 py-2 border-b border-border/20 last:border-0">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                    activity.type === 'completed' ? 'bg-emerald-500' : 'bg-blue-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-foreground">{activity.text}</p>
                    <p className="text-xs text-muted-foreground/60 mt-0.5">
                      {new Date(activity.time).toLocaleDateString('en-GB', { 
                        day: 'numeric', 
                        month: 'short', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Deadlines */}
          <div className="rounded-lg border border-border/20 bg-card p-5">
            <h3 className="text-lg font-semibold text-foreground mb-4">Upcoming Deadlines</h3>
            <div className="space-y-2">
              {upcomingTasks.map((task) => {
                const client = CLIENTS.find(c => c.id === task.client_id);
                return (
                  <Link
                    key={task.id}
                    href={`/tasks?task=${task.id}`}
                    className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/40 transition-colors duration-150"
                  >
                    <Calendar size={14} className="text-muted-foreground/60 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-foreground truncate">{task.title}</p>
                      {client && (
                        <p className="text-xs text-muted-foreground/60">{client.name}</p>
                      )}
                    </div>
                    <span className={`text-xs whitespace-nowrap ${getDueDateColor(task.due_date)}`}>
                      {formatDueDate(task.due_date)}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Team Performance */}
        <div>
          <div className="rounded-lg border border-border/20 bg-card p-5">
            <h3 className="text-lg font-semibold text-foreground mb-4">Team Performance</h3>
            <div className="space-y-4">
              {teamPerformance.map((team) => {
                const teamStyle = TEAM_STYLES[team.team as keyof typeof TEAM_STYLES];
                return (
                  <Link
                    key={team.team}
                    href={`/teams?team=${team.team}`}
                    className="block rounded-lg border border-border/20 bg-muted/20 p-4 hover:bg-muted/40 transition-colors duration-150"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span 
                        className="inline-block h-2 w-2 rounded-full" 
                        style={{ backgroundColor: teamStyle.color }}
                      />
                      <h4 className="text-[13px] font-semibold text-foreground">{teamStyle.label}</h4>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground/60">Clients</span>
                        <span className="font-medium text-foreground">{team.clientCount}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground/60">Active Tasks</span>
                        <span className="font-medium text-foreground">{team.activeTaskCount}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground/60">Completion</span>
                        <span className="font-medium text-foreground">{team.completionRate}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-2">
                        <div 
                          className="h-full rounded-full transition-all duration-300"
                          style={{ 
                            width: `${team.completionRate}%`,
                            backgroundColor: teamStyle.color,
                          }}
                        />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
