'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, MoreHorizontal, Check, Pencil, ShieldCheck, Loader2, ChevronDown } from 'lucide-react';
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
const PROTECTED_IDS = ['00000000-0000-0000-0000-000000000001']; // Admin only

const CATEGORY_ORDER: Record<string, number> = {
  'management': 0,
  'sales': 1,
  'admin': 2,
  'delivery': 3,
};

const CATEGORY_LABELS: Record<string, string> = {
  'management': 'Management',
  'sales': 'Sales',
  'admin': 'Admin',
  'delivery': 'Delivery Team',
};

const CATEGORIES = [
  { value: 'management', label: 'Management' },
  { value: 'sales', label: 'Sales' },
  { value: 'admin', label: 'Admin' },
  { value: 'delivery', label: 'Delivery Team' },
];

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
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [editRoleName, setEditRoleName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editPerms, setEditPerms] = useState<Permissions>(DEFAULT_PERMS);
  const [newRoleName, setNewRoleName] = useState('');
  const [newPerms, setNewPerms] = useState<Permissions>(DEFAULT_PERMS);
  const [newCategory, setNewCategory] = useState<string>('delivery');
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [editCategoryOpen, setEditCategoryOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
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

  // Open edit dialog
  const openEditDialog = (role: Role) => {
    setEditingRole(role);
    setEditRoleName(role.name);
    setEditCategory(role.category || 'delivery');
    setEditPerms(role.permissions || DEFAULT_PERMS);
    setEditDialogOpen(true);
  };

  // Update role
  const updateRole = async () => {
    if (!editingRole || !editRoleName.trim()) { 
      toast.error('Role name is required'); 
      return; 
    }
    setUpdating(true);
    const res = await fetch(`/api/roles/${editingRole.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        name: editRoleName.trim(), 
        category: editCategory,
        permissions: editPerms 
      }),
    });
    setUpdating(false);
    if (res.ok) {
      toast.success('Role updated');
      setEditDialogOpen(false);
      setEditingRole(null);
      loadRoles();
    } else {
      const e = await res.json();
      toast.error(e.error || 'Failed to update role');
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

  // Separate Admin role and sort others by category
  const adminRole = roles.find(r => r.name === ADMIN_ROLE_NAME);
  const otherRoles = roles
    .filter(r => r.name !== ADMIN_ROLE_NAME)
    .sort((a, b) => {
      const aCat = a.category || 'other';
      const bCat = b.category || 'other';
      const aOrder = CATEGORY_ORDER[aCat] ?? 999;
      const bOrder = CATEGORY_ORDER[bCat] ?? 999;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.name.localeCompare(b.name);
    });

  // Group roles by category for rendering with headers
  const rolesByCategory: Record<string, Role[]> = {};
  otherRoles.forEach(role => {
    const cat = role.category || 'other';
    if (!rolesByCategory[cat]) rolesByCategory[cat] = [];
    rolesByCategory[cat].push(role);
  });

  // Order categories
  const orderedCategories = Object.keys(rolesByCategory).sort((a, b) => {
    const aOrder = CATEGORY_ORDER[a] ?? 999;
    const bOrder = CATEGORY_ORDER[b] ?? 999;
    return aOrder - bOrder;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] text-muted-foreground">
            {roles.length} role{roles.length !== 1 ? 's' : ''} · {ALL_PERMISSION_KEYS.length} permissions
          </p>
          <p className="text-[11px] text-muted-foreground/50 mt-0.5">
            Permission changes save instantly
          </p>
        </div>
        <Button size="sm" onClick={() => setAddDialogOpen(true)} className="h-8 text-[13px] gap-1.5">
          <Plus size={14} /> Add role
        </Button>
      </div>

      {/* Admin role card - separate from matrix */}
      {adminRole && (
        <div className="bg-card border border-amber-400/20 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-amber-400" />
            <span className="text-[13px] font-semibold text-amber-400">{adminRole.name}</span>
            <span className="text-[10px] bg-amber-400/10 text-amber-400/80 px-1.5 py-0.5 rounded font-medium">
              Protected
            </span>
            <span className="text-[11px] text-muted-foreground ml-auto">
              Full system access
            </span>
          </div>
        </div>
      )}

      {/* Matrix table */}
      <div className="bg-card border border-border/20 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              {/* Category header row — only show for categories with 2+ roles */}
              <tr className="border-b border-border/10">
                <th className="sticky left-0 z-10 bg-muted/30 border-r border-border/10" />
                {orderedCategories.map(cat => {
                  const rolesInCat = rolesByCategory[cat] || [];
                  if (rolesInCat.length <= 1) {
                    return <th key={cat} className="border-l border-border/10" />;
                  }
                  return (
                    <th
                      key={cat}
                      colSpan={rolesInCat.length}
                      className={`px-3 py-1.5 text-center text-[11px] font-semibold border-l border-border/10 ${
                        cat === 'delivery' ? 'text-primary bg-primary/5' : 'text-muted-foreground/50'
                      }`}
                    >
                      {CATEGORY_LABELS[cat] || cat}
                    </th>
                  );
                })}
              </tr>
              {/* Role name row */}
              <tr className="border-b border-border/20 bg-muted/30">
                <th className="sticky left-0 z-10 bg-muted/30 text-left px-3 py-2 text-[11px] font-semibold text-muted-foreground/60 min-w-[200px] border-r border-border/10">
                  Permission
                </th>
                {orderedCategories.map(cat => {
                  const rolesInCat = rolesByCategory[cat] || [];
                  return rolesInCat.map(role => {
                    const isProtected = PROTECTED_IDS.includes(role.id);
                    const isDelivery = cat === 'delivery';
                    return (
                      <th key={role.id} className={`px-3 py-2 text-center min-w-[160px] border-l border-border/10 whitespace-nowrap ${isDelivery ? 'bg-primary/5' : ''}`}>
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="text-[13px] font-semibold text-foreground">
                            {role.name}
                          </span>
                          {!isProtected && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="p-0.5 rounded hover:bg-muted/60 text-muted-foreground/30 hover:text-muted-foreground transition-colors">
                                  <MoreHorizontal size={13} />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="center" className="w-40">
                                <DropdownMenuItem
                                  onClick={() => openEditDialog(role)}
                                  className="text-[13px]"
                                >
                                  <Pencil size={12} className="mr-2" /> Edit role
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
                      </th>
                    );
                  });
                })}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_GROUPS.map(({ group, items }) => (
                <>
                  {/* Group header */}
                  <tr key={`grp-${group}`} className="border-b border-border/10">
                    <td
                      colSpan={otherRoles.length + 1}
                      className="sticky left-0 px-3 py-1 text-[10px] font-semibold text-muted-foreground/50 bg-muted/20 border-r border-border/10"
                    >
                      {group}
                    </td>
                  </tr>
                  {/* Permission rows */}
                  {items.map(({ key, label, desc }) => (
                    <tr key={key} className="border-b border-border/10 hover:bg-secondary/20 transition-colors group/row">
                      {/* Sticky label cell */}
                      <td className="sticky left-0 z-10 bg-card group-hover/row:bg-secondary/20 transition-colors px-3 py-2 border-r border-border/10">
                        <div>
                          <p className="text-[13px] font-medium text-foreground leading-tight">{label}</p>
                          <p className="text-[11px] text-muted-foreground/50 mt-0.5 leading-tight">{desc}</p>
                        </div>
                      </td>
                      {/* Toggle cells */}
                      {otherRoles.map(role => {
                        const checked = role.permissions?.[key] === true;
                        const isDelivery = role.category === 'delivery';
                        return (
                          <td key={role.id} className={`px-3 py-2 text-center border-l border-border/10 ${isDelivery ? 'bg-primary/[0.02]' : ''}`}>
                            <PermissionCell
                              checked={checked}
                              disabled={false}
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
              <Popover open={newCategoryOpen} onOpenChange={setNewCategoryOpen}>
                <PopoverTrigger asChild>
                  <button className="w-full h-9 px-3 text-[13px] rounded-md border border-border/20 bg-secondary flex items-center justify-between hover:border-border/40 transition-colors">
                    {CATEGORIES.find(c => c.value === newCategory)?.label || 'Select category…'}
                    <ChevronDown size={14} className="text-muted-foreground/60" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-1" align="start">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.value}
                      onClick={() => {
                        setNewCategory(cat.value);
                        setNewCategoryOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-[13px] hover:bg-muted/60 transition-colors ${newCategory === cat.value ? 'bg-muted/40' : ''}`}
                    >
                      <span>{cat.label}</span>
                      {newCategory === cat.value && <Check size={14} className="text-primary" />}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label className="text-[13px] text-muted-foreground">Initial permissions</Label>
              {PERMISSION_GROUPS.map(({ group, items }) => (
                <div key={group} className="mt-2">
                  <p className="text-[10px] font-semibold text-muted-foreground/50 mb-1 px-1">{group}</p>
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

      {/* Edit Role Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-sm bg-card border-border/20">
          <DialogHeader>
            <DialogTitle className="text-[15px]">Edit role</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-[13px] text-muted-foreground">Role name *</Label>
              <Input
                value={editRoleName}
                onChange={e => setEditRoleName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') updateRole(); }}
                placeholder="e.g. Content Manager"
                className="h-9 text-[13px] bg-secondary border-border/20"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] text-muted-foreground">Category</Label>
              <Popover open={editCategoryOpen} onOpenChange={setEditCategoryOpen}>
                <PopoverTrigger asChild>
                  <button className="w-full h-9 px-3 text-[13px] rounded-md border border-border/20 bg-secondary flex items-center justify-between hover:border-border/40 transition-colors">
                    {CATEGORIES.find(c => c.value === editCategory)?.label || 'Select category…'}
                    <ChevronDown size={14} className="text-muted-foreground/60" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-1" align="start">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.value}
                      onClick={() => {
                        setEditCategory(cat.value);
                        setEditCategoryOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-[13px] hover:bg-muted/60 transition-colors ${editCategory === cat.value ? 'bg-muted/40' : ''}`}
                    >
                      <span>{cat.label}</span>
                      {editCategory === cat.value && <Check size={14} className="text-primary" />}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label className="text-[13px] text-muted-foreground">Permissions</Label>
              {PERMISSION_GROUPS.map(({ group, items }) => (
                <div key={group} className="mt-2">
                  <p className="text-[10px] font-semibold text-muted-foreground/50 mb-1 px-1">{group}</p>
                  {items.map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-secondary/40">
                      <span className="text-[13px] text-foreground">{label}</span>
                      <Switch
                        checked={editPerms[key] === true}
                        onCheckedChange={v => setEditPerms(p => ({ ...p, [key]: v }))}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="text-[13px] h-8 border-border/20">Cancel</Button>
            <Button onClick={updateRole} disabled={updating} className="text-[13px] h-8">
              {updating ? 'Saving…' : 'Save changes'}
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
