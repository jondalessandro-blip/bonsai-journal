const CACHE_NAME = 'bonsai-journal-v2';

function isExcludedRequest(request) {
  const url = new URL(request.url);
  const hostname = url.hostname.toLowerCase();

  return (
    url.pathname.startsWith('/api/') ||
    hostname.includes('clerk') ||
    hostname.includes('supabase')
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET' || isExcludedRequest(request)) {
    return;
  }

  const isAppShellRequest =
    request.destination === 'document' ||
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'worker';

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      if (isAppShellRequest) {
        try {
          const response = await fetch(request);
          if (response.ok && response.type === 'basic') {
            await cache.put(request, response.clone());
          }
          return response;
        } catch {
          return cache.match(request);
        }
      }

      const cachedResponse = await cache.match(request);
      const networkResponse = fetch(request)
        .then((response) => {
          if (response.ok && response.type === 'basic') {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => cachedResponse);

      return cachedResponse || networkResponse;
    }),
  );
});