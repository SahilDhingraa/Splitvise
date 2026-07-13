import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { Inter } from 'next/font/google';
import { ServiceWorker } from '@/components/ServiceWorker';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

// The favicon and Apple touch icon are picked up automatically from
// src/app/icon.png and src/app/apple-icon.png -- no <link> tags needed.
export const metadata: Metadata = {
  title: 'SplitVise — Expense Splitter',
  description: 'Smart expense splitting made simple',
  openGraph: {
    title: 'SplitVise',
    description: 'Smart expense splitting made simple',
    images: ['/logo-512.png'],
  },
  appleWebApp: {
    capable: true,
    title: 'SplitVise',
    // Lets the app draw behind the iOS status bar when installed.
    statusBarStyle: 'default',
  },
};

// Tints the browser/OS chrome to match the active theme when installed.
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
  ],
};

// Applies the saved theme before the page paints, so reloading in dark mode does
// not flash white first.
//
// This has to be `next/script` with `beforeInteractive`, not a plain <script>
// element: React does not execute script tags it renders itself, so a bare
// <script> here would silently never run on the client.
const themeScript = `
  try {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (saved === 'dark' || (!saved && prefersDark)) {
      document.documentElement.classList.add('dark');
    }
  } catch {}
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />
      </head>
      <body>
        <Script id="theme-init" strategy="beforeInteractive">
          {themeScript}
        </Script>
        <ServiceWorker />
        {children}
      </body>
    </html>
  );
}
