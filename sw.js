// Subir este numero de version cada vez que se suba una version nueva del sw.js
// para forzar a todos los telefonos a descartar el cache anterior.
const CACHE_NAME = 'smarket-fletes-v2';
const ARCHIVOS = ['./index.html', './style.css', './app.js', './manifest.json'];

self.addEventListener('install', (event) => {
  // Activa la version nueva del service worker de inmediato, sin esperar
  // a que se cierren todas las pestañas/instancias abiertas de la app.
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ARCHIVOS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((c) => c !== CACHE_NAME).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()) // toma el control de las pestañas ya abiertas, sin esperar a que se recarguen
  );
});

self.addEventListener('fetch', (event) => {
  // Los pedidos a la API de Apps Script van siempre a la red, nunca al cache
  if (event.request.method !== 'GET') return;

  // Estrategia "red primero": intenta buscar la version mas nueva en el servidor.
  // Si lo consigue, actualiza el cache y lo devuelve. Si no hay conexion, recien
  // ahi usa la copia guardada. Esto evita quedarse pegado con una version vieja.
  event.respondWith(
    fetch(event.request)
      .then((respuestaRed) => {
        const copia = respuestaRed.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia));
        return respuestaRed;
      })
      .catch(() => caches.match(event.request))
  );
});
