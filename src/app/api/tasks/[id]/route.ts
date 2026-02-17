import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { logActivity } from '@/lib/activity';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from('tasks')
    .select('*, projects(name, color)')
    .eq('id', id)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const project = data.projects as { name: string; color: string } | null;
  return NextResponse.json({
    ...data,
    project_name: project?.name || null,
    project_color: project?.color || null,
    projects: undefined,
  });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const updates: Record<string, unknown> = {};

  for (const key of ['title', 'description', 'status', 'priority', 'assignee', 'project_id', 'due_date', 'parent_id', 'labels']) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  // Validate title if being updated
  if ('title' in updates) {
    const titleVal = updates.title;
    if (!titleVal || typeof titleVal !== 'string' || titleVal.trim().length === 0) {
      return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 });
    }
    if (titleVal.length > 500) {
      return NextResponse.json({ error: 'Title too long' }, { status: 400 });
    }
  }

  const { data: existing } = await supabaseAdmin
    .from('tasks')
    .select('status, title, assignee, parent_id')
    .eq('id', id)
    .single();

  // SUBTASK COMPLETION LOGIC: Block parent completion if subtasks are incomplete
  if ('status' in updates && updates.status === 'done' && existing?.status !== 'done') {
    // Check if this task has incomplete subtasks
    const { data: subtasks } = await supabaseAdmin
      .from('tasks')
      .select('id, status')
      .eq('parent_id', id);

    const hasIncompleteSubtasks = subtasks && subtasks.length > 0 && subtasks.some((st: { status: string }) => st.status !== 'done');

    if (hasIncompleteSubtasks && !body.force) {
      return NextResponse.json({ 
        error: 'Cannot complete task with incomplete subtasks',
        code: 'INCOMPLETE_SUBTASKS',
        incomplete_count: subtasks?.filter((st: { status: string }) => st.status !== 'done').length || 0
      }, { status: 400 });
    }
  }

  if ('status' in updates) {
    if (updates.status === 'done') {
      if (existing?.status !== 'done') {
        updates.completed_at = new Date().toISOString();
      }
    } else {
      updates.completed_at = null;
    }
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .select('*, projects(name, color)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const project = data.projects as { name: string; color: string } | null;
  const response = {
    ...data,
    project_name: project?.name || null,
    project_color: project?.color || null,
    projects: undefined,
  };

  const agent = (body.agent as string) || response.assignee || existing?.assignee || 'casper';
  const statusChangedToDone = existing?.status !== 'done' && response.status === 'done';
  const action = statusChangedToDone ? 'task_completed' : 'task_updated';
  const description = statusChangedToDone
    ? `Task completed: ${response.title}`
    : `Task updated: ${response.title}`;

  await logActivity({
    action,
    description,
    agent,
    metadata: { task_id: response.id, status: response.status, priority: response.priority },
  });

  // SUBTASK COMPLETION LOGIC: Auto-complete parent when last subtask is done
  // NON-ATOMIC RACE CONDITION RISK: Between the sibling check and the parent update,
  // another request could complete a different subtask concurrently — both might
  // attempt to auto-complete the parent. This is harmless (idempotent UPDATE) but
  // could result in duplicate activity log entries. A Supabase RPC/transaction
  // would be the ideal solution to make this atomic.
  if (statusChangedToDone && response.parent_id) {
    // This is a subtask that just completed — check if all siblings are done
    const { data: siblings } = await supabaseAdmin
      .from('tasks')
      .select('id, status')
      .eq('parent_id', response.parent_id);

    const allSubtasksDone = siblings && siblings.length > 0 && siblings.every((st: { status: string }) => st.status === 'done');

    if (allSubtasksDone) {
      // Auto-complete the parent
      const { data: parent } = await supabaseAdmin
        .from('tasks')
        .select('status, title')
        .eq('id', response.parent_id)
        .single();

      if (parent && parent.status !== 'done') {
        await supabaseAdmin
          .from('tasks')
          .update({ 
            status: 'done', 
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', response.parent_id);

        await logActivity({
          action: 'task_completed',
          description: `Task auto-completed (all subtasks done): ${parent.title}`,
          agent,
          metadata: { task_id: response.parent_id, auto_completed: true },
        });
      }
    }
  }

  return NextResponse.json(response);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: existing } = await supabaseAdmin
    .from('tasks')
    .select('title, assignee')
    .eq('id', id)
    .single();

  // Fetch and clean up storage attachments for the parent task and all its subtasks
  // before deleting DB rows, so we don't leave orphaned files in the storage bucket.
  const { data: subtaskRows } = await supabaseAdmin
    .from('tasks')
    .select('id')
    .eq('parent_id', id);

  const allTaskIds = [id, ...(subtaskRows || []).map((s: { id: string }) => s.id)];

  const { data: attachmentRows } = await supabaseAdmin
    .from('task_attachments')
    .select('storage_path')
    .in('task_id', allTaskIds);

  if (attachmentRows && attachmentRows.length > 0) {
    const storagePaths = attachmentRows.map((a: { storage_path: string }) => a.storage_path).filter(Boolean);
    if (storagePaths.length > 0) {
      await supabaseAdmin.storage.from('documents').remove(storagePaths);
    }
  }

  // NON-ATOMIC RISK: We delete subtasks before the parent. If the parent delete
  // fails (e.g. a new FK constraint we haven't accounted for), the subtasks are
  // already gone and cannot be recovered. A Supabase RPC/transaction would be
  // the correct fix, but is deferred until proper auth is in place.
  //
  // If the DB has ON DELETE CASCADE on parent_id, deleting the parent directly
  // would cascade-delete all subtasks automatically and would be safer. For now
  // we delete subtasks explicitly as a defensive measure in case CASCADE is not set.
  const { error: subtaskDeleteError } = await supabaseAdmin
    .from('tasks')
    .delete()
    .eq('parent_id', id);

  if (subtaskDeleteError) {
    console.error('[DELETE /api/tasks] Failed to delete subtasks for parent', id, subtaskDeleteError.message);
  }

  const { error } = await supabaseAdmin
    .from('tasks')
    .delete()
    .eq('id', id);

  if (error) {
    // Log both the failed task and any subtask IDs that may already be gone
    const subtaskIds = (subtaskRows || []).map((s: { id: string }) => s.id);
    console.error('[DELETE /api/tasks] Parent delete failed after subtask delete — possible data inconsistency. Parent:', id, 'Subtasks:', subtaskIds, error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (existing) {
    await logActivity({
      action: 'task_deleted',
      description: `Task deleted: ${existing.title}`,
      agent: existing.assignee || 'casper',
      metadata: { task_id: id },
    });
  }
  return NextResponse.json({ success: true });
}
