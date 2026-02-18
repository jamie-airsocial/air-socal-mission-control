import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { name, members } = body;

  // Fetch current team name BEFORE any changes (needed for membership slug migration)
  const { data: currentTeam, error: fetchErr } = await supabaseAdmin
    .from('teams')
    .select('name')
    .eq('id', id)
    .single();

  if (fetchErr || !currentTeam) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  const oldSlug = currentTeam.name.toLowerCase();

  // Update team name if provided
  let newSlug = oldSlug;
  if (name !== undefined) {
    const trimmed = name.trim();
    const { error } = await supabaseAdmin
      .from('teams')
      .update({ name: trimmed, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    newSlug = trimmed.toLowerCase();

    // If the team was renamed, migrate app_users from old slug → new slug
    if (newSlug !== oldSlug) {
      await supabaseAdmin
        .from('app_users')
        .update({ team: newSlug })
        .eq('team', oldSlug);
    }
  }

  // Update team membership if members array provided
  // members = array of app_user IDs that should be in this team
  if (members !== undefined) {
    // Clear ALL current members of this team (use newSlug in case of rename)
    // Also clear oldSlug in case migration above missed anything
    await supabaseAdmin.from('app_users').update({ team: null }).eq('team', newSlug);
    if (newSlug !== oldSlug) {
      await supabaseAdmin.from('app_users').update({ team: null }).eq('team', oldSlug);
    }

    // Assign selected members to this team
    if (members.length > 0) {
      await supabaseAdmin
        .from('app_users')
        .update({ team: newSlug, updated_at: new Date().toISOString() })
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
      .eq('team', teamSlug)
      .eq('is_active', true);

    if (members && members.length > 0) {
      return NextResponse.json(
        { error: `Cannot delete a team with ${members.length} active member${members.length !== 1 ? 's' : ''}. Reassign them first.` },
        { status: 400 }
      );
    }
  }

  const { error } = await supabaseAdmin.from('teams').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
