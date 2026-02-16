'use client';

import { useState } from 'react';
import { TASKS, CLIENTS } from '@/lib/data';
import { STATUS_STYLES, PRIORITY_STYLES, MEMBER_COLORS, SERVICE_STYLES } from '@/lib/constants';
import { formatDueDate, getDueDateColor } from '@/lib/date';
import type { TaskStatus, TaskPriority, Service, Team } from '@/lib/types';
import { LayoutGrid, Table2, Search, Plus, Calendar, Repeat } from 'lucide-react';
import Link from 'next/link';

export default function TasksPage() {
  const [view, setView] = useState<'kanban' | 'table'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClient, setFilterClient] = useState<string>('all');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<TaskPriority | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all');
  const [filterService, setFilterService] = useState<Service | 'all'>('all');

  const filteredTasks = TASKS.filter(task => {
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filterClient !== 'all' && task.client_id !== filterClient) return false;
    if (filterAssignee !== 'all' && task.assignee !== filterAssignee) return false;
    if (filterPriority !== 'all' && task.priority !== filterPriority) return false;
    if (filterStatus !== 'all' && task.status !== filterStatus) return false;
    if (filterService !== 'all' && task.service !== filterService) return false;
    return true;
  });

  const tasksByStatus = {
    todo: filteredTasks.filter(t => t.status === 'todo'),
    doing: filteredTasks.filter(t => t.status === 'doing'),
    review: filteredTasks.filter(t => t.status === 'review'),
    done: filteredTasks.filter(t => t.status === 'done'),
  };

  return (
    <div className="animate-in fade-in duration-300">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
          <p className="text-[13px] text-muted-foreground/60 mt-1">{filteredTasks.length} tasks</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-border/20 bg-muted p-1">
            <button
              onClick={() => setView('kanban')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${
                view === 'kanban'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted/60'
              }`}
            >
              <LayoutGrid size={14} />
              Kanban
            </button>
            <button
              onClick={() => setView('table')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${
                view === 'table'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted/60'
              }`}
            >
              <Table2 size={14} />
              Table
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="h-8 w-full sm:w-[180px] pl-8 pr-3 text-xs bg-secondary border border-border/20 rounded-lg outline-none focus:border-primary/50 transition-colors placeholder:text-muted-foreground/60"
          />
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as TaskStatus | 'all')}
          className="h-8 px-3 text-xs bg-secondary border border-border/20 rounded-lg outline-none focus:border-primary/50 transition-colors text-foreground"
        >
          <option value="all">All Statuses</option>
          <option value="todo">To Do</option>
          <option value="doing">In Progress</option>
          <option value="review">Review</option>
          <option value="done">Done</option>
        </select>

        <select
          value={filterClient}
          onChange={(e) => setFilterClient(e.target.value)}
          className="h-8 px-3 text-xs bg-secondary border border-border/20 rounded-lg outline-none focus:border-primary/50 transition-colors text-foreground"
        >
          <option value="all">All Clients</option>
          {CLIENTS.map(client => (
            <option key={client.id} value={client.id}>{client.name}</option>
          ))}
        </select>

        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value as TaskPriority | 'all')}
          className="h-8 px-3 text-xs bg-secondary border border-border/20 rounded-lg outline-none focus:border-primary/50 transition-colors text-foreground"
        >
          <option value="all">All Priorities</option>
          <option value="P1">P1 - Urgent</option>
          <option value="P2">P2 - High</option>
          <option value="P3">P3 - Medium</option>
          <option value="P4">P4 - Low</option>
        </select>

        <select
          value={filterService}
          onChange={(e) => setFilterService(e.target.value as Service | 'all')}
          className="h-8 px-3 text-xs bg-secondary border border-border/20 rounded-lg outline-none focus:border-primary/50 transition-colors text-foreground"
        >
          <option value="all">All Services</option>
          <option value="seo">SEO</option>
          <option value="paid-ads">Paid Ads</option>
          <option value="social-media">Social Media</option>
          <option value="account-management">Account Management</option>
        </select>
      </div>

      {/* Kanban View */}
      {view === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {(['todo', 'doing', 'review', 'done'] as const).map(status => {
            const tasks = tasksByStatus[status];
            const statusStyle = STATUS_STYLES[status];

            return (
              <div key={status} className="flex flex-col">
                <div className="mb-3 flex items-center gap-2 px-1">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: statusStyle.dot }}
                  />
                  <h3 className="text-[13px] font-medium text-foreground">{statusStyle.label}</h3>
                  <span className="ml-auto text-[11px] font-medium text-muted-foreground/40">
                    {tasks.length}
                  </span>
                </div>

                <div className="space-y-2">
                  {tasks.map(task => {
                    const client = CLIENTS.find(c => c.id === task.client_id);
                    const priorityStyle = PRIORITY_STYLES[task.priority];
                    const serviceStyle = task.service ? SERVICE_STYLES[task.service] : null;

                    return (
                      <Link
                        key={task.id}
                        href={`/tasks?task=${task.id}`}
                        className="block rounded-lg border border-border/20 bg-card p-3 hover:bg-muted/40 hover:shadow-sm transition-all duration-150"
                        style={{
                          borderLeftWidth: '3px',
                          borderLeftColor: priorityStyle ? priorityStyle.text.replace('text-', '') : undefined,
                        }}
                      >
                        <h4 className="text-[13px] font-medium text-foreground mb-2 line-clamp-2">
                          {task.title}
                        </h4>

                        <div className="flex items-center justify-between gap-2 mb-2">
                          {client && (
                            <span className="text-[11px] text-muted-foreground/60 truncate">
                              {client.name}
                            </span>
                          )}
                          {serviceStyle && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${serviceStyle.bg} ${serviceStyle.text}`}>
                              {serviceStyle.label}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            {task.is_recurring && (
                              <Repeat size={10} className="text-primary/60" />
                            )}
                            {task.due_date && (
                              <div className={`flex items-center gap-1 ${getDueDateColor(task.due_date)}`}>
                                <Calendar size={10} />
                                <span className="text-[11px]">{formatDueDate(task.due_date)}</span>
                              </div>
                            )}
                          </div>
                          <div 
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold"
                            style={{ 
                              backgroundColor: MEMBER_COLORS[task.assignee] ? 
                                MEMBER_COLORS[task.assignee].replace('text-', 'bg-').replace('-400', '-500/20') : 
                                'rgba(100, 116, 139, 0.2)',
                              color: MEMBER_COLORS[task.assignee] ? 
                                MEMBER_COLORS[task.assignee].replace('bg-', '').replace('/20', '') : 
                                'rgb(148, 163, 184)',
                            }}
                          >
                            {task.assignee.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table View */}
      {view === 'table' && (
        <div className="rounded-lg border border-border/20 bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-card border-b border-border/20">
                <tr>
                  <th className="text-left px-4 py-3 text-[11px] font-medium text-muted-foreground/60">Title</th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium text-muted-foreground/60">Client</th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium text-muted-foreground/60">Status</th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium text-muted-foreground/60">Priority</th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium text-muted-foreground/60">Service</th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium text-muted-foreground/60">Assignee</th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium text-muted-foreground/60">Due Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map(task => {
                  const client = CLIENTS.find(c => c.id === task.client_id);
                  const statusStyle = STATUS_STYLES[task.status];
                  const priorityStyle = PRIORITY_STYLES[task.priority];
                  const serviceStyle = task.service ? SERVICE_STYLES[task.service] : null;

                  return (
                    <tr 
                      key={task.id}
                      className="border-b border-border/20 hover:bg-muted/40 transition-colors duration-150"
                    >
                      <td className="px-4 py-3">
                        <Link href={`/tasks?task=${task.id}`} className="flex items-center gap-2 hover:text-primary">
                          {task.is_recurring && (
                            <Repeat size={12} className="text-primary/60 shrink-0" />
                          )}
                          <span className="text-[13px] font-medium text-foreground">{task.title}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[13px] text-muted-foreground">
                          {client?.name || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: statusStyle.dot }}
                          />
                          <span className="text-[13px] text-muted-foreground">{statusStyle.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityStyle.bg} ${priorityStyle.text}`}>
                          {task.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {serviceStyle ? (
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${serviceStyle.bg} ${serviceStyle.text}`}>
                            {serviceStyle.label}
                          </span>
                        ) : (
                          <span className="text-[13px] text-muted-foreground/30">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-semibold"
                            style={{ 
                              backgroundColor: MEMBER_COLORS[task.assignee] ? 
                                MEMBER_COLORS[task.assignee].replace('text-', 'bg-').replace('-400', '-500/20') : 
                                'rgba(100, 116, 139, 0.2)',
                              color: MEMBER_COLORS[task.assignee] ? 
                                MEMBER_COLORS[task.assignee].replace('bg-', '').replace('/20', '') : 
                                'rgb(148, 163, 184)',
                            }}
                          >
                            {task.assignee.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </div>
                          <span className="text-[13px] text-muted-foreground capitalize">{task.assignee}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[13px] ${getDueDateColor(task.due_date)}`}>
                          {formatDueDate(task.due_date)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filteredTasks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Plus size={32} className="text-muted-foreground/30 mb-3" />
          <p className="text-[13px] font-medium text-muted-foreground">No tasks found</p>
          <p className="text-[13px] text-muted-foreground/60 mt-1">Try adjusting your filters</p>
        </div>
      )}
    </div>
  );
}
