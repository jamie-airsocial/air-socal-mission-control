import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const fileName = String(body?.fileName || '').trim();
    const contentType = String(body?.contentType || 'application/octet-stream').trim();
    const size = Number(body?.size || 0);

    if (!fileName) return NextResponse.json({ error: 'File name required' }, { status: 400 });
    if (size > 25 * 1024 * 1024) return NextResponse.json({ error: 'File too large (max 25MB)' }, { status: 400 });

    const fileExt = fileName.split('.').pop() || 'bin';
    const cleanBase = fileName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 80);
    const filePath = `${Date.now()}-${cleanBase}.${fileExt}`;

    const { data, error } = await supabaseAdmin.storage
      .from('uploads')
      .createSignedUploadUrl(filePath);

    if (error || !data) {
      return NextResponse.json({ error: error?.message || 'Failed to prepare upload' }, { status: 500 });
    }

    const publicData = supabaseAdmin.storage.from('uploads').getPublicUrl(filePath);

    return NextResponse.json({
      path: filePath,
      token: data.token,
      signedUrl: data.signedUrl,
      publicUrl: publicData.data.publicUrl,
      contentType,
    });
  } catch (error) {
    console.error('Signed upload prepare error:', error);
    return NextResponse.json({ error: 'Failed to prepare upload' }, { status: 500 });
  }
}
