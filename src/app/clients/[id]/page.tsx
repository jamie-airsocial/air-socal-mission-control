'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { TEAM_MEMBERS } from '@/lib/data';
import { TEAM_STYLES, SERVICE_STYLES, STATUS_STYLES, PRIORITY_STYLES } from '@/lib/constants';
import { formatDueDate, getDueDateColor } from '@/lib/date';
import { ArrowLeft, Tag, Calendar, FileText, BadgePoundSterling, Clock, Edit2, Check, X } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ServiceIcon } from '@/components/ui/service-icon';

interface Client {
  id: string;
  name: string;
  team: string;
  status: string;
  services: string[];
  monthly_retainer: number;
  assigned_members: string[];
  color: string | null;
  created_at: string;
  updated_at?: string;
  // Extended fields
  contract_value?: number;
  contract_start?: string;
  contract_end?: string;
  contract_renewal?: string;
  sale_source?: string;
  sold_by?: string;
  sale_closed_at?: string;
  notes?: string;
  signup_date?: string;
  churned_at?: string;
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

/** Services available for selection (account-management always included) */
const ALL_SERVICES = Object.entries(SERVICE_STYLES).map(([key, style]) => ({
  value: key,
  label: style.label,
}));

function monthsActive(from: string, to?: string): number {
  const start = new Date(from);
  const end = to ? new Date(to) : new Date();
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function EditableField({
  label,
  value,
  onSave,
  type = 'text',
  placeholder = '',
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const save = () => { onSave(draft); setEditing(false); };
  const cancel = () => { setDraft(value); setEditing(false); };

  return (
    <div>
      <p className="text-[11px] text-muted-foreground/60 mb-1">{label}</p>
      {editing ? (
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            type={type}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
            placeholder={placeholder}
            className="flex-1 h-7 px-2 text-[13px] bg-secondary border border-border/30 rounded outline-none focus:border-primary/50 transition-colors"
          />
          <button onClick={save} className="p-1 rounded hover:bg-emerald-500/10 text-emerald-400"><Check size={12} /></button>
          <button onClick={cancel} className="p-1 rounded hover:bg-muted/60 text-muted-foreground"><X size={12} /></button>
        </div>
      ) : (
        <div className="flex items-center gap-2 group">
          <p className="text-[13px]">{value || <span className="text-muted-foreground/40">{placeholder || 'Not set'}</span>}</p>
          <button
            onClick={() => { setDraft(value); setEditing(true); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted/60 text-muted-foreground/40 hover:text-muted-foreground"
          >
            <Edit2 size={10} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'service' | 'month'>('service');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'contract' | 'sale' | 'notes'>('overview');

  const fetchData = useCallback(async () => {
    try {
      const [clientRes, tasksRes] = await Promise.all([
        fetch(`/api/clients/${clientId}`).catch(() => fetch(`/api/clients`)),
        fetch(`/api/tasks`),
      ]);
      if (clientRes.ok) {
        const data = await clientRes.json();
        // Handle both single object (from [id] route) and array (fallback)
        if (Array.isArray(data)) {
          setClient(data.find((c: Client) => c.id === clientId) || null);
        } else {
          setClient(data);
        }
      }
      if (tasksRes.ok) {
        const allTasks = await tasksRes.json();
        setTasks(allTasks.filter((t: Task) => t.client_id === clientId));
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [clientId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const patchClient = useCallback(async (updates: Partial<Client>) => {
    if (!client) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setClient(updated);
      toast.success('Saved');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  }, [client, clientId]);

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
        <Link href="/clients" className="text-[13px] text-primary hover:underline mt-2">Back to clients</Link>
      </div>
    );
  }

  const teamStyle = TEAM_STYLES[client.team as keyof typeof TEAM_STYLES];
  const members = TEAM_MEMBERS.filter(m => (client.assigned_members || []).includes(m.id));
  const tenure = monthsActive(client.signup_date || client.created_at, client.churned_at);

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
      <div className="rounded-lg border border-border/20 bg-card p-6 mb-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">{client.name}</h1>
            <div className="flex items-center gap-3 flex-wrap">
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
              <span className="text-muted-foreground/30">·</span>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
                <Clock size={11} />
                {tenure === 1 ? '1 month' : `${tenure} months`} active
              </div>
            </div>
          </div>
          <div className="text-right">
            {client.monthly_retainer > 0 && (
              <div className="mb-1">
                <p className="text-[11px] text-muted-foreground/60">Monthly Retainer</p>
                <p className="text-xl font-semibold">£{client.monthly_retainer.toLocaleString()}</p>
              </div>
            )}
            {saving && <p className="text-[11px] text-muted-foreground/40">Saving…</p>}
          </div>
        </div>

        {/* Services */}
        {(client.services || []).length > 0 && (
          <div className="mb-4">
            <p className="text-[11px] text-muted-foreground/60 mb-2">Services</p>
            <div className="flex flex-wrap gap-2">
              {client.services.map((service) => {
                const s = SERVICE_STYLES[service];
                if (!s) return null;
                return (
                  <span key={service} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] font-medium ${s.bg} ${s.text}`}>
                    <ServiceIcon serviceKey={service} size={12} /> {s.label}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Team members */}
        {members.length > 0 && (
          <div>
            <p className="text-[11px] text-muted-foreground/60 mb-2">Team</p>
            <div className="flex items-center gap-3 flex-wrap">
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

      {/* Detail tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-border/20">
        {([ 
          { id: 'overview', label: 'Overview', icon: <Tag size={13} /> },
          { id: 'contract', label: 'Contract', icon: <FileText size={13} /> },
          { id: 'sale', label: 'Sale Details', icon: <BadgePoundSterling size={13} /> },
          { id: 'notes', label: 'Notes', icon: <Edit2 size={13} /> },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors duration-150 ${
              activeTab === tab.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Overview → Tasks */}
      {activeTab === 'overview' && (
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
      )}

      {/* Tab: Contract */}
      {activeTab === 'contract' && (
        <div className="rounded-lg border border-border/20 bg-card p-6">
          <h2 className="text-[13px] font-semibold mb-4">Contract Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <EditableField
              label="Contract Value (£)"
              value={client.contract_value ? String(client.contract_value) : ''}
              onSave={v => patchClient({ contract_value: v ? parseFloat(v) : undefined })}
              type="number"
              placeholder="e.g. 12000"
            />
            <EditableField
              label="Start Date"
              value={client.contract_start ? client.contract_start.split('T')[0] : ''}
              onSave={v => patchClient({ contract_start: v || undefined })}
              type="date"
            />
            <EditableField
              label="End Date"
              value={client.contract_end ? client.contract_end.split('T')[0] : ''}
              onSave={v => patchClient({ contract_end: v || undefined })}
              type="date"
            />
            <EditableField
              label="Renewal Date"
              value={client.contract_renewal ? client.contract_renewal.split('T')[0] : ''}
              onSave={v => patchClient({ contract_renewal: v || undefined })}
              type="date"
            />
            <EditableField
              label="Sign-up Date"
              value={client.signup_date ? client.signup_date.split('T')[0] : ''}
              onSave={v => patchClient({ signup_date: v || undefined })}
              type="date"
              placeholder="YYYY-MM-DD"
            />
            <div>
              <p className="text-[11px] text-muted-foreground/60 mb-1">Status</p>
              <select
                value={client.status}
                onChange={e => patchClient({ status: e.target.value })}
                className="h-8 px-2 text-[13px] bg-secondary border border-border/20 rounded-lg outline-none"
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="churned">Churned</option>
              </select>
            </div>
            {client.status === 'churned' && (
              <EditableField
                label="Churn Date"
                value={client.churned_at ? client.churned_at.split('T')[0] : ''}
                onSave={v => patchClient({ churned_at: v || undefined })}
                type="date"
                placeholder="YYYY-MM-DD"
              />
            )}
          </div>

          {/* Services editor */}
          <div className="mt-5 pt-5 border-t border-border/10">
            <p className="text-[11px] text-muted-foreground/60 mb-2">Services</p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_SERVICES.map(s => {
                const active = (client.services || []).includes(s.value);
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => {
                      const current = client.services || [];
                      const next = active ? current.filter(x => x !== s.value) : [...current, s.value];
                      patchClient({ services: next });
                    }}
                    className={`h-7 px-2.5 text-[11px] rounded-md border transition-colors duration-150 flex items-center gap-1 ${
                      active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/20 bg-secondary text-muted-foreground hover:border-primary/40'
                    }`}
                  >
                    {active && <Check size={10} />}
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Sale Details */}
      {activeTab === 'sale' && (
        <div className="rounded-lg border border-border/20 bg-card p-6">
          <h2 className="text-[13px] font-semibold mb-4">Sale Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <EditableField
              label="How We Won Them"
              value={client.sale_source || ''}
              onSave={v => patchClient({ sale_source: v || undefined })}
              placeholder="e.g. Referral, LinkedIn, Cold outreach"
            />
            <EditableField
              label="Sold By"
              value={client.sold_by || ''}
              onSave={v => patchClient({ sold_by: v || undefined })}
              placeholder="e.g. Jamie Ludlow"
            />
            <EditableField
              label="Date Closed"
              value={client.sale_closed_at ? client.sale_closed_at.split('T')[0] : ''}
              onSave={v => patchClient({ sale_closed_at: v || undefined })}
              type="date"
            />
          </div>
        </div>
      )}

      {/* Tab: Notes */}
      {activeTab === 'notes' && (
        <div className="rounded-lg border border-border/20 bg-card p-6">
          <h2 className="text-[13px] font-semibold mb-4">Notes</h2>
          <NotesEditor
            value={client.notes || ''}
            onSave={v => patchClient({ notes: v })}
          />
        </div>
      )}
    </div>
  );
}

function NotesEditor({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [changed, setChanged] = useState(false);

  const handleChange = (v: string) => { setDraft(v); setChanged(v !== value); };

  return (
    <div className="space-y-3">
      <textarea
        value={draft}
        onChange={e => handleChange(e.target.value)}
        placeholder="Add notes about this client..."
        rows={8}
        className="w-full p-3 text-[13px] bg-secondary border border-border/20 rounded-lg outline-none focus:border-primary/50 transition-colors duration-150 resize-y"
      />
      {changed && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSave(draft)}
            className="h-7 px-3 text-[13px] bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Save notes
          </button>
          <button
            onClick={() => { setDraft(value); setChanged(false); }}
            className="h-7 px-3 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
