// SplitVise service worker.
//
// WHAT THIS DELIBERATELY DOES NOT DO: cache pages, or anything from Supabase.
//
// Every page in this app is personalised and private -- it shows one account's
// rooms, payments and balances. A cached HTML or RSC response would sit in the
// browser's cache directory after sign-out, and could be served back to whoever
// uses the device next. So documents are always fetched from the network, and if
// the network is gone the user gets the offline page rather than stale data that
// might not be theirs.
//
// What IS cached is only content-addressed, non-personal static assets: the
// hashed /_next/static/ bundles and the logo. Those are identical for every
// visitor and safe to keep.

const VERSION = 'v1';
const STATIC_CACHE = `splitvise-static-${VERSION}`;
const OFFLINE_URL = '/offline.html';

const PRECACHE = [OFFLINE_URL, '/logo.png', '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      // Take over immediately rather than waiting for every tab to close.
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith('splitvise-') && name !== STATIC_CACHE)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Hashed build output and our own images. Content-addressed, identical for
// everyone, safe to serve from cache.
function isCacheableAsset(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/_next/static/') ||
      url.pathname.startsWith('/icons/') ||
      url.pathname === '/logo.png' ||
      url.pathname === '/logo-512.png')
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Never touch writes. Server Actions are POSTs, and a cached mutation would be
  // a catastrophe.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Supabase (auth, database) is another origin and must always hit the network.
  if (url.origin !== self.location.origin) return;

  // Page loads: network first, offline page as the fallback. Never cached.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(STATIC_CACHE);
        const offline = await cache.match(OFFLINE_URL);
        return offline ?? Response.error();
      }),
    );
    return;
  }

  if (isCacheableAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((response) => {
            // Only store complete, successful responses.
            if (response.ok && response.status === 200) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // Everything else -- RSC payloads, route handlers, anything personalised --
  // falls through to the network untouched and uncached.
});
