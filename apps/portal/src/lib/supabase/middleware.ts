import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Creates a Supabase client for use in Next.js middleware.
 * Handles cookie-based session refresh on every request.
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

  // Protected routes: redirect unauthenticated users to /login
  if (!user && pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // SECURITY NOTE: MFA step-up enforcement.
  //   - A user with a verified TOTP factor must be at aal2 to reach
  //     dashboard pages. If their session is still aal1 (password only)
  //     they are signed out and sent back to /login to complete the
  //     MFA challenge properly.
  //   - currentLevel === nextLevel means the session is at the highest
  //     AAL the user can reach. Anything less = step-up required.
  //   - We skip this check on /login itself so the MFA code-entry flow
  //     can complete — /login's own handler tracks the challenge state.
  if (user && pathname.startsWith('/dashboard')) {
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (
      aalData?.currentLevel &&
      aalData?.nextLevel &&
      aalData.currentLevel !== aalData.nextLevel
    ) {
      console.warn('[middleware] mfa step-up required, bouncing to /login', {
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

  // Redirect authenticated users away from /login and /register
  if (user && (pathname === '/login' || pathname === '/register')) {
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    // Only bounce them to /dashboard if their session is already at the
    // max AAL they can reach. An aal1 session of an MFA-enrolled user
    // should stay on /login to finish the challenge.
    if (!aalData || aalData.currentLevel === aalData.nextLevel) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
