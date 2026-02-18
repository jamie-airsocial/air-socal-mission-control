'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import {
  Plus, Search, X, Phone, Mail, Building2, TrendingUp, ChevronDown, Check,
  BarChart3, Table2, Kanban, PoundSterling, Percent, Trophy, UserPlus, Trash2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useUsers } from '@/hooks/use-users';
import { DatePicker } from '@/components/ui/date-picker';
import { ServiceIcon } from '@/components/ui/service-icon';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { SERVICE_STYLES, PIPELINE_STAGES, LOSS_REASONS } from '@/lib/constants';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { ShortcutsDialog } from '@/components/ui/shortcuts-dialog';
import { usePersistedState } from '@/hooks/use-persisted-state';
import { FilterPopover } from '@/components/ui/filter-popover';

// ── Types ────────────────────────────────────────────────────────────────────
interface Prospect {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  stage: string;
  value: number | null;
  notes: string | null;
  service: string | null;
  assignee: string | null;
  source: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  lost_reason: string | null;
  lost_reason_custom: string | null;
  team: string | null;
  won_at: string | null;
  lost_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ProspectFormState {
  name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  value: string;
  service: string;
  source: string;
  stage: string;
  assignee: string;
  notes: string;
  lost_reason: string | null;
  lost_reason_custom: string | null;
}

type ViewMode = 'pipeline' | 'table' | 'stats';

const emptyProspectForm: ProspectFormState = {
  name: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  value: '',
  service: '',
  source: '',
  stage: 'lead',
  assignee: '',
  notes: '',
  lost_reason: null,
  lost_reason_custom: null,
};

// ── Prospect Sheet ───────────────────────────────────────────────────────────
function ProspectSheet({
  open,
  onOpenChange,
  editProspect,
  defaultStage,
  users,
  onSaved,
  onDelete,
  onConvert,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editProspect: Prospect | null;
  defaultStage?: string;
  users: Array<{ id: string; full_name: string; is_active: boolean }>;
  onSaved: () => void;
  onDelete?: () => void;
  onConvert?: () => void;
}) {
  const [form, setForm] = useState<ProspectFormState>(emptyProspectForm);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);

  // Line items
  interface LineItem { id: string; service: string; description: string | null; monthly_value: number; billing_type: 'recurring' | 'one-off'; duration_months: number | null; }
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState<{ service: string; monthly_value: string; billing_type: 'recurring' | 'one-off'; duration_months: string }>({ service: '', monthly_value: '', billing_type: 'recurring', duration_months: '' });

  const fetchLineItems = useCallback(async (prospectId: string) => {
    try {
      const res = await fetch(`/api/prospects/${prospectId}/line-items`);
      if (res.ok) setLineItems(await res.json());
    } catch { /* silent */ }
  }, []);

