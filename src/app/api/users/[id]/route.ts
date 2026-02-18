import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/users/[id] — send a password reset email for the user.
 * Looks up the user's email from app_users, then calls Supabase Auth
 * resetPasswordForEmail which triggers the configured email template.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Look up the user's email from app_users
  const { data: appUser, error: lookupError } = await supabaseAdmin
    .from('app_users')
    .select('email, full_name')
    .eq('id', id)
    .single();

  if (lookupError || !appUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Use Supabase Auth to send password recovery email
  const { error } = await supabaseAdmin.auth.resetPasswordForEmail(appUser.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://air-social-staging.vercel.app'}/reset-password`,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, email: appUser.email });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { full_name, role_id, team, is_active } = body;

  const { data, error } = await supabaseAdmin
    .from('app_users')
    .update({ 
      full_name, 
      role_id, 
      team, 
      is_active,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*, role:roles(id, name, permissions)')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { error } = await supabaseAdmin
    .from('app_users')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
