'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';

import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <p className="text-gray-400">Loading...</p>
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
  const callbackError = searchParams.get('error');

  const [showReset, setShowReset] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginPending, setLoginPending] = useState(false);

  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetPending, setResetPending] = useState(false);

  // SECURITY NOTE: Sign-in runs in the browser so @supabase/ssr writes the
  // auth cookie via the browser client. A server-action flow with redirect()
  // drops the cookie under Next 14.2 + @supabase/ssr 0.3 and middleware
  // bounces back to /login. Keep this client-side until the SSR helper is
  // upgraded and verified end-to-end.
  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoginError(null);
    setLoginPending(true);

    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') || '');
    const password = String(form.get('password') || '');

    try {
      const supabase = createClient();

      // SECURITY NOTE: Wait for SIGNED_IN before navigating so the cookie has
      // definitely been written to document.cookie. Otherwise the hard nav
      // can race the cookie write and middleware sees no session.
      const navigated = new Promise<void>((resolve) => {
        const { data: sub } = supabase.auth.onAuthStateChange((event) => {
          if (event === 'SIGNED_IN') {
            sub.subscription.unsubscribe();
            console.warn('[login] SIGNED_IN received, hard-navigating', { redirectTo });
            window.location.assign(redirectTo);
            resolve();
          }
        });
      });

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        console.error('[login] signInWithPassword failed', {
          message: error.message,
          status: error.status,
          code: error.code,
        });
        setLoginError('Invalid email or password. Please try again.');
        return;
      }

      await navigated;
      return;
    } catch (err) {
      console.error('[login] unexpected error', err);
      setLoginError('Unable to sign in right now. Please try again.');
    } finally {
      setLoginPending(false);
    }
  }

  async function handleReset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResetError(null);
    setResetSuccess(false);
    setResetPending(true);

    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') || '');

    try {
      const supabase = createClient();
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard/settings`,
      });
      // Always show success — never reveal whether the email exists
      setResetSuccess(true);
    } catch (err) {
      console.error('[login] reset error', err);
      // Still show success to avoid leaking account existence
      setResetSuccess(true);
    } finally {
      setResetPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-navy">PRECISO</h1>
          <p className="mt-2 text-gray-600">
            {showReset ? 'Reset your password' : 'Sign in to your portal'}
          </p>
        </div>

        {callbackError && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Authentication failed. Please try signing in again.
          </div>
        )}

        {!showReset ? (
          <form
            onSubmit={handleLogin}
            className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm"
          >
            {loginError && (
              <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {loginError}
              </div>
            )}

            <div className="mb-4">
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-teal/50"
              />
            </div>

            <div className="mb-4">
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-teal/50"
              />
            </div>

            <div className="mb-6 text-right">
              <button
                type="button"
                onClick={() => setShowReset(true)}
                className="text-sm font-medium text-teal hover:text-teal-700"
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loginPending}
              className="w-full rounded-lg bg-teal px-4 py-3 font-medium text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loginPending ? 'Signing in...' : 'Sign In'}
            </button>

            <p className="mt-6 text-center text-sm text-gray-500">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="font-medium text-teal hover:text-teal-700">
                Register
              </Link>
            </p>
          </form>
        ) : (
          <form
            onSubmit={handleReset}
            className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm"
          >
            {resetSuccess ? (
              <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                If an account exists with that email, you will receive a password reset link.
              </div>
            ) : (
              <>
                {resetError && (
                  <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {resetError}
                  </div>
                )}

                <div className="mb-6">
                  <label
                    htmlFor="reset-email"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Email Address
                  </label>
                  <input
                    id="reset-email"
                    name="email"
                    type="email"
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-teal/50"
                  />
                </div>

                <button
                  type="submit"
                  disabled={resetPending}
                  className="w-full rounded-lg bg-teal px-4 py-3 font-medium text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {resetPending ? 'Sending...' : 'Send Reset Link'}
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setShowReset(false)}
              className="mt-4 w-full text-center text-sm font-medium text-teal hover:text-teal-700"
            >
              Back to login
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
