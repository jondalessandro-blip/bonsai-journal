const CACHE_NAME = 'bonsai-journal-v1';

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
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET' || isExcludedRequest(request)) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
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