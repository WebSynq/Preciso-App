import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'PRECISO | Developer Console',
  description: 'Platform operations console for PRECISO engineers',
  // SECURITY NOTE: never indexed.
  robots: { index: false, follow: false, nocache: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink font-sans text-gray-100 antialiased">{children}</body>
    </html>
  );
}
