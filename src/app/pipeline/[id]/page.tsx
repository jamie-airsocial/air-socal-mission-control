'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Phone, Mail, Calendar, FileText, MessageSquare, Plus, Clock, ChevronRight, Trash2, User, Globe, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { PIPELINE_STAGES, getServiceStyle } from '@/lib/constants';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface Prospect {
  id: string;
  name: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  stage: string;
  value?: number;
  service?: string;
  source?: string;
  assignee?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  won_at?: string;
  lost_at?: string;
  lost_reason?: string;
}

interface Activity {
  id: string;
  prospect_id: string;
  type: 'call' | 'email' | 'meeting' | 'note' | 'stage_change' | 'created' | 'won' | 'lost';
  title: string;
  description?: string;
  from_stage?: string;
  to_stage?: string;
  created_by?: string;
  created_at: string;
}

const ACTIVITY_TYPES = [
  { value: 'call', label: 'Phone call', icon: Phone, color: '#60a5fa' },
  { value: 'email', label: 'Email', icon: Mail, color: '#34d399' },
  { value: 'meeting', label: 'Meeting', icon: Calendar, color: '#a78bfa' },
  { value: 'note', label: 'Note', icon: FileText, color: '#fbbf24' },
] as const;

function getActivityIcon(type: string) {
  switch (type) {
    case 'call': return { icon: Phone, color: '#60a5fa' };
    case 'email': return { icon: Mail, color: '#34d399' };
    case 'meeting': return { icon: Calendar, color: '#a78bfa' };
    case 'note': return { icon: FileText, color: '#fbbf24' };
    case 'stage_change': return { icon: ChevronRight, color: '#818cf8' };
    case 'created': return { icon: Plus, color: '#6b7280' };
    case 'won': return { icon: ChevronRight, color: '#34d399' };
    case 'lost': return { icon: ChevronRight, color: '#f87171' };
    default: return { icon: MessageSquare, color: '#6b7280' };
  }
}

