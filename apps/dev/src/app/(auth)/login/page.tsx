'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';

import { createClient } from '@/lib/supabase/client';

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

  // SECURITY NOTE: Require developer claim at sign-in. Non-developer
  // sessions are immediately signed out with a generic error — we never
  // confirm that the account exists.
  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoginError(null);
    setLoginPending(true);

    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') || '');
    const password = String(form.get('password') || '');

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) {
        console.error('[dev/login] signInWithPassword failed', {
          message: error?.message,
          code: error?.code,
        });
        setLoginError('Invalid credentials.');
        return;
      }
      const role = (data.user.app_metadata as { role?: string } | undefined)?.role;
      if (role !== 'developer') {
        console.warn('[dev/login] non-developer attempted dev sign-in', {
          userId: data.user.id,
          role: role ?? 'none',
        });
        await supabase.auth.signOut();
        setLoginError('Invalid credentials.');
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

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-mono text-2xl font-bold text-teal-500">PRECISO · dev</h1>
          <p className="mt-2 text-sm text-gray-400">Platform operations console</p>
        </div>

        {(errorCode === 'not_authorized' || loginError) && (
          <div className="mb-6 rounded-lg border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-300">
            {loginError || 'You are not authorized to access this console.'}
          </div>
        )}

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
      </div>
    </main>
  );
}
