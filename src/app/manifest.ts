import type { MetadataRoute } from 'next';

// Served at /manifest.webmanifest. Next links it from <head> automatically.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SplitVise — Expense Splitter',
    short_name: 'SplitVise',
    description: 'Smart expense splitting made simple',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    categories: ['finance', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Android crops icons to the launcher's shape. Without a maskable icon it
      // shrinks the "any" icon into a white blob; with one, it fills the shape.
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
