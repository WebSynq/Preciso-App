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
 * POST /api/auth/login (developer console)
 *
 * Server-side login with failed-attempt lockout AND developer-role
 * enforcement. Same pattern as the admin console login route; only the
 * role claim differs (developer, not admin). See admin route for full
 * design notes.
 */

const MAX_ATTEMPTS_PER_EMAIL = 5;
const MAX_ATTEMPTS_PER_IP = 20;
const LOCKOUT_SECONDS = 15 * 60;

const GENERIC_ERROR = 'Invalid credentials.';
const LOCKOUT_ERROR =
  'Account temporarily locked due to too many failed sign-in attempts. Please try again in 15 minutes.';

const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

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

    const emailKey = `login-failed:dev:email:${email}`;
    const ipKey = `login-failed:dev:ip:${clientIp}`;
    const [emailAttempts, ipAttempts] = await Promise.all([
      readCounter(emailKey),
      readCounter(ipKey),
    ]);

    if (emailAttempts >= MAX_ATTEMPTS_PER_EMAIL || ipAttempts >= MAX_ATTEMPTS_PER_IP) {
      console.warn('[dev/auth/login] lockout hit', {
        requestId,
        email,
        ip: clientIp,
        emailAttempts,
        ipAttempts,
      });
      await writeAuditLog({
        actorId: ZERO_UUID,
        actorType: 'system',
        action: 'auth.dev_lockout_hit',
        ip: clientIp,
        requestId,
      });
      return NextResponse.json(
        { error: LOCKOUT_ERROR, requestId },
        { status: 429, headers: { 'x-request-id': requestId } },
      );
    }

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

    const signInFailed = !!error || !data?.user;
    const role = (data?.user?.app_metadata as { role?: string } | undefined)?.role;
    const isDeveloper = role === 'developer';

    if (signInFailed || !isDeveloper) {
      if (!signInFailed) {
        await supabase.auth.signOut();
      }
      const [newEmailAttempts, newIpAttempts] = await Promise.all([
        incrementCounter(emailKey, LOCKOUT_SECONDS),
        incrementCounter(ipKey, LOCKOUT_SECONDS),
      ]);
      console.warn('[dev/auth/login] rejected', {
        requestId,
        email,
        ip: clientIp,
        signInFailed,
        isDeveloper,
        newEmailAttempts,
        newIpAttempts,
      });
      await writeAuditLog({
        actorId: data?.user?.id ?? ZERO_UUID,
        actorType: 'system',
        action: signInFailed ? 'auth.dev_login_failed' : 'auth.dev_role_denied',
        ip: clientIp,
        requestId,
      });
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

    await Promise.all([resetCounter(emailKey), resetCounter(ipKey)]);

    // ─── MFA required if enrolled ────────────────────────────────────────
    const { data: factorsData } = await supabase.auth.mfa.listFactors();
    const verifiedTotp = factorsData?.all?.find(
      (f) => f.factor_type === 'totp' && f.status === 'verified',
    );
    if (verifiedTotp) {
      const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({
        factorId: verifiedTotp.id,
      });
      if (challengeErr || !challenge) {
        console.error('[dev/auth/login] mfa challenge failed', { requestId, challengeErr });
        return NextResponse.json(
          { error: 'Could not start MFA challenge. Please try again.', requestId },
          { status: 500, headers: { 'x-request-id': requestId } },
        );
      }
      return NextResponse.json(
        {
          requiresMfa: true,
          factorId: verifiedTotp.id,
          challengeId: challenge.id,
          requestId,
        },
        { status: 200, headers: { 'x-request-id': requestId } },
      );
    }

    await writeAuditLog({
      actorId: data.user.id,
      actorType: 'system',
      action: 'auth.dev_login_success',
      ip: clientIp,
      requestId,
    });

    return NextResponse.json(
      { success: true, userId: data.user.id, requestId },
      { status: 200, headers: { 'x-request-id': requestId } },
    );
  } catch (err) {
    console.error('[dev/auth/login] unexpected error', { requestId, err });
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again later.', requestId },
      { status: 500, headers: { 'x-request-id': requestId } },
    );
  }
}

async function writeAuditLog(opts: {
  actorId: string;
  actorType: string;
  action: string;
  ip: string;
  requestId: string;
}): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  try {
    const client = createAdminClient(url, key, { auth: { persistSession: false } });
    await client.from('audit_logs').insert({
      actor_id: opts.actorId,
      actor_type: opts.actorType,
      action: opts.action,
      resource_type: 'auth',
      resource_id: opts.actorId,
      ip_address: opts.ip !== 'unknown' ? opts.ip : null,
    });
  } catch (err) {
    console.error('[dev/auth/login] audit insert failed', { requestId: opts.requestId, err });
  }
}
