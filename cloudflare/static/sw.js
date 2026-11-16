/* QUIZy — service worker minimal.
 * Rôle : rendre l'appli installable et, si le réseau manque, afficher une page « hors ligne »
 * claire au lieu de l'erreur du navigateur. Il ne met JAMAIS en cache les données (/api, /setup) :
 * les révisions passent toujours par le serveur, comme avant. */
const VERSION = 'quizy-v1';
const HORS_LIGNE = '/hors-ligne';
const A_GARDER = [HORS_LIGNE, '/icon-192.png', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(A_GARDER)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // seules les ouvertures de page sont concernées ; tout le reste va au réseau sans intermédiaire
  if (req.method !== 'GET' || req.mode !== 'navigate') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/setup')) return;
  event.respondWith(
    fetch(req).catch(() => caches.match(HORS_LIGNE).then((r) => r || new Response('Hors ligne', { status: 503 })))
  );
});
