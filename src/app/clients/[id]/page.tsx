'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { TEAM_MEMBERS } from '@/lib/data';
import { TEAM_STYLES, SERVICE_STYLES, STATUS_STYLES, PRIORITY_STYLES } from '@/lib/constants';
import { formatDueDate, getDueDateColor } from '@/lib/date';
import { ArrowLeft, Tag, Calendar } from 'lucide-react';
import { ServiceIcon } from '@/components/ui/service-icon';
import Link from 'next/link';

interface Client {
  id: string;
  name: string;
  team: string;
  status: string;
  services: string[];
  monthly_retainer: number;
  assigned_members: string[];
  color: string | null;
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignee: string | null;
  due_date: string | null;
  service: string | null;
  is_recurring: boolean;
  client_id: string | null;
}

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'service' | 'month'>('service');

  const fetchData = useCallback(async () => {
    try {
      const [clientRes, tasksRes] = await Promise.all([
        fetch(`/api/clients`),
        fetch(`/api/tasks`),
      ]);
      if (clientRes.ok) {
        const clients = await clientRes.json();
        setClient(clients.find((c: Client) => c.id === clientId) || null);
      }
      if (tasksRes.ok) {
        const allTasks = await tasksRes.json();
        setTasks(allTasks.filter((t: Task) => t.client_id === clientId));
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [clientId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="animate-in fade-in duration-200">
        <div className="h-6 w-24 bg-muted/30 rounded animate-pulse mb-4" />
        <div className="h-48 bg-muted/20 rounded-lg animate-pulse mb-6" />
        <div className="h-64 bg-muted/20 rounded-lg animate-pulse" />
      </div>
    );
  }

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

  const teamStyle = TEAM_STYLES[client.team as keyof typeof TEAM_STYLES];
  const members = TEAM_MEMBERS.filter(m => (client.assigned_members || []).includes(m.id));

  const groupedTasks = view === 'service'
    ? tasks.reduce<Record<string, Task[]>>((acc, t) => {
        const key = t.service || 'none';
        (acc[key] ??= []).push(t);
        return acc;
      }, {})
    : tasks.reduce<Record<string, Task[]>>((acc, t) => {
        const key = !t.due_date ? 'No date' : new Date(t.due_date).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
        (acc[key] ??= []).push(t);
        return acc;
      }, {});

  return (
    <div className="animate-in fade-in duration-200">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors duration-150 mb-4"
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
              {teamStyle && (
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: teamStyle.color }} />
                  <span className="text-[13px] text-muted-foreground">{teamStyle.label}</span>
                </div>
              )}
              <span className="text-muted-foreground/30">·</span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                client.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' :
                client.status === 'paused' ? 'bg-amber-500/10 text-amber-400' :
                'bg-red-500/10 text-red-400'
              }`}>
                {client.status}
              </span>
            </div>
          </div>
          {client.monthly_retainer > 0 && (
            <div className="text-right">
              <p className="text-[11px] text-muted-foreground/60 mb-1">Monthly Retainer</p>
              <p className="text-xl font-semibold">£{client.monthly_retainer.toLocaleString()}</p>
            </div>
          )}
        </div>

        {(client.services || []).length > 0 && (
          <div className="mb-4">
            <p className="text-[11px] text-muted-foreground/60 mb-2">Services</p>
            <div className="flex flex-wrap gap-2">
              {client.services.map((service) => {
                const s = SERVICE_STYLES[service];
                if (!s) return null;
                return (
                  <span key={service} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] font-medium ${s.bg} ${s.text}`}>
                    <ServiceIcon serviceKey={service} size={13} />
                    {s.label}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {members.length > 0 && (
          <div>
            <p className="text-[11px] text-muted-foreground/60 mb-2">Team</p>
            <div className="flex items-center gap-3">
              {members.map((member) => (
                <div key={member.id} className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-[10px] leading-none font-semibold text-primary">{member.name.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="text-[13px] font-medium">{member.name}</p>
                    <p className="text-[11px] text-muted-foreground/60">{member.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tasks */}
      <div className="rounded-lg border border-border/20 bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[13px] font-semibold">Tasks ({tasks.length})</h2>
          <div className="flex items-center rounded-lg border border-border/20 bg-secondary p-0.5">
            {(['service', 'month'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-2.5 py-1 rounded-md text-[13px] font-medium transition-all duration-150 ${
                  view === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                By {v === 'service' ? 'Service' : 'Month'}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {Object.entries(groupedTasks).map(([group, groupTasks]) => {
            if (!groupTasks?.length) return null;
            const serviceStyle = view === 'service' && group !== 'none' ? SERVICE_STYLES[group] : null;
            const groupLabel = serviceStyle ? serviceStyle.label : view === 'service' ? 'No Service' : group;
            const groupIcon = serviceStyle ? serviceStyle.icon : view === 'service' ? '📋' : '📅';

            return (
              <div key={group}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm">{groupIcon}</span>
                  <h3 className="text-[13px] font-semibold">{groupLabel}</h3>
                  <span className="text-[11px] text-muted-foreground/60">({groupTasks.length})</span>
                </div>
                <div className="space-y-2">
                  {groupTasks.map((task) => {
                    const statusStyle = STATUS_STYLES[task.status];
                    const priorityStyle = task.priority && PRIORITY_STYLES[task.priority];
                    return (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border/20 bg-muted/20 hover:bg-muted/40 transition-colors duration-150"
                      >
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: statusStyle?.dot }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium truncate">{task.title}</p>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground/60">
                            {task.assignee && <span>{task.assignee}</span>}
                            {task.is_recurring && (
                              <>
                                <span>·</span>
                                <span className="flex items-center gap-1"><Calendar size={10} /> Recurring</span>
                              </>
                            )}
                          </div>
                        </div>
                        {priorityStyle && (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium shrink-0 ${priorityStyle.bg} ${priorityStyle.text}`}>
                            {task.priority}
                          </span>
                        )}
                        {task.due_date && (
                          <span className={`text-[11px] whitespace-nowrap shrink-0 ${getDueDateColor(task.due_date)}`}>
                            {formatDueDate(task.due_date)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Tag size={32} className="text-muted-foreground/30 mb-3" />
            <p className="text-[13px] font-medium text-muted-foreground">No tasks yet</p>
            <p className="text-[13px] text-muted-foreground/60 mt-1">Tasks assigned to this client will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
}
