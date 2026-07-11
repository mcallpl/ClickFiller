/* ClickFiller service worker — makes the app installable and usable offline.
 *
 * Strategy:
 *  - /api/* and any non-GET request: never touched. Form analysis must always
 *    hit the live server; caching it would be wrong and could serve stale or
 *    cross-user data.
 *  - Navigations (HTML): network-first, falling back to the cached shell so the
 *    app opens offline. Vite fingerprints asset filenames, so we cache them at
 *    runtime rather than precaching a hardcoded list.
 *  - Same-origin static assets (JS/CSS/images/fonts): stale-while-revalidate —
 *    instant from cache, refreshed in the background.
 */
const VERSION = 'clickfiller-v1';
const SHELL = 'index.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.add('/')).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GETs. Leave the API and everything else alone.
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }
  if (url.pathname.startsWith('/api') || url.pathname === '/health') {
    return;
  }

  // Navigations: network-first, fall back to the cached app shell offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/').then((r) => r || caches.match(SHELL))),
    );
    return;
  }

  // Static assets: stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
