import './globals.css';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { AppShell } from '@/components/layout/AppShell';

export const metadata = {
  title: { default: 'DISC — music discovery', template: '%s · DISC' },
  description: 'DISC is a local-first music discovery and streaming app. Search several open and licensed catalogs, build playlists and get transparent recommendations.',
  manifest: '/manifest.webmanifest',
};

export const viewport = { themeColor: '#09090B', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
