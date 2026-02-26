'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { getServiceStyle, getAssigneeColor } from '@/lib/constants';
import { ForecastChart } from '@/components/forecast-chart';
import Link from 'next/link';
import { startOfMonth, addMonths, isWithinInterval, endOfMonth, differenceInDays } from 'date-fns';

interface ContractLineItem {
  id: string;
  client_id: string;
  service: string;
  monthly_value: number;
  is_active: boolean;
  billing_type: string;
  assignee_id: string | null;
  start_date: string | null;
  end_date: string | null;
}

interface Client {
  id: string;
  name: string;
}

interface MemberAssignment {
  clientId: string;
  clientName: string;
  service: string;
  amount: number;
  billingType: string;
}

interface MemberDrillDownSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  memberName: string;
  memberTeam: string;
  memberRole?: string;
  mode: 'currency' | 'percentage';
  capacityTarget?: number;
  capacityTargets?: Record<string, number>;
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export function MemberDrillDownSheet({
  open,
  onOpenChange,
  memberId,
  memberName,
  memberTeam,
  memberRole,
  mode,
  capacityTarget = 0,
  capacityTargets = {},
}: MemberDrillDownSheetProps) {
  const [assignments, setAssignments] = useState<MemberAssignment[]>([]);
  const [rawItems, setRawItems] = useState<ContractLineItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const fetchAssignments = async () => {
      setLoading(true);
      try {
        // Fetch all clients to build a name map
        const clientsRes = await fetch('/api/clients');
        const clients: Client[] = await clientsRes.json();
        if (cancelled) return;
        const clientMap = new Map(clients.map(c => [c.id, c.name]));

        // Fetch all contract line items
        const itemsPromises = clients.map(c =>
          fetch(`/api/clients/${c.id}/contracts`)
            .then(r => (r.ok ? r.json() : []))
            .catch(() => [])
        );
        const allItemsArrays = await Promise.all(itemsPromises);
        if (cancelled) return;
        const allItems: ContractLineItem[] = allItemsArrays.flat();

        // Filter items assigned to this member that are active (both recurring and project)
        const memberItems = allItems.filter(
          item =>
            item.assignee_id === memberId &&
            item.is_active
        );

        const mapped: MemberAssignment[] = memberItems.map(item => ({
          clientId: item.client_id,
          clientName: clientMap.get(item.client_id) || 'Unknown',
          service: item.service,
          amount: item.monthly_value || 0,
          billingType: item.billing_type,
        }));

        if (!cancelled) {
          setAssignments(mapped);
          setRawItems(memberItems);
        }
      } catch (error) {
        console.error('Failed to fetch assignments:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAssignments();
    return () => { cancelled = true; };
  }, [open, memberId]);

  const recurringAssignments = assignments.filter(a => a.billingType === 'recurring');
  const projectAssignments = assignments.filter(a => a.billingType === 'one-off');

  const recurringTotal = recurringAssignments.reduce((sum, a) => sum + a.amount, 0);
  const projectTotal = projectAssignments.reduce((sum, a) => sum + a.amount, 0);
  const total = recurringTotal + projectTotal;

  // Group by service for each type
  function groupByService(items: MemberAssignment[]) {
    const byService = items.reduce((acc, a) => {
      if (!acc[a.service]) acc[a.service] = [];
      acc[a.service].push(a);
      return acc;
    }, {} as Record<string, MemberAssignment[]>);

    return Object.entries(byService)
      .map(([service, clients]) => ({
        service,
        amount: clients.reduce((sum, i) => sum + i.amount, 0),
        clients,
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  const recurringBreakdown = groupByService(recurringAssignments);
  const projectBreakdown = groupByService(projectAssignments);

  // Calculate effective capacity target based on the member's role (single service)
  const ROLE_TO_SERVICE: Record<string, string> = {
    'Paid Ads Manager': 'Paid Advertising',
    'Social Media Manager': 'Social Media',
    'SEO': 'SEO',
    'Creative': 'Creative',
  };

  const memberServices = [...new Set(recurringAssignments.map(a => a.service))];
  let effectiveTarget = capacityTarget;
  if (Object.keys(capacityTargets).length > 0) {
    const roleService = memberRole ? ROLE_TO_SERVICE[memberRole] : undefined;
    if (roleService && capacityTargets[roleService]) {
      effectiveTarget = capacityTargets[roleService];
    } else {
      const matchedService = memberRole
        ? memberServices.find(svc =>
            memberRole.toLowerCase().includes(svc.toLowerCase()) || svc.toLowerCase().includes(memberRole.toLowerCase())
          )
        : undefined;
      if (matchedService) {
        effectiveTarget = capacityTargets[matchedService] || 0;
      } else if (memberServices.length === 1) {
        effectiveTarget = capacityTargets[memberServices[0]] || 0;
      } else {
        const primaryService = recurringBreakdown[0]?.service;
        effectiveTarget = primaryService ? (capacityTargets[primaryService] || 0) : 0;
      }
    }
  }
  const percentage = effectiveTarget > 0 ? (total / effectiveTarget) * 100 : 0;

  const colorClass = getAssigneeColor(memberName, memberTeam);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 animate-in fade-in duration-200"
        onClick={() => onOpenChange(false)}
      />

      {/* Sheet */}
      <div className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-card border-l border-border/20 z-50 flex flex-col animate-in slide-in-from-right duration-200 md:top-3 md:bottom-3 md:rounded-tl-2xl md:rounded-bl-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/10">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-bold ${colorClass}`}>
              {getInitials(memberName)}
            </div>
            <div>
              <h2 className="text-[15px] font-semibold">{memberName}</h2>
              <p className="text-[11px] text-muted-foreground/60 capitalize">{memberTeam} Team</p>
            </div>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-2 rounded-lg hover:bg-muted/60 transition-colors"
          >
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-muted/20 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {/* Total */}
              <div className="rounded-lg border border-border/20 bg-muted/10 p-4">
                <p className="text-[11px] text-muted-foreground/60 mb-2">
                  {mode === 'currency' ? 'Total Billing' : 'Capacity Usage'}
                </p>
                <div className="flex items-baseline gap-2">
                  <p className="text-[24px] font-bold">
                    {mode === 'currency'
                      ? `£${Math.round(total).toLocaleString()}/mo`
                      : `${Math.round(percentage)}%`}
                  </p>
                  {mode === 'currency' && effectiveTarget > 0 && (
                    <span className={`text-[14px] font-medium ${percentage < 80 ? 'text-emerald-500' : percentage <= 95 ? 'text-amber-500' : 'text-red-500'}`}>
                      {Math.round(percentage)}%
                    </span>
                  )}
                </div>
                {mode === 'currency' && effectiveTarget > 0 && (
                  <p className="text-[11px] text-muted-foreground/60 mt-1">
                    of £{Math.round(effectiveTarget).toLocaleString()} target
                  </p>
                )}
              </div>

              {/* 6-month forecast */}
              {rawItems.length > 0 && (
                <div className="py-1">
                  <ForecastChart
                    data={(() => {
                      const months = Array.from({ length: 6 }, (_, i) => addMonths(startOfMonth(new Date()), i));
                      return months.map(month => {
                        const monthEnd = endOfMonth(month);
                        const daysInMonth = differenceInDays(monthEnd, month) + 1;
                        let monthTotal = 0;
                        const svcMap = new Map<string, number>();
                        for (const item of rawItems) {
                          let amount = 0;
                          if (item.billing_type === 'recurring') {
                            // Active recurring: check if not expired
                            if (item.end_date && new Date(item.end_date) < month) continue;
                            if (item.start_date && new Date(item.start_date) > monthEnd) continue;
                            amount = item.monthly_value || 0;
                          } else {
                            // Project: pro-rata based on overlap
                            if (!item.start_date || !item.end_date) continue;
                            const pStart = new Date(item.start_date);
                            const pEnd = new Date(item.end_date);
                            if (pEnd < month || pStart > monthEnd) continue;
                            const overlapStart = pStart > month ? pStart : month;
                            const overlapEnd = pEnd < monthEnd ? pEnd : monthEnd;
                            const overlapDays = differenceInDays(overlapEnd, overlapStart) + 1;
                            const totalDays = differenceInDays(pEnd, pStart) + 1;
                            amount = totalDays > 0 ? ((item.monthly_value || 0) / totalDays) * overlapDays : 0;
                          }
                          monthTotal += amount;
                          svcMap.set(item.service, (svcMap.get(item.service) || 0) + amount);
                        }
                        return {
                          month,
                          total: mode === 'percentage' && effectiveTarget > 0 ? (monthTotal / effectiveTarget) * 100 : monthTotal,
                          breakdown: Array.from(svcMap.entries()).map(([service, amt]) => ({
                            service,
                            amount: mode === 'percentage' && effectiveTarget > 0 ? (amt / effectiveTarget) * 100 : amt,
                          })),
                        };
                      });
                    })()}
                    color="var(--primary)"
                    mode={mode}
                    capacityTarget={mode === 'currency' ? effectiveTarget : 100}
                    defaultExpanded
                  />
                </div>
              )}

              {/* Recurring breakdown */}
              {recurringBreakdown.length > 0 && (
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground/60 mb-2">
                    Recurring {mode === 'currency' && `· £${Math.round(recurringTotal).toLocaleString()}/mo`}
                  </p>
                  <div className="space-y-3">
                    {recurringBreakdown.map(({ service, amount, clients }) => {
                      const style = getServiceStyle(service);
                      const svcTarget = capacityTargets[service] || 0;
                      const svcPct = svcTarget > 0 ? (amount / svcTarget) * 100 : 0;
                      return (
                        <div key={service} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: style.dot }} />
                              <span className="text-[13px] font-medium">{style.label}</span>
                            </div>
                            <span className="text-[13px] font-bold flex items-center gap-1.5">
                              {mode === 'currency'
                                ? `£${Math.round(amount).toLocaleString()}`
                                : `${Math.round(svcPct)}%`}
                              {mode === 'currency' && svcTarget > 0 && (
                                <span className={`text-[10px] font-normal ${svcPct < 80 ? 'text-emerald-500' : svcPct <= 95 ? 'text-amber-500' : 'text-red-500'}`}>
                                  {Math.round(svcPct)}%
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="ml-4 space-y-0.5">
                            {clients.map((client, idx) => (
                              <Link key={idx} href={`/clients/${client.clientId}`}
                                className="flex items-center justify-between py-1 px-2 -mx-2 rounded hover:bg-muted/30 transition-colors group">
                                <span className="text-[12px] text-muted-foreground/60 group-hover:text-foreground transition-colors">{client.clientName}</span>
                                <span className="text-[11px] text-muted-foreground/40 group-hover:text-muted-foreground transition-colors">
                                  {mode === 'currency'
                                    ? `£${Math.round(client.amount).toLocaleString()}`
                                    : `${svcTarget > 0 ? Math.round((client.amount / svcTarget) * 100) : 0}%`}
                                  {mode === 'currency' && svcTarget > 0 && (
                                    <span className="ml-1 text-muted-foreground/30">{Math.round((client.amount / svcTarget) * 100)}%</span>
                                  )}
                                </span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Project breakdown */}
              {projectBreakdown.length > 0 && (
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground/60 mb-2">
                    Project {mode === 'currency' && `· £${Math.round(projectTotal).toLocaleString()}`}
                  </p>
                  <div className="space-y-3">
                    {projectBreakdown.map(({ service, amount, clients }) => {
                      const style = getServiceStyle(service);
                      return (
                        <div key={service} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: style.dot }} />
                              <span className="text-[13px] font-medium">{style.label}</span>
                            </div>
                            <span className="text-[13px] font-bold">
                              {mode === 'currency' ? `£${Math.round(amount).toLocaleString()}` : ''}
                            </span>
                          </div>
                          <div className="ml-4 space-y-0.5">
                            {clients.map((client, idx) => (
                              <Link key={idx} href={`/clients/${client.clientId}`}
                                className="flex items-center justify-between py-1 px-2 -mx-2 rounded hover:bg-muted/30 transition-colors group">
                                <span className="text-[12px] text-muted-foreground/60 group-hover:text-foreground transition-colors">{client.clientName}</span>
                                {mode === 'currency' && (
                                  <span className="text-[11px] text-muted-foreground/40 group-hover:text-muted-foreground transition-colors">
                                    £{Math.round(client.amount).toLocaleString()}
                                  </span>
                                )}
                              </Link>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {recurringBreakdown.length === 0 && projectBreakdown.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-[13px] text-muted-foreground/60">No assignments yet</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
