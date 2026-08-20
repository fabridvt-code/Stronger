import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';
import { BottomNav } from '@/components/BottomNav';

export const metadata: Metadata = {
  title: 'Stronger — Training Tracker',
  description:
    'Local-first PWA that turns your workout program into a structured, trackable, progressive training system.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Stronger' },
};

export const viewport: Viewport = {
  themeColor: '#0b0e14',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-full">
        <Providers>
          <div className="mx-auto flex min-h-full max-w-2xl flex-col">
            <main className="flex-1 px-4 pb-28 pt-4">{children}</main>
            <BottomNav />
          </div>
        </Providers>
      </body>
    </html>
  );
}
