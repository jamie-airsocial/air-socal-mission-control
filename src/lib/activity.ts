import { supabaseAdmin } from '@/lib/supabase';

export async function logActivity(payload: {
  action: string;
  description: string;
  agent: string;
  metadata?: Record<string, unknown> | null;
}) {
  try {
    await supabaseAdmin.from('activity_log').insert({
      action: payload.action,
      description: payload.description,
      agent: payload.agent,
      metadata: payload.metadata || null,
    });
  } catch (error) {
    console.error('Failed to log activity', error);
  }
}
