// Offline support for the piano app. The page, its code and the piano
// samples are kept on the device after the first visit, so practice does
// not depend on a connection.

const VERSION = 'middle-c-v2';
const SAMPLES = [21, 24, 27, 30, 33, 36, 39, 42, 45, 48, 51, 54, 57, 60, 63, 66, 69, 72, 75, 78, 81, 84, 87, 90, 93, 96, 99, 102, 105, 108].map(
  (n) => `/piano/samples/${n}.mp3`,
);
const CORE = ['/piano', '/piano/capture-worklet.js', '/piano/manifest.webmanifest', '/piano/icons/icon-192.png', ...SAMPLES];

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
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('middle-c-') && k !== VERSION).map((k) => caches.delete(k))))
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

/** The address a page is kept under: its path alone, so ?mcdebug=1 and the like share one copy. */
function pageKey(url) {
  return url.origin + url.pathname.replace(/\/+$/, '');
}

/**
 * Fresh from the network when there is one, the kept copy when there is not.
 * Each page is kept under its own address. A page that was never kept falls
 * back to the app itself, so the app still opens offline.
 */
function networkFirst(request, offlinePage) {
  const key = request.mode === 'navigate' ? pageKey(new URL(request.url)) : request;
  return fetch(request)
    .then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(VERSION).then((cache) => cache.put(key, copy));
      }
      return response;
    })
    .catch(() =>
      caches
        .match(key)
        .then((hit) => hit || (offlinePage ? caches.match(offlinePage) : undefined))
        .then((hit) => hit || Response.error()),
    );
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    if (url.pathname === '/piano' || url.pathname.startsWith('/piano/')) event.respondWith(networkFirst(request, new URL('/piano', self.location.origin).href));
    return;
  }
  // Built code has a fingerprint in its name and never changes.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/piano/samples/') || url.pathname.startsWith('/piano/icons/')) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (url.pathname.startsWith('/piano/')) {
    event.respondWith(networkFirst(request));
  }
});
