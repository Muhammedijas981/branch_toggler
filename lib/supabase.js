import { createClient } from '@supabase/supabase-js';

let _client = null;

/**
 * Returns a singleton Supabase client using the SERVICE ROLE key.
 * This bypasses Row Level Security (RLS) — use only in server-side API routes.
 * Never expose this client or key to the browser.
 */
export function getSupabase() {
  if (!_client) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      throw new Error(
        'Missing Supabase config. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env.local'
      );
    }
    _client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    });
  }
  return _client;
}
