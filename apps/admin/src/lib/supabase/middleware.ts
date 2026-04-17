import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Middleware entry point for the admin app.
 *
 * SECURITY NOTE: This middleware MUST fail closed on any doubt.
 *   - Any path other than /login requires a valid Supabase session.
 *   - The session's JWT must carry app_metadata.role = 'admin'.
 *   - Anyone missing either claim is redirected to /login.
 *   - A user already signed in as admin landing on /login is redirected
 *     forward to /dashboard.
 *
 * Role assignment is never self-service — admin is set via SQL on
 * auth.users.raw_app_meta_data by a developer. See migration 00005.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isLogin = pathname === '/login';

  // Extract admin claim if present. getUser returns the authoritative
  // user object (server-validated), including app_metadata.
  const role = (user?.app_metadata as { role?: string } | undefined)?.role;
  const isAdmin = role === 'admin';

  if (!user && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  if (user && !isAdmin && !isLogin) {
    // Signed in but not an admin. Do not leak the admin URL structure —
    // kick them to /login with a generic error.
    console.warn('[admin/middleware] non-admin authenticated user blocked', {
      userId: user.id,
      path: pathname,
    });
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('error', 'not_authorized');
    return NextResponse.redirect(url);
  }

  if (user && isAdmin && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
