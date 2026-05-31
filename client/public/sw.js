const CACHE_NAME = 'marungko-phonics-v3';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.png',
  '/small_icon.png',
  '/land_bg.png',
  '/intro_bg.jpeg',
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
  '/sounds/M_malungay.mp3',
  '/sounds/M_mango.mp3',
  '/sounds/M_manok.mp3',
  '/sounds/M_medyas.mp3',
  '/sounds/M_motor.mp3',
  '/letters/A-agila.png',
  '/letters/A-aklat.png',
  '/letters/A-apoy.png',
  '/letters/A-araw.png',
  '/letters/A-aso.png',
  '/letters/B-bahay.png',
  '/letters/B-baso.png',
  '/letters/B-bato.png',
  '/letters/B-bola.png',
  '/letters/B-bus.png',
  '/letters/E-elepante.png',
  '/letters/E-empanada.png',
  '/letters/E-ensaymada.png',
  '/letters/E-eroplano.png',
  '/letters/E-espageti.png',
  '/letters/I-ibon.png',
  '/letters/I-ilaw.png',
  '/letters/I-isda.png',
  '/letters/I-isla.png',
  '/letters/I-itlog.png',
  '/letters/M-malungay.png',
  '/letters/M-mango.png',
  '/letters/M-manok.png',
  '/letters/M-mapa.png',
  '/letters/M-medyas.png',
  '/letters/M-motor.png',
  '/letters/M-mundo.png',
  '/letters/O-okra.png',
  '/letters/O-oktopus.png',
  '/letters/O-orange.png',
  '/letters/O-orasan.png',
  '/letters/O-oso.png',
  '/letters/S-saging.png',
  '/letters/S-sandok.png',
  '/letters/S-sapatos.png',
  '/letters/S-sarangola.png',
  '/letters/S-susi.png',
  '/letters/T-talong.png',
  '/letters/T-telepono.png',
  '/letters/T-tigre.png',
  '/letters/T-tinapay.png',
  '/letters/T-tupa.png',
  '/letters/U-ube.png',
  '/letters/U-unan.png',
  '/letters/U-unggoy.png',
  '/letters/U-upuan.png',
  '/letters/U-uwak.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        ASSETS_TO_CACHE.map(url =>
          cache.add(url).catch(err => console.warn('Failed to cache:', url, err))
        )
      );
    })
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

  // For JS/CSS assets - cache first, then network
  const url = new URL(event.request.url);
  const isAsset = url.pathname.startsWith('/assets/');

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

  // For everything else - network first, fallback to cache
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