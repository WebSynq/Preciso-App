import Link from 'next/link';

import { SignOutButton } from './sign-out-button';

import { requireDeveloper } from '@/lib/auth/require-developer';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireDeveloper();

  return (
    <div className="min-h-screen bg-ink">
      <header className="border-b border-ink-200 bg-ink-100">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="font-mono text-sm font-bold text-teal-500">
              preciso · dev
            </Link>
            <nav className="hidden gap-6 text-sm md:flex">
              <Link href="/dashboard" className="text-gray-300 hover:text-white">
                Overview
              </Link>
              <Link href="/dashboard/health" className="text-gray-300 hover:text-white">
                Health
              </Link>
              <Link href="/dashboard/audit-summary" className="text-gray-300 hover:text-white">
                Audit Summary
              </Link>
              <Link href="/dashboard/mfa" className="text-gray-300 hover:text-white">
                MFA
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden font-mono text-xs text-gray-400 md:block">{user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
