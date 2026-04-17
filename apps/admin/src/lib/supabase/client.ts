import { createBrowserClient } from '@supabase/ssr';

/**
 * Supabase client for browser/client components in the admin app.
 * Uses the anon key — RLS policies govern data access. @supabase/ssr >= 0.5
 * persists the session to document.cookie by default.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
