import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('clients')
    .select('*, contract_line_items(*)')
    .order('name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Calculate retainer from active recurring line items
  const enriched = (data || []).map(client => {
    const items = (client.contract_line_items || []) as Array<{ is_active: boolean; billing_type: string; monthly_value: number; end_date: string | null }>;
    // Auto-deactivate expired items
    const now = new Date();
    const activeItems = items.filter(i => {
      if (!i.is_active) return false;
      if (i.end_date && new Date(i.end_date) < now) return false;
      return true;
    });
    const recurring_total = activeItems.filter(i => i.billing_type !== 'one-off').reduce((s, i) => s + (i.monthly_value || 0), 0);
    const { contract_line_items: _, ...rest } = client;
    // Derive services from active line items
    const derived_services = [...new Set(activeItems.map((i) => (i as unknown as { service?: string }).service).filter(Boolean))];
    // Auto-derive status from billing: if client has line items but none are active, mark as churned
    const allItems = items;
    const derived_status = allItems.length > 0 && activeItems.length === 0 ? 'churned' : rest.status;
    return { ...rest, status: derived_status, calculated_retainer: recurring_total, derived_services };
  });

  return NextResponse.json(enriched);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    name, team, status, services, monthly_retainer, assigned_members, color,
    signup_date, notes, sale_source, sold_by, sale_closed_at,
    contract_value, contract_start, contract_end, contract_renewal,
    contact_name, contact_email, contact_phone, website,
  } = body;

  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const insertData: Record<string, unknown> = {
    name,
    team: team || null,
    status: status || 'active',
    services: services || [],
    monthly_retainer: monthly_retainer || null,
    assigned_members: assigned_members || [],
    color: color || null,
  };

  // Include optional extended fields if provided
  if (signup_date !== undefined) insertData.signup_date = signup_date;
  if (notes !== undefined) insertData.notes = notes;
  if (sale_source !== undefined) insertData.sale_source = sale_source;
  if (sold_by !== undefined) insertData.sold_by = sold_by;
  if (sale_closed_at !== undefined) insertData.sale_closed_at = sale_closed_at;
  if (contract_value !== undefined) insertData.contract_value = contract_value;
  if (contract_start !== undefined) insertData.contract_start = contract_start;
  if (contract_end !== undefined) insertData.contract_end = contract_end;
  if (contract_renewal !== undefined) insertData.contract_renewal = contract_renewal;
  if (contact_name !== undefined) insertData.contact_name = contact_name;
  if (contact_email !== undefined) insertData.contact_email = contact_email;
  if (contact_phone !== undefined) insertData.contact_phone = contact_phone;
  if (website !== undefined) insertData.website = website;

  const { data, error } = await supabaseAdmin
    .from('clients')
    .insert(insertData)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
