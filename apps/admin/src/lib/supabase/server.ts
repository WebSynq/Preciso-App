import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Server-side Supabase client for Server Components, Server Actions and
 * Route Handlers in the admin app. Uses the anon key — all data access
 * goes through RLS including the new admin-scope policies in migration
 * 00005. We do NOT use the service role key here: the DB must be the
 * source of truth for who can read what, not the app layer.
 */
export function createServerSupabaseClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll is called from Server Components where cookies cannot
            // be set. Safe to ignore if middleware is refreshing sessions.
          }
        },
      },
    },
  );
}