function formatTimestamp(date: string) {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

export default function ProspectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [logOpen, setLogOpen] = useState(false);
  const [logType, setLogType] = useState<string>('call');
  const [logTitle, setLogTitle] = useState('');
  const [logDescription, setLogDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    const [pRes, aRes] = await Promise.all([
      fetch(`/api/prospects`).then(r => r.json()),
      fetch(`/api/prospects/${id}/activities`).then(r => r.json()),
    ]);
    const p = (pRes || []).find((pr: Prospect) => pr.id === id);
    setProspect(p || null);
    setActivities(aRes || []);
    setLoading(false);
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const logActivity = async () => {
    if (!logTitle.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/prospects/${id}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: logType, title: logTitle, description: logDescription || null }),
      });
      if (!res.ok) throw new Error();
      toast.success('Activity logged');
      setLogTitle('');
      setLogDescription('');
      setLogOpen(false);
      loadData();
    } catch {
      toast.error('Failed to log activity');
    } finally {
      setSaving(false);
    }
  };

  const updateStage = async (newStage: string) => {
    if (!prospect || prospect.stage === newStage) return;
    try {
      const res = await fetch('/api/prospects', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: prospect.id, stage: newStage }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Moved to ${newStage.charAt(0).toUpperCase() + newStage.slice(1)}`);
      loadData();
    } catch {
      toast.error('Failed to update stage');
    }
  };

  if (loading) return (
    <div className="animate-in fade-in duration-200 p-6">
      <div className="h-6 w-32 bg-muted/30 rounded animate-pulse mb-4" />
      <div className="h-8 w-64 bg-muted/30 rounded animate-pulse mb-2" />
      <div className="h-4 w-48 bg-muted/20 rounded animate-pulse" />
    </div>
  );

  if (!prospect) return (
    <div className="p-6 text-center">
      <p className="text-muted-foreground">Prospect not found</p>
      <Button variant="ghost" onClick={() => router.push('/pipeline')} className="mt-4">Back to pipeline</Button>
    </div>
  );

  const stageInfo = PIPELINE_STAGES.find(s => s.id === prospect.stage);
  const serviceStyle = prospect.service ? getServiceStyle(prospect.service) : null;

  return (
    <div className="animate-in fade-in duration-200">
      {/* Header */}
      <button onClick={() => router.push('/pipeline')} className="flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground transition-colors mb-4">
        <ArrowLeft size={14} /> Back
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{prospect.name}</h1>
          <div className="flex items-center gap-3 mt-1.5">
            {stageInfo && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border" style={{ borderColor: `${stageInfo.color}40`, color: stageInfo.color, backgroundColor: `${stageInfo.color}10` }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: stageInfo.color }} />
                {stageInfo.label}
              </span>
            )}
            {prospect.value && (
              <span className="text-[13px] text-muted-foreground">£{prospect.value.toLocaleString()}</span>
            )}
            {serviceStyle && (
              <span className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${serviceStyle.bg} ${serviceStyle.text}`}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: serviceStyle.dot }} />
                {serviceStyle.label}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Details + Stage */}
        <div className="space-y-4">
          {/* Contact info */}
          <div className="rounded-lg border border-border/20 bg-card p-4">
            <h3 className="text-[13px] font-semibold mb-3">Contact details</h3>
            <div className="space-y-2">
              {prospect.contact_name && (
                <div className="flex items-center gap-2 text-[13px]">
                  <User size={13} className="text-muted-foreground/60 shrink-0" />
                  <span>{prospect.contact_name}</span>
                </div>
              )}
              {prospect.contact_email && (
                <div className="flex items-center gap-2 text-[13px]">
                  <Mail size={13} className="text-muted-foreground/60 shrink-0" />
                  <a href={`mailto:${prospect.contact_email}`} className="text-primary hover:underline">{prospect.contact_email}</a>
                </div>
              )}
              {prospect.contact_phone && (
                <div className="flex items-center gap-2 text-[13px]">
                  <Phone size={13} className="text-muted-foreground/60 shrink-0" />
                  <a href={`tel:${prospect.contact_phone}`} className="text-primary hover:underline">{prospect.contact_phone}</a>
                </div>
              )}
              {prospect.source && (
                <div className="flex items-center gap-2 text-[13px]">
                  <Globe size={13} className="text-muted-foreground/60 shrink-0" />
                  <span className="text-muted-foreground">{prospect.source}</span>
                </div>
              )}
              {prospect.assignee && (
                <div className="flex items-center gap-2 text-[13px]">
                  <Building2 size={13} className="text-muted-foreground/60 shrink-0" />
                  <span className="text-muted-foreground">{prospect.assignee}</span>
                </div>
              )}
              {!prospect.contact_name && !prospect.contact_email && !prospect.contact_phone && (
                <p className="text-[13px] text-muted-foreground/40">No contact details</p>
              )}
            </div>
          </div>

          {/* Stage pipeline */}
          <div className="rounded-lg border border-border/20 bg-card p-4">
            <h3 className="text-[13px] font-semibold mb-3">Pipeline stage</h3>
            <div className="space-y-1">
              {PIPELINE_STAGES.map(stage => {
                const isActive = prospect.stage === stage.id;
                const isPast = PIPELINE_STAGES.findIndex(s => s.id === prospect.stage) > PIPELINE_STAGES.findIndex(s => s.id === stage.id);
                return (
                  <button
                    key={stage.id}
                    onClick={() => updateStage(stage.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-[13px] transition-all duration-150 ${
                      isActive ? 'bg-primary/10 text-primary font-medium' : isPast ? 'text-muted-foreground' : 'text-muted-foreground/60 hover:bg-muted/40'
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: isActive || isPast ? stage.color : 'var(--border)' }} />
                    {stage.label}
                    {isActive && <span className="ml-auto text-[10px] text-primary/60">Current</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          {prospect.notes && (
            <div className="rounded-lg border border-border/20 bg-card p-4">
              <h3 className="text-[13px] font-semibold mb-2">Notes</h3>
              <p className="text-[13px] text-muted-foreground whitespace-pre-wrap">{prospect.notes}</p>
            </div>
          )}

          {/* Timestamps */}
          <div className="rounded-lg border border-border/20 bg-card p-4">
            <h3 className="text-[13px] font-semibold mb-2">Timeline</h3>
            <div className="space-y-1 text-[12px] text-muted-foreground/60">
              <div className="flex items-center gap-2">
                <Clock size={11} /> Created {new Date(prospect.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
              {prospect.won_at && (
                <div className="flex items-center gap-2 text-emerald-400">
                  <Clock size={11} /> Won {new Date(prospect.won_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              )}
              {prospect.lost_at && (
                <div className="flex items-center gap-2 text-red-400">
                  <Clock size={11} /> Lost {new Date(prospect.lost_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {prospect.lost_reason && <span>— {prospect.lost_reason}</span>}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Activity feed */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-border/20 bg-card">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
              <h3 className="text-[13px] font-semibold">Activity</h3>
              <Popover open={logOpen} onOpenChange={setLogOpen}>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="outline" className="h-7 text-[12px]">
                    <Plus size={12} className="mr-1" /> Log activity
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-3" align="end">
                  <p className="text-[13px] font-semibold mb-3">Log activity</p>
                  <div className="space-y-3">
                    <div className="flex gap-1">
                      {ACTIVITY_TYPES.map(t => (
                        <button
                          key={t.value}
                          onClick={() => setLogType(t.value)}
                          className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors ${
                            logType === t.value ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/40'
                          }`}
                        >
                          <t.icon size={11} /> {t.label}
                        </button>
                      ))}
                    </div>
                    <input
                      value={logTitle}
                      onChange={e => setLogTitle(e.target.value)}
                      placeholder="Activity title..."
                      className="w-full h-8 px-3 text-[13px] bg-secondary border border-border/20 rounded-md outline-none focus:border-primary/50 placeholder:text-muted-foreground/60"
                    />
                    <textarea
                      value={logDescription}
                      onChange={e => setLogDescription(e.target.value)}
                      placeholder="Details (optional)..."
                      rows={3}
                      className="w-full px-3 py-2 text-[13px] bg-secondary border border-border/20 rounded-md outline-none focus:border-primary/50 placeholder:text-muted-foreground/60 resize-none"
                    />
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setLogOpen(false)} className="h-7 text-[12px]">Cancel</Button>
                      <Button size="sm" onClick={logActivity} disabled={saving} className="h-7 text-[12px]">{saving ? 'Saving...' : 'Log'}</Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Activity timeline */}
            <div className="divide-y divide-border/10">
              {activities.length === 0 ? (
                <div className="px-4 py-8 text-center text-[13px] text-muted-foreground/40">
                  No activity yet. Log your first interaction.
                </div>
              ) : activities.map(activity => {
                const { icon: Icon, color } = getActivityIcon(activity.type);
                return (
                  <div key={activity.id} className="flex gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                    <div className="shrink-0 mt-0.5">
                      <div className="h-7 w-7 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
                        <Icon size={13} style={{ color }} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-foreground">{activity.title}</span>
                        <span className="text-[11px] text-muted-foreground/40 shrink-0">{formatTimestamp(activity.created_at)}</span>
                      </div>
                      {activity.description && (
                        <p className="text-[12px] text-muted-foreground mt-0.5">{activity.description}</p>
                      )}
                      {activity.created_by && (
                        <span className="text-[11px] text-muted-foreground/40">by {activity.created_by}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
