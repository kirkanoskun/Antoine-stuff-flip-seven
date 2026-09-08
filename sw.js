/* ═══════════════════════════════════════════
   Flip 7 — Service Worker
   ═══════════════════════════════════════════
   Bump APP_CACHE à chaque livraison : sans ça, les utilisateurs ayant
   installé la PWA resteraient bloqués sur l'ancienne version. */
const VERSION    = "v3";
const APP_CACHE  = `flip7-app-${VERSION}`;
const FONT_CACHE = "flip7-fonts-v1";   // versionné à part : les polices ne changent pas

const APP_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
  "./icons/icon-180.png",
  "./icons/favicon-32.png",
];

const FONT_HOSTS = new Set(["fonts.googleapis.com", "fonts.gstatic.com"]);

/* ── Install ─────────────────────────────────
   cache.addAll est atomique : une seule URL en échec fait échouer toute
   l'installation. On met donc chaque ressource en cache individuellement
   pour qu'une icône manquante ne prive pas l'utilisateur du hors-ligne. */
self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_CACHE);
    await Promise.all(APP_ASSETS.map(async url => {
      try {
        const res = await fetch(url, { cache: "reload" });
        if (res && res.ok) await cache.put(url, res);
      } catch (e) { /* ressource optionnelle : on continue */ }
    }));
    await self.skipWaiting();
  })());
});

/* ── Activate ──────────────────────────────── */
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable(); } catch (e) {}
    }
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => k !== APP_CACHE && k !== FONT_CACHE).map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

/* ── Fetch ───────────────────────────────────
   Trois stratégies :
   · navigation  → stale-while-revalidate, pour que les mises à jour
                   se propagent d'elles-mêmes au chargement suivant
   · polices     → cache-first, elles sont immuables
   · reste       → cache-first avec repli réseau */
self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  /* Polices Google — cache-first */
  if (FONT_HOSTS.has(url.hostname)) {
    event.respondWith((async () => {
      const cache = await caches.open(FONT_CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        // On ne met en cache que les réponses exploitables. Les réponses
        // opaques (cors: no-cors) ont un statut 0 et pollueraient le cache.
        if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
        return res;
      } catch (e) {
        return hit || Response.error();
      }
    })());
    return;
  }

  /* Navigation — stale-while-revalidate */
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(APP_CACHE);
      const cached = (await cache.match("./index.html")) || (await cache.match("./"));
      const network = (async () => {
        try {
          const preload = await event.preloadResponse;
          const res = preload || await fetch(req);
          if (res && res.ok) cache.put("./index.html", res.clone());
          return res;
        } catch (e) { return null; }
      })();
      if (cached) { event.waitUntil(network); return cached; }
      const res = await network;
      return res || new Response(
        "<h1>Hors ligne</h1><p>Ouvre l'application une fois connecté pour l'installer.</p>",
        { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 503 }
      );
    })());
    return;
  }

  /* Reste — cache-first */
  if (url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res && res.ok) {
        const cache = await caches.open(APP_CACHE);
        cache.put(req, res.clone());
      }
      return res;
    } catch (e) {
      return Response.error();
    }
  })());
});
