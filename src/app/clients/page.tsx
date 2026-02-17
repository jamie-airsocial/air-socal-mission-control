'use client';

import { useState } from 'react';
import { CLIENTS, TEAM_MEMBERS, TASKS } from '@/lib/data';
import { TEAM_STYLES, SERVICE_STYLES } from '@/lib/constants';
import type { Team, Service, ClientStatus } from '@/lib/legacy-types';
import { Users, Search, Filter } from 'lucide-react';
import Link from 'next/link';

export default function ClientsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTeam, setFilterTeam] = useState<Team | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<ClientStatus | 'all'>('all');
  const [filterService, setFilterService] = useState<Service | 'all'>('all');

  const filteredClients = CLIENTS.filter(client => {
    if (searchQuery && !client.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filterTeam !== 'all' && client.team !== filterTeam) return false;
    if (filterStatus !== 'all' && client.status !== filterStatus) return false;
    if (filterService !== 'all' && !client.services.includes(filterService)) return false;
    return true;
  });

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
        <p className="text-sm text-muted-foreground mt-1">{filteredClients.length} clients</p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search clients..."
            className="h-9 w-full sm:w-[200px] pl-8 pr-3 text-[13px] bg-secondary border border-border/20 rounded-lg outline-none focus:border-primary/50 transition-colors placeholder:text-muted-foreground/60"
          />
        </div>

        <select
          value={filterTeam}
          onChange={(e) => setFilterTeam(e.target.value as Team | 'all')}
          className="h-9 px-3 text-[13px] bg-secondary border border-border/20 rounded-lg outline-none focus:border-primary/50 transition-colors text-foreground"
        >
          <option value="all">All Teams</option>
          <option value="synergy">Synergy</option>
          <option value="ignite">Ignite</option>
          <option value="alliance">Alliance</option>
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as ClientStatus | 'all')}
          className="h-9 px-3 text-[13px] bg-secondary border border-border/20 rounded-lg outline-none focus:border-primary/50 transition-colors text-foreground"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="churned">Churned</option>
        </select>

        <select
          value={filterService}
          onChange={(e) => setFilterService(e.target.value as Service | 'all')}
          className="h-9 px-3 text-[13px] bg-secondary border border-border/20 rounded-lg outline-none focus:border-primary/50 transition-colors text-foreground"
        >
          <option value="all">All Services</option>
          <option value="seo">SEO</option>
          <option value="paid-ads">Paid Advertising</option>
          <option value="social-media">Social Media</option>
          <option value="account-management">Account Management</option>
        </select>
      </div>

      {/* Client Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClients.map((client) => {
          const teamStyle = TEAM_STYLES[client.team];
          const clientTasks = TASKS.filter(t => t.client_id === client.id);
          const activeTasks = clientTasks.filter(t => t.status !== 'done').length;
          const completedTasks = clientTasks.filter(t => t.status === 'done').length;

          return (
            <Link
              key={client.id}
              href={`/clients/${client.id}`}
              className="block rounded-lg border border-border/20 bg-card p-5 hover:bg-muted/40 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-150"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-[15px] font-semibold text-foreground mb-1">{client.name}</h3>
                  <div className="flex items-center gap-2">
                    <span 
                      className="inline-block h-1.5 w-1.5 rounded-full" 
                      style={{ backgroundColor: teamStyle.color }}
                    />
                    <span className="text-xs text-muted-foreground">{teamStyle.label}</span>
                  </div>
                </div>
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

              {/* Services */}
              <div className="mb-4">
                <p className="text-xs text-muted-foreground/60 mb-1.5">Services</p>
                <div className="flex flex-wrap gap-1.5">
                  {client.services.map((service) => {
                    const serviceStyle = SERVICE_STYLES[service];
                    return (
                      <span
                        key={service}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${serviceStyle.bg} ${serviceStyle.text}`}
                      >
                        <span>{serviceStyle.icon}</span>
                        {serviceStyle.label}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center justify-between pt-3 border-t border-border/20">
                <div>
                  <p className="text-xs text-muted-foreground/60">Retainer</p>
                  <p className="text-[13px] font-semibold text-foreground">
                    £{client.monthly_retainer.toLocaleString()}/mo
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground/60">Tasks</p>
                  <p className="text-[13px] font-semibold text-foreground">
                    {activeTasks} active · {completedTasks} done
                  </p>
                </div>
              </div>

              {/* Team Members */}
              <div className="mt-3 pt-3 border-t border-border/20">
                <div className="flex items-center gap-2">
                  <Users size={12} className="text-muted-foreground/60" />
                  <div className="flex -space-x-2">
                    {client.assigned_members.slice(0, 3).map((memberId) => {
                      const member = TEAM_MEMBERS.find(m => m.id === memberId);
                      if (!member) return null;
                      
                      return (
                        <div
                          key={memberId}
                          className="w-6 h-6 rounded-full bg-primary/20 border-2 border-card flex items-center justify-center"
                          title={member.name}
                        >
                          <span className="text-[9px] font-semibold text-primary">
                            {member.name.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                      );
                    })}
                    {client.assigned_members.length > 3 && (
                      <div className="w-6 h-6 rounded-full bg-muted/40 border-2 border-card flex items-center justify-center">
                        <span className="text-[9px] font-semibold text-muted-foreground">
                          +{client.assigned_members.length - 3}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {filteredClients.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users size={32} className="text-muted-foreground/30 mb-3" />
          <p className="text-[13px] font-medium text-muted-foreground">No clients found</p>
          <p className="text-[13px] text-muted-foreground/60 mt-1">Try adjusting your filters</p>
        </div>
      )}
    </div>
  );
}
