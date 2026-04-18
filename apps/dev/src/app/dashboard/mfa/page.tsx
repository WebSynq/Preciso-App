'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { createClient } from '@/lib/supabase/client';

/**
 * /dashboard/mfa — Developer TOTP enrollment / disable.
 * Dev accounts carry elevated infrastructure-observability access —
 * MFA is strongly recommended even though the dev surface never
 * exposes PHI.
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
  | { kind: 'enrolling'; factorId: string; qrCode: string; secret: string };

export default function DevMfaPage() {
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
      const stale = factors.find(
        (f) => f.factor_type === 'totp' && f.status !== 'verified',
      );
      if (stale) {
        await supabase.auth.mfa.unenroll({ factorId: stale.id });
      }
      const { data, error: enrollErr } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        issuer: 'PRECISO Dev',
        friendlyName: 'PRECISO Dev Authenticator',
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
      console.error('[dev/mfa/enroll] unexpected error', err);
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
      setNotice('MFA enrolled. You will be challenged on your next sign-in.');
      await loadFactors();
    } catch (err) {
      console.error('[dev/mfa/verify] unexpected error', err);
      setError('Unexpected error. Please try again.');
    } finally {
      setPending(false);
    }
  }

  async function disableMfa() {
    if (!verifiedFactor) return;
    const confirmed = window.confirm(
      'Disabling MFA lowers the security of this dev account. Continue?',
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
      <h1 className="mb-2 font-mono text-xl text-teal-500">account / mfa</h1>
      <p className="mb-6 text-sm text-gray-400">
        Two-factor authentication for the developer console.
      </p>

      {notice && (
        <div className="mb-6 rounded-lg border border-green-900 bg-green-950/50 px-4 py-3 text-sm text-green-300">
          {notice}
        </div>
      )}
      {error && (
        <div className="mb-6 rounded-lg border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-ink-200 bg-ink-100 p-5 text-sm text-gray-500">
          Loading factors...
        </div>
      ) : verifiedFactor ? (
        <section className="rounded-lg border border-ink-200 bg-ink-100 p-6">
          <div className="mb-4 flex items-center gap-3">
            <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
            <h2 className="font-mono text-sm font-semibold text-teal-500">mfa · active</h2>
          </div>
          <dl className="mb-6 space-y-2 font-mono text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">factor_type</dt>
              <dd className="text-gray-200">totp</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">enrolled_at</dt>
              <dd className="text-gray-200">
                {new Date(verifiedFactor.created_at).toISOString().slice(0, 10)}
              </dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={disableMfa}
            disabled={pending}
            className="rounded-md border border-red-900 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-950/50 disabled:opacity-50"
          >
            {pending ? 'Disabling...' : 'Disable MFA'}
          </button>
        </section>
      ) : enroll.kind === 'enrolling' ? (
        <section className="rounded-lg border border-ink-200 bg-ink-100 p-6">
          <h2 className="mb-4 font-mono text-sm font-semibold text-teal-500">
            scan / or / enter_secret
          </h2>
          <div className="mb-6 flex flex-col items-center gap-4 rounded border border-ink-300 bg-ink-200 p-6">
            {/* Raw <img> is deliberate — QR comes from Supabase as an SVG
                data URI, not a URL; next/image can't optimise it. */}
            <img src={enroll.qrCode} alt="MFA QR code" className="h-48 w-48 rounded bg-white p-2" />
            <p className="text-xs text-gray-500">Or enter this secret manually:</p>
            <code className="select-all rounded bg-ink-300 px-3 py-1 font-mono text-xs text-gray-200">
              {enroll.secret}
            </code>
          </div>
          <form onSubmit={confirmEnrollment}>
            <label htmlFor="totp-code" className="mb-1 block font-mono text-sm text-gray-300">
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
              className="w-full max-w-[12rem] rounded-lg border border-ink-300 bg-ink-200 px-3 py-2.5 font-mono text-lg tracking-widest text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
            />
            <div className="mt-6 flex gap-3">
              <button
                type="submit"
                disabled={pending || code.length !== 6}
                className="rounded-lg bg-teal-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? 'Verifying...' : 'Verify and enable'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEnroll({ kind: 'idle' });
                  setCode('');
                }}
                className="rounded-lg border border-ink-300 px-5 py-2.5 text-sm font-medium text-gray-300 transition hover:bg-ink-200"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      ) : (
        <section className="rounded-lg border border-ink-200 bg-ink-100 p-6">
          <div className="mb-4 flex items-center gap-3">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
            <h2 className="font-mono text-sm font-semibold text-amber-400">mfa · not_enabled</h2>
          </div>
          <p className="mb-6 text-sm text-gray-400">
            Dev accounts have elevated infrastructure access. Enroll an authenticator
            app to add a second factor.
          </p>
          <button
            type="button"
            onClick={startEnrollment}
            disabled={pending}
            className="rounded-lg bg-teal-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-teal-600 disabled:opacity-50"
          >
            {pending ? 'Starting...' : 'Set up MFA'}
          </button>
        </section>
      )}
    </div>
  );
}
