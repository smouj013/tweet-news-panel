/* sw.js — News → Tweet Template Panel (tnp-v4.0.1) — PWA Service Worker (AUTO-UPDATE READY)
   ✅ Offline-first para shell (HTML/CSS/JS/manifest/icons)
   ✅ Network-first para RSS/feeds/APIs (si falla: cache)
   ✅ Stale-while-revalidate para imágenes/favicons
   ✅ Limpieza automática de caches antiguos
   ✅ Soporta SKIP_WAITING (la app lo envía) => update instantáneo
   ✅ Compat con index.html + styles.css actualizados (ticker/popticker no requiere nada extra)
*/

"use strict";

const SW_VERSION = "tnp-v4.0.1";
const CACHE_PREFIX = "tnp";

const CACHE_SHELL   = `${CACHE_PREFIX}-shell-${SW_VERSION}`;
const CACHE_RUNTIME = `${CACHE_PREFIX}-runtime-${SW_VERSION}`;
const CACHE_FEEDS   = `${CACHE_PREFIX}-feeds-${SW_VERSION}`;
const CACHE_IMAGES  = `${CACHE_PREFIX}-img-${SW_VERSION}`;

const CACHE_KEEP_PREFIXES = [
  `${CACHE_PREFIX}-shell-`,
  `${CACHE_PREFIX}-runtime-`,
  `${CACHE_PREFIX}-feeds-`,
  `${CACHE_PREFIX}-img-`,
];

/**
 * Importante:
 * - Si algún icon no existe en tu repo, NO rompe: usamos Promise.allSettled.
 * - Rutas relativas " ./ " funcionan bien en GitHub Pages.
 */
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",

  // Icons (si están, se cachean; si no, se ignoran sin romper)
  "./assets/icons/favicon-32.png",
  "./assets/icons/apple-touch-icon-152.png",
  "./assets/icons/apple-touch-icon-167.png",
  "./assets/icons/apple-touch-icon-180.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-192-maskable.png",
  "./assets/icons/icon-512-maskable.png",
];

function isSameOrigin(reqUrl) {
  try { return new URL(reqUrl).origin === self.location.origin; } catch { return false; }
}

function isHtml(req) {
  const acc = req.headers.get("accept") || "";
  return acc.includes("text/html");
}

function isAsset(reqUrl) {
  const p = new URL(reqUrl).pathname.toLowerCase();
  return (
    p.endsWith(".js") || p.endsWith(".css") || p.endsWith(".html") ||
    p.endsWith(".webmanifest") || p.endsWith(".json") ||
    p.endsWith(".png") || p.endsWith(".svg") || p.endsWith(".ico") ||
    p.endsWith(".woff") || p.endsWith(".woff2") || p.endsWith(".ttf")
  );
}

function isFeedLike(reqUrl) {
  const u = new URL(reqUrl);
  const p = u.pathname.toLowerCase();
  const h = u.hostname.toLowerCase();
  const qs = u.search.toLowerCase();

  // proxies / helpers usados por app.js
  if (h.includes("allorigins.win")) return true;
  if (h.includes("r.jina.ai")) return true;
  if (h.includes("translate.googleapis.com")) return true;

  // Google News RSS
  if (h.includes("news.google.com") && p.includes("/rss")) return true;

  // GDELT JSON
  if (h.includes("api.gdeltproject.org")) return true;

  // heurística general RSS/Atom/JSON
  if (p.includes("rss") || p.includes("atom") || p.endsWith(".xml")) return true;
  if (p.endsWith(".json") || qs.includes("format=json") || qs.includes("output=json")) return true;

  return false;
}

function isImageLike(reqUrl) {
  const u = new URL(reqUrl);
  const p = u.pathname.toLowerCase();
  const h = u.hostname.toLowerCase();

  // favicons endpoint
  if (h.includes("google.com") && p.includes("/s2/favicons")) return true;

  return (
    p.endsWith(".png") || p.endsWith(".jpg") || p.endsWith(".jpeg") ||
    p.endsWith(".webp") || p.endsWith(".gif") || p.endsWith(".svg") ||
    p.endsWith(".ico")
  );
}

function withTimeout(timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  return { ctrl, cancel: () => clearTimeout(t) };
}

async function networkFirst(req, cacheName, timeoutMs = 9000) {
  const cache = await caches.open(cacheName);
  const { ctrl, cancel } = withTimeout(timeoutMs);

  try {
    const res = await fetch(req, { signal: ctrl.signal, cache: "no-store" });
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
    cancel();
  }
}

async function staleWhileRevalidate(req, cacheName, timeoutMs = 12000) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);

  const { ctrl, cancel } = withTimeout(timeoutMs);
  const refresh = fetch(req, { signal: ctrl.signal }).then((res) => {
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  }).catch(() => null).finally(cancel);

  return cached || (await refresh) || new Response("", { status: 504, statusText: "Offline" });
}

async function cacheFirst(req, cacheName, timeoutMs = 12000) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;

  const { ctrl, cancel } = withTimeout(timeoutMs);
  try {
    const res = await fetch(req, { signal: ctrl.signal });
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } finally {
    cancel();
  }
}

async function precacheShell() {
  const cache = await caches.open(CACHE_SHELL);

  // "cache: reload" fuerza a traer la versión nueva del server cuando instalas SW
  const requests = SHELL_ASSETS.map((u) => {
    try {
      return new Request(u, { cache: "reload" });
    } catch {
      return u;
    }
  });

  await Promise.allSettled(requests.map((r) => cache.add(r)));
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    await precacheShell();
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const keepExact = new Set([CACHE_SHELL, CACHE_RUNTIME, CACHE_FEEDS, CACHE_IMAGES]);

    await Promise.allSettled(keys.map(async (k) => {
      const isOurs = CACHE_KEEP_PREFIXES.some((pref) => k.startsWith(pref));
      if (isOurs && !keepExact.has(k)) await caches.delete(k);
    }));

    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  const msg = event.data || {};
  if (msg && msg.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = req.url;
  const same = isSameOrigin(url);

  // NAVIGATION (SPA-ish fallback a index.html)
  if (req.mode === "navigate" || (same && isHtml(req))) {
    event.respondWith((async () => {
      const fresh = await networkFirst(req, CACHE_RUNTIME, 9000);
      if (fresh && fresh.ok) return fresh;

      const cache = await caches.open(CACHE_SHELL);
      return (await cache.match("./index.html")) ||
             (await cache.match("./")) ||
             new Response("Offline", { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } });
    })());
    return;
  }

  // SHELL assets same-origin
  if (same && isAsset(url)) {
    event.respondWith(cacheFirst(req, CACHE_SHELL, 12000));
    return;
  }

  // FEEDS/APIs (network-first)
  if (isFeedLike(url)) {
    event.respondWith(networkFirst(req, CACHE_FEEDS, 14000));
    return;
  }

  // IMAGES/FAVICONS (SWR)
  if (isImageLike(url)) {
    event.respondWith(staleWhileRevalidate(req, CACHE_IMAGES, 14000));
    return;
  }

  // REST (SWR)
  event.respondWith(staleWhileRevalidate(req, CACHE_RUNTIME, 12000));
});
