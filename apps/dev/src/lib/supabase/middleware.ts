import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Middleware entry point for the developer console.
 *
 * SECURITY NOTE: FAIL CLOSED.
 *   - Any path other than /login requires a valid session.
 *   - The JWT must carry app_metadata.role = 'developer'.
 *   - Admins cannot access this surface — if an admin-authenticated
 *     session hits the dev console, they are rejected. Separation of
 *     duties: an account is either developer or admin, not both.
 *   - Role assignment is SQL-only. Never a self-service flow.
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
  // SECURITY NOTE: Auth + MFA API routes must not be redirected. A
  // 307 redirect preserves POST method, so redirecting /api/auth/login
  // to /login would turn the sign-in POST into a POST against the
  // page route — Next returns 405 and the user sees a cryptic failure.
  // These routes do their own auth internally; let them through.
  const isAuthApi = pathname.startsWith('/api/auth/');

  const role = (user?.app_metadata as { role?: string } | undefined)?.role;
  const isDeveloper = role === 'developer';

  if (!user && !isLogin && !isAuthApi) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  if (user && !isDeveloper && !isLogin && !isAuthApi) {
    console.warn('[dev/middleware] non-developer authenticated user blocked', {
      userId: user.id,
      role: role ?? 'none',
      path: pathname,
    });
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('error', 'not_authorized');
    return NextResponse.redirect(url);
  }

  // MFA step-up — same contract as portal/admin. Skipped on the auth
  // API routes so the MFA verify flow can complete.
  if (user && isDeveloper && !isLogin && !isAuthApi) {
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (
      aalData?.currentLevel &&
      aalData?.nextLevel &&
      aalData.currentLevel !== aalData.nextLevel
    ) {
      console.warn('[dev/middleware] mfa step-up required, bouncing to /login', {
        userId: user.id,
        currentLevel: aalData.currentLevel,
        nextLevel: aalData.nextLevel,
      });
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirect', pathname);
      url.searchParams.set('error', 'mfa_required');
      return NextResponse.redirect(url);
    }
  }

  if (user && isDeveloper && isLogin) {
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (!aalData || aalData.currentLevel === aalData.nextLevel) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
