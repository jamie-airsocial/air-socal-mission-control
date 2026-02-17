import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('labels')
    .select('name')
    .order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data || []).map((l: { name: string }) => l.name));
}

export async function POST(request: NextRequest) {
  const { name } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });
  const { error } = await supabaseAdmin.from('labels').insert({ name: name.trim() });
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Label already exists' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ name: name.trim() }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const { oldName, newName } = await request.json();
  if (!oldName || !newName?.trim()) return NextResponse.json({ error: 'Both names required' }, { status: 400 });
  const { error } = await supabaseAdmin.from('labels').update({ name: newName.trim() }).eq('name', oldName);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ name: newName.trim() });
}

export async function DELETE(request: NextRequest) {
  const { name } = await request.json();
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });
  const { error } = await supabaseAdmin.from('labels').delete().eq('name', name);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: name });
}
