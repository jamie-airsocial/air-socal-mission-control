import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { logActivity } from '@/lib/activity';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('project_id');
  const status = searchParams.get('status');
  const assignee = searchParams.get('assignee');
  const priority = searchParams.get('priority');

  let query = supabaseAdmin
    .from('tasks')
    .select('*, projects(name, color)')
    .order('created_at', { ascending: false });

  if (projectId === 'none') query = query.is('project_id', null);
  else if (projectId) query = query.eq('project_id', projectId);
  if (status) query = query.eq('status', status);
  if (assignee === 'none') query = query.is('assignee', null);
  else if (assignee) query = query.eq('assignee', assignee);
  // Filter for tasks with no priority — we check both NULL and empty string ('')
  // because some tasks were inserted with an empty string rather than NULL when
  // priority was not set. The .or() pattern covers both cases in one query.
  if (priority === 'none') query = query.or('priority.is.null,priority.eq.');
  else if (priority) query = query.eq('priority', priority);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Flatten the joined project data to match the old API shape
  const tasks = (data || []).map((t: Record<string, unknown>) => {
    const project = t.projects as { name: string; color: string } | null;
    return {
      ...t,
      project_name: project?.name || null,
      project_color: project?.color || null,
      projects: undefined,
    };
  });

  // Compute subtask counts for parent tasks
  const allTasks = tasks as Record<string, unknown>[];
  // Subtask counts are derived in-memory from the flat task list rather than a
  // separate COUNT query. This avoids an extra round-trip and keeps the query
  // simple. The trade-off is that counts are only accurate when fetching all
  // tasks (which is our only use case — we don't support paginated API calls).
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
  const { title, description, status, priority, assignee, project_id, due_date, parent_id, labels } = body;

  if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 });
  if (title.length > 500) return NextResponse.json({ error: 'Title too long' }, { status: 400 });
  if (description && typeof description === 'string' && description.length > 50000) return NextResponse.json({ error: 'Description too long' }, { status: 400 });

  const insert: Record<string, unknown> = {
    title,
    description: description || null,
    status: status || 'todo',
    priority: priority || null,
    assignee: assignee || null,
    project_id: project_id || null,
    due_date: due_date || null,
    parent_id: parent_id || null,
  };
  // Only include labels if the column exists (added via migration)
  if (labels !== undefined) insert.labels = labels;
  if (insert.status === 'done') insert.completed_at = new Date().toISOString();
  if (body.id) insert.id = body.id;

  const { data, error } = await supabaseAdmin
    .from('tasks')
    .insert(insert)
    .select('*, projects(name, color)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const project = data.projects as { name: string; color: string } | null;
  const task = {
    ...data,
    project_name: project?.name || null,
    project_color: project?.color || null,
    projects: undefined,
  };

  await logActivity({
    action: 'task_created',
    description: `Task created: ${task.title}`,
    agent: task.assignee || 'casper',
    metadata: { task_id: task.id, status: task.status, priority: task.priority },
  });

  return NextResponse.json(task, { status: 201 });
}
