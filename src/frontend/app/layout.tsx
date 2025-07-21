import type { Metadata } from 'next';
import './globals.css';
import Navigation from './components/Navigation';

export const metadata: Metadata = {
  title: 'ARKS RWA - Real World Asset Tokenization',
  description: 'Tokenize Real World Assets on the Internet Computer. Create, trade, and manage tokenized companies with full transparency and security.',
  keywords: 'RWA, Real World Assets, Tokenization, Internet Computer, DeFi, Trading',
  authors: [{ name: 'ARKS RWA Team' }],
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#3B82F6',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="bg-gray-900 text-white antialiased">
        <Navigation />
        <main className="relative">
          {children}
        </main>
      </body>
    </html>
  );
}