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
  const { name, members } = body;

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

  // ── 1. Rename team if name provided ──────────────────────────────────────
  if (name !== undefined) {
    const trimmed = name.trim();
    newSlug = nameToSlug(trimmed);

    const { error } = await supabaseAdmin
      .from('teams')
      .update({ name: trimmed, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Migrate all app_users from oldSlug → newSlug (handles rename)
    if (newSlug !== oldSlug) {
      await supabaseAdmin
        .from('app_users')
        .update({ team: newSlug, updated_at: new Date().toISOString() })
        .eq('team', oldSlug);
    }
  }

  // ── 2. Update membership if members array provided ────────────────────────
  if (members !== undefined) {
    // Clear ONLY users on the NEW slug (after rename migration has happened)
    // This avoids clearing users that were just migrated
    await supabaseAdmin
      .from('app_users')
      .update({ team: null, updated_at: new Date().toISOString() })
      .eq('team', newSlug);

    // Assign the selected member IDs to the new team slug
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
    const teamSlug = nameToSlug(team.name);
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
