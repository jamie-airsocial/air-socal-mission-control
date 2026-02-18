import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/users/auth-info
 * Returns a map of auth_user_id → last_sign_in_at by fetching from the
 * Supabase Auth admin API.
 */
export async function GET() {
  try {
    // Fetch all auth users (up to 1000)
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Build map: auth_user_id → last_sign_in_at
    const authInfoMap: Record<string, string | null> = {};
    for (const user of data.users) {
      authInfoMap[user.id] = user.last_sign_in_at ?? null;
    }

    return NextResponse.json(authInfoMap, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
