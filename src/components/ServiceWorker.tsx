'use client';

import { useEffect } from 'react';

// Registers the service worker, which is what makes the app installable.
//
// Registered after load rather than during it, so fetching and parsing the worker
// never competes with the first paint.
export function ServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // In dev the bundles are unhashed and change constantly, so a caching worker
    // just serves stale JS and creates phantom bugs. Only run it in production.
    if (process.env.NODE_ENV !== 'production') return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.error('Service worker registration failed:', error);
      });
    };

    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register);
      return () => window.removeEventListener('load', register);
    }
  }, []);

  return null;
}
