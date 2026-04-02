import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

type ProspectLineItem = {
  id: string;
  prospect_id: string;
  service: string;
  description: string | null;
  monthly_value: number | null;
  billing_type: 'recurring' | 'one-off' | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean | null;
};

type ContractLineItemInput = {
  service: string;
  description: string | null;
  monthly_value: number;
  billing_type: 'recurring' | 'one-off';
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
};

function normaliseContractLineItem(item: Partial<ProspectLineItem> | Partial<ContractLineItemInput>): ContractLineItemInput | null {
  if (!item.service) return null;

  return {
    service: item.service,
    description: item.description ?? null,
    monthly_value: Number(item.monthly_value ?? 0),
    billing_type: item.billing_type === 'one-off' ? 'one-off' : 'recurring',
    start_date: item.start_date ?? null,
    end_date: item.end_date ?? null,
    is_active: item.is_active ?? true,
  };
}

/**
 * POST /api/prospects/[id]/convert
 * Converts a prospect to either a brand new client or an existing client.
 * Contract line items moved into the client are explicitly supplied or derived
 * from active prospect line items. The prospect is only marked won after the
 * client + selected billing items have been handled successfully.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

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
    .eq('prospect_id', id)
    .order('created_at', { ascending: true });

  if (lineItemsErr) {
    return NextResponse.json({ error: lineItemsErr.message }, { status: 500 });
  }

  const allLineItems = (lineItems || []) as ProspectLineItem[];
  const activeLineItems = allLineItems.filter((item) => item.is_active);

  const selectedLineItems = Array.isArray(body.line_items)
    ? body.line_items
        .map((item: Partial<ProspectLineItem> | Partial<ContractLineItemInput>) => normaliseContractLineItem(item))
        .filter((item: ContractLineItemInput | null): item is ContractLineItemInput => Boolean(item))
    : activeLineItems
        .map((item) => normaliseContractLineItem(item))
        .filter((item: ContractLineItemInput | null): item is ContractLineItemInput => Boolean(item));

  const derivedServices = [...new Set(selectedLineItems.map((item: ContractLineItemInput) => item.service).filter((service: string | undefined): service is string => Boolean(service)))];
  const derivedMonthlyRetainer = selectedLineItems
    .filter((item: ContractLineItemInput) => item.is_active && item.billing_type === 'recurring')
    .reduce((sum: number, item: ContractLineItemInput) => sum + (item.monthly_value || 0), 0);

  const {
    mode = body.client_id ? 'existing' : 'new',
    client_id = null,
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

  let client = null as Record<string, unknown> | null;

  if (mode === 'existing') {
    if (!client_id) {
      return NextResponse.json({ error: 'client_id is required for existing-client conversion' }, { status: 400 });
    }

    const { data: existingClient, error: existingClientErr } = await supabaseAdmin
      .from('clients')
      .select('*')
      .eq('id', client_id)
      .single();

    if (existingClientErr || !existingClient) {
      return NextResponse.json({ error: 'Existing client not found' }, { status: 404 });
    }

    const mergedServices = [...new Set([...(existingClient.services || []), ...services])].filter(Boolean);
    const clientUpdates: Record<string, unknown> = {
      services: mergedServices,
      updated_at: new Date().toISOString(),
    };

    if (!existingClient.sale_source && sale_source) clientUpdates.sale_source = sale_source;
    if (!existingClient.sold_by && sold_by) clientUpdates.sold_by = sold_by;
    if (!existingClient.contact_name && prospect.contact_name) clientUpdates.contact_name = prospect.contact_name;
    if (!existingClient.contact_email && prospect.contact_email) clientUpdates.contact_email = prospect.contact_email;
    if (!existingClient.contact_phone && prospect.contact_phone) clientUpdates.contact_phone = prospect.contact_phone;
    if (!existingClient.website && prospect.website) clientUpdates.website = prospect.website;
    if ((!existingClient.notes || String(existingClient.notes).trim() === '') && notes) clientUpdates.notes = notes;

    const { data: updatedClient, error: updateClientErr } = await supabaseAdmin
      .from('clients')
      .update(clientUpdates)
      .eq('id', client_id)
      .select()
      .single();

    if (updateClientErr) {
      return NextResponse.json({ error: updateClientErr.message }, { status: 500 });
    }

    client = updatedClient as Record<string, unknown>;
  } else {
    const { data: createdClient, error: clientErr } = await supabaseAdmin
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

    client = createdClient as Record<string, unknown>;
  }

  if (!client?.id) {
    return NextResponse.json({ error: 'Client handling failed during conversion' }, { status: 500 });
  }

  if (selectedLineItems.length > 0) {
    const contractLineItems = selectedLineItems.map((item: ContractLineItemInput) => ({
      client_id: client!.id,
      ...item,
    }));

    const { error: contractItemsErr } = await supabaseAdmin
      .from('contract_line_items')
      .insert(contractLineItems);

    if (contractItemsErr) {
      return NextResponse.json({ error: contractItemsErr.message }, { status: 500 });
    }
  }

  const prospectBillingValue = activeLineItems.reduce((sum, item) => sum + (item.monthly_value || 0), 0);
  const prospectPrimaryService = activeLineItems.find((item) => item.service)?.service || prospect.service || null;

  const prospectUpdate: Record<string, unknown> = {
    stage: 'won',
    won_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    value: prospectBillingValue > 0 ? prospectBillingValue : prospect.value || null,
    service: prospectPrimaryService,
  };

  if (archive_prospect) {
    prospectUpdate.archived = true;
  }

  const { error: updateErr } = await supabaseAdmin
    .from('prospects')
    .update(prospectUpdate)
    .eq('id', id);

  if (updateErr) {
    console.error('Failed to update prospect after conversion:', updateErr.message);
  }

  return NextResponse.json(
    {
      client,
      prospect_id: id,
      mode,
      moved_line_items: selectedLineItems.length,
    },
    { status: 201 }
  );
}
