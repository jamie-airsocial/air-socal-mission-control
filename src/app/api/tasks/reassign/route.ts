import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const { from_assignee, to_assignee, all_statuses } = await request.json();

  if (!from_assignee || !to_assignee) {
    return NextResponse.json({ error: 'from_assignee and to_assignee are required' }, { status: 400 });
  }

  // Build the query — for hard deletes pass all_statuses=true to capture every task
  let query = supabaseAdmin
    .from('tasks')
    .select('id')
    .eq('assignee', from_assignee);

  if (!all_statuses) {
    query = query.in('status', ['backlog', 'todo', 'doing']);
  }

  const { data: tasks, error: fetchError } = await query;

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!tasks || tasks.length === 0) {
    return NextResponse.json({ count: 0 });
  }

  const ids = tasks.map(t => t.id);

  const { error: updateError } = await supabaseAdmin
    .from('tasks')
    .update({ assignee: to_assignee, updated_at: new Date().toISOString() })
    .in('id', ids);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ count: ids.length });
}
