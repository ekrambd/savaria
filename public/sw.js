// Service Worker - Auto unregister and cache bust
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch((err) => {
      // In case of navigation or network failure, let browser handle navigation
      if (event.request.mode === 'navigate') {
        return fetch(event.request, { cache: 'no-cache' }).catch(() => Response.error());
      }
      return Response.error();
    })
  );
});
