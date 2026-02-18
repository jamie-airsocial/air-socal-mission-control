import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const { data: teams, error } = await supabaseAdmin
    .from('teams')
    .select('*')
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Attach members to each team
  const { data: users } = await supabaseAdmin
    .from('app_users')
    .select('id, full_name, team, role_id, is_active, role:roles(id, name)')
    .eq('is_active', true);

  const enriched = (teams || []).map(team => {
    const slug = team.name.toLowerCase();
    const members = (users || []).filter(u => u.team === slug);
    return { ...team, members };
  });

  return NextResponse.json(enriched);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, color } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Team name is required' }, { status: 400 });
  }

  const insertData: Record<string, string> = { name: name.trim() };
  if (color) insertData.color = color;

  const { data, error } = await supabaseAdmin
    .from('teams')
    .insert(insertData)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
