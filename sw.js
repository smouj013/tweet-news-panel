/* sw.js — TNP Service Worker v4.1.1 — Stable Cache + PURGE + SKIP_WAITING */
const SW_VERSION = "tnp-sw-v4.1.1";
const CACHE_STATIC = `tnp-static-${SW_VERSION}`;

const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./assets/icons/favicon-32.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_STATIC);
    await cache.addAll(PRECACHE_URLS);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => {
      if (k.startsWith("tnp-static-") && k !== CACHE_STATIC) return caches.delete(k);
      return Promise.resolve();
    }));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  if (data.type === "PURGE_CACHES") {
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    })());
    return;
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Navegación: fallback a index
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_STATIC);
      const cached = await cache.match("./index.html");
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) cache.put("./index.html", fresh.clone());
        return fresh;
      } catch {
        return cached || new Response("Offline", { status: 503 });
      }
    })());
    return;
  }

  // Solo cacheamos same-origin estáticos
  if (url.origin !== self.location.origin) return;

  // Stale-while-revalidate
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_STATIC);
    const cached = await cache.match(req);

    const fetchPromise = fetch(req).then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => cached);

    return cached || fetchPromise;
  })());
});
