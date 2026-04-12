import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { updateSession } from '@/lib/supabase/middleware';

// ─── Auth endpoint rate limiting ─────────────────────────────────────────────
// In-process rate limiter for login and register server actions.
//
// Limitation: this counter lives in a single Next.js Edge runtime instance.
// Across multiple pods it is not perfectly global, but it provides meaningful
// friction against scripted brute-force and credential-stuffing attacks.
//
// For multi-instance deployments, replace with an Upstash Redis rate limiter.

const AUTH_PATHS = new Set(['/login', '/register']);

/** Sliding-window counters keyed by "<path>:<ip>". */
const rateLimitStore = new Map<string, { count: number; windowStart: number }>();

const AUTH_RATE_LIMIT = 10;        // max requests per window
const AUTH_WINDOW_MS  = 60_000;    // 1 minute

/** Returns true if the request should be blocked due to rate limit. */
function isRateLimited(ip: string, pathname: string): boolean {
  const key = `${pathname}:${ip}`;
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now - entry.windowStart > AUTH_WINDOW_MS) {
    // Start a fresh window.
    rateLimitStore.set(key, { count: 1, windowStart: now });
    return false;
  }

  entry.count += 1;
  if (entry.count > AUTH_RATE_LIMIT) {
    return true;
  }
  return false;
}

// Periodically purge stale entries so the Map does not grow unbounded.
// This runs per-process; in production prefer pg_cron or Upstash TTL.
setInterval(() => {
  const cutoff = Date.now() - AUTH_WINDOW_MS * 2;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.windowStart < cutoff) {
      rateLimitStore.delete(key);
    }
  }
}, AUTH_WINDOW_MS);

// ─── Middleware ───────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Apply rate limiting to login and register endpoints.
  if (AUTH_PATHS.has(pathname)) {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    if (isRateLimited(ip, pathname)) {
      return new NextResponse(
        JSON.stringify({ error: 'Too many requests. Please wait and try again.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '60',
          },
        },
      );
    }
  }

  return await updateSession(request);
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/register'],
};
