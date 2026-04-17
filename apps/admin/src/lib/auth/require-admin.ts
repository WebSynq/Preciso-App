import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * Server-side guard for admin pages.
 *
 * SECURITY NOTE: Every admin page MUST call this as its first line.
 * Middleware gates navigation but this belt-and-suspenders call protects
 * against internal rewrites / direct fetches / any code path that does not
 * go through the Next.js middleware layer. It FAILS CLOSED — if either
 * auth or the admin claim is missing, we redirect to /login and never
 * render the admin page content.
 */
export async function requireAdmin(): Promise<{ user: User }> {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const role = (user.app_metadata as { role?: string } | undefined)?.role;
  if (role !== 'admin') {
    console.warn('[admin/requireAdmin] non-admin user hit an admin page', {
      userId: user.id,
    });
    redirect('/login?error=not_authorized');
  }

  return { user };
}
