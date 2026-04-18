import {
  getOrCreateRequestId,
  incrementCounter,
  resetCounter,
} from '@preciso/utils';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * POST /api/auth/mfa/verify (admin console)
 *
 * Mirrors the portal's MFA verify route. Same lockout + audit contract,
 * namespaced under 'admin:' keys and 'auth.admin_mfa_*' action names.
 * See apps/portal/.../mfa/verify/route.ts for the full design notes.
 */

const MAX_ATTEMPTS_PER_EMAIL = 5;
const LOCKOUT_SECONDS = 15 * 60;

const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request.headers.get('x-request-id'));
  const clientIp =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  try {
    const body = (await request.json()) as { challengeId?: unknown; code?: unknown };
    const challengeId = typeof body.challengeId === 'string' ? body.challengeId : '';
    const code =
      typeof body.code === 'string' ? body.code.replace(/\D/g, '').slice(0, 8) : '';

    if (!challengeId || !/^\d{6,8}$/.test(code)) {
      return NextResponse.json(
        { error: 'Invalid verification data.', requestId },
        { status: 400, headers: { 'x-request-id': requestId } },
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

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Session expired. Sign in again.', requestId },
        { status: 401, headers: { 'x-request-id': requestId } },
      );
    }

    const role = (user.app_metadata as { role?: string } | undefined)?.role;
    if (role !== 'admin') {
      // Guard against a non-admin session somehow reaching here.
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: 'Invalid credentials.', requestId },
        { status: 403, headers: { 'x-request-id': requestId } },
      );
    }

    const { data: factors } = await supabase.auth.mfa.listFactors();
    const factor = factors?.all?.find(
      (f) => f.factor_type === 'totp' && f.status === 'verified',
    );
    if (!factor) {
      return NextResponse.json(
        { error: 'No MFA factor found for this account.', requestId },
        { status: 400, headers: { 'x-request-id': requestId } },
      );
    }

    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId: factor.id,
      challengeId,
      code,
    });

    const emailKey = `login-failed:admin:email:${user.email?.toLowerCase() ?? user.id}`;
    const ipKey = `login-failed:admin:ip:${clientIp}`;

    if (verifyErr) {
      const newEmailAttempts = await incrementCounter(emailKey, LOCKOUT_SECONDS);
      await incrementCounter(ipKey, LOCKOUT_SECONDS);
      await writeAuditLog({
        actorId: user.id,
        actorType: 'system',
        action: 'auth.admin_mfa_failed',
        ip: clientIp,
        requestId,
      });
      if (newEmailAttempts !== null && newEmailAttempts >= MAX_ATTEMPTS_PER_EMAIL) {
        await supabase.auth.signOut();
        return NextResponse.json(
          {
            error:
              'Account temporarily locked due to too many failed sign-in attempts. ' +
              'Please try again in 15 minutes.',
            requestId,
          },
          { status: 429, headers: { 'x-request-id': requestId } },
        );
      }
      return NextResponse.json(
        { error: 'Invalid code. Please try again.', requestId },
        { status: 401, headers: { 'x-request-id': requestId } },
      );
    }

    await Promise.all([resetCounter(emailKey), resetCounter(ipKey)]);
    await writeAuditLog({
      actorId: user.id,
      actorType: 'admin',
      action: 'auth.admin_mfa_success',
      ip: clientIp,
      requestId,
    });

    return NextResponse.json(
      { success: true, requestId },
      { status: 200, headers: { 'x-request-id': requestId } },
    );
  } catch (err) {
    console.error('[admin/auth/mfa/verify] unexpected error', { requestId, err });
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
      actor_id: opts.actorId || ZERO_UUID,
      actor_type: opts.actorType,
      action: opts.action,
      resource_type: 'auth',
      resource_id: opts.actorId || ZERO_UUID,
      ip_address: opts.ip !== 'unknown' ? opts.ip : null,
    });
  } catch (err) {
    console.error('[admin/auth/mfa/verify] audit insert failed', { requestId: opts.requestId, err });
  }
}
