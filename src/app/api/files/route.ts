import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { DOCUMENTS_BUCKET } from '@/lib/storage';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path');

  if (!path) {
    return NextResponse.json({ error: 'Missing file path' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.storage.from(DOCUMENTS_BUCKET).createSignedUrl(path, 60 * 10, {
    download: false,
  });

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: error?.message || 'Unable to open file' }, { status: 404 });
  }

  return NextResponse.redirect(data.signedUrl, { status: 302 });
}
