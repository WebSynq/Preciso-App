import Link from 'next/link';

import { SignOutButton } from './sign-out-button';

import { requireAdmin } from '@/lib/auth/require-admin';

// Admin dashboard shell. requireAdmin enforces the admin claim on every
// route under /dashboard before rendering any child page.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAdmin();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-navy text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="text-lg font-bold">
              PRECISO Admin
            </Link>
            <nav className="hidden gap-6 text-sm md:flex">
              <Link href="/dashboard" className="text-gray-200 hover:text-white">
                Overview
              </Link>
              <Link href="/dashboard/providers" className="text-gray-200 hover:text-white">
                Providers
              </Link>
              <Link href="/dashboard/orders" className="text-gray-200 hover:text-white">
                Orders
              </Link>
              <Link href="/dashboard/audit" className="text-gray-200 hover:text-white">
                Audit Log
              </Link>
              <Link href="/dashboard/mfa" className="text-gray-200 hover:text-white">
                MFA
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-gray-300 md:block">{user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
