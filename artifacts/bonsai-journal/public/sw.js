const CACHE_NAME = 'bonsai-journal-v3';

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
  if (request.cache === 'no-store') return;

  const isAppShellRequest =
    request.destination === 'document' ||
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'worker';

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      if (isAppShellRequest) {
        try {
          const response = await fetch(request, { cache: 'no-cache' });
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

self.addEventListener('push', (event) => {
  let parsedPayload;
  try {
    parsedPayload = event.data ? event.data.json() : {};
  } catch {
    parsedPayload = {};
  }
  const payload =
    parsedPayload && typeof parsedPayload === 'object' ? parsedPayload : {};

  const title =
    typeof payload.title === 'string' && payload.title.trim()
      ? payload.title
      : 'Bonsai Journal';
  const body = typeof payload.body === 'string' ? payload.body : '';
  const url =
    typeof payload.url === 'string' && payload.url.trim()
      ? payload.url
      : '/';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      tag: 'bonsai-daily',
      data: { url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const rawUrl = event.notification.data?.url;

  event.waitUntil(
    (async () => {
      const url = rawUrl ? new URL(rawUrl, self.location.origin) : null;
      const targetUrl =
        url?.origin === self.location.origin ? url.href : null;
      const windows = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      const appWindow = windows.find((client) =>
        client.url.startsWith(self.registration.scope),
      );

      if (appWindow) {
        if (targetUrl) await appWindow.navigate(targetUrl);
        await appWindow.focus();
      } else if (targetUrl) {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});