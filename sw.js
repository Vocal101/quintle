// Offline support: precache everything, serve from cache, refresh in the background.
// Bump VERSION whenever a file changes so players pick up the new build.
const VERSION = 'quintle-v1';
const ASSETS = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'js/main.js',
  'js/game.js',
  'js/ui.js',
  'js/storage.js',
  'js/words.js',
  'fonts/clear-sans-latin-400-normal.woff2',
  'fonts/clear-sans-latin-700-normal.woff2',
  'icons/favicon.svg',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
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
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(request, { ignoreSearch: true });
      const network = fetch(request)
        .then((res) => { if (res.ok) cache.put(request, res.clone()); return res; })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
