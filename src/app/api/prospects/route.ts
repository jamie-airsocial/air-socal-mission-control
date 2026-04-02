import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const includeArchived = searchParams.get('archived') === 'true';

  let query = supabaseAdmin
    .from('prospects')
    .select('*')
    .order('created_at', { ascending: false });

  if (!includeArchived) {
    query = query.or('archived.is.null,archived.eq.false');
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const prospects = data || [];
  if (prospects.length === 0) return NextResponse.json(prospects);

  const prospectIds = prospects.map((prospect) => prospect.id);
  const { data: lineItems, error: lineItemsError } = await supabaseAdmin
    .from('prospect_line_items')
    .select('prospect_id,service,monthly_value,is_active,created_at')
    .in('prospect_id', prospectIds);

  if (lineItemsError) return NextResponse.json({ error: lineItemsError.message }, { status: 500 });

  const billingByProspect = new Map();
  for (const item of lineItems || []) {
    if (!item.is_active) continue;
    const current = billingByProspect.get(item.prospect_id) || { total: 0, service: null, created_at: null };
    current.total += Number(item.monthly_value || 0);
    if (!current.service) current.service = item.service || null;
    if (!current.created_at || (item.created_at && item.created_at < current.created_at)) current.created_at = item.created_at;
    billingByProspect.set(item.prospect_id, current);
  }

  const enriched = prospects.map((prospect) => {
    const billing = billingByProspect.get(prospect.id);
    if (!billing) return prospect;
    return {
      ...prospect,
      value: billing.total > 0 ? billing.total : prospect.value,
      service: prospect.service || billing.service || null,
    };
  });

  return NextResponse.json(enriched);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, company, email, phone, stage, value, notes, service, assignee, source, contact_name, contact_email, contact_phone, team } = body;

  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const insertData = {
    name,
    company: company || null,
    email: email || null,
    phone: phone || null,
    stage: stage || 'lead',
    value: value || null,
    notes: notes || null,
    service: service || null,
    assignee: assignee || null,
    source: source || null,
    contact_name: contact_name || null,
    contact_email: contact_email || null,
    contact_phone: contact_phone || null,
    team: team || null,
  };

  const { data, error } = await supabaseAdmin
    .from('prospects')
    .insert(insertData)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-log creation
  if (data?.id) {
    await supabaseAdmin.from('prospect_activities').insert({
      prospect_id: data.id,
      type: 'created',
      title: 'Prospect created',
    });
  }

  return NextResponse.json(data, { status: 201 });
}

async function updateProspect(request: NextRequest) {
  const body = await request.json();
  const { id, website: _website, ...updates } = body;

  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  // Fetch current prospect to detect stage changes
  let oldStage: string | null = null;
  if (updates.stage) {
    const { data: current } = await supabaseAdmin.from('prospects').select('stage').eq('id', id).single();
    oldStage = current?.stage || null;
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('prospects')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-log stage change
  if (updates.stage && oldStage && updates.stage !== oldStage) {
    const stageLabel = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    const activityType = updates.stage === 'won' ? 'won' : updates.stage === 'lost' ? 'lost' : 'stage_change';
    await supabaseAdmin.from('prospect_activities').insert({
      prospect_id: id,
      type: activityType,
      title: `Stage changed from ${stageLabel(oldStage)} to ${stageLabel(updates.stage)}`,
      from_stage: oldStage,
      to_stage: updates.stage,
    });
  }

  return NextResponse.json(data);
}

export async function PUT(request: NextRequest) {
  return updateProspect(request);
}

export async function PATCH(request: NextRequest) {
  return updateProspect(request);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  const { data: prospect, error: prospectErr } = await supabaseAdmin
    .from('prospects')
    .select('id,name')
    .eq('id', id)
    .single();

  if (prospectErr || !prospect) {
    return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });
  }

  const { error } = await supabaseAdmin
    .from('prospects')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, deleted_id: id, deleted_name: prospect.name });
}
