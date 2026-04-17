import { createBrowserClient, type CookieOptions } from '@supabase/ssr';

/**
 * Creates a Supabase client for use in browser/client components.
 * Uses the anon key — RLS policies govern data access.
 *
 * SECURITY NOTE: Explicit `cookies` handlers persist the auth session to
 * document.cookie so Next.js middleware and server components can see it.
 * Without this, @supabase/ssr 0.3 may leave the session in localStorage only
 * and middleware redirect-loops back to /login after sign-in.
 *
 * We strip the `Secure` flag on non-HTTPS origins (localhost dev) because
 * browsers silently discard Secure cookies on http://. In production the
 * portal runs on HTTPS so Secure stays off only in dev.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          if (typeof document === 'undefined') return [];
          // SECURITY NOTE: Read raw values — do NOT decodeURIComponent.
          // @supabase/ssr's server-side reader also reads raw values, so
          // both sides must agree. Double-decoding corrupts the JSON.
          return document.cookie
            .split(';')
            .map((c) => c.trim())
            .filter(Boolean)
            .map((c) => {
              const eq = c.indexOf('=');
              const name = eq === -1 ? c : c.slice(0, eq);
              const value = eq === -1 ? '' : c.slice(eq + 1);
              return { name, value };
            });
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          if (typeof document === 'undefined') return;
          const isHttps = window.location.protocol === 'https:';
          for (const { name, value, options } of cookiesToSet) {
            // SECURITY NOTE: Write raw values — do NOT encodeURIComponent.
            // Supabase session JSON contains `{`, `"`, `:` which are valid
            // cookie octets; URL-encoding them produces `%7B%22...` which
            // the server-side reader can't parse back to JSON.
            let cookie = `${name}=${value}`;
            if (options?.maxAge !== undefined) cookie += `; Max-Age=${options.maxAge}`;
            if (options?.expires) {
              const exp =
                options.expires instanceof Date ? options.expires : new Date(options.expires);
              cookie += `; Expires=${exp.toUTCString()}`;
            }
            cookie += `; Path=${options?.path || '/'}`;
            if (options?.domain) cookie += `; Domain=${options.domain}`;
            // Only set Secure on HTTPS. Browsers discard Secure cookies on
            // http://, which would break localhost dev.
            if (options?.secure && isHttps) cookie += '; Secure';
            cookie += `; SameSite=${options?.sameSite || 'Lax'}`;
            document.cookie = cookie;
          }
          console.warn('[supabase/browser] wrote cookies', {
            names: cookiesToSet.map((c) => c.name),
            count: cookiesToSet.length,
          });
        },
      },
    },
  );
}
