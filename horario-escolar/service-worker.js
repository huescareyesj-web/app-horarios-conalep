const CACHE_NAME = 'mi-horario-v1';
const CORE_FILES = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Sirve desde caché cuando no hay red; si hay red, siempre intenta la versión fresca.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// La página (script.js) nos pide mostrar el aviso de una clase en el momento justo.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_CLASS_NOTIFICATION') {
    const { title, body } = event.data;
    self.registration.showNotification(title, {
      body,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      tag: 'clase-actual',
      renotify: true,
    });
  }
});
