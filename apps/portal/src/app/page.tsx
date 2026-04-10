import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-navy text-white">
      <h1 className="mb-4 text-4xl font-bold tracking-tight">PRECISO</h1>
      <p className="mb-8 text-lg text-navy-200">Clinical Genomics Ordering Portal</p>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="rounded-lg bg-teal px-6 py-3 font-medium text-white transition hover:bg-teal-600"
        >
          Sign In
        </Link>
        <Link
          href="/register"
          className="rounded-lg border border-teal px-6 py-3 font-medium text-teal-300 transition hover:bg-teal-900/20"
        >
          Register
        </Link>
      </div>
    </main>
  );
}
