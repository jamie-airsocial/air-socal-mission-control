import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from('contract_line_items')
    .select('*')
    .eq('client_id', id)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || [], { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const { service, description, monthly_value, start_date, end_date, is_active } = body;

  if (!service) {
    return NextResponse.json({ error: 'service is required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('contract_line_items')
    .insert({
      client_id: id,
      service,
      description: description || null,
      monthly_value: monthly_value ?? 0,
      start_date: start_date || null,
      end_date: end_date || null,
      is_active: is_active !== undefined ? is_active : true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
