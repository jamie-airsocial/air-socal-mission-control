'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CLIENTS, TASKS, TEAM_MEMBERS } from '@/lib/data';
import { TEAM_STYLES, SERVICE_STYLES, STATUS_STYLES, PRIORITY_STYLES } from '@/lib/constants';
import { formatDueDate, getDueDateColor } from '@/lib/date';
import { ArrowLeft, Users, Receipt, Calendar, Tag } from 'lucide-react';
import Link from 'next/link';

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;
  const client = CLIENTS.find(c => c.id === clientId);

  const [view, setView] = useState<'service' | 'month'>('service');

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-[13px] text-muted-foreground">Client not found</p>
        <Link href="/clients" className="text-[13px] text-primary hover:underline mt-2">
          Back to clients
        </Link>
      </div>
    );
  }

  const clientTasks = TASKS.filter(t => t.client_id === client.id);
  const teamStyle = TEAM_STYLES[client.team];
  const members = TEAM_MEMBERS.filter(m => client.assigned_members.includes(m.id));

  // Group tasks by service or month
  const groupedTasks = view === 'service'
    ? clientTasks.reduce<Record<string, typeof clientTasks>>((acc, t) => {
        const key = t.service || 'none';
        (acc[key] ??= []).push(t);
        return acc;
      }, {})
    : clientTasks.reduce<Record<string, typeof clientTasks>>((acc, t) => {
        const key = !t.due_date ? 'No date' : new Date(t.due_date).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
        (acc[key] ??= []).push(t);
        return acc;
      }, {});

  return (
    <div className="animate-in fade-in duration-300">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      {/* Client Header */}
      <div className="rounded-lg border border-border/20 bg-card p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">{client.name}</h1>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span 
                  className="inline-block h-2 w-2 rounded-full" 
                  style={{ backgroundColor: teamStyle.color }}
                />
                <span className="text-[13px] text-muted-foreground">{teamStyle.label}</span>
              </div>
              <span className="text-muted-foreground/30">·</span>
              <span 
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  client.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' :
                  client.status === 'paused' ? 'bg-amber-500/10 text-amber-400' :
                  'bg-red-500/10 text-red-400'
                }`}
              >
                {client.status}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground/60 mb-1">Monthly Retainer</p>
            <p className="text-xl font-semibold text-foreground">
              £{client.monthly_retainer.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Services */}
        <div className="mb-4">
          <p className="text-xs text-muted-foreground/60 mb-2">Services</p>
          <div className="flex flex-wrap gap-2">
            {client.services.map((service) => {
              const serviceStyle = SERVICE_STYLES[service];
              return (
                <span
                  key={service}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium ${serviceStyle.bg} ${serviceStyle.text}`}
                >
                  <span>{serviceStyle.icon}</span>
                  {serviceStyle.label}
                </span>
              );
            })}
          </div>
        </div>

        {/* Team Members */}
        <div>
          <p className="text-xs text-muted-foreground/60 mb-2">Team</p>
          <div className="flex items-center gap-3">
            {members.map((member) => (
              <div key={member.id} className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-xs font-semibold text-primary">
                    {member.name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <div>
                  <p className="text-[13px] font-medium text-foreground">{member.name}</p>
                  <p className="text-xs text-muted-foreground/60">{member.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tasks Section */}
      <div className="rounded-lg border border-border/20 bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Tasks</h2>
          <div className="flex items-center gap-1 rounded-lg border border-border/20 bg-muted p-1">
            <button
              onClick={() => setView('service')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors duration-150 ${
                view === 'service'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted/60'
              }`}
            >
              By Service
            </button>
            <button
              onClick={() => setView('month')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors duration-150 ${
                view === 'month'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted/60'
              }`}
            >
              By Month
            </button>
          </div>
        </div>

        {/* Grouped Tasks */}
        <div className="space-y-6">
          {Object.entries(groupedTasks).map(([group, tasks]) => {
            if (!tasks || tasks.length === 0) return null;

            let groupLabel = group;
            let groupIcon = null;

            if (view === 'service') {
              const serviceStyle = group !== 'none' ? SERVICE_STYLES[group as keyof typeof SERVICE_STYLES] : null;
              groupLabel = serviceStyle ? serviceStyle.label : 'No Service';
              groupIcon = serviceStyle ? serviceStyle.icon : '📋';
            } else {
              groupIcon = '📅';
            }

            return (
              <div key={group}>
                <div className="flex items-center gap-2 mb-3">
                  {groupIcon && <span className="text-sm">{groupIcon}</span>}
                  <h3 className="text-[13px] font-semibold text-foreground">{groupLabel}</h3>
                  <span className="text-xs text-muted-foreground/60">({tasks.length})</span>
                </div>

                <div className="space-y-2">
                  {tasks.map((task) => {
                    const statusStyle = STATUS_STYLES[task.status];
                    const priorityStyle = PRIORITY_STYLES[task.priority];

                    return (
                      <Link
                        key={task.id}
                        href={`/tasks?task=${task.id}`}
                        className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border/20 bg-muted/20 hover:bg-muted/40 transition-colors duration-150"
                      >
                        <span
                          className="inline-block h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: statusStyle.dot }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-foreground truncate mb-0.5">
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                            <span>{task.assignee}</span>
                            {task.is_recurring && (
                              <>
                                <span>·</span>
                                <span className="flex items-center gap-1">
                                  <Calendar size={10} />
                                  Recurring
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${priorityStyle.bg} ${priorityStyle.text}`}
                        >
                          {task.priority}
                        </span>
                        {task.due_date && (
                          <span className={`text-xs whitespace-nowrap shrink-0 ${getDueDateColor(task.due_date)}`}>
                            {formatDueDate(task.due_date)}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {clientTasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Tag size={32} className="text-muted-foreground/30 mb-3" />
            <p className="text-[13px] font-medium text-muted-foreground">No tasks yet</p>
            <p className="text-[13px] text-muted-foreground/60 mt-1">Tasks will appear here once created</p>
          </div>
        )}
      </div>
    </div>
  );
}
