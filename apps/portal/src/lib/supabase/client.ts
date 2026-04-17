import { createBrowserClient } from '@supabase/ssr';

/**
 * Supabase client for browser/client components. Uses the anon key — RLS
 * policies govern data access. @supabase/ssr >= 0.5 writes the session to
 * document.cookie by default, which the middleware and server clients read.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
