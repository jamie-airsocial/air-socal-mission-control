import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { logActivity } from '@/lib/activity';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('client_id');
  const status = searchParams.get('status');
  const assignee = searchParams.get('assignee');
  const priority = searchParams.get('priority');
  const service = searchParams.get('service');

  let query = supabaseAdmin
    .from('tasks')
    .select('*, clients(name, color, team)')
    .order('created_at', { ascending: false });

  if (clientId === 'none') query = query.is('client_id', null);
  else if (clientId) query = query.eq('client_id', clientId);
  if (status) query = query.eq('status', status);
  if (assignee === 'none') query = query.is('assignee', null);
  else if (assignee) query = query.eq('assignee', assignee);
  if (service) query = query.eq('service', service);
  if (priority === 'none') query = query.or('priority.is.null,priority.eq.');
  else if (priority) query = query.eq('priority', priority);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Flatten the joined client data
  const tasks = (data || []).map((t: Record<string, unknown>) => {
    const client = t.clients as { name: string; color: string; team: string } | null;
    return {
      ...t,
      client_name: client?.name || null,
      client_color: client?.color || null,
      client_team: client?.team || null,
      clients: undefined,
    };
  });

  // Compute subtask counts for parent tasks
  const allTasks = tasks as Record<string, unknown>[];
  const subtaskCounts: Record<string, { total: number; done: number }> = {};
  for (const t of allTasks) {
    const pid = t.parent_id as string | null;
    if (pid) {
      if (!subtaskCounts[pid]) subtaskCounts[pid] = { total: 0, done: 0 };
      subtaskCounts[pid].total++;
      if (t.status === 'done') subtaskCounts[pid].done++;
    }
  }
  for (const t of allTasks) {
    const id = t.id as string;
    if (subtaskCounts[id]) {
      t.subtask_count = subtaskCounts[id].total;
      t.subtasks_done_count = subtaskCounts[id].done;
    }
  }

  return NextResponse.json(tasks);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { title, description, status, priority, assignee, client_id, project_id, service, due_date, parent_id, labels } = body;

  if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 });
  if (title.length > 500) return NextResponse.json({ error: 'Title too long' }, { status: 400 });
  if (description && typeof description === 'string' && description.length > 50000) return NextResponse.json({ error: 'Description too long' }, { status: 400 });

  const insert: Record<string, unknown> = {
    title,
    description: description || null,
    status: status || 'todo',
    priority: priority || null,
    assignee: assignee || null,
    client_id: client_id || null,
    project_id: project_id || null,
    service: service || null,
    due_date: due_date || null,
    parent_id: parent_id || null,
  };
  if (labels !== undefined) insert.labels = labels;
  if (insert.status === 'done') insert.completed_at = new Date().toISOString();
  if (body.id) insert.id = body.id;

  const { data, error } = await supabaseAdmin
    .from('tasks')
    .insert(insert)
    .select('*, clients(name, color, team)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const client = data.clients as { name: string; color: string; team: string } | null;
  const task = {
    ...data,
    client_name: client?.name || null,
    client_color: client?.color || null,
    client_team: client?.team || null,
    clients: undefined,
  };

  await logActivity({
    action: 'task_created',
    description: `Task created: ${task.title}`,
    agent: task.assignee || 'system',
    metadata: { task_id: task.id, status: task.status, priority: task.priority },
  });

  return NextResponse.json(task, { status: 201 });
}
