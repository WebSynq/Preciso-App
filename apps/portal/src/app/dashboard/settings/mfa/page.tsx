'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { createClient } from '@/lib/supabase/client';

/**
 * /dashboard/settings/mfa — TOTP enrollment / disable for the authenticated
 * provider. Uses Supabase's built-in MFA API so factors live in auth.users
 * and HIPAA-relevant authentication state stays in one place.
 *
 * SECURITY NOTE: Enrollment runs entirely in the browser — the factor is
 * created server-side by Supabase against the current JWT. We never let the
 * client pick an arbitrary user_id; Supabase derives it from the session.
 *
 * The verify() call on enrollment upgrades the CURRENT session to aal2 so
 * the user is not kicked back to the login challenge immediately after
 * enrolling. They will be challenged on their next sign-in.
 */

type Factor = {
  id: string;
  friendly_name: string | null;
  factor_type: string;
  status: string;
  created_at: string;
};

type EnrollState =
  | { kind: 'idle' }
  | {
      kind: 'enrolling';
      factorId: string;
      qrCode: string;
      secret: string;
    };

export default function MfaSettingsPage() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enroll, setEnroll] = useState<EnrollState>({ kind: 'idle' });
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadFactors = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: listErr } = await supabase.auth.mfa.listFactors();
      if (listErr) {
        setError(listErr.message);
        return;
      }
      setFactors((data?.all || []) as Factor[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFactors();
  }, [loadFactors]);

  const verifiedFactor = factors.find(
    (f) => f.factor_type === 'totp' && f.status === 'verified',
  );

  async function startEnrollment() {
    setError(null);
    setNotice(null);
    setPending(true);
    try {
      const supabase = createClient();
      // If an unverified factor is hanging around, clear it first —
      // Supabase disallows more than one TOTP factor per user.
      const stale = factors.find(
        (f) => f.factor_type === 'totp' && f.status !== 'verified',
      );
      if (stale) {
        await supabase.auth.mfa.unenroll({ factorId: stale.id });
      }

      const { data, error: enrollErr } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        issuer: 'PRECISO',
        friendlyName: 'PRECISO Authenticator',
      });
      if (enrollErr || !data) {
        setError(enrollErr?.message || 'Could not start MFA enrollment.');
        return;
      }
      setEnroll({
        kind: 'enrolling',
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
    } catch (err) {
      console.error('[mfa/enroll] unexpected error', err);
      setError('Unexpected error. Please try again.');
    } finally {
      setPending(false);
    }
  }

  async function confirmEnrollment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (enroll.kind !== 'enrolling') return;
    setError(null);
    setPending(true);
    try {
      const supabase = createClient();
      const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({
        factorId: enroll.factorId,
      });
      if (chErr || !challenge) {
        setError(chErr?.message || 'Could not create MFA challenge.');
        return;
      }
      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId: enroll.factorId,
        challengeId: challenge.id,
        code: code.trim(),
      });
      if (verifyErr) {
        setError('Invalid code. Check your authenticator app and try again.');
        return;
      }
      setEnroll({ kind: 'idle' });
      setCode('');
      setNotice('MFA enrolled. You will be asked for a code on your next sign-in.');
      await loadFactors();
    } catch (err) {
      console.error('[mfa/verify] unexpected error', err);
      setError('Unexpected error. Please try again.');
    } finally {
      setPending(false);
    }
  }

  async function disableMfa() {
    if (!verifiedFactor) return;
    const confirmed = window.confirm(
      'Disabling MFA lowers the security of this account. Continue?',
    );
    if (!confirmed) return;
    setError(null);
    setNotice(null);
    setPending(true);
    try {
      const supabase = createClient();
      const { error: unErr } = await supabase.auth.mfa.unenroll({
        factorId: verifiedFactor.id,
      });
      if (unErr) {
        setError(unErr.message);
        return;
      }
      setNotice('MFA disabled.');
      await loadFactors();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-2 text-2xl font-bold text-navy">Two-Factor Authentication</h1>
      <p className="mb-6 text-sm text-gray-500">
        Add a second step to sign-in using an authenticator app on your phone.
        Recommended for every clinician account.
      </p>

      {notice && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {notice}
        </div>
      )}
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-sm">
          Loading factors...
        </div>
      ) : verifiedFactor ? (
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
            <h2 className="text-base font-semibold text-navy">MFA is active</h2>
          </div>
          <dl className="mb-6 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Factor type</dt>
              <dd className="font-medium text-gray-800">TOTP (authenticator app)</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Name</dt>
              <dd className="font-medium text-gray-800">
                {verifiedFactor.friendly_name || 'Authenticator'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Enrolled</dt>
              <dd className="font-medium text-gray-800">
                {new Date(verifiedFactor.created_at).toLocaleDateString()}
              </dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={disableMfa}
            disabled={pending}
            className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50"
          >
            {pending ? 'Disabling...' : 'Disable MFA'}
          </button>
          <p className="mt-3 text-xs text-gray-400">
            SECURITY NOTE: disabling MFA weakens account protection. Clinical-grade
            security recommends keeping it on.
          </p>
        </section>
      ) : enroll.kind === 'enrolling' ? (
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-navy">
            Scan the QR code with your authenticator app
          </h2>
          <ol className="mb-6 ml-4 list-decimal space-y-2 text-sm text-gray-600">
            <li>
              Install an authenticator app such as Google Authenticator, Authy, or
              1Password.
            </li>
            <li>Scan the QR code below.</li>
            <li>Enter the 6-digit code shown by the app to confirm.</li>
          </ol>
          <div className="mb-6 flex flex-col items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 p-6">
            {/* QR comes back as an SVG data URI from Supabase */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={enroll.qrCode} alt="MFA QR code" className="h-48 w-48" />
            <p className="text-xs text-gray-500">
              Can&apos;t scan? Enter this secret manually:
            </p>
            <code className="select-all rounded bg-white px-3 py-1 font-mono text-xs text-gray-800">
              {enroll.secret}
            </code>
          </div>
          <form onSubmit={confirmEnrollment}>
            <label htmlFor="totp-code" className="mb-1 block text-sm font-medium text-gray-700">
              6-digit code
            </label>
            <input
              id="totp-code"
              name="code"
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              autoFocus
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="w-full max-w-[12rem] rounded-lg border border-gray-300 px-3 py-2.5 font-mono text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-teal/50"
            />
            <div className="mt-6 flex gap-3">
              <button
                type="submit"
                disabled={pending || code.length !== 6}
                className="rounded-lg bg-teal px-5 py-2.5 text-sm font-medium text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? 'Verifying...' : 'Verify and enable MFA'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEnroll({ kind: 'idle' });
                  setCode('');
                }}
                className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      ) : (
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
            <h2 className="text-base font-semibold text-navy">MFA is not enabled</h2>
          </div>
          <p className="mb-6 text-sm text-gray-600">
            Adding MFA means even if your password is compromised, an attacker
            still cannot sign in without the code from your authenticator app.
            HIPAA-aligned clinical workflows require this on every account that
            can access patient data.
          </p>
          <button
            type="button"
            onClick={startEnrollment}
            disabled={pending}
            className="rounded-lg bg-teal px-5 py-2.5 text-sm font-medium text-white transition hover:bg-teal-600 disabled:opacity-50"
          >
            {pending ? 'Starting...' : 'Set up MFA'}
          </button>
        </section>
      )}
    </div>
  );
}
