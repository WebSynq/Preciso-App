import Link from 'next/link';

export default function PendingPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
        <svg
          className="h-8 w-8 text-amber-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <h1 className="mb-2 text-2xl font-bold text-navy">Account Under Review</h1>
      <p className="mb-6 max-w-md text-gray-600">
        Your Hospital/Enterprise account is being reviewed by the PRECISO team. You will receive an
        email once your account has been approved and activated.
      </p>
      <p className="text-sm text-gray-400">
        Questions?{' '}
        <Link href="mailto:support@preciso.ai" className="text-teal hover:text-teal-700">
          Contact support
        </Link>
      </p>
    </div>
  );
}
