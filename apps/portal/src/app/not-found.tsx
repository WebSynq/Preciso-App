import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <h1 className="mb-2 text-6xl font-bold text-navy">404</h1>
      <p className="mb-6 text-lg text-gray-500">Page not found.</p>
      <Link
        href="/"
        className="rounded-lg bg-teal px-6 py-2.5 text-sm font-medium text-white transition hover:bg-teal-600"
      >
        Go Home
      </Link>
    </main>
  );
}
