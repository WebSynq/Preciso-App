import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'PRECISO | Clinical Genomics Portal',
  description: 'Physician ordering portal for precision genomic testing',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white font-sans antialiased">{children}</body>
    </html>
  );
}
