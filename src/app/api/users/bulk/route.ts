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

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { user_ids, updates, password } = body as {
    user_ids?: string[];
    updates?: {
      team?: string | null;
      role_id?: string | null;
      is_active?: boolean;
      is_admin?: boolean;
      permission_overrides?: Record<string, boolean> | null;
    };
    password?: string;
  };

  if (!Array.isArray(user_ids) || user_ids.length === 0) {
    return NextResponse.json({ error: 'Select at least one user' }, { status: 400 });
  }

  const uniqueIds = [...new Set(user_ids)];

  if (uniqueIds.some(id => OWNER_USER_IDS.includes(id))) {
    return NextResponse.json({ error: 'Owner account cannot be bulk edited' }, { status: 403 });
  }

  if ((!updates || Object.keys(updates).length === 0) && !password) {
    return NextResponse.json({ error: 'No changes provided' }, { status: 400 });
  }

  if (password && password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
  }

  const { data: existingUsers, error: existingUsersError } = await supabaseAdmin
    .from('app_users')
    .select('id, auth_user_id, full_name, is_admin, is_active')
    .in('id', uniqueIds);

  if (existingUsersError) {
    return NextResponse.json({ error: existingUsersError.message }, { status: 500 });
  }

  if (!existingUsers || existingUsers.length !== uniqueIds.length) {
    return NextResponse.json({ error: 'One or more users could not be found' }, { status: 404 });
  }

  const activeAdminIdsBeingRemoved = existingUsers
    .filter(user => user.is_admin && user.is_active && (updates?.is_admin === false || updates?.is_active === false))
    .map(user => user.id);

  if (activeAdminIdsBeingRemoved.length > 0) {
    const remainingActiveAdmins = await countOtherActiveAdmins(activeAdminIdsBeingRemoved);
    if (remainingActiveAdmins === 0) {
      return NextResponse.json({ error: 'At least one active admin is required' }, { status: 400 });
    }
  }

  const failures: Array<{ id: string; full_name: string; error: string }> = [];
  const succeeded: string[] = [];

  for (const user of existingUsers) {
    try {
      if ((updates?.is_active !== undefined || password) && !user.auth_user_id) {
        throw new Error('User has no linked auth account');
      }

      const revert: { is_active?: boolean } = {};

      if (updates && Object.keys(updates).length > 0) {
        const payload: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() };

        const { error: updateError } = await supabaseAdmin
          .from('app_users')
          .update(payload)
          .eq('id', user.id);

        if (updateError) throw new Error(updateError.message);

        if (updates.is_active !== undefined) {
          revert.is_active = user.is_active;
        }
      }

      if (updates?.is_active !== undefined && user.auth_user_id) {
        const { error: authStatusError } = await supabaseAdmin.auth.admin.updateUserById(user.auth_user_id, {
          ban_duration: updates.is_active ? '0' : 'none',
        });
        if (authStatusError) {
          if (revert.is_active !== undefined) {
            await supabaseAdmin
              .from('app_users')
              .update({ is_active: revert.is_active, updated_at: new Date().toISOString() })
              .eq('id', user.id);
          }
          throw new Error(`Status sync failed: ${authStatusError.message}`);
        }
      }

      if (password && user.auth_user_id) {
        const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(user.auth_user_id, { password });
        if (passwordError) throw new Error(`Password update failed: ${passwordError.message}`);
      }

      succeeded.push(user.id);
    } catch (error) {
      failures.push({
        id: user.id,
        full_name: user.full_name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return NextResponse.json({
    success: failures.length === 0,
    updated_count: succeeded.length,
    failed_count: failures.length,
    failures,
  }, { status: failures.length > 0 ? 207 : 200 });
}
