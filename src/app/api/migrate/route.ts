import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// One-shot migration endpoint - protected by secret
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (body.secret !== 'air-social-migrate-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: string[] = [];

  // 1. Add last_active_at to app_users
  try {
    const { error } = await supabaseAdmin.rpc('exec_migration', {
      sql: 'ALTER TABLE app_users ADD COLUMN IF NOT EXISTS last_active_at timestamptz'
    });
    if (error) results.push(`last_active_at: ${error.message}`);
    else results.push('last_active_at: added');
  } catch (e) {
    results.push(`last_active_at: ${e}`);
  }

  return NextResponse.json({ results });
}
