'use client';

import { CLIENTS, TEAM_MEMBERS } from '@/lib/data';
import { TEAM_STYLES } from '@/lib/constants';
import { DollarSign, TrendingUp, AlertCircle, Calendar } from 'lucide-react';

export default function XeroPage() {
  // Calculate revenue metrics
  const totalRevenue = CLIENTS.filter(c => c.status === 'active')
    .reduce((sum, c) => sum + c.monthly_retainer, 0);

  const revenueByTeam = (['synergy', 'ignite', 'alliance'] as const).map(team => {
    const teamClients = CLIENTS.filter(c => c.team === team && c.status === 'active');
    const revenue = teamClients.reduce((sum, c) => sum + c.monthly_retainer, 0);
    return {
      team,
      revenue,
      percentage: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0,
    };
  });

  // Mock billing data
  const billingData = CLIENTS.filter(c => c.status === 'active').map(client => ({
    id: client.id,
    name: client.name,
    retainer: client.monthly_retainer,
    lastInvoice: '1 Feb 2026',
    status: Math.random() > 0.2 ? 'paid' as const : Math.random() > 0.5 ? 'pending' as const : 'overdue' as const,
  }));

  // Revenue forecast (next 3 months)
  const forecast = [
    { month: 'March 2026', revenue: totalRevenue },
    { month: 'April 2026', revenue: totalRevenue * 1.05 }, // +5% growth
    { month: 'May 2026', revenue: totalRevenue * 1.1 }, // +10% growth
  ];

  // Mock trend data for chart (last 6 months)
  const trendData = [
    { month: 'Sep', revenue: totalRevenue * 0.75 },
    { month: 'Oct', revenue: totalRevenue * 0.82 },
    { month: 'Nov', revenue: totalRevenue * 0.88 },
    { month: 'Dec', revenue: totalRevenue * 0.92 },
    { month: 'Jan', revenue: totalRevenue * 0.96 },
    { month: 'Feb', revenue: totalRevenue },
  ];

  const maxRevenue = Math.max(...trendData.map(d => d.revenue));

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Xero Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Revenue overview and billing management
          </p>
          <p className="text-xs text-amber-400 mt-2 flex items-center gap-1.5">
            <AlertCircle size={12} />
            Mock data — Not connected to live Xero API
          </p>
        </div>
      </div>

      {/* Revenue Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="rounded-lg border border-border/20 bg-card px-5 py-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={14} className="text-emerald-400" />
            <p className="text-xs text-muted-foreground">Total Monthly Revenue</p>
          </div>
          <p className="text-2xl font-semibold text-foreground">
            £{totalRevenue.toLocaleString()}
          </p>
        </div>

        <div className="rounded-lg border border-border/20 bg-card px-5 py-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={14} className="text-blue-400" />
            <p className="text-xs text-muted-foreground">Active Clients</p>
          </div>
          <p className="text-2xl font-semibold text-foreground">
            {CLIENTS.filter(c => c.status === 'active').length}
          </p>
        </div>

        <div className="rounded-lg border border-border/20 bg-card px-5 py-4">
          <div className="flex items-center gap-2 mb-1">
            <Calendar size={14} className="text-purple-400" />
            <p className="text-xs text-muted-foreground">Avg Retainer</p>
          </div>
          <p className="text-2xl font-semibold text-foreground">
            £{Math.round(totalRevenue / CLIENTS.filter(c => c.status === 'active').length).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Chart + Revenue by Team */}
        <div className="lg:col-span-2 space-y-6">
          {/* Revenue Trend Chart */}
          <div className="rounded-lg border border-border/20 bg-card p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Revenue Trend</h3>
            <div className="h-64 flex items-end justify-between gap-3">
              {trendData.map((data, i) => {
                const height = (data.revenue / maxRevenue) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full flex items-end justify-center" style={{ height: '220px' }}>
                      <div
                        className="w-full rounded-t-md bg-gradient-to-t from-primary/80 to-primary transition-all duration-300 hover:from-primary hover:to-primary/90"
                        style={{ height: `${height}%` }}
                        title={`${data.month}: £${Math.round(data.revenue).toLocaleString()}`}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground/60">{data.month}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Revenue by Team */}
          <div className="rounded-lg border border-border/20 bg-card p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Revenue by Team</h3>
            <div className="space-y-3">
              {revenueByTeam.map(({ team, revenue, percentage }) => {
                const teamStyle = TEAM_STYLES[team];
                return (
                  <div key={team}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span 
                          className="inline-block h-2 w-2 rounded-full" 
                          style={{ backgroundColor: teamStyle.color }}
                        />
                        <span className="text-[13px] font-medium text-foreground">{teamStyle.label}</span>
                      </div>
                      <span className="text-[13px] font-semibold text-foreground">
                        £{revenue.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ 
                          width: `${percentage}%`,
                          backgroundColor: teamStyle.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Billing Table + Forecast */}
        <div className="space-y-6">
          {/* Billing Status */}
          <div className="rounded-lg border border-border/20 bg-card p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Billing Status</h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {billingData.map(bill => (
                <div 
                  key={bill.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-[13px] font-medium text-foreground truncate">{bill.name}</p>
                    <p className="text-xs text-muted-foreground/60">£{bill.retainer.toLocaleString()}/mo</p>
                  </div>
                  <span 
                    className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${
                      bill.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400' :
                      bill.status === 'pending' ? 'bg-amber-500/10 text-amber-400' :
                      'bg-red-500/10 text-red-400'
                    }`}
                  >
                    {bill.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Revenue Forecast */}
          <div className="rounded-lg border border-border/20 bg-card p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Forecast</h3>
            <p className="text-xs text-muted-foreground/60 mb-4">
              Projected revenue based on active retainers
            </p>
            <div className="space-y-3">
              {forecast.map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <span className="text-[13px] text-muted-foreground">{item.month}</span>
                  <span className="text-[13px] font-semibold text-foreground">
                    £{Math.round(item.revenue).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border/20">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-muted-foreground">Q1 Total</span>
                <span className="text-lg font-semibold text-emerald-400">
                  £{Math.round(forecast.reduce((sum, f) => sum + f.revenue, 0)).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
