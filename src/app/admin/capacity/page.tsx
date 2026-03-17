'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Plus, Save, TrendingUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { getServiceStyle } from '@/lib/constants';

interface CapacityTargets {
  'paid-advertising': number;
  'seo': number;
  'social-media': number;
  'creative': number;
  [key: string]: number;
}

interface UserLite {
  id: string;
  full_name: string;
  role?: { name: string } | null;
  is_active?: boolean;
}


const SERVICE_KEYS = [
  'paid-advertising',
  'seo',
  'social-media',
  'account-management',
  'creative'
] as const;

export default function CapacitySettingsPage() {
  const [targets, setTargets] = useState<CapacityTargets>({
    'paid-advertising': 15000,
    'seo': 10000,
    'social-media': 12000,
    'account-management': 0,
    'creative': 5000
  });

  const [memberTargets, setMemberTargets] = useState<Record<string, number>>({});
  const [users, setUsers] = useState<UserLite[]>([]);
  const [newMemberId, setNewMemberId] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const autoTotal = SERVICE_KEYS.reduce((sum: number, key) => sum + (Number(targets[key]) || 0), 0);
  const overrideEntries = Object.entries(memberTargets)
    .filter(([, v]) => Number(v) > 0)
    .map(([id, target]) => ({ id, target: Number(target), user: users.find(u => u.id === id) }))
    .sort((a, b) => (a.user?.full_name || '').localeCompare(b.user?.full_name || ''));
  const availableUsers = users.filter(u => !(u.id in memberTargets));

  useEffect(() => {
    fetchCapacityTargets();
  }, []);

  async function fetchCapacityTargets() {
    try {
      const [capacityRes, usersRes] = await Promise.all([
        fetch('/api/admin/capacity'),
        fetch('/api/users')
      ]);
      if (!capacityRes.ok) throw new Error('Failed to fetch capacity targets');
      const data = await capacityRes.json();

      if (data.targets) setTargets(data.targets);
      if (data.memberTargets) setMemberTargets(data.memberTargets);

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers((usersData || []).filter((u: UserLite) => u.is_active !== false));
      }

    } catch (err) {
      console.error('Error fetching capacity targets:', err);
      toast.error('Failed to load capacity targets');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const finalTotal = autoTotal;
      
      const res = await fetch('/api/admin/capacity', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets, teamTotal: finalTotal, memberTargets })
      });

      if (!res.ok) throw new Error('Failed to save capacity targets');

      toast.success('Capacity targets saved successfully');
    } catch (err) {
      console.error('Error saving capacity targets:', err);
      toast.error('Failed to save capacity targets');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-[13px] text-muted-foreground">Loading capacity settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="rounded-lg border border-border/20 bg-card p-6 space-y-6">
        <div>
          <h2 className="text-[15px] font-semibold text-foreground flex items-center gap-2">
            <TrendingUp size={16} className="text-primary" />
            Monthly Capacity Targets
          </h2>
          <p className="text-[11px] text-muted-foreground mt-1">
            Set default billing targets per service. Individual overrides are edited from Admin → Users (Edit user).
          </p>
        </div>

        {/* Service targets */}
        <div className="space-y-4">
          {SERVICE_KEYS.map(serviceKey => {
            const style = getServiceStyle(serviceKey);
            return (
              <div key={serviceKey} className="flex items-center gap-4">
                <div className="flex-1">
                  <Label htmlFor={serviceKey} className="text-[11px] text-muted-foreground flex items-center gap-2 mb-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: style.dot }} />
                    {style.label}
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground/60">£</span>
                    <Input
                      id={serviceKey}
                      type="text"
                      inputMode="numeric"
                      value={targets[serviceKey] || 0}
                      onChange={e => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        setTargets({ ...targets, [serviceKey]: Number(val) });
                      }}
                      className="pl-7 text-[13px] h-9"
                    />
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground/40 w-24 text-right">
                  {autoTotal > 0 ? `${((targets[serviceKey] / autoTotal) * 100).toFixed(0)}% of total` : '—'}
                </div>
              </div>
            );
          })}
        </div>

        {/* Individual overrides */}
        <div className="pt-4 border-t border-border/10 space-y-3">
          <div>
            <Label className="text-[11px] text-muted-foreground mb-1 block">Custom targets by team member</Label>
            <p className="text-[10px] text-muted-foreground/60">Only members listed here are using overrides.</p>
          </div>

          <div className="space-y-2">
            {overrideEntries.length === 0 ? (
              <p className="text-[11px] text-muted-foreground/60">No custom overrides yet.</p>
            ) : (
              overrideEntries.map(({ id, target, user }) => (
                <div key={id} className="flex items-center gap-2 rounded-md border border-border/20 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium truncate">{user?.full_name || 'Unknown user'}</p>
                    <p className="text-[10px] text-muted-foreground/60 truncate">{user?.role?.name || 'No role'}</p>
                  </div>
                  <div className="relative w-28">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground/60">£</span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={target}
                      onChange={e => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        setMemberTargets(prev => ({ ...prev, [id]: Number(val || 0) }));
                      }}
                      className="pl-6 h-8 text-[12px]"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setMemberTargets(prev => { const n = { ...prev }; delete n[id]; return n; })}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  >
                    <X size={14} />
                  </Button>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <select
              value={newMemberId}
              onChange={e => setNewMemberId(e.target.value)}
              className="h-8 flex-1 rounded-md border border-border/20 bg-background px-2 text-[12px]"
            >
              <option value="">Select team member…</option>
              {availableUsers.map(u => (
                <option key={u.id} value={u.id}>{u.full_name}{u.role?.name ? ` — ${u.role.name}` : ''}</option>
              ))}
            </select>
            <div className="relative w-28">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground/60">£</span>
              <Input
                type="text"
                inputMode="numeric"
                value={newTarget}
                onChange={e => setNewTarget(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Target"
                className="pl-6 h-8 text-[12px]"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-8 text-[12px]"
              onClick={() => {
                const val = Number(newTarget || 0);
                if (!newMemberId || !val) return;
                setMemberTargets(prev => ({ ...prev, [newMemberId]: val }));
                setNewMemberId('');
                setNewTarget('');
              }}
              disabled={!newMemberId || !newTarget}
            >
              <Plus size={12} className="mr-1" /> Add override
            </Button>
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="text-[13px]"
          >
            <Save size={14} className="mr-2" />
            {saving ? 'Saving...' : 'Save Targets'}
          </Button>
        </div>
      </div>

      {/* Info box */}
      <div className="rounded-lg border border-border/10 bg-muted/20 p-4">
        <h3 className="text-[12px] font-medium text-foreground mb-1">How capacity works</h3>
        <ul className="text-[11px] text-muted-foreground space-y-1 list-disc list-inside">
          <li>Capacity % = (Actual billing / Target) × 100</li>
          <li>Green (&lt;80%) = healthy capacity, room for more work</li>
          <li>Amber (80-95%) = busy, close to capacity</li>
          <li>Red (&gt;95%) = over-capacity, team is stretched</li>
          <li>Delivery team sees percentages only (no £ amounts)</li>
          <li>Teams page shows both percentages and £ figures</li>
        </ul>
      </div>
    </div>
  );
}
