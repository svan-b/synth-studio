// Offline support for the guitar app. The page and its code are kept on
// the device after the first visit, so practice does not depend on a
// connection. The guitar sound is made on the device, so there are no samples.

const VERSION = 'open-string-v1';
const CORE = ['/guitar', '/guitar/capture-worklet.js', '/guitar/manifest.webmanifest', '/guitar/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) =>
      // One missing file must not stop the rest from being stored.
      Promise.all(CORE.map((url) => cache.add(url).catch(() => undefined))),
    ),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('open-string-') && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function cacheFirst(request) {
  return caches.match(request).then(
    (hit) =>
      hit ||
      fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      }),
  );
}

function networkFirst(request, fallbackUrl) {
  return fetch(request)
    .then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(VERSION).then((cache) => cache.put(fallbackUrl || request, copy));
      }
      return response;
    })
    .catch(() => caches.match(fallbackUrl || request).then((hit) => hit || Response.error()));
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    if (url.pathname === '/guitar' || url.pathname.startsWith('/guitar/')) event.respondWith(networkFirst(request, '/guitar'));
    return;
  }
  // Built code has a fingerprint in its name and never changes.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/guitar/icons/')) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (url.pathname.startsWith('/guitar/')) {
    event.respondWith(networkFirst(request));
  }
});
