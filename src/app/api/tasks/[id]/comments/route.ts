import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from('comments')
    .select('*')
    .eq('task_id', id)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: taskId } = await params;
  const body = await request.json();

  // Validate content — must be a non-empty string, capped to 10,000 characters
  const content = typeof body.content === 'string' ? body.content.trim().slice(0, 10000) : null;
  if (!content) return NextResponse.json({ error: 'Content required' }, { status: 400 });

  // Allowlist authors — prevents arbitrary strings being stored as the author field
  const VALID_AUTHORS = ['jamie', 'casper', 'developer', 'ui-designer', 'qa-tester', 'copywriter', 'analyst', 'manager'];
  const author = VALID_AUTHORS.includes(body.author) ? body.author : 'casper';

  const { data, error } = await supabaseAdmin
    .from('comments')
    .insert({
      task_id: taskId,
      content,
      author,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: taskId } = await params;
  const body = await request.json();
  const { commentId } = body;

  // Validate content — same rules as POST: non-empty string, capped to 10,000 characters
  const rawContent = typeof body.content === 'string' ? body.content.trim().slice(0, 10000) : null;
  if (!commentId || !rawContent) {
    return NextResponse.json({ error: 'Comment ID and content are required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('comments')
    .update({ content: rawContent })
    .eq('id', commentId)
    .eq('task_id', taskId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: taskId } = await params;
  const { searchParams } = new URL(request.url);
  const commentId = searchParams.get('commentId');

  if (!commentId) {
    return NextResponse.json({ error: 'Comment ID is required' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('comments')
    .delete()
    .eq('id', commentId)
    .eq('task_id', taskId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
