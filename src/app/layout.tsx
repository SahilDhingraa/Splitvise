import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import { ServiceWorker } from '@/components/ServiceWorker';
import './globals.css';

// Display face for headings and figures, Plex for body copy, Plex Mono for every
// amount so columns of money line up.
const display = Bricolage_Grotesque({
  subsets: ['latin'],
  axes: ['opsz'],
  variable: '--font-bricolage',
});
const body = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-sans',
});
const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
});

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
  width: 'device-width',
  initialScale: 1,
  // Lets the page extend under the notch and home indicator when installed. The
  // CSS then pads content back out with env(safe-area-inset-*), so nothing
  // important sits under either.
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#111926' },
    { media: '(prefers-color-scheme: dark)', color: '#090D13' },
  ],
};

// Applies the saved theme before the page paints, so reloading in dark mode does
// not flash white first.
//
// Inlined into <head> by hand rather than via next/script. The caveat about React
// not executing script tags applies to scripts React creates on the client; this
// one is part of the server-rendered HTML, so the browser runs it on parse --
// which is also the only moment early enough to beat the first paint.
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
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ServiceWorker />
        {children}
      </body>
    </html>
  );
}
