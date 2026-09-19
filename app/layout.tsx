import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = {
  themeColor: '#090d16',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'NEXORA POS — Production Offline-First POS PWA',
  description: 'Offline-first, multi-tenant, multi-location production POS PWA with explainable inventory and cash ledgers, sub-second checkout, and local sync resilience.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'NEXORA POS',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'NEXORA POS — Production Offline-First POS PWA',
    description: 'Offline-first, multi-tenant, multi-location production POS PWA with explainable inventory and cash ledgers.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NEXORA POS — Production Offline-First POS PWA',
    description: 'Offline-first, multi-tenant, multi-location production POS PWA with explainable inventory and cash ledgers.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased selection:bg-sky-500 selection:text-white min-h-screen overflow-x-hidden font-sans" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
