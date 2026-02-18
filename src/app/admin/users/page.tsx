'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, UserX, UserCheck, KeyRound } from 'lucide-react';
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
import { Check, ChevronDown } from 'lucide-react';
import { ASSIGNEE_COLORS, TEAM_STYLES } from '@/lib/constants';
import type { AppUser, Role } from '@/lib/auth-types';

const TEAMS = [
  { value: 'synergy', label: 'Synergy' },
  { value: 'ignite', label: 'Ignite' },
  { value: 'alliance', label: 'Alliance' },
];

function TeamSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = TEAMS.find(t => t.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full h-9 px-3 text-[13px] rounded-md border border-border/20 bg-secondary flex items-center justify-between hover:border-border/40 transition-colors">
          {selected ? (
            <span className={TEAM_STYLES[value as keyof typeof TEAM_STYLES]?.text}>{selected.label}</span>
          ) : (
            <span className="text-muted-foreground/40">Select team…</span>
          )}
          <ChevronDown size={14} className="text-muted-foreground/60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="start">
        {TEAMS.map(t => (
          <button
            key={t.value}
            onClick={() => { onChange(t.value); setOpen(false); }}
            className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-[13px] hover:bg-muted/60 transition-colors ${value === t.value ? 'bg-muted/40' : ''}`}
          >
            <span className={TEAM_STYLES[t.value as keyof typeof TEAM_STYLES]?.text}>{t.label}</span>
            {value === t.value && <Check size={14} className="text-primary" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function RoleSelect({ value, onChange, roles }: { value: string; onChange: (v: string) => void; roles: Role[] }) {
  const [open, setOpen] = useState(false);
  const selected = roles.find(r => r.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full h-9 px-3 text-[13px] rounded-md border border-border/20 bg-secondary flex items-center justify-between hover:border-border/40 transition-colors">
          {selected ? (
            <span>{selected.name}</span>
          ) : (
            <span className="text-muted-foreground/40">Select role…</span>
          )}
          <ChevronDown size={14} className="text-muted-foreground/60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        {roles.map(r => (
          <button
            key={r.id}
            onClick={() => { onChange(r.id); setOpen(false); }}
            className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-[13px] hover:bg-muted/60 transition-colors ${value === r.id ? 'bg-muted/40' : ''}`}
          >
            <span>{r.name}</span>
            {value === r.id && <Check size={14} className="text-primary" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

interface UserFormData {
  email: string;
  full_name: string;
  role_id: string;
  team: string;
  password: string;
}

const emptyForm: UserFormData = {
  email: '',
  full_name: '',
  role_id: '',
  team: '',
  password: '',
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [form, setForm] = useState<UserFormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  // Deactivation confirm dialog state
  const [deactivateTarget, setDeactivateTarget] = useState<AppUser | null>(null);
  const [reassignTo, setReassignTo] = useState<string>('');
  const [deactivating, setDeactivating] = useState(false);

  const loadData = useCallback(async () => {
    const [usersRes, rolesRes] = await Promise.all([
      fetch('/api/users', { cache: 'no-store' }),
      fetch('/api/roles'),
    ]);
    const [usersData, rolesData] = await Promise.all([
      usersRes.json(),
      rolesRes.json(),
    ]);
    setUsers(usersData || []);
    setRoles(rolesData || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const openAdd = () => {
    setEditingUser(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (user: AppUser) => {
    setEditingUser(user);
    setForm({
      email: user.email,
      full_name: user.full_name,
      role_id: user.role_id || '',
      team: user.team || '',
      password: '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.full_name || !form.team) {
      toast.error('Please fill in all required fields');
      return;
    }
    setSaving(true);
    try {
      if (editingUser) {
        const res = await fetch(`/api/users/${editingUser.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: form.full_name,
            role_id: form.role_id || null,
            team: form.team,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error);
        }
        toast.success('User updated', { description: `${form.full_name} has been updated.` });
      } else {
        if (!form.email) {
          toast.error('Email is required for new users');
          return;
        }
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error);
        }
        toast.success('User created', { description: `${form.full_name} can now log in with their email.` });
      }
      setDialogOpen(false);
      loadData();
    } catch (err) {
      toast.error('Error', { description: err instanceof Error ? err.message : 'Something went wrong' });
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async (user: AppUser) => {
    try {
      const res = await fetch(`/api/users/${user.id}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send reset email');
      toast.success('Password reset email sent', {
        description: `Reset link sent to ${data.email}`,
      });
    } catch (err) {
      toast.error('Failed to send reset email', {
        description: err instanceof Error ? err.message : 'Something went wrong',
      });
    }
  };

  // Open deactivation confirm dialog
  const promptDeactivate = (user: AppUser) => {
    setDeactivateTarget(user);
    setReassignTo('');
  };

  // Reactivate without any confirm dialog
  const handleReactivate = async (user: AppUser) => {
    const res = await fetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: true }),
    });
    if (res.ok) {
      toast.success('User reactivated', { description: `${user.full_name} has been reactivated.` });
      loadData();
    } else {
      toast.error('Failed to reactivate user');
    }
  };

  // Confirm deactivation: optionally reassign tasks, then deactivate
  const confirmDeactivate = async () => {
    if (!deactivateTarget) return;
    setDeactivating(true);
    try {
      // Reassign tasks if a target was chosen
      if (reassignTo) {
        const res = await fetch('/api/tasks/reassign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from_assignee: deactivateTarget.full_name,
            to_assignee: reassignTo,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to reassign tasks');
        }
        const { count } = await res.json();
        if (count > 0) {
          toast.success(`${count} task${count === 1 ? '' : 's'} reassigned to ${reassignTo}`);
        }
      }

      // Deactivate the user
      const res = await fetch(`/api/users/${deactivateTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: false }),
      });
      if (!res.ok) throw new Error('Failed to deactivate user');

      toast.success('User deactivated', { description: `${deactivateTarget.full_name} has been deactivated.` });
      setDeactivateTarget(null);
      loadData();
    } catch (err) {
      toast.error('Error', { description: err instanceof Error ? err.message : 'Something went wrong' });
    } finally {
      setDeactivating(false);
    }
  };

  const teamStyle = (team: string | null) => TEAM_STYLES[team as keyof typeof TEAM_STYLES];
  const activeUsers = users.filter(u => u.is_active);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-muted-foreground">{users.length} users</p>
        <Button onClick={openAdd} size="sm" className="h-8 text-[13px] gap-1.5">
          <Plus size={14} />
          Add user
        </Button>
      </div>

      <div className="bg-card border border-border/20 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/20 hover:bg-transparent">
              <TableHead className="text-[12px] text-muted-foreground font-medium">Name</TableHead>
              <TableHead className="text-[12px] text-muted-foreground font-medium">Email</TableHead>
              <TableHead className="text-[12px] text-muted-foreground font-medium">Team</TableHead>
              <TableHead className="text-[12px] text-muted-foreground font-medium">Role</TableHead>
              <TableHead className="text-[12px] text-muted-foreground font-medium">Status</TableHead>
              <TableHead className="text-[12px] text-muted-foreground font-medium w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-[13px] text-muted-foreground/40">
                  Loading users…
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-[13px] text-muted-foreground/40">
                  No users yet
                </TableCell>
              </TableRow>
            ) : users.map(user => {
              const ts = teamStyle(user.team);
              const colorClass = ASSIGNEE_COLORS[user.full_name] || 'bg-primary/20 text-primary';
              return (
                <TableRow key={user.id} className="border-border/20 hover:bg-secondary/30 transition-colors">
                  <TableCell className="text-[13px]">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium shrink-0 ${colorClass}`}>
                        {user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </div>
                      <span className="font-medium text-foreground">{user.full_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    {user.team && ts ? (
                      <span className={`px-2 py-0.5 rounded text-[12px] font-medium ${ts.bg} ${ts.text}`}>
                        {ts.label}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/40 text-[13px]">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">
                    {user.role?.name || '—'}
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
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(user)}
                        className="p-1.5 rounded hover:bg-muted/60 text-muted-foreground/60 hover:text-foreground transition-colors"
                        title="Edit user"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleResetPassword(user)}
                        className="p-1.5 rounded hover:bg-amber-500/10 text-muted-foreground/60 hover:text-amber-400 transition-colors"
                        title={`Send password reset to ${user.email}`}
                      >
                        <KeyRound size={14} />
                      </button>
                      {user.is_active ? (
                        <button
                          onClick={() => promptDeactivate(user)}
                          className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground/60 hover:text-destructive transition-colors"
                          title="Deactivate user"
                        >
                          <UserX size={14} />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReactivate(user)}
                          className="p-1.5 rounded hover:bg-status-success/10 text-muted-foreground/60 hover:text-status-success transition-colors"
                          title="Reactivate user"
                        >
                          <UserCheck size={14} />
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border/20">
          <DialogHeader>
            <DialogTitle className="text-[15px]">
              {editingUser ? 'Edit user' : 'Add new user'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-[13px] text-muted-foreground">Full name *</Label>
              <Input
                value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                placeholder="Sophie Gore"
                className="h-9 text-[13px] bg-secondary border-border/20"
              />
            </div>

            {!editingUser && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-[13px] text-muted-foreground">Email *</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="name@airsocial.co.uk"
                    className="h-9 text-[13px] bg-secondary border-border/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px] text-muted-foreground">Temporary password</Label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Leave blank for default"
                    className="h-9 text-[13px] bg-secondary border-border/20"
                  />
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label className="text-[13px] text-muted-foreground">Team *</Label>
              <TeamSelect value={form.team} onChange={v => setForm(f => ({ ...f, team: v }))} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[13px] text-muted-foreground">Role</Label>
              <RoleSelect value={form.role_id} onChange={v => setForm(f => ({ ...f, role_id: v }))} roles={roles} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="text-[13px] h-8 border-border/20">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="text-[13px] h-8">
              {saving ? 'Saving…' : editingUser ? 'Save changes' : 'Create user'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivation confirm dialog */}
      <AlertDialog open={!!deactivateTarget} onOpenChange={open => { if (!open) setDeactivateTarget(null); }}>
        <AlertDialogContent className="bg-card border-border/20 sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px]">
              Deactivate {deactivateTarget?.full_name}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-muted-foreground space-y-2">
              <span>This will deactivate the user&apos;s account. They will no longer be able to log in.</span>
              {activeUsers.filter(u => u.id !== deactivateTarget?.id).length > 0 && (
                <span className="block pt-2">
                  Optionally reassign their open tasks to another team member:
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {activeUsers.filter(u => u.id !== deactivateTarget?.id).length > 0 && (
            <div className="px-1 pb-2">
              <select
                value={reassignTo}
                onChange={e => setReassignTo(e.target.value)}
                className="w-full h-9 px-3 text-[13px] bg-secondary border border-border/20 rounded-md outline-none focus:border-primary/50 transition-colors"
              >
                <option value="">— Don&apos;t reassign tasks —</option>
                {activeUsers
                  .filter(u => u.id !== deactivateTarget?.id)
                  .map(u => (
                    <option key={u.id} value={u.full_name}>{u.full_name}</option>
                  ))}
              </select>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel className="text-[13px] h-8 border-border/20">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeactivate}
              disabled={deactivating}
              className="text-[13px] h-8 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deactivating ? 'Deactivating…' : 'Deactivate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
