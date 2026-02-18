'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import type { Role, Permissions } from '@/lib/auth-types';

const PERMISSION_KEYS: { key: keyof Permissions; label: string; desc: string }[] = [
  { key: 'dashboard', label: 'Dashboard', desc: 'View main dashboard' },
  { key: 'tasks', label: 'Tasks', desc: 'View and manage tasks' },
  { key: 'clients', label: 'Clients', desc: 'View and manage clients' },
  { key: 'pipeline', label: 'Pipeline', desc: 'View sales pipeline' },
  { key: 'teams', label: 'Teams', desc: 'View team information' },
  { key: 'xero', label: 'Xero', desc: 'Access Xero integration' },
  { key: 'settings', label: 'Settings', desc: 'Access admin settings' },
];

const DEFAULT_PERMS: Permissions = {
  dashboard: true,
  tasks: true,
  clients: true,
  pipeline: false,
  teams: true,
  xero: false,
  settings: false,
};

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newPerms, setNewPerms] = useState<Permissions>(DEFAULT_PERMS);
  const [creating, setCreating] = useState(false);

  const loadRoles = useCallback(async () => {
    const res = await fetch('/api/roles');
    const data = await res.json();
    setRoles(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadRoles(); }, [loadRoles]);

  const updatePermission = (roleId: string, key: keyof Permissions, value: boolean) => {
    setRoles(prev => prev.map(r => {
      if (r.id !== roleId) return r;
      return { ...r, permissions: { ...r.permissions, [key]: value } };
    }));
  };

  const saveRole = async (role: Role) => {
    setSaving(role.id);
    const res = await fetch(`/api/roles/${role.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: role.name, permissions: role.permissions }),
    });
    setSaving(null);
    if (res.ok) {
      toast.success('Role saved', { description: `${role.name} permissions updated.` });
    } else {
      toast.error('Failed to save role');
    }
  };

  const deleteRole = async (role: Role) => {
    if (!confirm(`Delete role "${role.name}"? Users with this role will lose their permissions.`)) return;
    const res = await fetch(`/api/roles/${role.id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Role deleted', { description: `${role.name} has been removed.` });
      loadRoles();
    } else {
      toast.error('Failed to delete role');
    }
  };

  const createRole = async () => {
    if (!newRoleName.trim()) {
      toast.error('Role name is required');
      return;
    }
    setCreating(true);
    const res = await fetch('/api/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newRoleName, permissions: newPerms }),
    });
    setCreating(false);
    if (res.ok) {
      toast.success('Role created', { description: `${newRoleName} has been added.` });
      setAddDialogOpen(false);
      setNewRoleName('');
      setNewPerms(DEFAULT_PERMS);
      loadRoles();
    } else {
      toast.error('Failed to create role');
    }
  };

  // Protected role IDs that shouldn't be deleted
  const PROTECTED_IDS = [
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000005',
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-muted-foreground">{roles.length} roles</p>
        <Button onClick={() => setAddDialogOpen(true)} size="sm" className="h-8 text-[13px] gap-1.5">
          <Plus size={14} />
          Add role
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[13px] text-muted-foreground/40">Loading roles…</div>
      ) : (
        <div className="space-y-4">
          {roles.map(role => (
            <div key={role.id} className="bg-card border border-border/20 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-[14px] font-semibold text-foreground">{role.name}</h3>
                  <p className="text-[12px] text-muted-foreground/60 mt-0.5">
                    {Object.values(role.permissions || {}).filter(Boolean).length} of {PERMISSION_KEYS.length} permissions enabled
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => saveRole(role)}
                    disabled={saving === role.id}
                    className="h-7 text-[12px] border-border/20 gap-1.5"
                  >
                    <Save size={12} />
                    {saving === role.id ? 'Saving…' : 'Save'}
                  </Button>
                  {!PROTECTED_IDS.includes(role.id) && (
                    <button
                      onClick={() => deleteRole(role)}
                      className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {PERMISSION_KEYS.map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between gap-2 bg-secondary/40 rounded-md px-3 py-2.5">
                    <div>
                      <p className="text-[13px] font-medium text-foreground">{label}</p>
                      <p className="text-[11px] text-muted-foreground/60">{desc}</p>
                    </div>
                    <Switch
                      checked={role.permissions?.[key] === true}
                      onCheckedChange={(v) => updatePermission(role.id, key, v)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Role Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border/20">
          <DialogHeader>
            <DialogTitle className="text-[15px]">Create new role</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-[13px] text-muted-foreground">Role name *</Label>
              <Input
                value={newRoleName}
                onChange={e => setNewRoleName(e.target.value)}
                placeholder="e.g. Content Manager"
                className="h-9 text-[13px] bg-secondary border-border/20"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">Permissions</Label>
              <div className="space-y-2">
                {PERMISSION_KEYS.map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between py-1">
                    <span className="text-[13px] text-foreground">{label}</span>
                    <Switch
                      checked={newPerms[key] === true}
                      onCheckedChange={(v) => setNewPerms(p => ({ ...p, [key]: v }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)} className="text-[13px] h-8 border-border/20">
              Cancel
            </Button>
            <Button onClick={createRole} disabled={creating} className="text-[13px] h-8">
              {creating ? 'Creating…' : 'Create role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
