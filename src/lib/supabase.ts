import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Validate required environment variables at module load time so failures are
// immediately obvious rather than surfacing as confusing downstream errors.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!supabaseUrl) throw new Error('Missing required env var: NEXT_PUBLIC_SUPABASE_URL');

const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseAnonKey) throw new Error('Missing required env var: NEXT_PUBLIC_SUPABASE_ANON_KEY');

// Client-side client (uses anon key, respects RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side client (lazy — only created when accessed, avoids crashing in browser)
let _supabaseAdmin: SupabaseClient | null = null;
export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_supabaseAdmin) {
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY not available (client-side?)');
      _supabaseAdmin = createClient(supabaseUrl, serviceKey);
    }
    return (_supabaseAdmin as unknown as Record<string | symbol, unknown>)[prop];
  },
});
