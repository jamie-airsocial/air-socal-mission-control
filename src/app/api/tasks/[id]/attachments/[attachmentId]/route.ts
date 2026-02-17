import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const { id: taskId, attachmentId } = await params;
  const body = await request.json();

  // Validate and sanitise the new filename to prevent path traversal and oversized names
  const newName = typeof body.file_name === 'string' ? body.file_name.trim().slice(0, 200) : null;
  if (!newName) return NextResponse.json({ error: 'Invalid file_name' }, { status: 400 });
  const safeName = newName.replace(/[^a-zA-Z0-9._\- ]/g, '_');

  const { error } = await supabaseAdmin
    .from('task_attachments')
    .update({ file_name: safeName })
    .eq('id', attachmentId)
    .eq('task_id', taskId); // Ownership check: prevents renaming attachments from other tasks

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const { id: taskId, attachmentId } = await params;

  // Get the attachment to find storage path — also verify it belongs to this task (ownership check)
  const { data: attachment, error: fetchError } = await supabaseAdmin
    .from('task_attachments')
    .select('storage_path')
    .eq('id', attachmentId)
    .eq('task_id', taskId) // Ownership check: prevents deleting attachments from other tasks
    .single();

  if (fetchError || !attachment) {
    return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
  }

  // Delete from storage
  await supabaseAdmin.storage
    .from('documents')
    .remove([attachment.storage_path]);

  // Delete from database
  const { error } = await supabaseAdmin
    .from('task_attachments')
    .delete()
    .eq('id', attachmentId)
    .eq('task_id', taskId); // Redundant safety check

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
