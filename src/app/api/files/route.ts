import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { DOCUMENTS_BUCKET } from '@/lib/storage';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const rawPath = request.nextUrl.searchParams.get('path');

  if (!rawPath) {
    return NextResponse.json({ error: 'Missing file path' }, { status: 400 });
  }

  const decodeHtmlEntities = (value: string) => value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

  const candidatePaths = Array.from(new Set([
    rawPath,
    decodeHtmlEntities(rawPath),
    rawPath.replace(/&amp;/g, '&'),
  ].filter(Boolean)));

  for (const path of candidatePaths) {
    const { data, error } = await supabaseAdmin.storage.from(DOCUMENTS_BUCKET).createSignedUrl(path, 60 * 10, {
      download: false,
    });

    if (!error && data?.signedUrl) {
      return NextResponse.redirect(data.signedUrl, { status: 302 });
    }
  }

  return NextResponse.json({ error: 'Unable to open file' }, { status: 404 });
}
