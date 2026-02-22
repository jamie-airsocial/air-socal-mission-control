import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, error } = await supabaseAdmin
    .from('prospect_activities')
    .select('*')
    .eq('prospect_id', id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { type, title, description, created_by } = body;

  if (!type || !title) {
    return NextResponse.json({ error: 'type and title required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('prospect_activities')
    .insert({ prospect_id: id, type, title, description: description || null, created_by: created_by || null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
