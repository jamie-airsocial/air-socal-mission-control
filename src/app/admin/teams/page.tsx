'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Users, X, Check, Search, AlertTriangle } from 'lucide-react';
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
import { ASSIGNEE_COLORS, TEAM_STYLES } from '@/lib/constants';
import type { AppUser } from '@/lib/auth-types';

interface Team {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const colorClass = ASSIGNEE_COLORS[name] || 'bg-primary/20 text-primary';
  const dim = size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-[11px]';
  return (
    <div className={`${dim} rounded-full flex items-center justify-center font-medium shrink-0 ${colorClass}`} title={name}>
      {getInitials(name)}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminTeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [teamName, setTeamName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<Team | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    const [teamsRes, usersRes] = await Promise.all([
      fetch('/api/teams'),
      fetch('/api/users', { cache: 'no-store' }),
    ]);
    const [teamsData, usersData] = await Promise.all([
      teamsRes.json(),
      usersRes.json(),
    ]);
    setTeams(teamsData || []);
    setUsers(usersData || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Active users in a team (by team name slug)
  const getMembersForTeam = useCallback((team: Team) => {
    const slug = team.name.toLowerCase();
    return users.filter(u => u.team === slug && u.is_active);
  }, [users]);

  // All users for a team (including inactive)
  const getAllMembersForTeam = useCallback((team: Team) => {
    const slug = team.name.toLowerCase();
    return users.filter(u => u.team === slug);
  }, [users]);

  const openCreate = () => {
    setEditingTeam(null);
    setTeamName('');
    setSelectedMembers([]);
    setMemberSearch('');
    setDialogOpen(true);
  };

  const openEdit = (team: Team) => {
    setEditingTeam(team);
    setTeamName(team.name);
    setSelectedMembers(getMembersForTeam(team).map(u => u.id));
    setMemberSearch('');
    setDialogOpen(true);
  };

  const toggleMember = (userId: string) => {
    setSelectedMembers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleSave = async () => {
    if (!teamName.trim()) { toast.error('Team name is required'); return; }
    setSaving(true);
    try {
      if (editingTeam) {
        const res = await fetch(`/api/teams/${editingTeam.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: teamName.trim(), members: selectedMembers }),
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
        toast.success('Team updated');
      } else {
        const res = await fetch('/api/teams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: teamName.trim() }),
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
        const newTeam = await res.json();
        if (selectedMembers.length > 0) {
          await fetch(`/api/teams/${newTeam.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ members: selectedMembers }),
          });
        }
        toast.success(`Team "${teamName}" created`);
      }
      setDialogOpen(false);
      loadData();
    } catch (err) {
      toast.error('Error', { description: err instanceof Error ? err.message : 'Something went wrong' });
    } finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/teams/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      toast.success('Team deleted');
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      toast.error('Cannot delete team', { description: err instanceof Error ? err.message : 'Something went wrong' });
    } finally { setDeleting(false); }
  };

  // Active users available for membership assignment
  const activeUsers = users.filter(u => u.is_active);