  const addLineItem = async () => {
    if (!editProspect || !newItem.service.trim()) return;
    const res = await fetch(`/api/prospects/${editProspect.id}/line-items`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service: newItem.service.trim(),
        monthly_value: parseFloat(newItem.monthly_value) || 0,
        billing_type: newItem.billing_type,
        duration_months: newItem.duration_months ? parseInt(newItem.duration_months) : null,
      }),
    });
    if (res.ok) {
      await fetchLineItems(editProspect.id);
      setNewItem({ service: '', monthly_value: '', billing_type: 'recurring', duration_months: '' });
      setShowAddItem(false);
    }
  };

  const deleteLineItem = async (itemId: string) => {
    if (!editProspect) return;
    await fetch(`/api/prospect-line-items/${itemId}`, { method: 'DELETE' });
    await fetchLineItems(editProspect.id);
  };

  const lineItemsTotal = lineItems.reduce((s, i) => s + (i.monthly_value || 0), 0);
  const recurringTotal = lineItems.filter(i => i.billing_type !== 'one-off').reduce((s, i) => s + (i.monthly_value || 0), 0);
  const oneOffTotal = lineItems.filter(i => i.billing_type === 'one-off').reduce((s, i) => s + (i.monthly_value || 0), 0);

  useEffect(() => {
    if (open) {
      setConfirmDelete(false);
      setLineItems([]);
      setShowAddItem(false);
      if (editProspect) {
        fetchLineItems(editProspect.id);
        setForm({
          name: editProspect.name || '',
          contact_name: editProspect.contact_name || '',
          contact_email: editProspect.contact_email || '',
          contact_phone: editProspect.contact_phone || '',
          value: editProspect.value != null ? String(editProspect.value) : '',
          service: editProspect.service || '',
          source: editProspect.source || '',
          stage: editProspect.stage || 'lead',
          assignee: editProspect.assignee || '',
          notes: editProspect.notes || '',
          lost_reason: editProspect.lost_reason || null,
          lost_reason_custom: editProspect.lost_reason_custom || null,
        });
      } else {
        setForm({ ...emptyProspectForm, stage: defaultStage || 'lead' });
      }
    }
  }, [open, editProspect, defaultStage]);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Company name is required'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        contact_name: form.contact_name.trim() || null,
        contact_email: form.contact_email.trim() || null,
        contact_phone: form.contact_phone.trim() || null,
        value: form.value ? parseFloat(form.value) : null,
        service: form.service || null,
        source: form.source.trim() || null,
        stage: form.stage,
        assignee: form.assignee || null,
        notes: form.notes.trim() || null,
        lost_reason: form.stage === 'lost' ? (form.lost_reason || null) : null,
        lost_reason_custom: form.stage === 'lost' ? (form.lost_reason_custom || null) : null,
      };

      if (editProspect) {
        const res = await fetch('/api/prospects', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editProspect.id, ...payload }),
        });
        if (!res.ok) { toast.error('Failed to update prospect'); return; }

        // Handle stage transitions
        if (payload.stage === 'won' && editProspect.stage !== 'won') {
          setTimeout(() => confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } }), 200);
          toast.success('🎉 Deal won!');
        } else {
          toast.success(`${form.name} updated`);
        }
      } else {
        const res = await fetch('/api/prospects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) { toast.error('Failed to create prospect'); return; }
        toast.success('Prospect added to pipeline');
      }

      onOpenChange(false);
      onSaved();
    } catch { toast.error('Something went wrong'); }
    finally { setSaving(false); }
  };

  const activeUsers = users.filter(u => u.is_active);
  const currentStage = PIPELINE_STAGES.find(s => s.id === form.stage);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="px-6 py-5 border-b border-border/20">
          <SheetTitle className="text-[15px] truncate">
            {editProspect ? editProspect.name : 'New Prospect'}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Won banner */}
          {editProspect?.stage === 'won' && onConvert && (
            <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[13px] font-semibold text-emerald-400">🎉 Deal Won!</p>
                  <p className="text-[12px] text-muted-foreground/60 mt-0.5">Ready to onboard this client?</p>
                </div>
                <Button
                  size="sm"
                  onClick={onConvert}
                  className="h-8 text-[13px] gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white shrink-0"
                >
                  <UserPlus size={14} />
                  Convert to Client
                </Button>
              </div>
            </div>
          )}

          {/* Lost reason — editable */}
          {form.stage === 'lost' && (
            <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10 space-y-2">
              <span className="text-[11px] font-medium text-red-400 uppercase tracking-wider">Lost Reason</span>
              <select
                value={form.lost_reason || ''}
                onChange={e => setForm(f => ({ ...f, lost_reason: e.target.value || null }))}
                className="w-full h-8 px-2 text-[13px] bg-secondary border border-border/20 rounded-lg outline-none"
              >
                <option value="">No reason selected</option>
                {LOSS_REASONS.map(r => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
              {form.lost_reason === 'other' && (
                <Input
                  value={form.lost_reason_custom || ''}
                  onChange={e => setForm(f => ({ ...f, lost_reason_custom: e.target.value }))}
                  placeholder="Custom reason..."
                  className="h-8 text-[13px] bg-secondary border-border/20"
                />
              )}
            </div>
          )}

          {/* Company Name */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wide">
              Company Name *
            </Label>
            <Input
              autoFocus={!editProspect}
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Acme Ltd"
              className="text-[13px] h-9"
            />
          </div>

          {/* Contact Name */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wide">Contact Name</Label>
            <Input
              value={form.contact_name}
              onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
              placeholder="Jane Smith"
              className="text-[13px] h-9"
            />
          </div>

          {/* Contact Email */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wide">Contact Email</Label>
            <Input
              type="email"
              value={form.contact_email}
              onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))}
              placeholder="jane@company.com"
              className="text-[13px] h-9"
            />
          </div>

          {/* Contact Phone */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wide">Contact Phone</Label>
            <Input
              type="tel"
              value={form.contact_phone}
              onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))}
              placeholder="07xxx xxxxxx"
              className="text-[13px] h-9"
            />
          </div>

          {/* Services & Pricing (Line Items) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wide">Services & Pricing</Label>
              {lineItemsTotal > 0 && (
                <span className="text-[13px] font-semibold text-emerald-400">
                  £{lineItemsTotal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              )}
            </div>

            {/* Existing line items */}
            {lineItems.length > 0 && (
              <div className="space-y-1.5">
                {lineItems.map(item => (
                  <div key={item.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-border/20 bg-muted/20">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium truncate">{item.service}</p>
                      <p className="text-[11px] text-muted-foreground/60">
                        <span className={item.billing_type === 'one-off' ? 'text-amber-400' : 'text-emerald-400'}>
                          £{(item.monthly_value || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                        </span>
                        {item.billing_type === 'recurring' ? '/mo' : ' one-off'}
                        {item.duration_months && ` · ${item.duration_months}mo`}
                      </p>
                    </div>
                    <button onClick={() => deleteLineItem(item.id)}
                      className="p-1 rounded hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive transition-colors">
                      <X size={12} />
                    </button>
                  </div>
                ))}
                {recurringTotal > 0 && oneOffTotal > 0 && (
                  <div className="flex items-center gap-3 px-2.5 text-[11px] text-muted-foreground/60">
                    <span>Recurring: <span className="text-emerald-400">£{recurringTotal.toLocaleString('en-GB', { minimumFractionDigits: 2 })}/mo</span></span>
                    <span>One-off: <span className="text-amber-400">£{oneOffTotal.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span></span>
                  </div>
                )}
              </div>
            )}

            {/* Add new line item form */}
            {showAddItem ? (
              <div className="space-y-2 p-2.5 rounded-lg border border-border/20 bg-muted/10">
                <Input
                  autoFocus
                  value={newItem.service}
                  onChange={e => setNewItem(prev => ({ ...prev, service: e.target.value }))}
                  placeholder="Service name (e.g. Paid Advertising)"
                  className="h-8 text-[13px] bg-secondary border-border/20"
                />
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">£</span>
                    <Input
                      type="number" min="0" step="0.01"
                      value={newItem.monthly_value}
                      onChange={e => setNewItem(prev => ({ ...prev, monthly_value: e.target.value }))}
                      placeholder="0.00"
                      className="h-8 pl-5 text-[13px] bg-secondary border-border/20"
                    />
                  </div>
                  <div className="flex items-center rounded-md border border-border/20 bg-secondary p-0.5">
                    {(['recurring', 'one-off'] as const).map(bt => (
                      <button key={bt} type="button"
                        onClick={() => setNewItem(prev => ({ ...prev, billing_type: bt }))}
                        className={`h-6 px-2 rounded text-[11px] font-medium transition-all ${
                          newItem.billing_type === bt ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                        }`}
                      >
                        {bt === 'recurring' ? 'Monthly' : 'One-off'}
                      </button>
                    ))}
                  </div>
                </div>
                {newItem.billing_type === 'one-off' && (
                  <Input
                    type="number" min="1"
                    value={newItem.duration_months}
                    onChange={e => setNewItem(prev => ({ ...prev, duration_months: e.target.value }))}
                    placeholder="Duration (months)"
                    className="h-8 text-[13px] bg-secondary border-border/20"
                  />
                )}
                <div className="flex items-center gap-1.5">
                  <button onClick={addLineItem}
                    className="h-7 px-2.5 text-[11px] font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                    Add
                  </button>
                  <button onClick={() => { setShowAddItem(false); setNewItem({ service: '', monthly_value: '', billing_type: 'recurring', duration_months: '' }); }}
                    className="h-7 px-2.5 text-[11px] rounded-md text-muted-foreground hover:text-foreground transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddItem(true)}
                className="w-full h-8 px-3 text-[11px] rounded-lg border border-dashed border-border/30 text-muted-foreground/60 hover:border-primary/40 hover:text-muted-foreground transition-colors flex items-center justify-center gap-1"
              >
                <Plus size={12} /> Add service
              </button>
            )}

            {/* Legacy single value for backwards compat - hidden if line items exist */}
            {lineItems.length === 0 && editProspect && (
              <div className="space-y-1.5 pt-1">
                <Label className="text-[11px] font-medium text-muted-foreground/40 uppercase tracking-wide">Overall Deal Value (£)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">£</span>
                  <Input
                    type="number"
                    value={form.value}
                    onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                    placeholder="0"
                    className="pl-7 text-[13px] h-9"
                  />
                </div>
              </div>
            )}
            {!editProspect && (
              <div className="space-y-1.5 pt-1">
                <Label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wide">Deal Value (£)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">£</span>
                  <Input
                    type="number"
                    value={form.value}
                    onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                    placeholder="0"
                    className="pl-7 text-[13px] h-9"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Source */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wide">Source</Label>
            <Input
              value={form.source}
              onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
              placeholder="e.g. Referral, LinkedIn, Website"
              className="text-[13px] h-9"
            />
          </div>

          {/* Stage */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wide">Stage</Label>
            <Popover open={stageOpen} onOpenChange={setStageOpen}>
              <PopoverTrigger asChild>
                <button className="w-full h-9 px-3 text-[13px] rounded-md border border-border/20 bg-secondary flex items-center gap-1.5 hover:border-border/40 transition-colors">
                  {currentStage ? (
                    <>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${currentStage.dotClass}`} />
                      <span className="flex-1 text-left">{currentStage.label}</span>
                    </>
                  ) : (
                    <span className="flex-1 text-left text-muted-foreground/40">Select stage…</span>
                  )}
                  <ChevronDown size={14} className="text-muted-foreground/60 shrink-0" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-44 p-1" align="start">
                {PIPELINE_STAGES.map(s => (
                  <button
                    key={s.id}
                    onClick={() => { setForm(f => ({ ...f, stage: s.id })); setStageOpen(false); }}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[13px] transition-colors ${
                      form.stage === s.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted/60 text-muted-foreground'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${s.dotClass}`} />
                    <span className="flex-1 text-left">{s.label}</span>
                    {form.stage === s.id && <Check size={12} />}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </div>

          {/* Assignee */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wide">Assignee</Label>
            <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
              <PopoverTrigger asChild>
                <button className="w-full h-9 px-3 text-[13px] rounded-md border border-border/20 bg-secondary flex items-center justify-between hover:border-border/40 transition-colors">
                  {form.assignee ? (
                    <span>{form.assignee}</span>
                  ) : (
                    <span className="text-muted-foreground/40">Select assignee…</span>
                  )}
                  <ChevronDown size={14} className="text-muted-foreground/60" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-1 max-h-56 overflow-y-auto" align="start">
                {activeUsers.map(u => (
                  <button
                    key={u.id}
                    onClick={() => { setForm(f => ({ ...f, assignee: u.full_name })); setAssigneeOpen(false); }}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[13px] transition-colors ${
                      form.assignee === u.full_name ? 'bg-primary/10 text-primary' : 'hover:bg-muted/60 text-muted-foreground'
                    }`}
                  >
                    <span className="flex-1 text-left">{u.full_name}</span>
                    {form.assignee === u.full_name && <Check size={12} />}
                  </button>
                ))}
                {form.assignee && (
                  <button
                    onClick={() => { setForm(f => ({ ...f, assignee: '' })); setAssigneeOpen(false); }}
                    className="w-full mt-1 pt-1 border-t border-border/10 px-2 py-1.5 rounded text-[13px] text-muted-foreground/60 hover:text-foreground transition-colors text-left"
                  >
                    Clear
                  </button>
                )}
              </PopoverContent>
            </Popover>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wide">Notes</Label>
            <Textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Any notes about this prospect…"
              className="text-[13px] min-h-[80px] resize-none"
            />
          </div>

          {/* Delete (edit mode only) */}
          {editProspect && onDelete && (
            <div className="pt-2 border-t border-border/10">
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-[13px] text-destructive flex-1">Delete this prospect? Cannot be undone.</span>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                  <Button size="sm" variant="destructive" onClick={onDelete}>Delete</Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 size={14} className="mr-1.5" />
                  Delete prospect
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/20 flex items-center gap-2">
          {editProspect && (
            <p className="text-[11px] text-muted-foreground/40 flex-1">
              Created {new Date(editProspect.created_at).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </p>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="text-[13px] h-8 border-border/20">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
              className="text-[13px] h-8"
            >
              {saving ? 'Saving…' : editProspect ? 'Save changes' : 'Add Prospect'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function PipelinePage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = usePersistedState('pipeline-search', '');
  const [viewMode, setViewMode] = useState<ViewMode>('pipeline');

  // Sheet state — single unified sheet for new + edit
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingProspect, setEditingProspect] = useState<Prospect | null>(null);
  const [sheetDefaultStage, setSheetDefaultStage] = useState('lead');

  // Loss + Convert dialogs
  const [lossModalProspect, setLossModalProspect] = useState<string | null>(null);
  const [lossReason, setLossReason] = useState('');
  const [lossReasonCustom, setLossReasonCustom] = useState('');
  const [convertProspect, setConvertProspect] = useState<Prospect | null>(null);

  // Filters
  const [filterService, setFilterService] = usePersistedState<string[]>('pipeline-filterService', []);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const { users } = useUsers();

  const fetchProspects = useCallback(async () => {
    try {
      const res = await fetch('/api/prospects');
      if (res.ok) setProspects(await res.json());
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProspects(); }, [fetchProspects]);

  const filtered = useMemo(() => {
    return prospects.filter(p => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !p.name.toLowerCase().includes(q) &&
          !p.company?.toLowerCase().includes(q) &&
          !p.contact_name?.toLowerCase().includes(q) &&
          !p.contact_email?.toLowerCase().includes(q)
        ) return false;
      }
      if (filterService.length > 0 && (!p.service || !filterService.includes(p.service))) return false;
      return true;
    });
  }, [prospects, searchQuery, filterService]);

  const hasFilters = filterService.length > 0 || searchQuery !== '';

  const openNewProspect = (stage?: string) => {
    setEditingProspect(null);
    setSheetDefaultStage(stage || 'lead');
    setSheetOpen(true);
  };

  const openEditProspect = (prospect: Prospect) => {
    setEditingProspect(prospect);
    setSheetOpen(true);
  };

  const updateProspect = async (id: string, updates: Partial<Prospect>) => {
    const prev = prospects.find(p => p.id === id);
    setProspects(ps => ps.map(p => p.id === id ? { ...p, ...updates } : p));

    if (updates.stage === 'won' && prev?.stage !== 'won') {
      updates.won_at = new Date().toISOString();
      setTimeout(() => {
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      }, 200);
      toast.success('🎉 Deal won!');
    }

    if (updates.stage === 'lost' && prev?.stage !== 'lost') {
      setLossModalProspect(id);
    }

    try {
      const res = await fetch('/api/prospects', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      });
      if (!res.ok) { toast.error('Failed to update'); fetchProspects(); }
    } catch { toast.error('Failed to update'); fetchProspects(); }
  };

  const submitLossReason = async () => {
    if (!lossModalProspect) return;
    await updateProspect(lossModalProspect, {
      lost_reason: lossReason || null,
      lost_reason_custom: lossReason === 'other' ? lossReasonCustom : null,
      lost_at: new Date().toISOString(),
    });
    setLossModalProspect(null);
    setLossReason('');
    setLossReasonCustom('');
    toast('Deal marked as lost');
  };

  const deleteProspect = async (id: string) => {
    setProspects(prev => prev.filter(p => p.id !== id));
    setSheetOpen(false);
    try {
      const res = await fetch(`/api/prospects?id=${id}`, { method: 'DELETE' });
      if (!res.ok) { toast.error('Failed to delete'); fetchProspects(); return; }
      toast.success('Prospect removed from pipeline');
    } catch { toast.error('Failed to delete'); fetchProspects(); }
  };

  const onDragEnd = (result: DropResult) => {
    const { draggableId, destination } = result;
    if (!destination) return;
    const newStage = destination.droppableId;
    const clearLoss = newStage !== 'won' && newStage !== 'lost'
      ? { lost_reason: null, lost_reason_custom: null, lost_at: null }
      : {};
    updateProspect(draggableId, { stage: newStage, ...clearLoss });
    if (newStage !== 'won' && newStage !== 'lost') {
      const stageLabel = PIPELINE_STAGES.find(s => s.id === newStage)?.label || newStage;
      toast.success(`Moved to ${stageLabel}`);
    }
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = filtered.length;
    const won = filtered.filter(p => p.stage === 'won');
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const wonRecent = won.filter(p => p.won_at && p.won_at >= thirtyDaysAgo);
    const lost = filtered.filter(p => p.stage === 'lost');
    const active = filtered.filter(p => !['won', 'lost'].includes(p.stage));
    const pipelineValue = active.reduce((s, p) => s + (p.value || 0), 0);
    const wonValue = wonRecent.reduce((s, p) => s + (p.value || 0), 0);
    const conversionRate = total > 0 ? Math.round((won.length / total) * 100) : 0;
    const avgDealValue = won.length > 0 ? Math.round(wonValue / won.length) : 0;

    const lossReasons: Record<string, number> = {};
    lost.forEach(p => {
      const reason = p.lost_reason || 'unspecified';
      lossReasons[reason] = (lossReasons[reason] || 0) + 1;
    });

    const stageCount: Record<string, number> = {};
    PIPELINE_STAGES.forEach(s => { stageCount[s.id] = filtered.filter(p => p.stage === s.id).length; });

    const stageValue: Record<string, number> = {};
    PIPELINE_STAGES.forEach(s => {
      stageValue[s.id] = filtered.filter(p => p.stage === s.id).reduce((sum, p) => sum + (p.value || 0), 0);
    });

    return { total, won: won.length, lost: lost.length, active: active.length, pipelineValue, wonValue, conversionRate, avgDealValue, lossReasons, stageCount, stageValue };
  }, [filtered]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  const PAGE_SHORTCUTS = [
    { key: 'N', description: 'New prospect' },
    { key: 'Esc', description: 'Close sheet' },
    { key: '1', description: 'Pipeline view' },
    { key: '2', description: 'Table view' },
    { key: '3', description: 'Stats view' },
    { key: '?', description: 'Show shortcuts' },
  ];

  useKeyboardShortcuts([
    { key: 'n', description: 'New prospect', action: () => { if (!sheetOpen) openNewProspect(); } },
    { key: 'Escape', description: 'Close', action: () => { setSheetOpen(false); setShowShortcuts(false); }, skipInInput: false },
    { key: '1', description: 'Pipeline view', action: () => setViewMode('pipeline') },
    { key: '2', description: 'Table view', action: () => setViewMode('table') },
    { key: '3', description: 'Stats view', action: () => setViewMode('stats') },
    { key: '?', description: 'Show shortcuts', action: () => setShowShortcuts(v => !v) },
  ]);

  const viewButtons: { mode: ViewMode; icon: typeof Kanban; label: string }[] = [
    { mode: 'pipeline', icon: Kanban, label: 'Pipeline' },
    { mode: 'table', icon: Table2, label: 'Table' },
    { mode: 'stats', icon: BarChart3, label: 'Stats' },
  ];

  return (
    <div className="animate-in fade-in duration-200">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Sales Pipeline</h1>
        <p className="text-[13px] text-muted-foreground/60 mt-1">
          {filtered.length} prospects · £{stats.pipelineValue.toLocaleString()} pipeline · £{stats.wonValue.toLocaleString()} won
        </p>
      </div>

      {/* Toolbar */}
      <div className="mb-6 flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="h-8 w-full sm:w-[180px] pl-8 pr-3 text-[13px] bg-secondary border border-border/20 rounded-lg outline-none focus:border-primary/50 transition-colors duration-150 placeholder:text-muted-foreground/60"
          />
        </div>

        {/* Service filter */}
        <FilterPopover
          label="Service"
          options={Object.entries(SERVICE_STYLES).map(([key, s]) => ({ value: key, label: s.label }))}
          selected={filterService}
          onSelectionChange={setFilterService}
          width="w-52"
        />

        {hasFilters && (
          <button
            onClick={() => { setFilterService([]); setSearchQuery(''); }}
            className="h-8 px-3 text-[13px] rounded-lg border border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors duration-150 flex items-center gap-1.5"
          >
            <X className="h-3 w-3" /> Clear all
          </button>
        )}

        {/* View toggle */}
        <div className="flex items-center rounded-lg border border-border/20 bg-secondary p-0.5">
          {viewButtons.map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] font-medium transition-all duration-150 ${
                viewMode === mode
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1" />
        <Button size="sm" onClick={() => openNewProspect()}>
          <Plus className="h-4 w-4 mr-1" /> New Prospect
        </Button>
      </div>

      {/* Unified Prospect Sheet */}
      <ProspectSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        editProspect={editingProspect}
        defaultStage={sheetDefaultStage}
        users={users}
        onSaved={fetchProspects}
        onDelete={editingProspect ? () => deleteProspect(editingProspect.id) : undefined}
        onConvert={editingProspect?.stage === 'won' ? () => {
          setConvertProspect(editingProspect);
          setSheetOpen(false);
        } : undefined}
      />

      {/* Loss Reason Modal */}
      {lossModalProspect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in duration-150">
          <div className="w-full max-w-md p-6 rounded-xl border border-border/20 bg-card shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold mb-1">Why was this deal lost?</h3>
            <p className="text-[13px] text-muted-foreground/60 mb-4">This helps track patterns and improve conversion.</p>
            <div className="space-y-2 mb-4">
              {LOSS_REASONS.map(r => (
                <button
                  key={r.id}
                  onClick={() => setLossReason(r.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-[13px] border transition-colors duration-150 ${
                    lossReason === r.id
                      ? 'border-primary/50 bg-primary/10 text-foreground'
                      : 'border-border/20 bg-secondary hover:border-primary/30'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {lossReason === 'other' && (
              <input
                autoFocus
                value={lossReasonCustom}
                onChange={e => setLossReasonCustom(e.target.value)}
                placeholder="Describe the reason..."
                className="w-full h-8 px-3 mb-4 text-[13px] bg-secondary border border-border/20 rounded-lg outline-none focus:border-primary/50 transition-colors duration-150"
              />
            )}
            <div className="flex items-center justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setLossModalProspect(null); setLossReason(''); setLossReasonCustom(''); }}>Skip</Button>
              <Button size="sm" onClick={submitLossReason}>Save Reason</Button>
            </div>
          </div>
        </div>
      )}

      {/* Views */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[300px] rounded-lg bg-muted/20 animate-pulse" />
          ))}
        </div>
      ) : viewMode === 'pipeline' ? (
        <PipelineView
          prospects={filtered}
          onDragEnd={onDragEnd}
          onUpdate={updateProspect}
          onDelete={deleteProspect}
          openNewProspect={openNewProspect}
          onEdit={openEditProspect}
        />
      ) : viewMode === 'table' ? (
        <TableView
          prospects={filtered}
          onUpdate={updateProspect}
          onDelete={deleteProspect}
          onEdit={openEditProspect}
        />
      ) : (
        <StatsView stats={stats} prospects={prospects} />
      )}

      {/* Convert to Client Dialog */}
      {convertProspect && (
        <ConvertToClientDialog
          prospect={convertProspect}
          onClose={() => setConvertProspect(null)}
          onConverted={() => {
            setConvertProspect(null);
            fetchProspects();
            toast.success('🎉 Client created!', { description: `${convertProspect.name} is now a client.` });
          }}
        />
      )}

      {/* Shortcuts Dialog */}
      <ShortcutsDialog
        open={showShortcuts}
        onClose={() => setShowShortcuts(false)}
        shortcuts={PAGE_SHORTCUTS}
        pageName="Pipeline"
      />
    </div>
  );
}

// ── Pipeline (Kanban) View ───────────────────────────────────────────────────
function PipelineView({ prospects, onDragEnd, onUpdate, onDelete, openNewProspect, onEdit }: {
  prospects: Prospect[];
  onDragEnd: (result: DropResult) => void;
  onUpdate: (id: string, updates: Partial<Prospect>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  openNewProspect: (stage?: string) => void;
  onEdit: (p: Prospect) => void;
}) {
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '60vh' }}>
        {PIPELINE_STAGES.map(stage => {
          const columnProspects = prospects.filter(p => p.stage === stage.id);
          const columnValue = columnProspects.reduce((sum, p) => sum + (p.value || 0), 0);

          return (
            <div key={stage.id} className="flex-shrink-0 w-[280px]">
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className={`w-2 h-2 rounded-full ${stage.dotClass}`} />
                <span className="text-[13px] font-semibold">{stage.label}</span>
                <span className="text-[11px] text-muted-foreground/60 ml-auto">
                  {columnProspects.length}{columnValue > 0 ? ` · £${columnValue.toLocaleString()}` : ''}
                </span>
              </div>

              <Droppable droppableId={stage.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`min-h-[200px] rounded-lg p-1.5 transition-colors duration-150 ${
                      snapshot.isDraggingOver ? 'bg-primary/5 ring-1 ring-primary/20' : 'bg-muted/20'
                    }`}
                  >
                    {columnProspects.map((prospect, index) => (
                      <Draggable key={prospect.id} draggableId={prospect.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            onClick={() => onEdit(prospect)}
                            className={`mb-2 p-3 rounded-lg border border-border/20 bg-card hover:bg-muted/40 transition-all duration-150 cursor-pointer ${
                              snapshot.isDragging ? 'shadow-lg ring-1 ring-primary/30' : ''
                            }`}
                          >
                            <div className="flex items-start justify-between mb-1.5">
                              <h3 className="text-[13px] font-semibold truncate mr-2">{prospect.name}</h3>
                              {prospect.value != null && prospect.value > 0 && (
                                <span className="text-[11px] font-medium text-emerald-400 shrink-0">
                                  £{prospect.value.toLocaleString()}
                                </span>
                              )}
                            </div>
                            {prospect.contact_name && (
                              <div className="text-[11px] text-muted-foreground/60 mb-1">{prospect.contact_name}</div>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              {prospect.service && SERVICE_STYLES[prospect.service] && (
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${SERVICE_STYLES[prospect.service].bg} ${SERVICE_STYLES[prospect.service].text}`}>
                                  {SERVICE_STYLES[prospect.service].label}
                                </span>
                              )}
                              {prospect.contact_email && <Mail size={10} className="text-muted-foreground/40" />}
                              {prospect.contact_phone && <Phone size={10} className="text-muted-foreground/40" />}
                              {prospect.source && (
                                <span className="text-[10px] text-muted-foreground/40 ml-auto">{prospect.source}</span>
                              )}
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    <button
                      onClick={() => openNewProspect(stage.id)}
                      className="w-full mt-1 p-2 rounded-lg border border-dashed border-border/20 text-[13px] text-muted-foreground/40 hover:text-muted-foreground/60 hover:border-primary/30 hover:bg-primary/5 transition-colors duration-150 flex items-center justify-center gap-1"
                    >
                      <Plus size={12} /> Add prospect
                    </button>
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}

// ── Table View ───────────────────────────────────────────────────────────────
function TableView({ prospects, onUpdate, onDelete, onEdit }: {
  prospects: Prospect[];
  onUpdate: (id: string, updates: Partial<Prospect>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onEdit: (p: Prospect) => void;
}) {
  return (
    <div className="rounded-lg border border-border/20 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/20 bg-muted/30">
              {['Name', 'Contact', 'Stage', 'Value', 'Service', 'Source', 'Assignee', 'Created'].map(h => (
                <th key={h} className="text-left text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider px-3 py-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {prospects.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-[13px] text-muted-foreground/40">No prospects yet</td>
              </tr>
            ) : prospects.map(p => {
              const stage = PIPELINE_STAGES.find(s => s.id === p.stage);
              return (
                <tr
                  key={p.id}
                  onClick={() => onEdit(p)}
                  className="border-b border-border/10 hover:bg-muted/20 transition-colors duration-150 cursor-pointer"
                >
                  <td className="px-3 py-2.5 text-[13px] font-medium">{p.name}</td>
                  <td className="px-3 py-2.5">
                    <div className="text-[13px]">{p.contact_name || '—'}</div>
                    {p.contact_email && <div className="text-[11px] text-muted-foreground/60">{p.contact_email}</div>}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      p.stage === 'won' ? 'bg-emerald-500/10 text-emerald-400' :
                      p.stage === 'lost' ? 'bg-red-500/10 text-red-400' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${stage?.dotClass || 'bg-muted-foreground'}`} />
                      {stage?.label || p.stage}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-[13px] font-medium">{p.value ? `£${p.value.toLocaleString()}` : '—'}</td>
                  <td className="px-3 py-2.5">
                    {p.service && SERVICE_STYLES[p.service] ? (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${SERVICE_STYLES[p.service].bg} ${SERVICE_STYLES[p.service].text}`}>
                        {SERVICE_STYLES[p.service].label}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-[13px] text-muted-foreground/60">{p.source || '—'}</td>
                  <td className="px-3 py-2.5 text-[13px] text-muted-foreground/60">{p.assignee || '—'}</td>
                  <td className="px-3 py-2.5 text-[11px] text-muted-foreground/40">
                    {new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
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

// ── Stats View ───────────────────────────────────────────────────────────────
function StatsView({ stats, prospects }: { stats: ReturnType<typeof Object>; prospects: Prospect[] }) {
  const s = stats as {
    total: number; won: number; lost: number; active: number;
    pipelineValue: number; wonValue: number; conversionRate: number; avgDealValue: number;
    lossReasons: Record<string, number>; stageCount: Record<string, number>; stageValue: Record<string, number>;
  };

  const maxStageCount = Math.max(...Object.values(s.stageCount), 1);
  const totalLost = Object.values(s.lossReasons).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Pipeline Value', value: `£${s.pipelineValue.toLocaleString()}`, icon: PoundSterling, color: 'text-primary' },
          { label: 'Won (Last 30 Days)', value: `£${s.wonValue.toLocaleString()}`, icon: Trophy, color: 'text-emerald-400' },
          { label: 'Conversion Rate', value: `${s.conversionRate}%`, icon: Percent, color: 'text-amber-400' },
          { label: 'Avg Deal Value', value: `£${s.avgDealValue.toLocaleString()}`, icon: TrendingUp, color: 'text-blue-400' },
        ].map(kpi => (
          <div key={kpi.label} className="p-4 rounded-lg border border-border/20 bg-card">
            <div className="flex items-center gap-2 mb-2">
              <kpi.icon size={14} className={kpi.color} />
              <span className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">{kpi.label}</span>
            </div>
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Stage Funnel + Loss Reasons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="p-4 rounded-lg border border-border/20 bg-card">
          <h3 className="text-[13px] font-semibold mb-4">Pipeline Funnel</h3>
          <div className="space-y-3">
            {PIPELINE_STAGES.map(stage => {
              const count = s.stageCount[stage.id] || 0;
              const value = s.stageValue[stage.id] || 0;
              const widthPercent = Math.max((count / maxStageCount) * 100, 4);
              return (
                <div key={stage.id}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${stage.dotClass}`} />
                      <span className="text-[13px] font-medium">{stage.label}</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground/60">{count} · £{value.toLocaleString()}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${stage.dotClass} opacity-80 transition-all duration-500`}
                      style={{ width: `${widthPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-4 rounded-lg border border-border/20 bg-card">
          <h3 className="text-[13px] font-semibold mb-4">Loss Reasons</h3>
          {Object.keys(s.lossReasons).length === 0 ? (
            <div className="flex items-center justify-center h-[200px] text-[13px] text-muted-foreground/40">
              No lost deals yet — keep winning! 🏆
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(s.lossReasons)
                .sort(([, a], [, b]) => b - a)
                .map(([reason, count]) => {
                  const label = LOSS_REASONS.find(r => r.id === reason)?.label || reason;
                  const pct = Math.round((count / totalLost) * 100);
                  return (
                    <div key={reason}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[13px]">{label}</span>
                        <span className="text-[11px] text-muted-foreground/60">{count} ({pct}%)</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                        <div className="h-full rounded-full bg-red-400/60 transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Convert to Client Dialog ─────────────────────────────────────────────────
function ConvertToClientDialog({ prospect, onClose, onConverted }: {
  prospect: Prospect;
  onClose: () => void;
  onConverted: () => void;
}) {
  const [name, setName] = useState(prospect.name);
  const [monthlyRetainer, setMonthlyRetainer] = useState(prospect.value?.toString() || '');
  const [signupDate, setSignupDate] = useState(new Date().toISOString().split('T')[0]);
  const [saleSource, setSaleSource] = useState(prospect.source || '');
  const [archiveProspect, setArchiveProspect] = useState(false);
  const [converting, setConverting] = useState(false);

  const handleConvert = async () => {
    if (!name.trim()) { toast.error('Client name is required'); return; }
    setConverting(true);
    try {
      const res = await fetch(`/api/prospects/${prospect.id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          services: prospect.service ? [prospect.service] : [],
          monthly_retainer: monthlyRetainer ? parseFloat(monthlyRetainer) : null,
          signup_date: signupDate,
          sale_source: saleSource || null,
          sold_by: prospect.assignee || null,
          team: prospect.team || null,
          notes: prospect.notes || null,
          archive_prospect: archiveProspect,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Conversion failed');
      }
      onConverted();
    } catch (err) {
      toast.error('Conversion failed', { description: err instanceof Error ? err.message : 'Something went wrong' });
    } finally {
      setConverting(false);
    }
  };

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md bg-card border-border/20">
        <DialogHeader>
          <DialogTitle className="text-[15px] flex items-center gap-2">
            <UserPlus size={16} className="text-emerald-400" />
            Convert to Client
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-[13px] text-muted-foreground/70">
            This will create a new client record and mark the prospect as won.
          </p>

          <div className="space-y-1.5">
            <Label className="text-[13px] text-muted-foreground">Client name *</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              className="h-9 text-[13px] bg-secondary border-border/20"
            />
          </div>

          {prospect.contact_name && (
            <div className="space-y-1 text-[13px]">
              <Label className="text-[13px] text-muted-foreground">Contact</Label>
              <div className="h-9 px-3 rounded-md border border-border/20 bg-secondary/50 flex items-center text-muted-foreground">
                {prospect.contact_name}
                {prospect.contact_email && (
                  <span className="ml-2 text-muted-foreground/60">· {prospect.contact_email}</span>
                )}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-[13px] text-muted-foreground">Monthly retainer (£)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">£</span>
              <Input
                type="number"
                value={monthlyRetainer}
                onChange={e => setMonthlyRetainer(e.target.value)}
                className="h-9 pl-7 text-[13px] bg-secondary border-border/20"
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[13px] text-muted-foreground">Sign-up date</Label>
            <DatePicker
              value={signupDate}
              onChange={setSignupDate}
              placeholder="DD/MM/YYYY"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[13px] text-muted-foreground">Sale source</Label>
            <Input
              value={saleSource}
              onChange={e => setSaleSource(e.target.value)}
              placeholder="e.g. Referral, LinkedIn..."
              className="h-9 text-[13px] bg-secondary border-border/20"
            />
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={archiveProspect}
              onChange={e => setArchiveProspect(e.target.checked)}
              className="w-4 h-4 rounded border-border/40 accent-primary"
            />
            <span className="text-[13px] text-muted-foreground">Hide prospect from active pipeline view</span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="text-[13px] h-8 border-border/20">
            Cancel
          </Button>
          <Button
            onClick={handleConvert}
            disabled={converting || !name.trim()}
            className="text-[13px] h-8 bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5"
          >
            <UserPlus size={14} />
            {converting ? 'Converting…' : 'Create Client'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
