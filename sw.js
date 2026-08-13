const CACHE_NAME = 'smarket-fletes-v1';
const ARCHIVOS = ['./index.html', './style.css', './app.js', './manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ARCHIVOS))
  );
});

self.addEventListener('fetch', (event) => {
  // Los pedidos a la API de Apps Script van siempre a la red, nunca al cache
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((respuestaCache) => {
      return respuestaCache || fetch(event.request);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((claves) =>
      Promise.all(claves.filter((c) => c !== CACHE_NAME).map((c) => caches.delete(c)))
    )
  );
});
