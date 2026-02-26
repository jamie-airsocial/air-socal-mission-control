'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { getServiceStyle, getAssigneeColor } from '@/lib/constants';
import Link from 'next/link';

interface ContractLineItem {
  id: string;
  client_id: string;
  service: string;
  monthly_value: number;
  is_active: boolean;
  billing_type: string;
  assignee_id: string | null;
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
  mode: 'currency' | 'percentage';
  capacityTarget?: number;
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
  mode,
  capacityTarget = 0,
}: MemberDrillDownSheetProps) {
  const [assignments, setAssignments] = useState<MemberAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;

    const fetchAssignments = async () => {
      setLoading(true);
      try {
        // Fetch all clients to build a name map
        const clientsRes = await fetch('/api/clients');
        const clients: Client[] = await clientsRes.json();
        const clientMap = new Map(clients.map(c => [c.id, c.name]));

        // Fetch all contract line items
        const itemsPromises = clients.map(c =>
          fetch(`/api/clients/${c.id}/contracts`)
            .then(r => (r.ok ? r.json() : []))
            .catch(() => [])
        );
        const allItemsArrays = await Promise.all(itemsPromises);
        const allItems: ContractLineItem[] = allItemsArrays.flat();

        // Filter items assigned to this member that are active and recurring
        const memberItems = allItems.filter(
          item =>
            item.assignee_id === memberId &&
            item.is_active &&
            item.billing_type === 'recurring'
        );

        const mapped: MemberAssignment[] = memberItems.map(item => ({
          clientId: item.client_id,
          clientName: clientMap.get(item.client_id) || 'Unknown',
          service: item.service,
          amount: item.monthly_value || 0,
          billingType: item.billing_type,
        }));

        setAssignments(mapped);
      } catch (error) {
        console.error('Failed to fetch assignments:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAssignments();
  }, [open, memberId]);

  const total = assignments.reduce((sum, a) => sum + a.amount, 0);
  const percentage = capacityTarget > 0 ? (total / capacityTarget) * 100 : 0;

  // Group by service
  const byService = assignments.reduce((acc, a) => {
    if (!acc[a.service]) acc[a.service] = [];
    acc[a.service].push(a);
    return acc;
  }, {} as Record<string, MemberAssignment[]>);

  const serviceBreakdown = Object.entries(byService)
    .map(([service, items]) => ({
      service,
      amount: items.reduce((sum, i) => sum + i.amount, 0),
      clients: items,
    }))
    .sort((a, b) => b.amount - a.amount);

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
      <div className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-card border-l border-border/20 z-50 flex flex-col animate-in slide-in-from-right duration-200">
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
                <p className="text-[24px] font-bold">
                  {mode === 'currency'
                    ? `£${Math.round(total).toLocaleString()}/mo`
                    : `${Math.round(percentage)}%`}
                </p>
                {mode === 'percentage' && capacityTarget > 0 && (
                  <p className="text-[11px] text-muted-foreground/60 mt-1">
                    £{Math.round(total).toLocaleString()} / £{Math.round(capacityTarget).toLocaleString()}
                  </p>
                )}
              </div>

              {/* Service breakdown */}
              {serviceBreakdown.length > 0 ? (
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground/60 mb-2">
                    By Service
                  </p>
                  <div className="space-y-3">
                    {serviceBreakdown.map(({ service, amount, clients }) => {
                      const style = getServiceStyle(service);
                      return (
                        <div key={service} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="h-2 w-2 rounded-full shrink-0"
                                style={{ backgroundColor: style.dot }}
                              />
                              <span className="text-[13px] font-medium">{style.label}</span>
                            </div>
                            <span className="text-[13px] font-bold">
                              {mode === 'currency'
                                ? `£${Math.round(amount).toLocaleString()}`
                                : `${capacityTarget > 0 ? Math.round((amount / capacityTarget) * 100) : 0}%`}
                            </span>
                          </div>
                          <div className="ml-4 space-y-0.5">
                            {clients.map((client, idx) => (
                              <Link
                                key={idx}
                                href={`/clients/${client.clientId}`}
                                className="flex items-center justify-between py-1 px-2 -mx-2 rounded hover:bg-muted/30 transition-colors group"
                              >
                                <span className="text-[12px] text-muted-foreground/60 group-hover:text-foreground transition-colors">
                                  {client.clientName}
                                </span>
                                <span className="text-[11px] text-muted-foreground/40 group-hover:text-muted-foreground transition-colors">
                                  {mode === 'currency'
                                    ? `£${Math.round(client.amount).toLocaleString()}`
                                    : `${capacityTarget > 0 ? Math.round((client.amount / capacityTarget) * 100) : 0}%`}
                                </span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
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
