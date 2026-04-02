import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';


async function syncProspectBillingSummary(prospectId: string) {
  const { data: lineItems, error: lineItemsError } = await supabaseAdmin
    .from('prospect_line_items')
    .select('service,monthly_value,is_active,created_at')
    .eq('prospect_id', prospectId)
    .order('created_at', { ascending: true });

  if (lineItemsError) throw lineItemsError;

  const activeLineItems = (lineItems || []).filter((item) => item.is_active);
  const totalValue = activeLineItems.reduce((sum, item) => sum + Number(item.monthly_value || 0), 0);
  const primaryService = activeLineItems.find((item) => item.service)?.service || null;

  const { error: updateError } = await supabaseAdmin
    .from('prospects')
    .update({
      value: totalValue > 0 ? totalValue : null,
      service: primaryService,
      updated_at: new Date().toISOString(),
    })
    .eq('id', prospectId);

  if (updateError) throw updateError;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, error } = await supabaseAdmin
    .from('prospect_line_items')
    .select('*')
    .eq('prospect_id', id)
    .order('created_at');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const { data, error } = await supabaseAdmin
    .from('prospect_line_items')
    .insert({ prospect_id: id, ...body })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await syncProspectBillingSummary(id);
  return NextResponse.json(data, { status: 201 });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: prospectId } = await params;
  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: 'Line item id required' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('prospect_line_items')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('prospect_id', prospectId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await syncProspectBillingSummary(prospectId);
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: prospectId } = await params;
  const body = await req.json();
  const { id } = body;

  if (!id) return NextResponse.json({ error: 'Line item id required' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('prospect_line_items')
    .delete()
    .eq('id', id)
    .eq('prospect_id', prospectId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await syncProspectBillingSummary(prospectId);
  return NextResponse.json({ success: true });
}
