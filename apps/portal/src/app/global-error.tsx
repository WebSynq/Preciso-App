'use client';

import Link from 'next/link';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 font-sans">
        <h1 className="mb-2 text-4xl font-bold text-gray-800">Something went wrong</h1>
        <p className="mb-6 text-gray-500">An unexpected error occurred.</p>
        <div className="flex gap-3">
          <button
            onClick={reset}
            className="rounded-lg bg-teal-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-teal-700"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Go Home
          </Link>
        </div>
      </body>
    </html>
  );
}
