import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  // Fetch all app users (active AND inactive)
  const { data, error } = await supabaseAdmin
    .from('app_users')
    .select('*, role:roles(id, name, permissions)')
    .order('full_name');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Merge last_sign_in_at from Supabase Auth
  try {
    const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (authData?.users) {
      const authMap = new Map(authData.users.map(u => [u.id, u.last_sign_in_at]));
      const merged = (data || []).map(u => ({
        ...u,
        last_sign_in_at: u.auth_user_id ? (authMap.get(u.auth_user_id) ?? null) : null,
      }));
      return NextResponse.json(merged, { headers: { 'Cache-Control': 'no-store' } });
    }
  } catch {
    // If auth lookup fails, return without last_sign_in_at
  }

  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { email, full_name, role_id, team, password } = body;

  if (!email || !full_name || !team) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Create auth user
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: password || 'AirSocial2026!',
    email_confirm: true,
    user_metadata: { full_name },
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  // Create app_user row
  const { data, error } = await supabaseAdmin.from('app_users').insert({
    auth_user_id: authData.user.id,
    email,
    full_name,
    role_id: role_id || null,
    team,
    is_active: true,
  }).select('*, role:roles(id, name, permissions)').single();

  if (error) {
    // Rollback auth user
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
