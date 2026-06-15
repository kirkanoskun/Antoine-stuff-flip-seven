/* ── Flip 7 Service Worker ── */
const APP_CACHE   = "flip7-app-v1";
const FONT_CACHE  = "flip7-fonts-v1";

const APP_ASSETS = [
  "./Flip%207%20Score%20Tracker%20App.html",
  "./manifest.json",
  "./icons/icon-512.svg",
  "./icons/icon-maskable-512.svg",
];

/* Install : précache le shell de l'app */
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(APP_CACHE).then(cache => cache.addAll(APP_ASSETS))
  );
  self.skipWaiting();
});

/* Activate : purge les anciens caches */
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== APP_CACHE && k !== FONT_CACHE)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

/* Fetch : stratégie différenciée */
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  /* Polices Google — cache-first (persistant entre sessions) */
  if (
    url.hostname === "fonts.googleapis.com" ||
    url.hostname === "fonts.gstatic.com"
  ) {
    event.respondWith(
      caches.open(FONT_CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(response => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          }).catch(() => cached);
        })
      )
    );
    return;
  }

  /* Shell de l'app — cache-first, réseau en fallback */
  if (event.request.method === "GET") {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(APP_CACHE).then(c => c.put(event.request, clone));
          }
          return response;
        });
      })
    );
  }
});
