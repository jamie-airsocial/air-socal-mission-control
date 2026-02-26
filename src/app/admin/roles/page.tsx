'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, MoreHorizontal, Check, Pencil, ShieldCheck, Loader2 } from 'lucide-react';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Role, Permissions } from '@/lib/auth-types';

// ── Permission definitions ────────────────────────────────────────────────────
const PERMISSION_GROUPS: { group: string; items: { key: keyof Permissions; label: string; desc: string }[] }[] = [
  {
    group: 'Core Pages',
    items: [
      { key: 'tasks',     label: 'Tasks',     desc: 'View and manage tasks' },
      { key: 'clients',   label: 'Clients',   desc: 'View client list and details' },
      { key: 'pipeline',  label: 'Pipeline',  desc: 'View and manage the pipeline' },
      { key: 'teams',     label: 'Teams',     desc: 'View team members and structure' },
    ],
  },
  {
    group: 'Finance',
    items: [
      { key: 'xero', label: 'Xero', desc: 'Access revenue and billing data' },
    ],
  },
  {
    group: 'Administration',
    items: [
      { key: 'settings', label: 'Settings', desc: 'Manage users, roles, and system settings' },
    ],
  },
];

const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap(g => g.items.map(i => i.key));

const DEFAULT_PERMS: Permissions = {
  clients: true,
  tasks: true,
  pipeline: false,
  teams: true,
  xero: false,
  settings: false,
};

const ADMIN_ROLE_NAME = 'Admin';
const PROTECTED_IDS = [
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000006',
  '00000000-0000-0000-0000-000000000007',
  '00000000-0000-0000-0000-000000000008',
];

const CATEGORY_ORDER = ['delivery', 'management', 'admin', 'sales', null];
const CATEGORY_LABELS: Record<string, string> = {
  delivery: 'Delivery',
  management: 'Management',
  admin: 'Admin',
  sales: 'Sales',
};

// ── Inline editable role name ─────────────────────────────────────────────────
function RoleNameEditor({
  role,
  onSave,
  isAdmin,
}: {
  role: Role;
  onSave: (id: string, name: string) => Promise<void>;
  isAdmin: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(role.name);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const save = async () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === role.name) { setEditing(false); setDraft(role.name); return; }
    setSaving(true);
    await onSave(role.id, trimmed);
    setSaving(false);
    setEditing(false);
  };

  if (isAdmin) {
    return (
      <span className="text-[13px] font-semibold text-amber-400">{role.name}</span>
    );
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setEditing(false); setDraft(role.name); } }}
        className="w-28 px-1.5 py-0.5 text-[13px] font-semibold bg-secondary border border-primary/50 rounded outline-none text-center"
        disabled={saving}
      />
    );
  }

  return (
    <button
      onClick={() => { if (!PROTECTED_IDS.includes(role.id)) setEditing(true); }}
      title="Click to rename"
      className="flex items-center gap-1 group text-[13px] font-semibold text-foreground hover:text-primary transition-colors"
    >
      {role.name}
      {!PROTECTED_IDS.includes(role.id) && (
        <Pencil size={11} className="opacity-0 group-hover:opacity-50 transition-opacity" />
      )}
    </button>
  );
}

