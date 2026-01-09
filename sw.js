/* sw.js — News → Tweet Template Panel (tnp-v4.0.1) — PWA Service Worker
   ✅ Offline-first para shell (HTML/CSS/JS/manifest/icons)
   ✅ Network-first para RSS/feeds (si falla: cache)
   ✅ Stale-while-revalidate para imágenes y favicons
   ✅ Limpieza automática de caches antiguos
*/

"use strict";

const SW_VERSION = "tnp-v4.0.1";
const CACHE_PREFIX = "tnp";
const CACHE_SHELL = `${CACHE_PREFIX}-shell-${SW_VERSION}`;
const CACHE_RUNTIME = `${CACHE_PREFIX}-runtime-${SW_VERSION}`;
const CACHE_FEEDS = `${CACHE_PREFIX}-feeds-${SW_VERSION}`;
const CACHE_IMAGES = `${CACHE_PREFIX}-img-${SW_VERSION}`;

const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-192-maskable.png",
  "./assets/icons/icon-512-maskable.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_SHELL);
    await Promise.allSettled(SHELL_ASSETS.map((u) => cache.add(u)));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const keep = new Set([CACHE_SHELL, CACHE_RUNTIME, CACHE_FEEDS, CACHE_IMAGES]);
    await Promise.allSettled(keys.map((k) => (keep.has(k) ? null : caches.delete(k))));
    await self.clients.claim();
  })());
});

function isSameOrigin(reqUrl) {
  try { return new URL(reqUrl).origin === self.location.origin; } catch { return false; }
}
function isHtml(req) {
  const acc = req.headers.get("accept") || "";
  return acc.includes("text/html");
}
function isAsset(reqUrl) {
  const p = new URL(reqUrl).pathname;
  return (
    p.endsWith(".js") || p.endsWith(".css") || p.endsWith(".html") ||
    p.endsWith(".webmanifest") || p.endsWith(".json") ||
    p.endsWith(".png") || p.endsWith(".svg") || p.endsWith(".ico") ||
    p.endsWith(".woff") || p.endsWith(".woff2")
  );
}
function isFeedLike(reqUrl) {
  const u = new URL(reqUrl);
  const p = u.pathname.toLowerCase();
  const h = u.hostname.toLowerCase();
  const qs = u.search.toLowerCase();

  if (h.includes("allorigins.win")) return true;
  if (h.includes("r.jina.ai")) return true;
  if (h.includes("translate.googleapis.com")) return true;
  if (h.includes("news.google.com") && p.includes("/rss")) return true;
  if (h.includes("api.gdeltproject.org")) return true;

  if (p.includes("rss") || p.includes("atom") || p.endsWith(".xml")) return true;
  if (p.endsWith(".json") || qs.includes("format=json") || qs.includes("output=json")) return true;

  return false;
}
function isImageLike(reqUrl) {
  const u = new URL(reqUrl);
  const p = u.pathname.toLowerCase();
  const h = u.hostname.toLowerCase();
  if (h.includes("google.com") && p.includes("/s2/favicons")) return true;
  return (
    p.endsWith(".png") || p.endsWith(".jpg") || p.endsWith(".jpeg") ||
    p.endsWith(".webp") || p.endsWith(".gif") || p.endsWith(".svg") ||
    p.endsWith(".ico")
  );
}

async function networkFirst(req, cacheName, timeoutMs = 8000) {
  const cache = await caches.open(cacheName);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(req, { signal: ctrl.signal });
    if (res && res.ok) {
      cache.put(req, res.clone());
      return res;
    }
    const cached = await cache.match(req);
    return cached || res;
  } catch {
    const cached = await cache.match(req);
    return cached || new Response("", { status: 504, statusText: "Offline" });
  } finally {
    clearTimeout(t);
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);

  const fetchPromise = fetch(req).then((res) => {
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  }).catch(() => null);

  return cached || (await fetchPromise) || new Response("", { status: 504, statusText: "Offline" });
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res && res.ok) cache.put(req, res.clone());
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = req.url;
  const same = isSameOrigin(url);

  // 1) Navegación: network-first con fallback a index.html
  if (req.mode === "navigate" || (same && isHtml(req))) {
    event.respondWith((async () => {
      try {
        const fresh = await networkFirst(req, CACHE_RUNTIME, 8000);
        if (fresh && fresh.ok) return fresh;
      } catch {}
      const cache = await caches.open(CACHE_SHELL);
      return (await cache.match("./index.html")) || (await cache.match("./")) || new Response("Offline", { status: 200 });
    })());
    return;
  }

  // 2) Assets locales: cache-first
  if (same && isAsset(url)) {
    event.respondWith(cacheFirst(req, CACHE_SHELL));
    return;
  }

  // 3) Feeds/APIs/proxies: network-first
  if (isFeedLike(url)) {
    event.respondWith(networkFirst(req, CACHE_FEEDS, 12000));
    return;
  }

  // 4) Imágenes/favicons: SWR
  if (isImageLike(url)) {
    event.respondWith(staleWhileRevalidate(req, CACHE_IMAGES));
    return;
  }

  // 5) Resto: runtime SWR
  event.respondWith(staleWhileRevalidate(req, CACHE_RUNTIME));
});
