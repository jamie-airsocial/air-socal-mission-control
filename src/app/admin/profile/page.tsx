'use client';

import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { Camera, Lock, User, Mail, Shield, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/auth-context';
import { getTeamStyle } from '@/lib/constants';
import { createBrowserClient } from '@supabase/ssr';

/** Resize image to 128x128 and convert to data URL (base64) */
function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas not supported'));
          return;
        }
        // Draw resized image
        ctx.drawImage(img, 0, 0, 128, 128);
        // Convert to data URL with compression
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export default function ProfilePage() {
  const { appUser, roleName } = useAuth();
  const [fullName, setFullName] = useState(appUser?.full_name || '');
  const [avatarUrl, setAvatarUrl] = useState(appUser?.avatar_url || null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  
  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const teamStyle = appUser?.team ? getTeamStyle(appUser.team) : null;

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (5MB max before compression)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be smaller than 5MB');
      return;
    }

    setUploadingAvatar(true);
    try {
      const dataUrl = await resizeImage(file);
      
      // Check final size (must be < 100KB)
      const sizeKB = Math.round((dataUrl.length * 3) / 4 / 1024);
      if (sizeKB > 100) {
        toast.error(`Compressed image is ${sizeKB}KB (max 100KB). Try a simpler image.`);
        setUploadingAvatar(false);
        return;
      }

      // Update avatar_url in database
      const res = await fetch(`/api/users/${appUser?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: dataUrl }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to upload avatar');
      }

      setAvatarUrl(dataUrl);
      toast.success('Profile photo updated');
      
      // Reload page to update auth context
      setTimeout(() => window.location.reload(), 500);
    } catch (err) {
      toast.error('Failed to upload avatar', {
        description: err instanceof Error ? err.message : 'Something went wrong',
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!fullName.trim()) {
      toast.error('Name cannot be empty');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/users/${appUser?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update profile');
      }

      toast.success('Profile updated');
      
      // Reload page to update auth context
      setTimeout(() => window.location.reload(), 500);
    } catch (err) {
      toast.error('Failed to update profile', {
        description: err instanceof Error ? err.message : 'Something went wrong',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error('Please fill in all password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setChangingPassword(true);
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) throw error;

      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error('Failed to change password', {
        description: err instanceof Error ? err.message : 'Something went wrong',
      });
    } finally {
      setChangingPassword(false);
    }
  };

  if (!appUser) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[13px] text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Profile Section */}
      <div className="bg-card border border-border/20 rounded-lg p-5 space-y-5">
        <h2 className="text-[15px] font-semibold text-foreground">Profile</h2>

        {/* Avatar Upload */}
        <div className="flex items-start gap-4">
          <div className="relative group">
            <button
              onClick={handleAvatarClick}
              disabled={uploadingAvatar}
              className="relative w-20 h-20 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center text-primary font-semibold text-[20px] hover:opacity-80 transition-opacity disabled:opacity-50"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={appUser.full_name} className="w-full h-full object-cover" />
              ) : (
                <span>{appUser.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}</span>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera size={20} className="text-white" />
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
          <div className="flex-1 space-y-1">
            <p className="text-[13px] font-medium text-foreground">Profile photo</p>
            <p className="text-[12px] text-muted-foreground/60">
              Click the avatar to upload a new photo. Images are resized to 128×128 and must be under 100KB.
            </p>
          </div>
        </div>

        {/* Full Name */}
        <div className="space-y-1.5">
          <Label className="text-[13px] text-muted-foreground flex items-center gap-1.5">
            <User size={12} />
            Full name
          </Label>
          <Input
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Your name"
            className="h-9 text-[13px] bg-secondary border-border/20"
          />
        </div>

        {/* Email (read-only) */}
        <div className="space-y-1.5">
          <Label className="text-[13px] text-muted-foreground flex items-center gap-1.5">
            <Mail size={12} />
            Email
          </Label>
          <Input
            value={appUser.email}
            disabled
            className="h-9 text-[13px] bg-muted/30 border-border/20 text-muted-foreground cursor-not-allowed"
          />
        </div>

        {/* Role (read-only) */}
        <div className="space-y-1.5">
          <Label className="text-[13px] text-muted-foreground flex items-center gap-1.5">
            <Shield size={12} />
            Role
          </Label>
          <div className="h-9 px-3 rounded-md border border-border/20 bg-muted/30 flex items-center">
            <span className="text-[13px] font-medium text-foreground">{roleName || 'Team Member'}</span>
          </div>
        </div>

        {/* Team (read-only) */}
        <div className="space-y-1.5">
          <Label className="text-[13px] text-muted-foreground flex items-center gap-1.5">
            <Users size={12} />
            Team
          </Label>
          <div className="h-9 px-3 rounded-md border border-border/20 bg-muted/30 flex items-center">
            {appUser.team && teamStyle ? (
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[12px] font-medium ${teamStyle.bg} ${teamStyle.text}`}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: teamStyle.color }} />
                {teamStyle.label}
              </span>
            ) : (
              <span className="text-[13px] text-muted-foreground">—</span>
            )}
          </div>
        </div>

        <div className="pt-2">
          <Button onClick={handleSaveProfile} disabled={saving || fullName === appUser.full_name} className="h-8 text-[13px]">
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
      </div>

      {/* Security Section */}
      <div className="bg-card border border-border/20 rounded-lg p-5 space-y-5">
        <h2 className="text-[15px] font-semibold text-foreground flex items-center gap-2">
          <Lock size={14} />
          Security
        </h2>

        <p className="text-[12px] text-muted-foreground/60">
          Change your password to keep your account secure. You&apos;ll stay logged in after changing your password.
        </p>

        {/* Current Password */}
        <div className="space-y-1.5">
          <Label className="text-[13px] text-muted-foreground">Current password</Label>
          <Input
            type="password"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            placeholder="Enter current password"
            className="h-9 text-[13px] bg-secondary border-border/20"
          />
        </div>

        {/* New Password */}
        <div className="space-y-1.5">
          <Label className="text-[13px] text-muted-foreground">New password</Label>
          <Input
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="Enter new password (min 8 characters)"
            className="h-9 text-[13px] bg-secondary border-border/20"
          />
        </div>

        {/* Confirm New Password */}
        <div className="space-y-1.5">
          <Label className="text-[13px] text-muted-foreground">Confirm new password</Label>
          <Input
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            className="h-9 text-[13px] bg-secondary border-border/20"
          />
        </div>

        <div className="pt-2">
          <Button
            onClick={handleChangePassword}
            disabled={changingPassword || !newPassword || !confirmPassword}
            className="h-8 text-[13px]"
          >
            {changingPassword ? 'Updating...' : 'Update password'}
          </Button>
        </div>
      </div>
    </div>
  );
}
