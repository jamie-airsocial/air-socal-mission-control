'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Save, TrendingUp } from 'lucide-react';
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
  const [teamTotal, setTeamTotal] = useState<number>(0);
  const [useManualTotal, setUseManualTotal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Calculate auto total
  const autoTotal = SERVICE_KEYS.reduce((sum: number, key) => sum + (Number(targets[key]) || 0), 0);

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
      if (data.teamTotal) {
        setTeamTotal(data.teamTotal);
        // If team total differs from auto-calculated, user has set it manually
        const calculatedTotal = Object.values(data.targets).reduce((s: number, v) => s + Number(v), 0);
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
      const finalTotal = useManualTotal ? teamTotal : autoTotal;
      
      const res = await fetch('/api/admin/capacity', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets, teamTotal: finalTotal })
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
                      type="number"
                      value={targets[serviceKey] || 0}
                      onChange={e => setTargets({ ...targets, [serviceKey]: Number(e.target.value) })}
                      className="pl-7 text-[13px] h-9"
                      min={0}
                      step={100}
                    />
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground/40 w-24 text-right">
                  {((targets[serviceKey] / (useManualTotal ? teamTotal : autoTotal)) * 100).toFixed(0)}% of total
                </div>
              </div>
            );
          })}
        </div>

        {/* Team total */}
        <div className="pt-4 border-t border-border/10">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <Label className="text-[11px] text-muted-foreground mb-1.5 block">
                Team Total Target
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground/60">£</span>
                <Input
                  type="number"
                  value={useManualTotal ? teamTotal : autoTotal}
                  onChange={e => {
                    setTeamTotal(Number(e.target.value));
                    setUseManualTotal(true);
                  }}
                  disabled={!useManualTotal}
                  className="pl-7 text-[13px] h-9 font-medium"
                  min={0}
                  step={100}
                />
              </div>
            </div>
            <div className="pt-6">
              <Button
                variant={useManualTotal ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setUseManualTotal(!useManualTotal);
                  if (useManualTotal) {
                    setTeamTotal(autoTotal);
                  }
                }}
                className="text-[11px] h-9"
              >
                {useManualTotal ? 'Manual' : 'Auto'}
              </Button>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground/60 mt-1.5">
            {useManualTotal
              ? 'Using manual team total (click Auto to calculate from services)'
              : 'Auto-calculated from service targets (click Manual to override)'}
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
