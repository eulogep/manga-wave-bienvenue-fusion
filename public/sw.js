const CACHE_PREFIX = 'manga-wave-shell-';
const SHELL_CACHE = `${CACHE_PREFIX}v1`;
const SHELL_URLS = [
  '/',
  '/manifest.webmanifest',
  '/icons/manga-wave-192.png',
  '/icons/manga-wave-512.png',
];

const cacheShellAssets = async (cache, response) => {
  const html = await response.text();
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?]+)[^"]*"/g)].map((match) => match[1]);
  if (assets.length > 0) await cache.addAll([...new Set(assets)]);
};

const trimAssetCache = async (cache, limit = 24) => {
  const assets = (await cache.keys()).filter((request) => new URL(request.url).pathname.startsWith('/assets/'));
  await Promise.all(assets.slice(0, Math.max(0, assets.length - limit)).map((request) => cache.delete(request)));
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(async (cache) => {
      await cache.addAll(SHELL_URLS);
      const shell = await cache.match('/');
      if (shell) await cacheShellAssets(cache, shell);
      await self.skipWaiting();
    }),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== SHELL_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

const isShellAsset = (url) => (
  url.origin === self.location.origin
  && (url.pathname.startsWith('/assets/')
    || url.pathname.startsWith('/icons/')
    || url.pathname === '/favicon.ico'
    || url.pathname === '/manifest.webmanifest')
);

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const cachedDocument = response.clone();
            const assetDocument = response.clone();
            event.waitUntil(caches.open(SHELL_CACHE).then(async (cache) => {
              await cache.put('/', cachedDocument);
              await cacheShellAssets(cache, assetDocument);
              await trimAssetCache(cache);
            }));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) || caches.match('/')),
    );
    return;
  }

  if (!isShellAsset(url)) return;
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        event.waitUntil(caches.open(SHELL_CACHE).then(async (cache) => {
          await cache.put(request, copy);
          await trimAssetCache(cache);
        }));
      }
      return response;
    })),
  );
});
