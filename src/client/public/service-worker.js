const CACHE = 'body-os-shell-v2';
const APP_SHELL = ['/', '/manifest.webmanifest', '/body-os-app-192-v2.png', '/body-os-app-512-v2.png', '/body-os-logo.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  // Training and account data must remain network-only; never cache API responses.
  if (new URL(request.url).pathname.startsWith('/api/')) return;
  event.respondWith(fetch(request).catch(() => caches.match(request).then((cached) => cached || caches.match('/'))));
});
