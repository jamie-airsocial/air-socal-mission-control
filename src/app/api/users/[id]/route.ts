import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

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
  const { full_name, email, role_id, team, is_active } = body;

  // If email is changing, sync to Supabase Auth first
  if (email !== undefined) {
    // Fetch the auth_user_id so we can update the auth record
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('app_users')
      .select('auth_user_id, email')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (existing.auth_user_id && email !== existing.email) {
      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(
        existing.auth_user_id,
        { email, email_confirm: true }
      );
      if (authErr) {
        return NextResponse.json(
          { error: `Auth email update failed: ${authErr.message}` },
          { status: 500 }
        );
      }
    }
  }

  // If deactivating/reactivating, also ban/unban in Supabase Auth
  if (is_active !== undefined) {
    const { data: existing } = await supabaseAdmin
      .from('app_users')
      .select('auth_user_id')
      .eq('id', id)
      .single();

    if (existing?.auth_user_id) {
      if (!is_active) {
        // Ban the user so they can't log in
        await supabaseAdmin.auth.admin.updateUserById(existing.auth_user_id, {
          ban_duration: 'none', // permanent ban
        });
      } else {
        // Unban the user
        await supabaseAdmin.auth.admin.updateUserById(existing.auth_user_id, {
          ban_duration: '0', // remove ban
        });
      }
    }
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (full_name !== undefined) updates.full_name = full_name;
  if (email !== undefined) updates.email = email;
  if (role_id !== undefined) updates.role_id = role_id;
  if (team !== undefined) updates.team = team;
  if (is_active !== undefined) updates.is_active = is_active;

  const { data, error } = await supabaseAdmin
    .from('app_users')
    .update(updates)
    .eq('id', id)
    .select('*, role:roles(id, name, permissions)')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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

  // Fetch the user so we can get their auth_user_id
  const { data: appUser, error: fetchError } = await supabaseAdmin
    .from('app_users')
    .select('auth_user_id, full_name')
    .eq('id', id)
    .single();

  if (fetchError || !appUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
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
