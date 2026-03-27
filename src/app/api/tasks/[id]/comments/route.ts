import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

async function resolveAuthorFromRequest(request: NextRequest): Promise<string> {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) return 'casper';

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) return 'casper';

  const { data: appUser } = await supabaseAdmin
    .from('app_users')
    .select('full_name')
    .eq('auth_user_id', authData.user.id)
    .single();

  if (!appUser?.full_name) return 'casper';

  return appUser.full_name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'casper';
}

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

  const author = await resolveAuthorFromRequest(request);

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
