import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('capacity_targets')
    .select('*')
    .order('service');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Transform into a more usable format
  const targets: Record<string, number> = {};
  let teamTotal = 0;

  for (const row of data || []) {
    if (row.service === '__team_total__') {
      teamTotal = Number(row.monthly_target);
    } else {
      targets[row.service] = Number(row.monthly_target);
    }
  }

  // If team_total isn't set, calculate from services
  if (teamTotal === 0) {
    teamTotal = Object.values(targets).reduce((sum, val) => sum + val, 0);
  }

  return NextResponse.json({ targets, teamTotal });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { targets, teamTotal } = body;

  if (!targets || typeof teamTotal !== 'number') {
    return NextResponse.json(
      { error: 'Invalid request body. Expected { targets: Record<string, number>, teamTotal: number }' },
      { status: 400 }
    );
  }

  try {
    // Upsert each service target
    const upserts = Object.entries(targets).map(([service, monthly_target]) => ({
      service,
      monthly_target: Number(monthly_target),
      updated_at: new Date().toISOString()
    }));

    // Add team total
    upserts.push({
      service: '__team_total__',
      monthly_target: Number(teamTotal),
      updated_at: new Date().toISOString()
    });

    const { error } = await supabaseAdmin
      .from('capacity_targets')
      .upsert(upserts, { onConflict: 'service' });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
