import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const DEFAULT_STAGE_IDS = ['lead', 'won', 'lost'];
const FALLBACK_STAGES = [
  { id: 'lead', label: 'Lead', color: 'var(--status-warning)', sort_order: 0, is_default: true },
  { id: 'contacted', label: 'Contacted', color: '#60a5fa', sort_order: 1, is_default: false },
  { id: 'proposal', label: 'Proposal', color: '#a78bfa', sort_order: 2, is_default: false },
  { id: 'negotiation', label: 'Negotiation', color: '#f97316', sort_order: 3, is_default: false },
  { id: 'won', label: 'Won', color: 'var(--status-success)', sort_order: 4, is_default: true },
  { id: 'lost', label: 'Lost', color: '#ef4444', sort_order: 5, is_default: true },
];

async function ensurePipelineStagesTable() {
  await supabaseAdmin.rpc('exec_sql', {
    sql: `
      create table if not exists public.pipeline_stages (
        id text primary key,
        label text not null,
        color text not null,
        sort_order integer not null default 0,
        is_default boolean not null default false,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    `,
  });
}

async function ensureSeedData() {
  const { data: existing } = await supabaseAdmin
    .from('pipeline_stages')
    .select('id')
    .limit(1);

  if (existing && existing.length > 0) return;

  await supabaseAdmin
    .from('pipeline_stages')
    .insert(FALLBACK_STAGES);
}

export async function GET() {
  await ensurePipelineStagesTable();
  await ensureSeedData();

  const { data, error } = await supabaseAdmin
    .from('pipeline_stages')
    .select('*')
    .order('sort_order');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { id, label, color } = body;

  if (!id || !label || !color) {
    return NextResponse.json({ error: 'id, label, and color are required' }, { status: 400 });
  }

  await ensurePipelineStagesTable();
  await ensureSeedData();

  const { data: maxData } = await supabaseAdmin
    .from('pipeline_stages')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .single();

  const nextSortOrder = (maxData?.sort_order ?? -1) + 1;

  const { data, error } = await supabaseAdmin
    .from('pipeline_stages')
    .insert({
      id,
      label,
      color,
      sort_order: nextSortOrder,
      is_default: false,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function PUT(request: Request) {
  const body = await request.json();
  if (!Array.isArray(body)) {
    return NextResponse.json({ error: 'Expected array of { id, sort_order }' }, { status: 400 });
  }

  const updates = body.map((item: { id: string; sort_order: number }) =>
    supabaseAdmin.from('pipeline_stages').update({ sort_order: item.sort_order }).eq('id', item.id)
  );

  const results = await Promise.all(updates);
  const failed = results.filter(r => r.error);
  if (failed.length > 0) {
    return NextResponse.json({ error: 'Some updates failed', details: failed.map(f => f.error?.message) }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const { id, label, color, sort_order } = body;

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (label !== undefined) updates.label = label;
  if (color !== undefined) updates.color = color;
  if (sort_order !== undefined) updates.sort_order = sort_order;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('pipeline_stages')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  await ensurePipelineStagesTable();
  await ensureSeedData();

  const { data: stage } = await supabaseAdmin
    .from('pipeline_stages')
    .select('id, is_default')
    .eq('id', id)
    .single();

  if (stage?.is_default || DEFAULT_STAGE_IDS.includes(stage?.id || '')) {
    return NextResponse.json({ error: 'Cannot delete protected stage' }, { status: 403 });
  }

  const { data: prospects, error: prospectsError } = await supabaseAdmin
    .from('prospects')
    .select('id')
    .eq('stage', stage?.id)
    .limit(1);

  if (prospectsError) {
    return NextResponse.json({ error: prospectsError.message }, { status: 500 });
  }

  if (prospects && prospects.length > 0) {
    return NextResponse.json({ error: 'Cannot delete stage that is in use' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('pipeline_stages')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
