import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * Auth-only server client. Used exclusively to verify the caller's JWT and
 * role claim via supabase.auth.getUser(). Never use this client to read from
 * the public schema — RLS intentionally returns nothing for developers.
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
            // setAll is called from Server Components where cookies cannot be set.
          }
        },
      },
    },
  );
}

/**
 * SECURITY NOTE: Read-only aggregate client for developer pages ONLY.
 *
 *  - Uses the service role key, which BYPASSES RLS. This is the explicit
 *    trust boundary: the app layer (this module) must NEVER return PHI
 *    through any function that uses this client.
 *  - Every consumer function in the dev app must return counts, groupings,
 *    or other aggregate values — never individual rows with identifying
 *    columns (email, first_name, npi_number, patient_ref, kit_barcode,
 *    delivery_address, report_url, raw_result_ref).
 *  - A future hardening pass will replace this with dedicated Postgres
 *    views grantable to a `developer` DB role, so enforcement moves to
 *    the database. Until then, treat this as lead-in code and code review
 *    is the control.
 */
export function createAggregateClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is required for the developer console. ' +
        'Set it in apps/dev/.env.local (Supabase dashboard → Settings → API → Legacy tab → service_role).',
    );
  }
  return createSupabaseClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