// ── Auto-saving toggle cell ───────────────────────────────────────────────────
function PermissionCell({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => Promise<void>;
  disabled?: boolean;
}) {
  const [pending, setPending] = useState(false);

  const handle = async (v: boolean) => {
    setPending(true);
    await onChange(v);
    setPending(false);
  };

  if (disabled) {
    return (
      <div className="flex justify-center">
        <div className="w-5 h-5 rounded-full bg-amber-400/15 border border-amber-400/30 flex items-center justify-center">
          <Check size={11} className="text-amber-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center gap-1.5 min-w-[60px]">
      {pending && <Loader2 size={11} className="animate-spin text-muted-foreground/40 shrink-0" />}
      <Switch
        checked={checked}
        onCheckedChange={handle}
        disabled={pending}
        className="data-[state=checked]:bg-primary shrink-0"
      />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminRolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newPerms, setNewPerms] = useState<Permissions>(DEFAULT_PERMS);
  const [newCategory, setNewCategory] = useState<string>('delivery');
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

  // Auto-save a single permission toggle
  const savePermission = async (roleId: string, key: keyof Permissions, value: boolean) => {
    // Optimistic local update
    setRoles(prev => prev.map(r =>
      r.id === roleId ? { ...r, permissions: { ...r.permissions, [key]: value } } : r
    ));
    const role = roles.find(r => r.id === roleId);
    if (!role) return;
    const updated = { ...role.permissions, [key]: value };
    const res = await fetch(`/api/roles/${roleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissions: updated }),
    });
    if (!res.ok) {
      // Revert on failure
      setRoles(prev => prev.map(r =>
        r.id === roleId ? { ...r, permissions: { ...r.permissions, [key]: !value } } : r
      ));
      toast.error('Failed to save permission');
    }
  };

  // Rename a role inline
  const renameRole = async (roleId: string, name: string) => {
    const res = await fetch(`/api/roles/${roleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const updated = await res.json();
      setRoles(prev => prev.map(r => r.id === roleId ? { ...r, name: updated.name } : r));
      toast.success('Role renamed');
    } else {
      toast.error('Failed to rename role');
    }
  };

  const createRole = async () => {
    if (!newRoleName.trim()) { toast.error('Role name is required'); return; }
    setCreating(true);
    const res = await fetch('/api/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newRoleName.trim(), permissions: newPerms, category: newCategory }),
    });
    setCreating(false);
    if (res.ok) {
      toast.success(`Role "${newRoleName}" created`);
      setAddDialogOpen(false);
      setNewRoleName('');
      setNewPerms(DEFAULT_PERMS);
      setNewCategory('delivery');
      loadRoles();
    } else {
      const e = await res.json();
      toast.error(e.error || 'Failed to create role');
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-[13px] text-muted-foreground/40">
        <Loader2 size={16} className="animate-spin" /> Loading roles…
      </div>
    );
  }

  // Hide Admin role from the permissions matrix and sort by category
  const displayRoles = roles
    .filter(r => r.name !== ADMIN_ROLE_NAME)
    .sort((a, b) => {
      const aIndex = CATEGORY_ORDER.indexOf(a.category || null);
      const bIndex = CATEGORY_ORDER.indexOf(b.category || null);
      if (aIndex !== bIndex) return aIndex - bIndex;
      return a.name.localeCompare(b.name);
    });

  // Group roles by category for headers
  const rolesByCategory = displayRoles.reduce((acc, role) => {
    const cat = role.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(role);
    return acc;
  }, {} as Record<string, Role[]>);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] text-muted-foreground">
            {roles.length} role{roles.length !== 1 ? 's' : ''} · {ALL_PERMISSION_KEYS.length} permissions
          </p>
          <p className="text-[11px] text-muted-foreground/50 mt-0.5">
            Changes save instantly. Click a role name to rename it.
          </p>
        </div>
        <Button size="sm" onClick={() => setAddDialogOpen(true)} className="h-8 text-[13px] gap-1.5">
          <Plus size={14} /> Add role
        </Button>
      </div>

      {/* Matrix table */}
      <div className="bg-card border border-border/20 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              {/* Category header row */}
              <tr className="border-b border-border/10 bg-muted/40">
                <th className="sticky left-0 z-10 bg-muted/40 border-r border-border/10"></th>
                {CATEGORY_ORDER.filter(cat => rolesByCategory[cat || 'other']).map(cat => {
                  const rolesInCat = rolesByCategory[cat || 'other'] || [];
                  if (rolesInCat.length === 0) return null;
                  return (
                    <th
                      key={cat || 'other'}
                      colSpan={rolesInCat.length}
                      className="px-4 py-2 text-center text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest border-r border-border/10 last:border-r-0"
                    >
                      {CATEGORY_LABELS[cat || 'other'] || 'Other'}
                    </th>
                  );
                })}
              </tr>
              {/* Role name row */}
              <tr className="border-b border-border/20 bg-muted/30">
                {/* Sticky permission column header */}
                <th className="sticky left-0 z-10 bg-muted/30 text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider min-w-[200px] border-r border-border/10">
                  Permission
                </th>
                {displayRoles.map(role => {
                  const isAdmin = role.name === ADMIN_ROLE_NAME;
                  const isProtected = isAdmin || PROTECTED_IDS.includes(role.id);
                  return (
                    <th key={role.id} className="px-4 py-3 text-center min-w-[130px]">
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-1.5">
                          {isAdmin && <ShieldCheck size={13} className="text-amber-400 shrink-0" />}
                          <RoleNameEditor role={role} onSave={renameRole} isAdmin={isAdmin} />
                          {!isProtected && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="p-0.5 rounded hover:bg-muted/60 text-muted-foreground/30 hover:text-muted-foreground transition-colors">
                                  <MoreHorizontal size={13} />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="center" className="w-40">
                                <DropdownMenuItem
                                  onClick={() => {
                                    // Trigger the RoleNameEditor to go into edit mode
                                    // We'll handle this via a rename dialog instead
                                    const el = document.querySelector<HTMLButtonElement>(`[data-role-rename="${role.id}"]`);
                                    el?.click();
                                  }}
                                  className="text-[13px]"
                                >
                                  <Pencil size={12} className="mr-2" /> Rename
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setDeleteTarget(role)}
                                  className="text-[13px] text-destructive focus:text-destructive focus:bg-destructive/10"
                                >
                                  <Trash2 size={12} className="mr-2" /> Delete role
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                        {isAdmin && (
                          <span className="text-[10px] bg-amber-400/10 text-amber-400/80 px-1.5 py-0.5 rounded font-medium leading-none">
                            Protected
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_GROUPS.map(({ group, items }) => (
                <>
                  {/* Group header */}
                  <tr key={`grp-${group}`} className="border-b border-border/10">
                    <td
                      colSpan={displayRoles.length + 1}
                      className="sticky left-0 px-4 py-1.5 text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest bg-muted/20 border-r border-border/10"
                    >
                      {group}
                    </td>
                  </tr>
                  {/* Permission rows */}
                  {items.map(({ key, label, desc }) => (
                    <tr key={key} className="border-b border-border/10 hover:bg-secondary/20 transition-colors group/row">
                      {/* Sticky label cell */}
                      <td className="sticky left-0 z-10 bg-card group-hover/row:bg-secondary/20 transition-colors px-4 py-3 border-r border-border/10">
                        <div>
                          <p className="text-[13px] font-medium text-foreground leading-tight">{label}</p>
                          <p className="text-[11px] text-muted-foreground/50 mt-0.5 leading-tight">{desc}</p>
                        </div>
                      </td>
                      {/* Toggle cells */}
                      {displayRoles.map(role => {
                        const isAdmin = role.name === ADMIN_ROLE_NAME;
                        const checked = isAdmin ? true : (role.permissions?.[key] === true);
                        return (
                          <td key={role.id} className="px-4 py-3 text-center">
                            <PermissionCell
                              checked={checked}
                              disabled={isAdmin}
                              onChange={v => savePermission(role.id, key, v)}
                            />
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

      {/* Add Role Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-sm bg-card border-border/20">
          <DialogHeader>
            <DialogTitle className="text-[15px]">Create new role</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-[13px] text-muted-foreground">Role name *</Label>
              <Input
                value={newRoleName}
                onChange={e => setNewRoleName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createRole(); }}
                placeholder="e.g. Content Manager"
                className="h-9 text-[13px] bg-secondary border-border/20"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] text-muted-foreground">Category</Label>
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger className="h-9 text-[13px] bg-secondary border-border/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="delivery" className="text-[13px]">Delivery</SelectItem>
                  <SelectItem value="management" className="text-[13px]">Management</SelectItem>
                  <SelectItem value="admin" className="text-[13px]">Admin</SelectItem>
                  <SelectItem value="sales" className="text-[13px]">Sales</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[13px] text-muted-foreground">Initial permissions</Label>
              {PERMISSION_GROUPS.map(({ group, items }) => (
                <div key={group} className="mt-2">
                  <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider mb-1 px-1">{group}</p>
                  {items.map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-secondary/40">
                      <span className="text-[13px] text-foreground">{label}</span>
                      <Switch
                        checked={newPerms[key] === true}
                        onCheckedChange={v => setNewPerms(p => ({ ...p, [key]: v }))}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)} className="text-[13px] h-8 border-border/20">Cancel</Button>
            <Button onClick={createRole} disabled={creating} className="text-[13px] h-8">
              {creating ? 'Creating…' : 'Create role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Role confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="bg-card border-border/20 sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px]">Delete &quot;{deleteTarget?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-muted-foreground">
              Users assigned this role will lose their permissions. This action cannot be undone.
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
