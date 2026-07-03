/*
  OSMOS service worker.

  - App shell (this file's own HTML/manifest/icons) is cached and served
    "stale while revalidate": instant load from cache, refreshed quietly
    in the background so the next visit picks up any redeploy.
  - Everything else (Google Fonts, TensorFlow.js, the COCO-SSD model and
    its weight files) is cached the first time it's successfully loaded
    and then served straight from cache from then on — including offline.
    These are all pinned/versioned CDN URLs, so this is safe forever; it
    just means the browser never re-downloads the multi-MB model again.

  Bump CACHE_NAME (e.g. to 'osmos-cache-v2') whenever you redeploy a
  change to index.html/manifest/icons, so old clients pick up the update
  instead of quietly serving a stale copy from their cache.
*/
const CACHE_NAME = 'osmos-cache-v3';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.ico',
  './icons/favicon-32.png',
  './icons/favicon-16.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => { /* offline-first install shouldn't hard-fail */ })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const sameOrigin = new URL(req.url).origin === self.location.origin;

  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req).then((res) => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached);

      if (sameOrigin) {
        // app shell: serve cached copy instantly, refresh quietly for next time
        if (cached) { networkFetch.catch(() => {}); return cached; }
        return networkFetch;
      }

      // third-party (fonts / model / weights): cache-first, network as fallback
      return cached || networkFetch;
    })
  );
});
