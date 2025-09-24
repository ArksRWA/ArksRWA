import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Navigation from './components/Navigation';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'ARKS RWA - Real World Asset Tokenization',
  description: 'Tokenize Real World Assets. Create, trade, and manage tokenized companies with full transparency and security.',
  keywords: 'RWA, Real World Assets, Tokenization, DeFi, Trading, Plug Wallet',
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
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className={`${inter.variable} bg-gradient-primary text-foreground antialiased font-sans min-h-screen`}>
        <Navigation />
        <main className="relative min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}