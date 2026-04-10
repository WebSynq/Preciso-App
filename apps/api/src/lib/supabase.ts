import { createClient } from '@supabase/supabase-js';

/**
 * Supabase admin client using service role key.
 * Bypasses RLS — use only in trusted server-side operations.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

/**
 * Supabase client scoped to a specific user's JWT.
 * RLS policies are enforced based on the JWT claims.
 */
export function createUserClient(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false },
    },
  );
}
