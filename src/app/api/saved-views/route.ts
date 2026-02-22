import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('user_id');
  if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('saved_views')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { user_id, name, filters, for_view } = body;

  if (!user_id || !name || !filters) {
    return NextResponse.json({ error: 'user_id, name, and filters are required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('saved_views')
    .insert({ user_id, name, filters, for_view })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  const userId = request.nextUrl.searchParams.get('user_id');

  if (!id || !userId) return NextResponse.json({ error: 'id and user_id required' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('saved_views')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
