const CACHE_NAME = 'marungko-phonics-v4'; // bump this number every time you deploy new assets
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.png',
  '/small_icon.png',
  '/land_bg.png',
  '/intro_bg.png',
  '/intro_bgg.jpeg',
  '/trace_bg.jpeg',
  '/acc_button.png',
  '/play_button.png',
  '/blue.png',
  '/purple.png',
  '/rainbow.png',
  '/red.png',
  '/yellow.png',
  '/eraser.png',
  '/Home_bg.mp3',
  '/lose.mp3',
  '/win.mp3',
  '/ting.mp3',
  '/Panuto_1.mp3',
  '/Panuto_2.mp3',
  '/Panuto_3.mp3',
  '/Panuto_4.mp3',
];

// Send a message to every open tab of the app
function broadcast(message) {
  self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
    clients.forEach((client) => client.postMessage(message));
  });
}

// Cache a big list of files, 8 at a time, reporting progress after each one
async function cacheAllWithProgress(cache, urls) {
  const total = urls.length;
  let done = 0;
  broadcast({ type: 'CACHE_PROGRESS', done, total });

  const CONCURRENCY = 8;
  let index = 0;

  async function worker() {
    while (index < urls.length) {
      const url = urls[index++];
      try {
        const res = await fetch(url, { cache: 'no-cache' });
        if (res.ok) await cache.put(url, res);
      } catch (err) {
        console.warn('Failed to cache:', url, err);
      }
      done++;
      broadcast({ type: 'CACHE_PROGRESS', done, total });
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  broadcast({ type: 'CACHE_COMPLETE', total });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      let manifestAssets = [];
      try {
        const res = await fetch('/asset-manifest.json', { cache: 'no-cache' });
        if (res.ok) manifestAssets = await res.json();
      } catch (err) {
        console.warn('Could not load asset manifest', err);
      }

      const allAssets = [...new Set([...CORE_ASSETS, ...manifestAssets])];
      await cacheAllWithProgress(cache, allAssets);
    })()
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  const url = new URL(event.request.url);
  const isAsset =
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/allimages/') ||
    url.pathname.startsWith('/letters/') ||
    url.pathname.startsWith('/letter/') ||
    url.pathname.startsWith('/letter_sounds/') ||
    url.pathname.startsWith('/instructions/') ||
    url.pathname.startsWith('/sounds/');

  if (isAsset) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        if (response) return response;
        return fetch(event.request).then((response) => {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return response;
        });
      })
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((response) => {
          return response || caches.match('/index.html');
        });
      })
  );
});