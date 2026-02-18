import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { name, members } = body;

  // Update team name if provided
  if (name !== undefined) {
    const { error } = await supabaseAdmin
      .from('teams')
      .update({ name: name.trim(), updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update team membership if members array provided
  // members = array of app_user IDs that should be in this team
  if (members !== undefined) {
    // Get current team name to use as the team value
    const { data: team, error: teamErr } = await supabaseAdmin
      .from('teams')
      .select('name')
      .eq('id', id)
      .single();

    if (teamErr || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const teamSlug = team.name.toLowerCase();

    // Remove all users from this team first
    await supabaseAdmin
      .from('app_users')
      .update({ team: null })
      .eq('team', teamSlug);

    // Assign selected members to this team
    if (members.length > 0) {
      await supabaseAdmin
        .from('app_users')
        .update({ team: teamSlug })
        .in('id', members);
    }
  }

  const { data, error } = await supabaseAdmin
    .from('teams')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Check for members still in this team
  const { data: team } = await supabaseAdmin
    .from('teams')
    .select('name')
    .eq('id', id)
    .single();

  if (team) {
    const teamSlug = team.name.toLowerCase();
    const { data: members } = await supabaseAdmin
      .from('app_users')
      .select('id')
      .eq('team', teamSlug);

    if (members && members.length > 0) {
      return NextResponse.json(
        { error: `Cannot delete team with ${members.length} member(s). Reassign them first.` },
        { status: 400 }
      );
    }
  }

  const { error } = await supabaseAdmin
    .from('teams')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
