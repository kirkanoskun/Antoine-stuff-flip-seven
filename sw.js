/* ═══════════════════════════════════════════
   Flip 7 — Service Worker
   ═══════════════════════════════════════════
   Bump APP_CACHE à chaque livraison : sans ça, les utilisateurs ayant
   installé la PWA resteraient bloqués sur l'ancienne version. */
const VERSION   = "v4";
const APP_CACHE = `flip7-app-${VERSION}`;

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
  // Polices auto-hébergées. On ne précache que le sous-ensemble latin :
  // latin-ext n'est demandé que si un prénom l'exige, et le gestionnaire
  // « cache-first » ci-dessous le conservera à ce moment-là.
  "./fonts/nunito-latin.woff2",
  "./fonts/fredoka-latin.woff2",
];

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
    // Tout ce qui n'est pas le cache courant part, y compris l'ancien cache
    // des polices Google, devenu inutile depuis leur auto-hébergement.
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== APP_CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

/* ── Fetch ───────────────────────────────────
   Deux stratégies. Toutes les ressources sont désormais servies depuis
   la même origine : il n'y a plus aucune requête externe à intercepter.
   · navigation  → stale-while-revalidate, pour que les mises à jour
                   se propagent d'elles-mêmes au chargement suivant
   · reste       → cache-first avec repli réseau (polices comprises) */
self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

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
