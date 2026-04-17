import type { User } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';

import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * Server-side guard for every developer page.
 *
 * SECURITY NOTE: Belt + suspenders with the middleware. FAILS CLOSED.
 * Any direct fetch, internal rewrite, or code path that skips the
 * middleware hits this gate instead. Missing auth or missing developer
 * claim -> redirect to /login, no admin surface rendered.
 */
export async function requireDeveloper(): Promise<{ user: User }> {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const role = (user.app_metadata as { role?: string } | undefined)?.role;
  if (role !== 'developer') {
    console.warn('[dev/requireDeveloper] non-developer hit a dev page', {
      userId: user.id,
      role: role ?? 'none',
    });
    redirect('/login?error=not_authorized');
  }

  return { user };
}
