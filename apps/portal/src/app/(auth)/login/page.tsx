'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useActionState, useState } from 'react';

import { loginAction, resetPasswordAction, type LoginState } from './actions';

const loginInitial: LoginState = {};
const resetInitial: { success?: boolean; error?: string } = {};

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-gray-50"><p className="text-gray-400">Loading...</p></div>}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/dashboard';
  const callbackError = searchParams.get('error');

  const [showReset, setShowReset] = useState(false);
  const [loginState, loginFormAction, loginPending] = useActionState(loginAction, loginInitial);
  const [resetState, resetFormAction, resetPending] = useActionState(
    resetPasswordAction,
    resetInitial,
  );

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
            action={loginFormAction}
            className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm"
          >
            <input type="hidden" name="redirect" value={redirectTo} />

            {loginState.error && (
              <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {loginState.error}
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
            action={resetFormAction}
            className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm"
          >
            {resetState.success ? (
              <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                If an account exists with that email, you will receive a password reset link.
              </div>
            ) : (
              <>
                {resetState.error && (
                  <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {resetState.error}
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
