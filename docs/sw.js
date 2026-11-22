// Unisci PDF: keeps the installed app working without a network. Written by src/build.js.
const CACHE = 'unisci-pdf-7b038168d5d7';
const SHELL = ['./', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('unisci-pdf-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(request, { ignoreSearch: true }).then((hit) => {
    if (hit) return hit;
    return fetch(request).catch(() => (request.mode === 'navigate' ? caches.match('./') : Response.error()));
  }));
});
