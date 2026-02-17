'use client';

import { useEffect, useState } from 'react';
import { TEAM_STYLES } from '@/lib/constants';
import { DollarSign, TrendingUp, Users, AlertCircle } from 'lucide-react';

interface Client {
  id: string;
  name: string;
  team: string;
  status: string;
  monthly_retainer: number;
}

export default function XeroPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/clients')
      .then(r => r.json())
      .then(data => setClients(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const activeClients = clients.filter(c => c.status === 'active');
  const totalRevenue = activeClients.reduce((sum, c) => sum + (c.monthly_retainer || 0), 0);
  const avgRetainer = activeClients.length > 0 ? Math.round(totalRevenue / activeClients.length) : 0;

  const revenueByTeam = (['synergy', 'ignite', 'alliance'] as const).map(team => {
    const teamClients = activeClients.filter(c => c.team === team);
    const revenue = teamClients.reduce((sum, c) => sum + (c.monthly_retainer || 0), 0);
    return { team, revenue, count: teamClients.length };
  });

  const maxTeamRevenue = Math.max(...revenueByTeam.map(t => t.revenue), 1);

  if (loading) {
    return (
      <div className="animate-in fade-in duration-200">
        <div className="mb-6">
          <div className="h-8 w-48 bg-muted/30 rounded animate-pulse" />
          <div className="h-4 w-64 bg-muted/20 rounded animate-pulse mt-2" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted/20 rounded-lg animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-200">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Xero</h1>
        <p className="text-[13px] text-muted-foreground/60 mt-1">Revenue overview</p>
        <p className="text-[11px] text-amber-400/60 mt-2 flex items-center gap-1">
          <AlertCircle size={10} />
          Not connected to Xero — showing retainer data from clients
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="p-4 rounded-lg border border-border/20 bg-card">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={14} className="text-emerald-400" />
            <span className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">Monthly Revenue</span>
          </div>
          <p className="text-2xl font-bold text-emerald-400">£{totalRevenue.toLocaleString()}</p>
        </div>
        <div className="p-4 rounded-lg border border-border/20 bg-card">
          <div className="flex items-center gap-2 mb-2">
            <Users size={14} className="text-blue-400" />
            <span className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">Active Clients</span>
          </div>
          <p className="text-2xl font-bold text-blue-400">{activeClients.length}</p>
        </div>
        <div className="p-4 rounded-lg border border-border/20 bg-card">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-purple-400" />
            <span className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">Avg Retainer</span>
          </div>
          <p className="text-2xl font-bold text-purple-400">£{avgRetainer.toLocaleString()}</p>
        </div>
      </div>

      {/* Revenue by Team */}
      <div className="p-4 rounded-lg border border-border/20 bg-card mb-6">
        <h3 className="text-[13px] font-semibold mb-4">Revenue by Team</h3>
        <div className="space-y-3">
          {revenueByTeam.map(({ team, revenue, count }) => {
            const style = TEAM_STYLES[team];
            const pct = Math.max((revenue / maxTeamRevenue) * 100, 4);
            return (
              <div key={team}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: style.color }} />
                    <span className="text-[13px] font-medium">{style.label}</span>
                    <span className="text-[11px] text-muted-foreground/40">{count} clients</span>
                  </div>
                  <span className="text-[13px] font-semibold">£{revenue.toLocaleString()}</span>
                </div>
                <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: style.color, opacity: 0.7 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Client Revenue Table */}
      <div className="rounded-lg border border-border/20 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/20 bg-muted/30">
              {['Client', 'Team', 'Monthly Retainer'].map(h => (
                <th key={h} className="text-left text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider px-3 py-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeClients.length === 0 ? (
              <tr><td colSpan={3} className="text-center py-8 text-[13px] text-muted-foreground/40">No active clients</td></tr>
            ) : activeClients.map(c => {
              const style = c.team && TEAM_STYLES[c.team as keyof typeof TEAM_STYLES];
              return (
                <tr key={c.id} className="border-b border-border/10 hover:bg-muted/20 transition-colors duration-150">
                  <td className="px-3 py-2.5 text-[13px] font-medium">{c.name}</td>
                  <td className="px-3 py-2.5">
                    {style ? (
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${style.bg} ${style.text}`}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: style.color }} />
                        {style.label}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-[13px] font-medium">
                    {c.monthly_retainer ? `£${c.monthly_retainer.toLocaleString()}/mo` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
