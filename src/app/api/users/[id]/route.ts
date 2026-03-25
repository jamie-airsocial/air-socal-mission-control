import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const OWNER_USER_IDS = ['83983bb2-3d05-4be3-97f3-fdac36929560'];

async function countOtherActiveAdmins(excludeIds: string[]) {
  const { count, error } = await supabaseAdmin
    .from('app_users')
    .select('id', { count: 'exact', head: true })
    .eq('is_admin', true)
    .eq('is_active', true)
    .not('id', 'in', `(${excludeIds.join(',')})`);

  if (error) throw error;
  return count || 0;
}

/**
 * POST /api/users/[id] — send a password reset email for the user.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: appUser, error: lookupError } = await supabaseAdmin
    .from('app_users')
    .select('email, full_name')
    .eq('id', id)
    .single();

  if (lookupError || !appUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (OWNER_USER_IDS.includes(id)) {
    return NextResponse.json({ error: 'Owner password reset cannot be triggered by admins' }, { status: 403 });
  }

  const { error } = await supabaseAdmin.auth.resetPasswordForEmail(appUser.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://air-social-staging.vercel.app'}/reset-password`,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, email: appUser.email });
}

/**
 * PATCH /api/users/[id] — update user fields (name, role, team, is_active).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { full_name, email, role_id, team, is_active, avatar_url, is_admin, permission_overrides } = body;

  // Owner protection — owner record is fully locked from admin edits
  if (OWNER_USER_IDS.includes(id)) {
    return NextResponse.json({ error: 'Owner account cannot be modified' }, { status: 403 });
  }

  const { data: existingUser, error: existingUserError } = await supabaseAdmin
    .from('app_users')
    .select('id, auth_user_id, email, is_admin, is_active')
    .eq('id', id)
    .single();

  if (existingUserError || !existingUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (is_admin === false && existingUser.is_admin && existingUser.is_active) {
    const remainingActiveAdmins = await countOtherActiveAdmins([id]);
    if (remainingActiveAdmins === 0) {
      return NextResponse.json({ error: 'At least one active admin is required' }, { status: 400 });
    }
  }

  if (is_active === false && existingUser.is_admin && existingUser.is_active) {
    const remainingActiveAdmins = await countOtherActiveAdmins([id]);
    if (remainingActiveAdmins === 0) {
      return NextResponse.json({ error: 'At least one active admin is required' }, { status: 400 });
    }
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (full_name !== undefined) updates.full_name = full_name;
  if (email !== undefined) updates.email = email;
  if (role_id !== undefined) updates.role_id = role_id;
  if (team !== undefined) updates.team = team;
  if (is_active !== undefined) updates.is_active = is_active;
  if (avatar_url !== undefined) updates.avatar_url = avatar_url;
  if (is_admin !== undefined) updates.is_admin = is_admin;
  if (permission_overrides !== undefined) updates.permission_overrides = permission_overrides;

  const { data, error } = await supabaseAdmin
    .from('app_users')
    .update(updates)
    .eq('id', id)
    .select('*, role:roles(id, name, permissions)')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (existingUser.auth_user_id) {
    if (email !== undefined && email !== existingUser.email) {
      const { error: authEmailError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.auth_user_id, {
        email,
        email_confirm: true,
      });

      if (authEmailError) {
        await supabaseAdmin
          .from('app_users')
          .update({ email: existingUser.email, updated_at: new Date().toISOString() })
          .eq('id', id);

        return NextResponse.json({ error: `Auth email update failed: ${authEmailError.message}` }, { status: 500 });
      }
    }

    if (is_active !== undefined) {
      const { error: authStatusError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.auth_user_id, {
        ban_duration: is_active ? '0' : 'none',
      });

      if (authStatusError) {
        await supabaseAdmin
          .from('app_users')
          .update({ is_active: existingUser.is_active, updated_at: new Date().toISOString() })
          .eq('id', id);

        return NextResponse.json({ error: `Auth status update failed: ${authStatusError.message}` }, { status: 500 });
      }
    }
  }

  return NextResponse.json(data);
}

/**
 * DELETE /api/users/[id] — permanently delete user from app_users AND Supabase Auth.
 * Caller must have already reassigned tasks before calling this.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (OWNER_USER_IDS.includes(id)) {
    return NextResponse.json({ error: 'Owner account cannot be deleted' }, { status: 403 });
  }

  // Fetch the user so we can get their auth_user_id
  const { data: appUser, error: fetchError } = await supabaseAdmin
    .from('app_users')
    .select('auth_user_id, full_name, is_admin, is_active')
    .eq('id', id)
    .single();

  if (fetchError || !appUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (appUser.is_admin && appUser.is_active) {
    const remainingActiveAdmins = await countOtherActiveAdmins([id]);
    if (remainingActiveAdmins === 0) {
      return NextResponse.json({ error: 'At least one active admin is required' }, { status: 400 });
    }
  }

  // Delete from app_users first (FK constraints satisfied before auth deletion)
  const { error: deleteError } = await supabaseAdmin
    .from('app_users')
    .delete()
    .eq('id', id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  // Delete from Supabase Auth (best-effort — don't fail if auth_user_id missing)
  if (appUser.auth_user_id) {
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(appUser.auth_user_id);
    if (authError) {
      // App user is already gone; log but don't return error
      console.error(`[users] Failed to delete auth user ${appUser.auth_user_id}:`, authError.message);
    }
  }

  return NextResponse.json({ success: true });
}
