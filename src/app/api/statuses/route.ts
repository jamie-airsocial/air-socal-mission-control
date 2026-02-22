import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('task_statuses')
    .select('*')
    .order('sort_order');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  // TODO: Add admin-only check when auth middleware is implemented
  const body = await request.json();
  const { slug, label, colour, dot_colour } = body;

  if (!slug || !label || !colour) {
    return NextResponse.json({ error: 'slug, label, and colour are required' }, { status: 400 });
  }

  // Get max sort_order and add 1
  const { data: maxData } = await supabaseAdmin
    .from('task_statuses')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .single();

  const nextSortOrder = (maxData?.sort_order ?? -1) + 1;

  const { data, error } = await supabaseAdmin
    .from('task_statuses')
    .insert({ 
      slug, 
      label, 
      colour,
      dot_colour: dot_colour || colour,
      sort_order: nextSortOrder,
      is_default: false
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function PUT(request: Request) {
  // Batch reorder — accepts array of { id, sort_order }
  const body = await request.json();
  if (!Array.isArray(body)) {
    return NextResponse.json({ error: 'Expected array of { id, sort_order }' }, { status: 400 });
  }

  const updates = body.map((item: { id: string; sort_order: number }) =>
    supabaseAdmin.from('task_statuses').update({ sort_order: item.sort_order }).eq('id', item.id)
  );

  const results = await Promise.all(updates);
  const failed = results.filter(r => r.error);
  if (failed.length > 0) {
    return NextResponse.json({ error: 'Some updates failed', details: failed.map(f => f.error?.message) }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(request: Request) {
  // TODO: Add admin-only check when auth middleware is implemented
  const body = await request.json();
  const { id, label, colour, dot_colour, sort_order } = body;

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (label !== undefined) updates.label = label;
  if (colour !== undefined) updates.colour = colour;
  if (dot_colour !== undefined) updates.dot_colour = dot_colour;
  if (sort_order !== undefined) updates.sort_order = sort_order;

  const { data, error } = await supabaseAdmin
    .from('task_statuses')
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
  // TODO: Add admin-only check when auth middleware is implemented
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  // Check if status is protected (todo or done)
  const { data: status } = await supabaseAdmin
    .from('task_statuses')
    .select('slug, is_default')
    .eq('id', id)
    .single();

  if (status?.is_default || ['todo', 'done'].includes(status?.slug || '')) {
    return NextResponse.json({ error: 'Cannot delete protected status' }, { status: 403 });
  }

  // Check if any tasks use this status
  const { data: tasks, error: tasksError } = await supabaseAdmin
    .from('tasks')
    .select('id')
    .eq('status', status?.slug)
    .limit(1);

  if (tasksError) {
    return NextResponse.json({ error: tasksError.message }, { status: 500 });
  }

  if (tasks && tasks.length > 0) {
    return NextResponse.json({ error: 'Cannot delete status that is in use' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('task_statuses')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
