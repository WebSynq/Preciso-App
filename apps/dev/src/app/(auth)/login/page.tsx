'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-ink">
          <p className="text-gray-500">Loading...</p>
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/dashboard';
  const errorCode = searchParams.get('error');

  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginPending, setLoginPending] = useState(false);

  const [mfa, setMfa] = useState<{ challengeId: string } | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoginError(null);
    setLoginPending(true);

    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') || '');
    const password = String(form.get('password') || '');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const result = (await res.json().catch(() => ({}))) as {
        error?: string;
        success?: boolean;
        requiresMfa?: boolean;
        challengeId?: string;
      };

      if (result.requiresMfa && result.challengeId) {
        setMfa({ challengeId: result.challengeId });
        return;
      }

      if (!res.ok || !result.success) {
        setLoginError(result.error || 'Invalid credentials.');
        return;
      }
      window.location.assign(redirectTo);
    } catch (err) {
      console.error('[dev/login] unexpected error', err);
      setLoginError('Unable to sign in right now. Please try again.');
    } finally {
      setLoginPending(false);
    }
  }

  async function handleMfaSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!mfa) return;
    setLoginError(null);
    setLoginPending(true);
    try {
      const res = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId: mfa.challengeId, code: mfaCode }),
      });
      const result = (await res.json().catch(() => ({}))) as {
        error?: string;
        success?: boolean;
      };
      if (!res.ok || !result.success) {
        setLoginError(result.error || 'Invalid code. Please try again.');
        return;
      }
      window.location.assign(redirectTo);
    } catch (err) {
      console.error('[dev/login] mfa verify unexpected error', err);
      setLoginError('Unable to verify code right now. Please try again.');
    } finally {
      setLoginPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-mono text-2xl font-bold text-teal-500">PRECISO · dev</h1>
          <p className="mt-2 text-sm text-gray-400">Platform operations console</p>
        </div>

        {(errorCode === 'not_authorized' ||
          errorCode === 'mfa_required' ||
          errorCode === 'session_expired' ||
          loginError) && (
          <div
            className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
              errorCode === 'mfa_required' || errorCode === 'session_expired'
                ? 'border-amber-900 bg-amber-950/50 text-amber-300'
                : 'border-red-900 bg-red-950/50 text-red-300'
            }`}
          >
            {loginError ||
              (errorCode === 'mfa_required'
                ? 'Please enter your authentication code to complete sign-in.'
                : errorCode === 'session_expired'
                  ? 'You were signed out after 15 minutes of inactivity. Please sign in again.'
                  : 'You are not authorized to access this console.')}
          </div>
        )}

        {mfa ? (
          <form
            onSubmit={handleMfaSubmit}
            className="rounded-xl border border-ink-200 bg-ink-100 p-8 shadow-xl"
          >
            <p className="mb-4 text-sm text-gray-300">
              Enter the 6-digit code from your authenticator app.
            </p>
            <label htmlFor="mfa-code" className="mb-1 block text-sm font-medium text-gray-300">
              Authentication code
            </label>
            <input
              id="mfa-code"
              name="code"
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              autoFocus
              autoComplete="one-time-code"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
              className="w-full rounded-lg border border-ink-300 bg-ink-200 px-3 py-2.5 font-mono text-lg tracking-widest text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
            />
            <button
              type="submit"
              disabled={loginPending || mfaCode.length !== 6}
              className="mt-6 w-full rounded-lg bg-teal-500 px-4 py-3 font-medium text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loginPending ? 'Verifying...' : 'Verify and sign in'}
            </button>
            <button
              type="button"
              onClick={() => {
                setMfa(null);
                setMfaCode('');
                setLoginError(null);
              }}
              className="mt-4 w-full text-center text-sm font-medium text-gray-500 hover:text-gray-300"
            >
              Cancel and start over
            </button>
          </form>
        ) : (
          <form
            onSubmit={handleLogin}
            className="rounded-xl border border-ink-200 bg-ink-100 p-8 shadow-xl"
          >
            <div className="mb-4">
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-300">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="w-full rounded-lg border border-ink-300 bg-ink-200 px-3 py-2.5 text-sm text-gray-100 transition focus:outline-none focus:ring-2 focus:ring-teal-500/50"
              />
            </div>

            <div className="mb-6">
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-300">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="w-full rounded-lg border border-ink-300 bg-ink-200 px-3 py-2.5 text-sm text-gray-100 transition focus:outline-none focus:ring-2 focus:ring-teal-500/50"
              />
            </div>

            <button
              type="submit"
              disabled={loginPending}
              className="w-full rounded-lg bg-teal-500 px-4 py-3 font-medium text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loginPending ? 'Signing in...' : 'Sign In'}
            </button>

            <p className="mt-6 text-center text-xs text-gray-500">
              Developer access is non-clinical. No PHI is exposed on this console.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
