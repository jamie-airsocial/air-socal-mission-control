'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, UserX, UserCheck, LockKeyhole, Trash2, Clock, Search, X, ChevronsUpDown, ChevronUp, ChevronDown, Filter, Check, ShieldCheck, KeyRound } from 'lucide-react';
import { FilterPopover } from '@/components/ui/filter-popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
// Check + ChevronDown consolidated into top import
import { ASSIGNEE_COLORS, TEAM_STYLES, getTeamStyle } from '@/lib/constants';
import type { AppUser, Role } from '@/lib/auth-types';

// ── Relative time helper ─────────────────────────────────────────────────────
function relativeTime(isoString: string | null | undefined): string {
  if (!isoString) return 'Never';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return 'Just now';
  if (mins < 60) return `${mins} mins ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30.44);
  if (months < 12) return `${months} months ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function absoluteTime(isoString: string | null | undefined): string {
  if (!isoString) return 'Never logged in';
  return new Date(isoString).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function isOnline(isoString: string | null | undefined): boolean {
  if (!isoString) return false;
  return Date.now() - new Date(isoString).getTime() < 5 * 60_000; // < 5 minutes
}

// ── Sub-components ───────────────────────────────────────────────────────────
interface TeamOption { value: string; label: string; }

function TeamSelect({ value, onChange, teams }: { value: string; onChange: (v: string) => void; teams: TeamOption[] }) {
  const [open, setOpen] = useState(false);
  const selected = teams.find(t => t.value === value);
  const style = value ? getTeamStyle(value) : null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full h-9 px-3 text-[13px] rounded-md border border-border/20 bg-secondary flex items-center justify-between hover:border-border/40 transition-colors">
          {selected && style
            ? <span className={style.text}>{selected.label}</span>
            : <span className="text-muted-foreground/40">Select team…</span>}
          <ChevronDown size={14} className="text-muted-foreground/60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="start">
        {teams.map(t => {
          const ts = getTeamStyle(t.value);
          return (
            <button key={t.value} onClick={() => { onChange(t.value); setOpen(false); }}
              className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-[13px] hover:bg-muted/60 transition-colors ${value === t.value ? 'bg-muted/40' : ''}`}>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ts.color }} />
                <span className={ts.text}>{t.label}</span>
              </div>
              {value === t.value && <Check size={14} className="text-primary" />}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

function RoleSelect({ value, onChange, roles }: { value: string; onChange: (v: string) => void; roles: Role[] }) {
  const [open, setOpen] = useState(false);
  const selected = roles.find(r => r.id === value);
  // Hide Admin role from selection
  const selectableRoles = roles.filter(r => r.name !== 'Admin');
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full h-9 px-3 text-[13px] rounded-md border border-border/20 bg-secondary flex items-center justify-between hover:border-border/40 transition-colors">
          {selected
            ? <span>{selected.name}</span>
            : <span className="text-muted-foreground/40">Select role…</span>}
          <ChevronDown size={14} className="text-muted-foreground/60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        {selectableRoles.map(r => (
          <button key={r.id} onClick={() => { onChange(r.id); setOpen(false); }}
            className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-[13px] hover:bg-muted/60 transition-colors ${value === r.id ? 'bg-muted/40' : ''}`}>
            <span>{r.name}</span>
            {value === r.id && <Check size={14} className="text-primary" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// ── Types ────────────────────────────────────────────────────────────────────
interface UserFormData {
  email: string;
  full_name: string;
  role_id: string;
  team: string;
  password: string;
}

const emptyForm: UserFormData = { email: '', full_name: '', role_id: '', team: '', password: '' };

// ── Main page ────────────────────────────────────────────────────────────────
// Owner accounts — permissions cannot be changed by anyone
const OWNER_USER_IDS = ['83983bb2-3d05-4be3-97f3-fdac36929560']; // Jamie

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [teamOptions, setTeamOptions] = useState<TeamOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Search, filter, sort
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTeams, setFilterTeams] = useState<string[]>([]);
  const [filterRoles, setFilterRoles] = useState<string[]>([]);
  const [sortField, setSortField] = useState<'name' | 'email' | 'team' | 'role' | 'lastActive' | 'status'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return <ChevronsUpDown size={12} className="text-muted-foreground/30" />;
    return sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  // Add/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [form, setForm] = useState<UserFormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  // Deactivate dialog (soft, optional reassignment)
  const [deactivateTarget, setDeactivateTarget] = useState<AppUser | null>(null);
  const [deactivateReassignTo, setDeactivateReassignTo] = useState('');
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateReassignOpen, setDeactivateReassignOpen] = useState(false);

  // Delete dialog (hard delete, mandatory reassignment)
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);
  const [deleteReassignTo, setDeleteReassignTo] = useState('');
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteReassignOpen, setDeleteReassignOpen] = useState(false);

  // Permissions dialog
  const [permissionsTarget, setPermissionsTarget] = useState<AppUser | null>(null);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [customPermissions, setCustomPermissions] = useState<Partial<Record<string, boolean>>>({});
  const [savingPermissions, setSavingPermissions] = useState(false);

  const loadData = useCallback(async () => {
    const [usersRes, rolesRes, teamsRes] = await Promise.all([
      fetch('/api/users', { cache: 'no-store' }),
      fetch('/api/roles'),
      fetch('/api/teams'),
    ]);
    const [usersData, rolesData, teamsData] = await Promise.all([
      usersRes.json(), rolesRes.json(), teamsRes.json(),
    ]);
    setUsers(usersData || []);
    setRoles(rolesData || []);
    setTeamOptions((teamsData || []).map((t: { name: string }) => ({
      value: t.name.toLowerCase(),
      label: t.name,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Add/Edit ───────────────────────────────────────────────────────────────
  const openAdd = () => { setEditingUser(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (user: AppUser) => {
    setEditingUser(user);
    setForm({ email: user.email, full_name: user.full_name, role_id: user.role_id || '', team: user.team || '', password: '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.full_name) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      if (editingUser) {
        const res = await fetch(`/api/users/${editingUser.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ full_name: form.full_name, email: form.email, role_id: form.role_id || null, team: form.team || null }),
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
        toast.success('User updated', { description: `${form.full_name} has been updated.` });
      } else {
        if (!form.email) { toast.error('Email is required for new users'); return; }
        const res = await fetch('/api/users', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
        toast.success('User created', { description: `${form.full_name} can now log in with their email.` });
      }
      setDialogOpen(false);
      loadData();
    } catch (err) {
      toast.error('Error', { description: err instanceof Error ? err.message : 'Something went wrong' });
    } finally { setSaving(false); }
  };

  // ── Reset password ─────────────────────────────────────────────────────────
  const handleResetPassword = async (user: AppUser) => {
    try {
      const res = await fetch(`/api/users/${user.id}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send reset email');
      toast.success('Password reset email sent', { description: `Reset link sent to ${data.email}` });
    } catch (err) {
      toast.error('Failed to send reset email', { description: err instanceof Error ? err.message : 'Something went wrong' });
    }
  };

  // ── Reactivate ─────────────────────────────────────────────────────────────
  const handleReactivate = async (user: AppUser) => {
    const res = await fetch(`/api/users/${user.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: true }),
    });
    if (res.ok) {
      toast.success('User reactivated', { description: `${user.full_name} can now log in again.` });
      loadData();
    } else {
      toast.error('Failed to reactivate user');
    }
  };

  // ── Deactivate (soft) ──────────────────────────────────────────────────────
  const promptDeactivate = (user: AppUser) => { setDeactivateTarget(user); setDeactivateReassignTo(''); };

  const confirmDeactivate = async () => {
    if (!deactivateTarget) return;
    setDeactivating(true);
    try {
      if (deactivateReassignTo) {
        const res = await fetch('/api/tasks/reassign', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ from_assignee: deactivateTarget.full_name, to_assignee: deactivateReassignTo }),
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed to reassign tasks'); }
        const { count } = await res.json();
        if (count > 0) toast.success(`${count} task${count === 1 ? '' : 's'} reassigned to ${deactivateReassignTo}`);
      }
      const res = await fetch(`/api/users/${deactivateTarget.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: false }),
      });
      if (!res.ok) throw new Error('Failed to deactivate user');
      toast.success('User deactivated', { description: `${deactivateTarget.full_name} can no longer log in.` });
      setDeactivateTarget(null);
      loadData();
    } catch (err) {
      toast.error('Error', { description: err instanceof Error ? err.message : 'Something went wrong' });
    } finally { setDeactivating(false); }
  };

  // ── Delete (hard) ──────────────────────────────────────────────────────────
  const promptDelete = (user: AppUser) => {
    // Prevent deleting the last admin
    if (user.is_admin) {
      const otherAdmins = users.filter(u => u.is_admin && u.id !== user.id && u.is_active).length;
      if (otherAdmins === 0) {
        toast.error('Cannot delete the only admin', { description: 'Grant admin access to another user first.' });
        return;
      }
    }
    setDeleteTarget(user); setDeleteReassignTo(''); setDeleteConfirmName('');
  };

  const canConfirmDelete = deleteTarget
    ? deleteReassignTo.length > 0 && deleteConfirmName === deleteTarget.full_name
    : false;

  const confirmDelete = async () => {
    if (!deleteTarget || !canConfirmDelete) return;
    setDeleting(true);
    try {
      // Reassign ALL tasks (open + done) from this user before permanent deletion
      const res = await fetch('/api/tasks/reassign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from_assignee: deleteTarget.full_name, to_assignee: deleteReassignTo, all_statuses: true }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed to reassign tasks'); }
      const { count } = await res.json();
      if (count > 0) toast.success(`${count} task${count === 1 ? '' : 's'} reassigned to ${deleteReassignTo}`);

      // Hard delete user
      const delRes = await fetch(`/api/users/${deleteTarget.id}`, { method: 'DELETE' });
      if (!delRes.ok) { const e = await delRes.json(); throw new Error(e.error || 'Failed to delete user'); }
      toast.success('User permanently deleted', { description: `${deleteTarget.full_name} has been removed.` });
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      toast.error('Delete failed', { description: err instanceof Error ? err.message : 'Something went wrong' });
    } finally { setDeleting(false); }
  };

  // ── Admin toggle ───────────────────────────────────────────────────────────
  const handleToggleAdmin = async (user: AppUser) => {
    const newAdminState = !user.is_admin;
    // Prevent removing the last admin
    if (!newAdminState) {
      const adminCount = users.filter(u => u.is_admin && u.id !== user.id && u.is_active).length;
      if (adminCount === 0) {
        toast.error('Cannot remove admin access', { description: 'This is the only admin. Grant admin access to another user first.' });
        return;
      }
    }
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_admin: newAdminState }),
      });
      if (!res.ok) throw new Error('Failed to update admin status');
      toast.success(
        newAdminState ? 'Admin access granted' : 'Admin access revoked',
        { description: `${user.full_name} ${newAdminState ? 'now has' : 'no longer has'} full admin access.` }
      );
      loadData();
    } catch (err) {
      toast.error('Failed to update admin status', {
        description: err instanceof Error ? err.message : 'Something went wrong',
      });
    }
  };

  // ── Permissions dialog ─────────────────────────────────────────────────────
  const openPermissions = (user: AppUser) => {
    setPermissionsTarget(user);
    // Load current effective permissions (role + overrides)
    const rolePerms = user.role?.permissions || {};
    const userOverrides = user.permission_overrides || {};
    setCustomPermissions({ ...rolePerms, ...userOverrides });
    setPermissionsOpen(true);
  };

  const handleSavePermissions = async () => {
    if (!permissionsTarget) return;
    setSavingPermissions(true);
    try {
      // Only send overrides that differ from role defaults
      const rolePerms = (permissionsTarget.role?.permissions || {}) as Record<string, boolean | undefined>;
      const overrides: Record<string, boolean> = {};
      Object.keys(customPermissions).forEach((key) => {
        if (customPermissions[key] !== rolePerms[key]) {
          overrides[key] = customPermissions[key] || false;
        }
      });

      const res = await fetch(`/api/users/${permissionsTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permission_overrides: Object.keys(overrides).length > 0 ? overrides : null,
        }),
      });
      if (!res.ok) throw new Error('Failed to update permissions');
      toast.success('Permissions updated', {
        description: `Custom permissions set for ${permissionsTarget.full_name}.`,
      });
      setPermissionsOpen(false);
      loadData();
    } catch (err) {
      toast.error('Failed to update permissions', {
        description: err instanceof Error ? err.message : 'Something went wrong',
      });
    } finally {
      setSavingPermissions(false);
    }
  };

  const handleResetPermissions = async () => {
    if (!permissionsTarget) return;
    try {
      const res = await fetch(`/api/users/${permissionsTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permission_overrides: null }),
      });
      if (!res.ok) throw new Error('Failed to reset permissions');
      toast.success('Permissions reset', {
        description: `${permissionsTarget.full_name} now uses their role defaults.`,
      });
      setPermissionsOpen(false);
      loadData();
    } catch (err) {
      toast.error('Failed to reset permissions', {
        description: err instanceof Error ? err.message : 'Something went wrong',
      });
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const activeUsers = users.filter(u => u.is_active);
  const otherActiveUsers = (excludeId: string) => activeUsers.filter(u => u.id !== excludeId);

  // Filter
  const filteredUsers = users.filter(u => {
    if (searchQuery && !u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) && !u.email.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterTeams.length > 0 && !filterTeams.includes(u.team || '')) return false;
    if (filterRoles.length > 0 && !filterRoles.includes(u.role_id || '')) return false;
    return true;
  });

  // Sort
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    switch (sortField) {
      case 'name': return dir * a.full_name.localeCompare(b.full_name);
      case 'email': return dir * a.email.localeCompare(b.email);
      case 'team': return dir * (a.team || 'zzz').localeCompare(b.team || 'zzz');
      case 'role': return dir * ((a.role?.name || 'zzz').localeCompare(b.role?.name || 'zzz'));
      case 'lastActive': {
        const aTime = a.last_active_at || a.last_sign_in_at || '';
        const bTime = b.last_active_at || b.last_sign_in_at || '';
        return dir * aTime.localeCompare(bTime);
      }
      case 'status': return dir * (Number(b.is_active) - Number(a.is_active));
      default: return 0;
    }
  });

  const hasFilters = searchQuery || filterTeams.length > 0 || filterRoles.length > 0;

  return (
    <TooltipProvider delayDuration={600}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[13px] text-muted-foreground">
            {activeUsers.length} active · {users.length - activeUsers.length} inactive
          </p>
          <Button onClick={openAdd} size="sm" className="h-8 text-[13px] gap-1.5">
            <Plus size={14} /> Add user
          </Button>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="h-8 w-full sm:w-[180px] pl-8 pr-3 text-[13px] bg-secondary border border-border/20 rounded-lg outline-none focus:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors duration-150 placeholder:text-muted-foreground/60"
            />
          </div>
          <FilterPopover
            label="Team"
            options={teamOptions.map(t => ({ value: t.value, label: t.label }))}
            selected={filterTeams}
            onSelectionChange={setFilterTeams}
          />
          <FilterPopover
            label="Role"
            options={roles.filter(r => r.name !== 'Admin').map(r => ({ value: r.id, label: r.name }))}
            selected={filterRoles}
            onSelectionChange={setFilterRoles}
            width="w-52"
          />
          {hasFilters && (
            <button onClick={() => { setSearchQuery(''); setFilterTeams([]); setFilterRoles([]); }}
              className="h-8 px-3 text-[13px] rounded-lg border border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors flex items-center gap-1.5">
              <X size={12} /> Clear
            </button>
          )}
          <p className="text-[12px] text-muted-foreground/50 ml-auto">{sortedUsers.length} of {users.length} users</p>
        </div>

        <div className="bg-card border border-border/20 rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border/20 hover:bg-transparent">
                {([['name', 'Name'], ['email', 'Email'], ['team', 'Team'], ['role', 'Role'], ['lastActive', 'Last Active'], ['status', 'Status']] as const).map(([field, label]) => (
                  <TableHead key={field}
                    className="text-[12px] text-muted-foreground font-medium cursor-pointer select-none hover:text-foreground transition-colors"
                    onClick={() => toggleSort(field)}>
                    <span className="flex items-center gap-1">{label} <SortIcon field={field} /></span>
                  </TableHead>
                ))}
                <TableHead className="text-[12px] text-muted-foreground font-medium w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-[13px] text-muted-foreground/40">
                    Loading users…
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-[13px] text-muted-foreground/40">
                    No users yet
                  </TableCell>
                </TableRow>
              ) : sortedUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-[13px] text-muted-foreground/40">
                    No users match filters
                  </TableCell>
                </TableRow>
              ) : sortedUsers.map(user => {
                const ts = user.team ? getTeamStyle(user.team) : null;
                const colorClass = ASSIGNEE_COLORS[user.full_name] || 'bg-primary/20 text-primary';
                const isInactive = !user.is_active;
                return (
                  <TableRow
                    key={user.id}
                    className={`border-border/20 transition-colors ${isInactive ? 'opacity-50' : 'hover:bg-secondary/30'}`}
                  >
                    <TableCell className="text-[13px]">
                      <div className="flex items-center gap-2.5">
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt={user.full_name}
                            className="w-7 h-7 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium shrink-0 ${colorClass}`}>
                            {user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </div>
                        )}
                        <span className={`font-medium ${isInactive ? 'text-muted-foreground' : 'text-foreground'}`}>
                          {user.full_name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      {user.team && ts ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[12px] font-medium ${ts.bg} ${ts.text}`}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ts.color }} />
                          {teamOptions.find(t => t.value === user.team)?.label || user.team}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40 text-[13px]">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">
                      {user.role?.name || '—'}
                    </TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground/60 cursor-default">
                            {isOnline(user.last_active_at) ? (
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" title="Online now" />
                            ) : (
                              <Clock size={11} className="shrink-0" />
                            )}
                            <span>{user.last_active_at ? relativeTime(user.last_active_at) : relativeTime(user.last_sign_in_at)}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-[12px]">
                          {user.last_active_at ? (
                            <div>
                              <p className="font-medium">Last active: {absoluteTime(user.last_active_at)}</p>
                              <p className="text-muted-foreground/60 mt-0.5">Last login: {absoluteTime(user.last_sign_in_at)}</p>
                            </div>
                          ) : absoluteTime(user.last_sign_in_at)}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded text-[12px] font-medium ${
                        user.is_active
                          ? 'bg-status-success/10 text-status-success'
                          : 'bg-muted/40 text-muted-foreground/60'
                      }`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-0.5">
                        {/* Edit */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button onClick={() => openEdit(user)}
                              className="p-1.5 rounded hover:bg-muted/60 text-muted-foreground/60 hover:text-foreground transition-colors">
                              <Pencil size={14} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-[12px]">Edit</TooltipContent>
                        </Tooltip>

                        {/* Admin toggle */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button onClick={() => !OWNER_USER_IDS.includes(user.id) && handleToggleAdmin(user)}
                              className={`p-1.5 rounded transition-colors ${
                                OWNER_USER_IDS.includes(user.id)
                                  ? 'bg-primary/10 text-primary cursor-not-allowed opacity-60'
                                  : user.is_admin
                                    ? 'bg-primary/10 text-primary hover:bg-primary/20'
                                    : 'text-muted-foreground/60 hover:bg-blue-500/10 hover:text-blue-400'
                              }`}>
                              <ShieldCheck size={14} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-[12px]">
                            {OWNER_USER_IDS.includes(user.id) ? 'Owner — cannot be changed' : user.is_admin ? 'Remove admin access' : 'Grant admin access'}
                          </TooltipContent>
                        </Tooltip>

                        {/* Custom permissions */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button onClick={() => !OWNER_USER_IDS.includes(user.id) && openPermissions(user)}
                              className={`p-1.5 rounded transition-colors ${
                                OWNER_USER_IDS.includes(user.id)
                                  ? 'text-muted-foreground/30 cursor-not-allowed'
                                  : user.permission_overrides
                                    ? 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20'
                                    : 'text-muted-foreground/60 hover:bg-muted/60 hover:text-foreground'
                              }`}>
                              <KeyRound size={14} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-[12px]">
                            {OWNER_USER_IDS.includes(user.id) ? 'Owner — cannot be changed' : user.permission_overrides ? 'Edit custom permissions' : 'Set custom permissions'}
                          </TooltipContent>
                        </Tooltip>

                        {/* Reset password */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button onClick={() => handleResetPassword(user)}
                              className="p-1.5 rounded hover:bg-amber-500/10 text-muted-foreground/60 hover:text-amber-400 transition-colors">
                              <LockKeyhole size={14} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-[12px]">Send password reset</TooltipContent>
                        </Tooltip>

                        {/* Deactivate / Reactivate */}
                        {user.is_active ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button onClick={() => !OWNER_USER_IDS.includes(user.id) && promptDeactivate(user)}
                                className={`p-1.5 rounded transition-colors ${OWNER_USER_IDS.includes(user.id) ? 'text-muted-foreground/30 cursor-not-allowed' : 'hover:bg-orange-500/10 text-muted-foreground/60 hover:text-orange-400'}`}>
                                <UserX size={14} />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-[12px]">Deactivate</TooltipContent>
                          </Tooltip>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button onClick={() => handleReactivate(user)}
                                className="p-1.5 rounded hover:bg-status-success/10 text-muted-foreground/60 hover:text-status-success transition-colors">
                                <UserCheck size={14} />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-[12px]">Reactivate</TooltipContent>
                          </Tooltip>
                        )}

                        {/* Hard delete */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button onClick={() => promptDelete(user)}
                              className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground/60 hover:text-destructive transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-[12px]">Permanently delete</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* ── Add/Edit dialog ───────────────────────────────────────────────── */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md bg-card border-border/20">
            <DialogHeader>
              <DialogTitle className="text-[15px]">{editingUser ? 'Edit user' : 'Add new user'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-[13px] text-muted-foreground">Full name *</Label>
                <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="Sophie Gore" className="h-9 text-[13px] bg-secondary border-border/20" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px] text-muted-foreground">Email *</Label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="name@airsocial.co.uk" className="h-9 text-[13px] bg-secondary border-border/20" />
                {editingUser && (
                  <p className="text-[11px] text-muted-foreground/50">
                    Changing email updates both the app and Supabase Auth.
                  </p>
                )}
              </div>
              {!editingUser && (
                <div className="space-y-1.5">
                  <Label className="text-[13px] text-muted-foreground">Temporary password</Label>
                  <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Leave blank for default" className="h-9 text-[13px] bg-secondary border-border/20" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-[13px] text-muted-foreground">Team *</Label>
                <TeamSelect value={form.team} onChange={v => setForm(f => ({ ...f, team: v }))} teams={teamOptions} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px] text-muted-foreground">Role</Label>
                <RoleSelect value={form.role_id} onChange={v => setForm(f => ({ ...f, role_id: v }))} roles={roles} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="text-[13px] h-8 border-border/20">Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="text-[13px] h-8">
                {saving ? 'Saving…' : editingUser ? 'Save changes' : 'Create user'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Deactivate dialog (soft, optional reassignment) ───────────────── */}
        <AlertDialog open={!!deactivateTarget} onOpenChange={open => { if (!open) setDeactivateTarget(null); }}>
          <AlertDialogContent className="bg-card border-border/20 sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-[15px]">
                Deactivate {deactivateTarget?.full_name}?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-[13px] text-muted-foreground">
                Their account will be disabled and they won&apos;t be able to log in.
                Their tasks will remain assigned to them unless you choose to reassign below.
              </AlertDialogDescription>
            </AlertDialogHeader>

            {deactivateTarget && otherActiveUsers(deactivateTarget.id).length > 0 && (
              <div className="px-1 pb-1 space-y-1.5">
                <p className="text-[12px] text-muted-foreground/60">Optionally reassign their open tasks to:</p>
                <Popover open={deactivateReassignOpen} onOpenChange={setDeactivateReassignOpen}>
                  <PopoverTrigger asChild>
                    <button className="w-full h-9 px-3 text-[13px] rounded-md border border-border/20 bg-secondary flex items-center justify-between hover:border-border/40 transition-colors">
                      <span className={deactivateReassignTo ? 'text-foreground' : 'text-muted-foreground/40'}>
                        {deactivateReassignTo || '— Keep tasks assigned to them —'}
                      </span>
                      <ChevronDown size={14} className="text-muted-foreground/60" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-1" align="start">
                    <button
                      onClick={() => { setDeactivateReassignTo(''); setDeactivateReassignOpen(false); }}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-[13px] transition-colors duration-150 ${
                        !deactivateReassignTo ? 'bg-primary/10 text-primary' : 'hover:bg-muted/60 text-muted-foreground'
                      }`}
                    >
                      <span>— Keep tasks assigned to them —</span>
                      {!deactivateReassignTo && <Check size={12} />}
                    </button>
                    {otherActiveUsers(deactivateTarget.id).map(u => (
                      <button
                        key={u.id}
                        onClick={() => { setDeactivateReassignTo(u.full_name); setDeactivateReassignOpen(false); }}
                        className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-[13px] transition-colors duration-150 ${
                          deactivateReassignTo === u.full_name ? 'bg-primary/10 text-primary' : 'hover:bg-muted/60 text-muted-foreground'
                        }`}
                      >
                        <span>{u.full_name}</span>
                        {deactivateReassignTo === u.full_name && <Check size={12} />}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <AlertDialogFooter>
              <AlertDialogCancel className="text-[13px] h-8 border-border/20">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeactivate}
                disabled={deactivating}
                className="text-[13px] h-8 bg-orange-500 text-white hover:bg-orange-600"
              >
                {deactivating ? 'Deactivating…' : 'Deactivate'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ── Delete dialog (hard delete, mandatory reassignment) ───────────── */}
        <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
          <AlertDialogContent className="bg-card border-destructive/30 sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-[15px] text-destructive flex items-center gap-2">
                <Trash2 size={16} />
                Permanently delete {deleteTarget?.full_name}?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-[13px] text-muted-foreground space-y-1">
                <span className="block font-medium text-destructive/80">
                  ⚠️ This cannot be undone.
                </span>
                <span className="block">
                  This will permanently remove the user from the app and revoke their Supabase Auth account.
                  You must reassign their tasks to another team member before proceeding.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="px-1 pb-1 space-y-3">
              {/* Mandatory reassignment */}
              <div className="space-y-1.5">
                <p className="text-[12px] font-medium text-muted-foreground">
                  Reassign all tasks to: <span className="text-destructive">*</span>
                </p>
                {deleteTarget && otherActiveUsers(deleteTarget.id).length > 0 ? (
                  <Popover open={deleteReassignOpen} onOpenChange={setDeleteReassignOpen}>
                    <PopoverTrigger asChild>
                      <button className={`w-full h-9 px-3 text-[13px] rounded-md bg-secondary flex items-center justify-between transition-colors border ${
                        deleteReassignTo ? 'border-border/20 hover:border-border/40' : 'border-destructive/40 hover:border-destructive/60'
                      }`}>
                        <span className={deleteReassignTo ? 'text-foreground' : 'text-muted-foreground/40'}>
                          {deleteReassignTo || '— Select a team member —'}
                        </span>
                        <ChevronDown size={14} className="text-muted-foreground/60" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-1" align="start">
                      {otherActiveUsers(deleteTarget.id).map(u => (
                        <button
                          key={u.id}
                          onClick={() => { setDeleteReassignTo(u.full_name); setDeleteReassignOpen(false); }}
                          className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-[13px] transition-colors duration-150 ${
                            deleteReassignTo === u.full_name ? 'bg-primary/10 text-primary' : 'hover:bg-muted/60 text-muted-foreground'
                          }`}
                        >
                          <span>{u.full_name}</span>
                          {deleteReassignTo === u.full_name && <Check size={12} />}
                        </button>
                      ))}
                    </PopoverContent>
                  </Popover>
                ) : (
                  <p className="text-[12px] text-destructive/60 italic">No other active users to reassign to. Add another user first.</p>
                )}
              </div>

              {/* Confirm by typing name */}
              <div className="space-y-1.5">
                <p className="text-[12px] text-muted-foreground">
                  Type <span className="font-mono font-semibold text-foreground">{deleteTarget?.full_name}</span> to confirm:
                </p>
                <Input
                  value={deleteConfirmName}
                  onChange={e => setDeleteConfirmName(e.target.value)}
                  placeholder={deleteTarget?.full_name}
                  className={`h-9 text-[13px] bg-secondary border-border/20 font-mono ${
                    deleteConfirmName && deleteConfirmName !== deleteTarget?.full_name ? 'border-destructive/50' : ''
                  }`}
                />
              </div>
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel className="text-[13px] h-8 border-border/20">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                disabled={deleting || !canConfirmDelete}
                className="text-[13px] h-8 bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-40"
              >
                {deleting ? 'Deleting…' : 'Permanently delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ── Permissions dialog ────────────────────────────────────────────── */}
        <Dialog open={permissionsOpen} onOpenChange={setPermissionsOpen}>
          <DialogContent className="sm:max-w-lg bg-card border-border/20">
            <DialogHeader>
              <DialogTitle className="text-[15px] flex items-center gap-2">
                <KeyRound size={16} />
                Custom permissions for {permissionsTarget?.full_name}
              </DialogTitle>
              <p className="text-[12px] text-muted-foreground/60 mt-1">
                {permissionsTarget?.is_admin ? (
                  <span className="text-primary font-medium">Admin users have full access to everything.</span>
                ) : permissionsTarget?.role ? (
                  <>Role: <span className="font-medium text-foreground">{permissionsTarget.role.name}</span> · Overrides apply on top of role defaults</>
                ) : (
                  <>No role assigned · Set custom permissions below</>
                )}
              </p>
            </DialogHeader>

            {permissionsTarget && !permissionsTarget.is_admin && (
              <div className="space-y-4 py-2">
                {/* Page access */}
                <div className="space-y-2">
                  <p className="text-[12px] font-medium text-muted-foreground">Page access</p>
                  <div className="grid grid-cols-2 gap-2">
                    {['dashboard', 'tasks', 'clients', 'pipeline', 'teams', 'xero', 'settings'].map((perm) => {
                      const overrides = permissionsTarget.permission_overrides as Record<string, boolean | undefined> | null | undefined;
                      const isOverridden = overrides && overrides[perm] !== undefined;
                      return (
                        <div key={perm} className="flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-secondary/40 border border-border/20">
                          <div className="flex items-center gap-2">
                            {isOverridden && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" title="Custom override" />}
                            <span className="text-[13px] capitalize">{perm}</span>
                          </div>
                          <Switch
                            checked={customPermissions[perm] || false}
                            onCheckedChange={(checked) => setCustomPermissions(p => ({ ...p, [perm]: checked }))}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Action permissions */}
                <div className="space-y-2">
                  <p className="text-[12px] font-medium text-muted-foreground">Action permissions</p>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { key: 'manage_users', label: 'Manage users' },
                      { key: 'manage_clients', label: 'Manage clients' },
                      { key: 'manage_tasks', label: 'Manage tasks' },
                      { key: 'manage_prospects', label: 'Manage prospects' },
                      { key: 'manage_billing', label: 'Manage billing' },
                    ].map(({ key, label }) => {
                      const overrides = permissionsTarget.permission_overrides as Record<string, boolean | undefined> | null | undefined;
                      const isOverridden = overrides && overrides[key] !== undefined;
                      return (
                        <div key={key} className="flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-secondary/40 border border-border/20">
                          <div className="flex items-center gap-2">
                            {isOverridden && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" title="Custom override" />}
                            <span className="text-[13px]">{label}</span>
                          </div>
                          <Switch
                            checked={customPermissions[key] || false}
                            onCheckedChange={(checked) => setCustomPermissions(p => ({ ...p, [key]: checked }))}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {permissionsTarget?.is_admin && (
              <div className="py-6 text-center">
                <p className="text-[13px] text-muted-foreground/60">
                  Admin users have unrestricted access. Remove admin status to set custom permissions.
                </p>
              </div>
            )}

            <DialogFooter className="flex items-center gap-2">
              {permissionsTarget?.permission_overrides && !permissionsTarget.is_admin && (
                <Button variant="outline" onClick={handleResetPermissions} className="text-[13px] h-8 border-border/20 mr-auto">
                  Reset to role defaults
                </Button>
              )}
              <Button variant="outline" onClick={() => setPermissionsOpen(false)} className="text-[13px] h-8 border-border/20">
                Cancel
              </Button>
              {!permissionsTarget?.is_admin && (
                <Button onClick={handleSavePermissions} disabled={savingPermissions} className="text-[13px] h-8">
                  {savingPermissions ? 'Saving…' : 'Save permissions'}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
