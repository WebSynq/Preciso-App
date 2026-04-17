import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'PRECISO | Admin Console',
  description: 'Platform administration for PRECISO — clinical genomics ordering',
  // SECURITY NOTE: robots meta forces no-index on every admin page. Admin
  // surfaces should never appear in search results even if a link leaks.
  robots: { index: false, follow: false, nocache: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 font-sans antialiased">{children}</body>
    </html>
  );
}
