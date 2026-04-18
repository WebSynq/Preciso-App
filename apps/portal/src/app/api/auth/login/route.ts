import {
  getOrCreateRequestId,
  incrementCounter,
  readCounter,
  resetCounter,
} from '@preciso/utils';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * POST /api/auth/login
 *
 * Server-side login with failed-attempt lockout. Keeps the lockout check
 * out of client code so it cannot be bypassed.
 *
 * SECURITY NOTES:
 *   - Lockout is 5 failed attempts / 15 minutes, keyed by lowercased
 *     email. Per-email so an attacker with one stolen email address
 *     cannot lock out every account by bruteforcing IPs.
 *   - AND per-IP — an attacker cycling through emails to brute the
 *     password space gets limited to 20/15min per IP.
 *   - On failure we ALSO write an audit_logs row so admins can see
 *     attack patterns without hitting Supabase logs directly.
 *   - Error messages are intentionally generic: never reveal whether
 *     the email exists, whether the account is locked, or whether the
 *     password was wrong.
 *   - We use @supabase/ssr's createServerClient so the auth cookies
 *     are set by this response directly — no client-side session
 *     persistence, no cookie race with middleware.
 */

const MAX_ATTEMPTS_PER_EMAIL = 5;
const MAX_ATTEMPTS_PER_IP = 20;
const LOCKOUT_SECONDS = 15 * 60;

const GENERIC_ERROR = 'Invalid email or password. Please try again.';
const LOCKOUT_ERROR =
  'Account temporarily locked due to too many failed sign-in attempts. Please try again in 15 minutes.';

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request.headers.get('x-request-id'));
  const clientIp =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  try {
    const body = (await request.json()) as { email?: unknown; password?: unknown };
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password || email.length > 255 || password.length > 500) {
      return NextResponse.json(
        { error: GENERIC_ERROR, requestId },
        { status: 400, headers: { 'x-request-id': requestId } },
      );
    }

    // ─── Lockout pre-check ───────────────────────────────────────────────
    const emailKey = `login-failed:email:${email}`;
    const ipKey = `login-failed:ip:${clientIp}`;
    const [emailAttempts, ipAttempts] = await Promise.all([
      readCounter(emailKey),
      readCounter(ipKey),
    ]);

    if (emailAttempts >= MAX_ATTEMPTS_PER_EMAIL || ipAttempts >= MAX_ATTEMPTS_PER_IP) {
      console.warn('[auth/login] lockout hit, rejecting before Supabase call', {
        requestId,
        email,
        ip: clientIp,
        emailAttempts,
        ipAttempts,
      });
      await writeLockoutAuditLog({ email, ip: clientIp, requestId });
      return NextResponse.json(
        { error: LOCKOUT_ERROR, requestId },
        { status: 429, headers: { 'x-request-id': requestId } },
      );
    }

    // ─── Attempt sign-in server-side; @supabase/ssr writes cookies ──────
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          },
        },
      },
    );

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      // ─── Failed attempt: increment both counters, audit ────────────────
      const [newEmailAttempts, newIpAttempts] = await Promise.all([
        incrementCounter(emailKey, LOCKOUT_SECONDS),
        incrementCounter(ipKey, LOCKOUT_SECONDS),
      ]);
      console.warn('[auth/login] sign-in failed', {
        requestId,
        email,
        ip: clientIp,
        newEmailAttempts,
        newIpAttempts,
        code: error?.code,
      });
      await writeFailedAuditLog({ email, ip: clientIp, requestId });

      // If they've just crossed the threshold, return the lockout message
      // so the UI can show it — we're transparent about the lockout to
      // the legitimate owner of the account, not to random attackers.
      if (
        (newEmailAttempts !== null && newEmailAttempts >= MAX_ATTEMPTS_PER_EMAIL) ||
        (newIpAttempts !== null && newIpAttempts >= MAX_ATTEMPTS_PER_IP)
      ) {
        return NextResponse.json(
          { error: LOCKOUT_ERROR, requestId },
          { status: 429, headers: { 'x-request-id': requestId } },
        );
      }

      return NextResponse.json(
        { error: GENERIC_ERROR, requestId },
        { status: 401, headers: { 'x-request-id': requestId } },
      );
    }

    // ─── Success: clear counters, audit, return user ─────────────────────
    await Promise.all([resetCounter(emailKey), resetCounter(ipKey)]);
    await writeSuccessAuditLog({
      userId: data.user.id,
      ip: clientIp,
      userAgent: request.headers.get('user-agent'),
      requestId,
    });

    console.warn('[auth/login] sign-in success', { requestId, userId: data.user.id });

    return NextResponse.json(
      { success: true, userId: data.user.id, requestId },
      { status: 200, headers: { 'x-request-id': requestId } },
    );
  } catch (err) {
    console.error('[auth/login] unexpected error', { requestId, err });
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again later.', requestId },
      { status: 500, headers: { 'x-request-id': requestId } },
    );
  }
}

// ─── Audit helpers ─────────────────────────────────────────────────────────
//
// All login events (success, failed, lockout-hit) go into audit_logs via
// the service-role client. We use a synthetic actor_id for attempts
// against unknown accounts — real UUID for success, zero UUID for
// failures. resource_type 'auth' distinguishes these from PHI audits.

const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

async function getAuditClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

async function writeFailedAuditLog(opts: {
  email: string;
  ip: string;
  requestId: string;
}): Promise<void> {
  const client = await getAuditClient();
  if (!client) return;
  try {
    await client.from('audit_logs').insert({
      actor_id: ZERO_UUID,
      actor_type: 'system',
      action: 'auth.login_failed',
      resource_type: 'auth',
      resource_id: ZERO_UUID,
      ip_address: opts.ip !== 'unknown' ? opts.ip : null,
      user_agent: null,
    });
  } catch (err) {
    console.error('[auth/login] audit insert failed', { requestId: opts.requestId, err });
  }
}

async function writeLockoutAuditLog(opts: {
  email: string;
  ip: string;
  requestId: string;
}): Promise<void> {
  const client = await getAuditClient();
  if (!client) return;
  try {
    await client.from('audit_logs').insert({
      actor_id: ZERO_UUID,
      actor_type: 'system',
      action: 'auth.lockout_hit',
      resource_type: 'auth',
      resource_id: ZERO_UUID,
      ip_address: opts.ip !== 'unknown' ? opts.ip : null,
      user_agent: null,
    });
  } catch (err) {
    console.error('[auth/login] lockout audit insert failed', { requestId: opts.requestId, err });
  }
}

async function writeSuccessAuditLog(opts: {
  userId: string;
  ip: string;
  userAgent: string | null;
  requestId: string;
}): Promise<void> {
  const client = await getAuditClient();
  if (!client) return;
  try {
    await client.from('audit_logs').insert({
      actor_id: opts.userId,
      actor_type: 'provider',
      action: 'auth.login_success',
      resource_type: 'auth',
      resource_id: opts.userId,
      ip_address: opts.ip !== 'unknown' ? opts.ip : null,
      user_agent: opts.userAgent,
    });
  } catch (err) {
    console.error('[auth/login] success audit insert failed', { requestId: opts.requestId, err });
  }
}