  // Filtered list for the member picker
  const filteredUsers = useMemo(() => {
    if (!memberSearch.trim()) return activeUsers;
    const q = memberSearch.toLowerCase();
    return activeUsers.filter(u =>
      u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [activeUsers, memberSearch]);

  const deleteTargetMembers = deleteTarget ? getMembersForTeam(deleteTarget) : [];
  const canDelete = deleteTargetMembers.length === 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-muted-foreground">
          {teams.length} team{teams.length !== 1 ? 's' : ''} · {users.filter(u => u.is_active).length} active members
        </p>
        <Button onClick={openCreate} size="sm" className="h-8 text-[13px] gap-1.5">
          <Plus size={14} /> Add team
        </Button>
      </div>

      {/* Team cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-36 rounded-lg bg-muted/20 animate-pulse" />)}
        </div>
      ) : teams.length === 0 ? (
        <div className="text-center py-16 text-[13px] text-muted-foreground/40">
          No teams yet. Create one to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map(team => {
            const slug = team.name.toLowerCase() as keyof typeof TEAM_STYLES;
            const style = TEAM_STYLES[slug];
            const activeMembers = getMembersForTeam(team);
            const allMembers = getAllMembersForTeam(team);
            const inactiveCount = allMembers.length - activeMembers.length;

            return (
              <div
                key={team.id}
                className="bg-card border border-border/20 rounded-lg p-4 hover:border-border/40 transition-colors flex flex-col gap-3"
              >
                {/* Card header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      {style && (
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: style.color }} />
                      )}
                      <h3 className={`text-[15px] font-semibold ${style?.text || 'text-foreground'}`}>
                        {team.name}
                      </h3>
                    </div>
                    <p className="text-[12px] text-muted-foreground/60 flex items-center gap-1.5 mt-0.5">
                      <Users size={11} />
                      {activeMembers.length} active member{activeMembers.length !== 1 ? 's' : ''}
                      {inactiveCount > 0 && (
                        <span className="text-muted-foreground/40">· {inactiveCount} inactive</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => openEdit(team)}
                      className="p-1.5 rounded hover:bg-muted/60 text-muted-foreground/60 hover:text-foreground transition-colors"
                      title="Edit team"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(team)}
                      className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground/60 hover:text-destructive transition-colors"
                      title="Delete team"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Member list */}
                {activeMembers.length > 0 ? (
                  <div className="space-y-1.5">
                    {activeMembers.map(u => (
                      <div key={u.id} className="flex items-center gap-2">
                        <Avatar name={u.full_name} size="sm" />
                        <div className="min-w-0">
                          <p className="text-[12px] font-medium text-foreground leading-tight truncate">{u.full_name}</p>
                          {u.role?.name && (
                            <p className="text-[11px] text-muted-foreground/50 leading-tight truncate">{u.role.name}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12px] text-muted-foreground/40 italic">No active members</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) setDialogOpen(false); }}>
        <DialogContent className="sm:max-w-md bg-card border-border/20">
          <DialogHeader>
            <DialogTitle className="text-[15px]">
              {editingTeam ? `Edit "${editingTeam.name}"` : 'Create team'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Team name */}
            <div className="space-y-1.5">
              <Label className="text-[13px] text-muted-foreground">Team name *</Label>
              <Input
                value={teamName}
                onChange={e => setTeamName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                placeholder="e.g. Synergy"
                className="h-9 text-[13px] bg-secondary border-border/20"
                autoFocus
              />
            </div>

            {/* Member picker */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[13px] text-muted-foreground">Members</Label>
                {selectedMembers.length > 0 && (
                  <span className="text-[11px] text-primary font-medium">
                    {selectedMembers.length} selected
                  </span>
                )}
              </div>

              {/* Search */}
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                <input
                  value={memberSearch}
                  onChange={e => setMemberSearch(e.target.value)}
                  placeholder="Search users…"
                  className="w-full h-8 pl-8 pr-3 text-[13px] bg-secondary border border-border/20 rounded-lg outline-none focus:border-primary/50 transition-colors placeholder:text-muted-foreground/40"
                />
                {memberSearch && (
                  <button onClick={() => setMemberSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground">
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* User list */}
              <div className="max-h-52 overflow-y-auto space-y-0.5 border border-border/20 rounded-lg p-1.5 bg-secondary/20">
                {filteredUsers.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground/40 text-center py-4">
                    {memberSearch ? 'No users match your search' : 'No active users'}
                  </p>
                ) : filteredUsers.map(u => {
                  const isSelected = selectedMembers.includes(u.id);
                  const teamSlug = u.team as keyof typeof TEAM_STYLES;
                  const userTeamStyle = teamSlug ? TEAM_STYLES[teamSlug] : null;
                  return (
                    <button
                      key={u.id}
                      onClick={() => toggleMember(u.id)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] transition-colors text-left ${
                        isSelected ? 'bg-primary/10 hover:bg-primary/15' : 'hover:bg-muted/60'
                      }`}
                    >
                      <Avatar name={u.full_name} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium leading-tight truncate">{u.full_name}</p>
                        {u.team && userTeamStyle && (
                          <p className={`text-[11px] leading-tight ${userTeamStyle.text}`}>
                            Currently: {userTeamStyle.label}
                          </p>
                        )}
                      </div>
                      {u.role?.name && (
                        <span className="text-[11px] text-muted-foreground/50 shrink-0">{u.role.name}</span>
                      )}
                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                        isSelected ? 'border-primary bg-primary' : 'border-border/40'
                      }`}>
                        {isSelected && <Check size={10} className="text-primary-foreground" />}
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground/50">
                Assigning a user to this team removes them from their current team.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="text-[13px] h-8 border-border/20">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="text-[13px] h-8">
              {saving ? 'Saving…' : editingTeam ? 'Save changes' : 'Create team'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="bg-card border-border/20 sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px]">
              Delete &quot;{deleteTarget?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-[13px] text-muted-foreground space-y-2">
                {!canDelete ? (
                  <div className="flex gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-400">Team has {deleteTargetMembers.length} active member{deleteTargetMembers.length !== 1 ? 's' : ''}</p>
                      <p className="text-amber-400/70 text-[12px] mt-0.5">
                        Reassign all members to another team before deleting. Edit the team to move them.
                      </p>
                    </div>
                  </div>
                ) : (
                  <p>This action cannot be undone. The team will be permanently removed.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-[13px] h-8 border-border/20">Cancel</AlertDialogCancel>
            {!canDelete ? (
              <Button
                size="sm"
                onClick={() => { setDeleteTarget(null); if (deleteTarget) openEdit(deleteTarget); }}
                className="text-[13px] h-8"
              >
                Edit team →
              </Button>
            ) : (
              <AlertDialogAction
                onClick={confirmDelete}
                disabled={deleting}
                className="text-[13px] h-8 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? 'Deleting…' : 'Delete team'}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
