import { createBrowserClient, type CookieOptions } from '@supabase/ssr';

/**
 * Creates a Supabase client for use in browser/client components.
 * Uses the anon key — RLS policies govern data access.
 *
 * SECURITY NOTE: We pass explicit `cookies` handlers so the auth session is
 * persisted to document.cookie (not just localStorage). This is what lets
 * Next.js middleware and server components see the session on the next
 * request. Without this, @supabase/ssr 0.3's default leaves the session in
 * localStorage only, and middleware redirect-loops back to /login after
 * sign-in.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          if (typeof document === 'undefined') return [];
          return document.cookie
            .split(';')
            .map((c) => c.trim())
            .filter(Boolean)
            .map((c) => {
              const eq = c.indexOf('=');
              const name = decodeURIComponent(eq === -1 ? c : c.slice(0, eq));
              const value = eq === -1 ? '' : decodeURIComponent(c.slice(eq + 1));
              return { name, value };
            });
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          if (typeof document === 'undefined') return;
          for (const { name, value, options } of cookiesToSet) {
            let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
            if (options?.maxAge !== undefined) cookie += `; Max-Age=${options.maxAge}`;
            if (options?.expires) {
              const exp =
                options.expires instanceof Date ? options.expires : new Date(options.expires);
              cookie += `; Expires=${exp.toUTCString()}`;
            }
            cookie += `; Path=${options?.path || '/'}`;
            if (options?.domain) cookie += `; Domain=${options.domain}`;
            if (options?.secure) cookie += '; Secure';
            cookie += `; SameSite=${options?.sameSite || 'Lax'}`;
            document.cookie = cookie;
          }
        },
      },
    },
  );
}
