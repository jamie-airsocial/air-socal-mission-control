'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';
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
import { ASSIGNEE_COLORS } from '@/lib/constants';
import type { AppUser } from '@/lib/auth-types';

interface TeamMember {
  id: string;
  full_name: string;
  team: string | null;
  is_active: boolean;
  role?: { id: string; name: string } | null;
}

interface Team {
  id: string;
  name: string;
  color?: string;
  created_at: string;
  updated_at: string;
  members?: TeamMember[];
}

const PRESET_COLORS = [
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Purple', hex: '#a855f7' },
  { name: 'Green', hex: '#22c55e' },
  { name: 'Rose', hex: '#f43f5e' },
  { name: 'Cyan', hex: '#06b6d4' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Teal', hex: '#14b8a6' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Lime', hex: '#84cc16' },
  { name: 'Slate', hex: '#64748b' },
];

/** Convert team display name to slug used in app_users.team */
function teamSlug(name: string): string {
  return name.trim().toLowerCase();
}

export default function AdminTeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [teamName, setTeamName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [teamColor, setTeamColor] = useState('#3b82f6');
  const [showCustomColor, setShowCustomColor] = useState(false);
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
    setAllUsers(usersData || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  /** Get live members for a team from the enriched teams data */
  const getMembersForTeam = (team: Team): TeamMember[] => {
    // Prefer embedded members from the API if available
    if (team.members) return team.members;
    // Fallback: match by slug
    const slug = teamSlug(team.name);
    return allUsers
      .filter(u => u.is_active && (u.team || '').toLowerCase() === slug)
      .map(u => ({ id: u.id, full_name: u.full_name, team: u.team, is_active: u.is_active, role: u.role }));
  };

  const activeUsers = allUsers.filter(u => u.is_active);

  const openCreate = () => {
    setEditingTeam(null);
    setTeamName('');
    setSelectedMembers([]);
    setTeamColor('#3b82f6');
    setShowCustomColor(false);
    setDialogOpen(true);
  };

  const openEdit = (team: Team) => {
    setEditingTeam(team);
    setTeamName(team.name);
    setTeamColor(team.color || '#3b82f6');
    setShowCustomColor(!PRESET_COLORS.some(p => p.hex === (team.color || '#3b82f6')));
    const members = getMembersForTeam(team).map(u => u.id);
    setSelectedMembers(members);
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
          body: JSON.stringify({ name: teamName.trim(), members: selectedMembers, color: teamColor }),
        });
        if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
        toast.success('Team updated', { description: `${teamName} has been updated.` });
      } else {
        const res = await fetch('/api/teams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: teamName.trim(), color: teamColor }),
        });
        if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
        const newTeam = await res.json();
        if (selectedMembers.length > 0) {
          await fetch(`/api/teams/${newTeam.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ members: selectedMembers }),
          });
        }
        toast.success('Team created', { description: `${teamName} has been added.` });
      }
      setDialogOpen(false);
      loadData();
    } catch (err) {
      toast.error('Error', { description: err instanceof Error ? err.message : 'Something went wrong' });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/teams/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
      toast.success('Team deleted', { description: `${deleteTarget.name} has been removed.` });
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      toast.error('Cannot delete team', { description: err instanceof Error ? err.message : 'Something went wrong' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-muted-foreground">{teams.length} teams</p>
        <Button onClick={openCreate} size="sm" className="h-8 text-[13px] gap-1.5">
          <Plus size={14} /> Add team
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 rounded-lg bg-muted/20 animate-pulse" />
          ))}
        </div>
      ) : teams.length === 0 ? (
        <div className="text-center py-12 text-[13px] text-muted-foreground/40">
          No teams yet. Create one to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map(team => {
            const members = getMembersForTeam(team);
            const color = team.color || '#3b82f6';
            return (
              <div
                key={team.id}
                className="bg-card border border-border/20 rounded-lg p-4 hover:border-border/40 transition-colors"
                style={{ borderTopColor: color, borderTopWidth: 2 }}
              >
                {/* Team header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <h3 className="text-[15px] font-semibold" style={{ color }}>
                      {team.name}
                    </h3>
                    <p className="text-[12px] text-muted-foreground/60 mt-0.5">
                      {members.length} member{members.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
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

                {/* Member list with name + role */}
                {members.length > 0 ? (
                  <div className="space-y-2">
                    {members.map(u => {
                      const colorClass = ASSIGNEE_COLORS[u.full_name] || 'bg-primary/20 text-primary';
                      const initials = u.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
                      return (
                        <div key={u.id} className="flex items-center gap-2.5 py-1.5 px-2 -mx-2 rounded-md hover:bg-muted/30 transition-colors">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium shrink-0 ${colorClass}`}
                          >
                            {initials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-medium truncate">{u.full_name}</p>
                            <p className="text-[11px] text-muted-foreground/50 truncate">
                              {u.role?.name || 'No role'}
                            </p>
                          </div>
                        </div>
                      );
                    })}
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
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border/20">
          <DialogHeader>
            <DialogTitle className="text-[15px]">
              {editingTeam ? `Edit ${editingTeam.name}` : 'Create team'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-[13px] text-muted-foreground">Team name *</Label>
              <Input
                value={teamName}
                onChange={e => setTeamName(e.target.value)}
                placeholder="e.g. Synergy"
                className="h-9 text-[13px] bg-secondary border-border/20"
                autoFocus
              />
              {editingTeam && teamSlug(teamName) !== teamSlug(editingTeam.name) && (
                <p className="text-[11px] text-amber-400/80">
                  ⚠ Renaming will update all team members to the new slug.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-[13px] text-muted-foreground">Team colour</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map(preset => (
                  <button
                    key={preset.hex}
                    onClick={() => { setTeamColor(preset.hex); setShowCustomColor(false); }}
                    className={`w-8 h-8 rounded-lg border-2 transition-all hover:scale-110 ${
                      teamColor === preset.hex && !showCustomColor ? 'border-foreground scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: preset.hex }}
                    title={preset.name}
                  />
                ))}
                <button
                  onClick={() => setShowCustomColor(!showCustomColor)}
                  className={`w-8 h-8 rounded-lg border-2 transition-all hover:scale-110 flex items-center justify-center text-[10px] font-medium ${
                    showCustomColor ? 'border-foreground' : 'border-border/40'
                  }`}
                  style={showCustomColor ? { backgroundColor: teamColor } : undefined}
                  title="Custom hex colour"
                >
                  {!showCustomColor && '#'}
                </button>
              </div>
              {showCustomColor && (
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-8 h-8 rounded-lg shrink-0 border border-border/20" style={{ backgroundColor: teamColor }} />
                  <Input
                    value={teamColor}
                    onChange={e => setTeamColor(e.target.value)}
                    placeholder="#3b82f6"
                    className="h-8 text-[13px] bg-secondary border-border/20 font-mono w-28"
                    maxLength={7}
                  />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-[13px] text-muted-foreground">Members</Label>
              <p className="text-[12px] text-muted-foreground/60">Select active users to assign to this team.</p>
              <div className="max-h-64 overflow-y-auto space-y-0.5 border border-border/20 rounded-lg p-2 bg-secondary/30">
                {activeUsers.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground/40 text-center py-4">No active users</p>
                ) : activeUsers.map(u => {
                  const isSelected = selectedMembers.includes(u.id);
                  const colorClass = ASSIGNEE_COLORS[u.full_name] || 'bg-primary/20 text-primary';
                  const initials = u.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                  const currentTeam = u.team ? teams.find(t => teamSlug(t.name) === u.team) : null;
                  const isOnOtherTeam = currentTeam && editingTeam && teamSlug(currentTeam.name) !== teamSlug(editingTeam.name);
                  return (
                    <button
                      key={u.id}
                      onClick={() => toggleMember(u.id)}
                      className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] transition-colors ${
                        isSelected ? 'bg-primary/10' : 'hover:bg-muted/60'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium shrink-0 ${colorClass}`}>
                        {initials}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className="font-medium truncate">{u.full_name}</p>
                        <p className="text-[11px] text-muted-foreground/50 truncate">
                          {u.role?.name || 'No role'}
                          {currentTeam && (
                            <span className="ml-1.5 text-muted-foreground/40">
                              · <span className="inline-flex items-center gap-1 align-middle">
                                <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: currentTeam.color || '#3b82f6' }} />
                                <span>{currentTeam.name}</span>
                              </span>
                            </span>
                          )}
                          {!currentTeam && <span className="ml-1.5 text-muted-foreground/30">· No team</span>}
                        </p>
                      </div>
                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                        isSelected ? 'border-primary bg-primary' : 'border-border/40'
                      }`}>
                        {isSelected && <Check size={10} className="text-primary-foreground" />}
                      </div>
                    </button>
                  );
                })}
              </div>
              {selectedMembers.length > 0 && (
                <p className="text-[12px] text-muted-foreground/60">
                  {selectedMembers.length} member{selectedMembers.length !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="text-[13px] h-8 border-border/20">
              <X size={14} className="mr-1.5" /> Cancel
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
            <AlertDialogDescription className="text-[13px] text-muted-foreground">
              {deleteTarget && getMembersForTeam(deleteTarget).length > 0 ? (
                <>
                  This team has <strong>{getMembersForTeam(deleteTarget).length} active member{getMembersForTeam(deleteTarget).length !== 1 ? 's' : ''}</strong>.
                  Please reassign them to another team before deleting.
                </>
              ) : (
                'This action cannot be undone.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-[13px] h-8 border-border/20">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting || (deleteTarget ? getMembersForTeam(deleteTarget).length > 0 : false)}
              className="text-[13px] h-8 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting…' : 'Delete team'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
