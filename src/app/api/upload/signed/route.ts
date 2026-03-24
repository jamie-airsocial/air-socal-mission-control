import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const fileName = String(body?.fileName || '').trim();
    const size = Number(body?.size || 0);

    if (!fileName) return NextResponse.json({ error: 'File name required' }, { status: 400 });
    if (size > 25 * 1024 * 1024) return NextResponse.json({ error: 'File too large (max 25MB)' }, { status: 400 });

    const ext = fileName.includes('.') ? fileName.split('.').pop() : 'bin';
    const base = fileName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 80);
    const path = `${Date.now()}-${base}.${ext}`;

    const { data, error } = await supabaseAdmin.storage.from('documents').createSignedUploadUrl(path);
    if (error || !data?.token) {
      return NextResponse.json({ error: error?.message || 'Failed to prepare upload' }, { status: 500 });
    }

    const { data: publicData } = supabaseAdmin.storage.from('documents').getPublicUrl(path);
    return NextResponse.json({ path, token: data.token, signedUrl: (data as { signedUrl?: string }).signedUrl, publicUrl: publicData.publicUrl });
  } catch (error) {
    console.error('Signed upload prepare error:', error);
    return NextResponse.json({ error: 'Failed to prepare upload' }, { status: 500 });
  }
}
