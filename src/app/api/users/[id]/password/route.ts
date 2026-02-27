import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * PUT /api/users/[id]/password — set a specific password for the user.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { password } = body;

  if (!password || password.length < 6) {
    return NextResponse.json(
      { error: 'Password must be at least 6 characters' },
      { status: 400 }
    );
  }

  // Owner protection
  const OWNER_USER_IDS = ['83983bb2-3d05-4be3-97f3-fdac36929560'];
  if (OWNER_USER_IDS.includes(id)) {
    return NextResponse.json(
      { error: 'Owner password cannot be changed by admins' },
      { status: 403 }
    );
  }

  // Look up the user's auth_user_id from app_users
  const { data: appUser, error: lookupError } = await supabaseAdmin
    .from('app_users')
    .select('auth_user_id, email, full_name')
    .eq('id', id)
    .single();

  if (lookupError || !appUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (!appUser.auth_user_id) {
    return NextResponse.json(
      { error: 'User has no linked auth account' },
      { status: 400 }
    );
  }

  // Set the password using Supabase Admin API
  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
    appUser.auth_user_id,
    { password }
  );

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    email: appUser.email,
    full_name: appUser.full_name,
  });
}
