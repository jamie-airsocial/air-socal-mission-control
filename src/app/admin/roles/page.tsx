'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, MoreHorizontal, Check } from 'lucide-react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Role, Permissions } from '@/lib/auth-types';

const PERMISSION_KEYS: { key: keyof Permissions; label: string; group: string }[] = [
  // Navigation
  { key: 'dashboard', label: 'Dashboard', group: 'Navigation' },
  { key: 'tasks', label: 'Tasks', group: 'Navigation' },
  { key: 'clients', label: 'Clients', group: 'Navigation' },
  { key: 'pipeline', label: 'Pipeline', group: 'Navigation' },
  { key: 'teams', label: 'Teams', group: 'Navigation' },
  { key: 'xero', label: 'Xero Integration', group: 'Navigation' },
  { key: 'settings', label: 'Admin Settings', group: 'Admin' },
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

// Admin is always all-on
const ADMIN_PERMS: Permissions = {
  dashboard: true,
  tasks: true,
  clients: true,
  pipeline: true,
  teams: true,
  xero: true,
  settings: true,
};

const ADMIN_ROLE_NAME = 'Admin';

// Protected role IDs
const PROTECTED_IDS = [
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000005',
];

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newPerms, setNewPerms] = useState<Permissions>(DEFAULT_PERMS);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const saveAllRoles = async () => {
    setSaving(true);
    let success = 0;
    for (const role of roles) {
      if (role.name === ADMIN_ROLE_NAME) continue; // Skip admin — always protected
      const res = await fetch(`/api/roles/${role.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: role.name, permissions: role.permissions }),
      });
      if (res.ok) success++;
    }
    setSaving(false);
    if (success > 0) {
      toast.success('Permissions saved', { description: `${success} role${success === 1 ? '' : 's'} updated.` });
    } else {
      toast.error('No roles saved');
    }
  };

  const confirmDeleteRole = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/roles/${deleteTarget.id}`, { method: 'DELETE' });
    setDeleting(false);
    if (res.ok) {
      toast.success('Role deleted', { description: `${deleteTarget.name} has been removed.` });
      setDeleteTarget(null);
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

  // Group permissions
  const groups = [...new Set(PERMISSION_KEYS.map(p => p.group))];

  if (loading) {
    return <div className="text-center py-12 text-[13px] text-muted-foreground/40">Loading roles…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-muted-foreground">{roles.length} roles · {PERMISSION_KEYS.length} permissions</p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={saveAllRoles}
            disabled={saving}
            className="h-8 text-[13px] border-border/20"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
          <Button
            size="sm"
            onClick={() => setAddDialogOpen(true)}
            className="h-8 text-[13px] gap-1.5"
          >
            <Plus size={14} />
            Add role
          </Button>
        </div>
      </div>

      {/* Permissions Matrix Table */}
      <div className="bg-card border border-border/20 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/20">
                <th className="text-left px-4 py-3 text-[12px] font-medium text-muted-foreground w-44 min-w-[180px]">
                  Permission
                </th>
                {roles.map(role => (
                  <th key={role.id} className="px-3 py-3 text-center min-w-[120px]">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className={`text-[13px] font-semibold ${role.name === ADMIN_ROLE_NAME ? 'text-amber-400' : 'text-foreground'}`}>
                        {role.name}
                      </span>
                      {role.name === ADMIN_ROLE_NAME && (
                        <span className="text-[10px] bg-amber-400/10 text-amber-400 px-1.5 py-0.5 rounded font-medium">Protected</span>
                      )}
                      {role.name !== ADMIN_ROLE_NAME && !PROTECTED_IDS.includes(role.id) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-0.5 rounded hover:bg-muted/60 text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                              <MoreHorizontal size={12} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="center" className="w-36">
                            <DropdownMenuItem
                              onClick={() => setDeleteTarget(role)}
                              className="text-[13px] text-destructive focus:text-destructive focus:bg-destructive/10"
                            >
                              <Trash2 size={12} className="mr-2" />
                              Delete role
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map(group => (
                <>
                  {/* Group header row */}
                  <tr key={`group-${group}`} className="border-b border-border/10 bg-muted/20">
                    <td
                      colSpan={roles.length + 1}
                      className="px-4 py-1.5 text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider"
                    >
                      {group}
                    </td>
                  </tr>
                  {/* Permission rows in this group */}
                  {PERMISSION_KEYS.filter(p => p.group === group).map(({ key, label }) => (
                    <tr key={key} className="border-b border-border/10 hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3 text-[13px] font-medium text-foreground">
                        {label}
                      </td>
                      {roles.map(role => {
                        const isAdmin = role.name === ADMIN_ROLE_NAME;
                        const checked = isAdmin ? true : (role.permissions?.[key] === true);
                        return (
                          <td key={role.id} className="px-3 py-3 text-center">
                            {isAdmin ? (
                              // Admin: always on, greyed out toggle
                              <div className="flex justify-center">
                                <div className="w-5 h-5 rounded-full bg-amber-400/20 border border-amber-400/30 flex items-center justify-center">
                                  <Check size={12} className="text-amber-400" />
                                </div>
                              </div>
                            ) : (
                              <div className="flex justify-center">
                                <Switch
                                  checked={checked}
                                  onCheckedChange={(v) => updatePermission(role.id, key, v)}
                                  className="data-[state=checked]:bg-primary"
                                />
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[12px] text-muted-foreground/50">
        Changes are saved when you click &quot;Save changes&quot;. Admin permissions are always locked on.
      </p>

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
              <Label className="text-[13px] text-muted-foreground">Initial permissions</Label>
              <div className="space-y-1">
                {PERMISSION_KEYS.map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between py-1.5 px-3 rounded-md hover:bg-secondary/40">
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

      {/* Delete Role Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="bg-card border-border/20 sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px]">Delete &quot;{deleteTarget?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-muted-foreground">
              Users with this role will lose their permissions. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-[13px] h-8 border-border/20">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteRole}
              disabled={deleting}
              className="text-[13px] h-8 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting…' : 'Delete role'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
