'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Save, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { getServiceStyle } from '@/lib/constants';

interface CapacityTargets {
  'paid-advertising': number;
  'seo': number;
  'social-media': number;
  'creative': number;
  [key: string]: number;
}

const SERVICE_KEYS = [
  'paid-advertising',
  'seo',
  'social-media',
  'creative'
] as const;

export default function CapacitySettingsPage() {
  const [targets, setTargets] = useState<CapacityTargets>({
    'paid-advertising': 15000,
    'seo': 10000,
    'social-media': 12000,
    'creative': 5000
  });
  const [included, setIncluded] = useState<Record<string, boolean>>({
    'paid-advertising': true,
    'seo': true,
    'social-media': true,
    'creative': true
  });
  const [teamTotal, setTeamTotal] = useState<number>(0);
  const [useManualTotal, setUseManualTotal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Auto total only sums included services
  const autoTotal = SERVICE_KEYS.reduce((sum: number, key) => sum + (included[key] ? (Number(targets[key]) || 0) : 0), 0);

  useEffect(() => {
    fetchCapacityTargets();
  }, []);

  async function fetchCapacityTargets() {
    try {
      const res = await fetch('/api/admin/capacity');
      if (!res.ok) throw new Error('Failed to fetch capacity targets');
      const data = await res.json();
      
      if (data.targets) {
        setTargets(data.targets);
      }
      if (data.included) {
        setIncluded(prev => ({ ...prev, ...data.included }));
      }
      if (data.teamTotal) {
        setTeamTotal(data.teamTotal);
        // If team total differs from auto-calculated, user has set it manually
        const includedMap = data.included || {};
        const calculatedTotal = Object.entries(data.targets).reduce((s: number, [k, v]) => s + ((includedMap[k] !== false) ? Number(v) : 0), 0);
        setUseManualTotal(Math.abs(data.teamTotal - calculatedTotal) > 1);
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
        body: JSON.stringify({ targets, teamTotal: finalTotal, included })
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
            Set billing targets for each service. These determine capacity percentages on the Delivery page.
          </p>
        </div>

        {/* Service targets */}
        <div className="space-y-4">
          {SERVICE_KEYS.map(serviceKey => {
            const style = getServiceStyle(serviceKey);
            return (
              <div key={serviceKey} className={`flex items-center gap-4 ${!included[serviceKey] ? 'opacity-40' : ''}`}>
                <div className="shrink-0 pt-5">
                  <Switch
                    checked={included[serviceKey] !== false}
                    onCheckedChange={v => setIncluded({ ...included, [serviceKey]: v })}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>
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
                  {included[serviceKey] && autoTotal > 0
                    ? `${((targets[serviceKey] / autoTotal) * 100).toFixed(0)}% of total`
                    : 'excluded'}
                </div>
              </div>
            );
          })}
        </div>

        {/* Team total */}
        <div className="pt-4 border-t border-border/10">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-[11px] text-muted-foreground mb-1 block">
                Team total target
              </Label>
              <p className="text-[18px] font-bold text-foreground">
                £{autoTotal.toLocaleString()}
              </p>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            Auto-calculated from included services. Toggle services on/off above.
          </p>
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
