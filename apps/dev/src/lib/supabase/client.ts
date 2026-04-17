import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser Supabase client. Uses the anon key. Sign-in flow only — data
 * reads happen server-side via a strictly-aggregated path.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
