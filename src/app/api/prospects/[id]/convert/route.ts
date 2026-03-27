import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/prospects/[id]/convert
 * Converts a won prospect to a client:
 * 1. Creates a new row in the clients table
 * 2. Marks the prospect stage as 'won' and records won_at
 * 3. Returns the new client record
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  // Fetch the prospect
  const { data: prospect, error: prospectErr } = await supabaseAdmin
    .from('prospects')
    .select('*')
    .eq('id', id)
    .single();

  if (prospectErr || !prospect) {
    return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });
  }

  const { data: lineItems, error: lineItemsErr } = await supabaseAdmin
    .from('prospect_line_items')
    .select('*')
    .eq('prospect_id', id);

  if (lineItemsErr) {
    return NextResponse.json({ error: lineItemsErr.message }, { status: 500 });
  }

  const activeLineItems = (lineItems || []).filter((item) => item.is_active);
  const derivedServices = [...new Set(activeLineItems.map((item) => item.service).filter(Boolean))];
  const derivedMonthlyRetainer = activeLineItems
    .filter((item) => item.billing_type === 'recurring')
    .reduce((sum, item) => sum + (item.monthly_value || 0), 0);

  // Allow overrides from request body (dialog form)
  const {
    name = prospect.name,
    team = prospect.team || null,
    services = derivedServices.length > 0 ? derivedServices : (prospect.service ? [prospect.service] : []),
    monthly_retainer = derivedMonthlyRetainer > 0 ? derivedMonthlyRetainer : (prospect.value || null),
    assigned_members = prospect.assignee ? [prospect.assignee] : [],
    notes = prospect.notes || null,
    sale_source = prospect.source || null,
    sold_by = prospect.assignee || null,
    signup_date = new Date().toISOString().split('T')[0],
    archive_prospect = false,
  } = body;

  // Create the client
  const { data: client, error: clientErr } = await supabaseAdmin
    .from('clients')
    .insert({
      name,
      team,
      status: 'active',
      services,
      monthly_retainer,
      assigned_members,
      notes,
      sale_source,
      sold_by,
      signup_date,
      sale_closed_at: new Date().toISOString(),
      contact_name: prospect.contact_name || null,
      contact_email: prospect.contact_email || null,
      contact_phone: prospect.contact_phone || null,
      website: prospect.website || null,
    })
    .select()
    .single();

  if (clientErr) {
    return NextResponse.json({ error: clientErr.message }, { status: 500 });
  }

  if (client && lineItems && lineItems.length > 0) {
    const contractLineItems = lineItems.map((item) => ({
      client_id: client.id,
      service: item.service,
      description: item.description || null,
      monthly_value: item.monthly_value || 0,
      billing_type: item.billing_type || 'recurring',
      start_date: item.start_date || null,
      end_date: item.end_date || null,
      is_active: item.is_active ?? true,
    }));

    const { error: contractItemsErr } = await supabaseAdmin
      .from('contract_line_items')
      .insert(contractLineItems);

    if (contractItemsErr) {
      return NextResponse.json({ error: contractItemsErr.message }, { status: 500 });
    }
  }

  // Update the prospect: mark as won, optionally archive
  const prospectUpdate: Record<string, unknown> = {
    stage: 'won',
    won_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (archive_prospect) {
    prospectUpdate.archived = true;
  }

  const { error: updateErr } = await supabaseAdmin
    .from('prospects')
    .update(prospectUpdate)
    .eq('id', id);

  if (updateErr) {
    // Client was created but prospect update failed — log it
    console.error('Failed to update prospect after conversion:', updateErr.message);
  }

  return NextResponse.json({ client, prospect_id: id }, { status: 201 });
}
