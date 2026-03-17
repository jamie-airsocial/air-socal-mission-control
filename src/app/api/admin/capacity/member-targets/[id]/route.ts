import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const target = body?.target;

  if (!id) {
    return NextResponse.json({ error: 'Missing user id' }, { status: 400 });
  }

  // Clear override when null/undefined/empty/<=0
  if (target === null || target === undefined || Number(target) <= 0 || Number.isNaN(Number(target))) {
    const { error } = await supabaseAdmin
      .from('capacity_targets')
      .delete()
      .eq('service', `__member_${id}`);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, cleared: true });
  }

  const { error } = await supabaseAdmin
    .from('capacity_targets')
    .upsert({
      service: `__member_${id}`,
      monthly_target: Number(target),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'service' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, target: Number(target) });
}
