'use client';

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
  const errorCode = searchParams.get('error');

  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginPending, setLoginPending] = useState(false);

  // SECURITY NOTE: We sign in with the same Supabase auth the portal uses
  // but then REQUIRE the JWT to carry app_metadata.role = 'admin'. A
  // provider who somehow reaches /login for the admin app still cannot
  // sign in — signInWithPassword succeeds, we immediately signOut, and
  // return a generic error that does not confirm the account exists.
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
        console.error('[admin/login] signInWithPassword failed', {
          message: error?.message,
          code: error?.code,
        });
        setLoginError('Invalid credentials.');
        return;
      }

      const role = (data.user.app_metadata as { role?: string } | undefined)?.role;
      if (role !== 'admin') {
        console.warn('[admin/login] non-admin attempted admin sign-in', {
          userId: data.user.id,
        });
        await supabase.auth.signOut();
        setLoginError('Invalid credentials.');
        return;
      }

      // Hard navigation so middleware sees the freshly-written cookies.
      window.location.assign(redirectTo);
    } catch (err) {
      console.error('[admin/login] unexpected error', err);
      setLoginError('Unable to sign in right now. Please try again.');
    } finally {
      setLoginPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-navy">PRECISO Admin</h1>
          <p className="mt-2 text-gray-600">Platform administration console</p>
        </div>

        {(errorCode === 'not_authorized' || loginError) && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {loginError || 'You are not authorized to access this console.'}
          </div>
        )}

        <form
          onSubmit={handleLogin}
          className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm"
        >
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

          <div className="mb-6">
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

          <button
            type="submit"
            disabled={loginPending}
            className="w-full rounded-lg bg-navy px-4 py-3 font-medium text-white transition hover:bg-navy-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loginPending ? 'Signing in...' : 'Sign In'}
          </button>

          <p className="mt-6 text-center text-xs text-gray-400">
            Admin access is by invitation only. Unauthorized access is logged.
          </p>
        </form>
      </div>
    </main>
  );
}
