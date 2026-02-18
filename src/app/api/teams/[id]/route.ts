import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/** Convert a team display name to the slug stored in app_users.team */
function nameToSlug(name: string): string {
  return name.trim().toLowerCase();
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { name, members, color } = body;

  // Fetch current team BEFORE any changes
  const { data: currentTeam, error: fetchErr } = await supabaseAdmin
    .from('teams')
    .select('name')
    .eq('id', id)
    .single();

  if (fetchErr || !currentTeam) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  const oldSlug = nameToSlug(currentTeam.name);
  let newSlug = oldSlug;
  const now = new Date().toISOString();

  // ── 1. Rename team if name provided ──────────────────────────────────────
  if (name !== undefined) {
    const trimmed = name.trim();
    newSlug = nameToSlug(trimmed);

    const updateData: Record<string, string> = { name: trimmed, updated_at: now };
    if (color) updateData.color = color;
    const { error } = await supabaseAdmin
      .from('teams')
      .update(updateData)
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Cascade rename across ALL tables that store team as a string
    if (newSlug !== oldSlug) {
      await Promise.all([
        supabaseAdmin.from('app_users').update({ team: newSlug, updated_at: now }).eq('team', oldSlug),
        supabaseAdmin.from('clients').update({ team: newSlug, updated_at: now }).eq('team', oldSlug),
        supabaseAdmin.from('prospects').update({ team: newSlug, updated_at: now }).eq('team', oldSlug),
      ]);
    }
  }

  // ── Color-only update (when name isn't changing) ──────────────────────────
  if (color && name === undefined) {
    await supabaseAdmin.from('teams').update({ color, updated_at: now }).eq('id', id);
  }

  // ── 2. Update membership if members array provided ────────────────────────
  if (members !== undefined) {
    // Remove all current members from this team
    await supabaseAdmin
      .from('app_users')
      .update({ team: null, updated_at: now })
      .eq('team', newSlug);

    // Assign the selected member IDs to the team
    if (members.length > 0) {
      await supabaseAdmin
        .from('app_users')
        .update({ team: newSlug, updated_at: now })
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
    const slug = nameToSlug(team.name);
    const { data: members } = await supabaseAdmin
      .from('app_users')
      .select('id')
      .eq('team', slug)
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
