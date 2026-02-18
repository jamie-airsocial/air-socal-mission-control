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

  // Allow overrides from request body (dialog form)
  const {
    name = prospect.name,
    team = prospect.team || null,
    services = prospect.service ? [prospect.service] : [],
    monthly_retainer = prospect.value || null,
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
    })
    .select()
    .single();

  if (clientErr) {
    return NextResponse.json({ error: clientErr.message }, { status: 500 });
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
