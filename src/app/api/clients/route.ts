import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('clients')
    .select('*')
    .order('name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, team, status, services, monthly_retainer, assigned_members, color } = body;

  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('clients')
    .insert({
      name,
      team: team || null,
      status: status || 'active',
      services: services || [],
      monthly_retainer: monthly_retainer || null,
      assigned_members: assigned_members || [],
      color: color || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
