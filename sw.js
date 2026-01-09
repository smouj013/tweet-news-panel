/* sw.js — News → Tweet Template Panel (tnp-v4.0.1) — PWA Service Worker (AUTO-UPDATE + HARDENED)
   ✅ Offline-first para shell (HTML/CSS/JS/manifest/icons)
   ✅ Network-first para RSS/feeds/APIs (si falla: cache)
   ✅ Stale-while-revalidate para imágenes/favicons
   ✅ Limpieza automática de caches antiguos
   ✅ AUTO-UPDATE REAL:
      - skipWaiting() en install
      - clients.claim() en activate
      - “update check” en background en cada navegación (registration.update())
      - (opcional y por defecto ON) soft-reload de pestañas al activar SW nuevo
        * si no quieres auto-reload: pon AUTO_RELOAD_ON_ACTIVATE = false
*/

"use strict";

/* ───────────────────────────── VERSIONING ───────────────────────────── */
/* Mantengo tu versión para compat con app.js (si tú decides subirla, cambiará cache-names) */
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

/* Auto-recarga al activar el SW nuevo (para que se note “al instante” sin tocar app.js) */
const AUTO_RELOAD_ON_ACTIVATE = true;
/* Solo recarga pestañas de tu origen (seguridad) */
const RELOAD_SAME_ORIGIN_ONLY = true;

/* ───────────────────────────── SHELL ───────────────────────────── */
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

/* ───────────────────────────── UTIL ───────────────────────────── */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

function withTimeout(timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  return { ctrl, cancel: () => clearTimeout(t) };
}

function isRangeRequest(req) {
  // Evita cachear peticiones parciales (p.ej. video/audio/range)
  return !!req.headers.get("range");
}

function offlineText(statusText = "Offline") {
  return new Response(statusText, {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" }
  });
}

/* ───────────────────────────── STRATEGIES ───────────────────────────── */
async function networkFirst(req, cacheName, timeoutMs = 9000) {
  const cache = await caches.open(cacheName);
  const { ctrl, cancel } = withTimeout(timeoutMs);

  try {
    const res = await fetch(req, { signal: ctrl.signal, cache: "no-store" });

    // Cachea solo si ok (y también opaque ok-ish si quieres: aquí lo cacheamos si existe)
    if (res && (res.ok || res.type === "opaque")) {
      try { cache.put(req, res.clone()); } catch {}
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
    if (res && (res.ok || res.type === "opaque")) {
      try { cache.put(req, res.clone()); } catch {}
    }
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
    if (res && (res.ok || res.type === "opaque")) {
      try { cache.put(req, res.clone()); } catch {}
    }
    return res;
  } catch {
    return new Response("", { status: 504, statusText: "Offline" });
  } finally {
    cancel();
  }
}

/* ───────────────────────────── INSTALL / ACTIVATE ───────────────────────────── */
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_SHELL);

    // precache best-effort
    await Promise.allSettled(SHELL_ASSETS.map((u) => cache.add(u)));

    // Activa rápido el SW nuevo
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Habilita navigation preload si existe (mejora perf en navegaciones)
    try {
      if (self.registration && self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
    } catch {}

    // Limpia caches antiguos del proyecto
    const keys = await caches.keys();
    const keepExact = new Set([CACHE_SHELL, CACHE_RUNTIME, CACHE_FEEDS, CACHE_IMAGES]);

    await Promise.allSettled(keys.map(async (k) => {
      const isOurs = CACHE_KEEP_PREFIXES.some(pref => k.startsWith(pref));
      if (isOurs && !keepExact.has(k)) {
        await caches.delete(k);
      }
    }));

    // Toma control
    await self.clients.claim();

    // Notifica a pestañas (por si luego quieres escucharlo en app.js)
    try {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of clients) {
        try { c.postMessage({ type: "SW_ACTIVATED", version: SW_VERSION }); } catch {}
      }
    } catch {}

    // Auto-reload (para “actualización automática visible” sin tocar app.js)
    if (AUTO_RELOAD_ON_ACTIVATE) {
      try {
        const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const c of clients) {
          try {
            if (RELOAD_SAME_ORIGIN_ONLY) {
              const same = isSameOrigin(c.url);
              if (!same) continue;
            }
            // navigate refresca la pestaña con el SW ya activo
            await c.navigate(c.url);
          } catch {}
          await sleep(120);
        }
      } catch {}
    }
  })());
});

/* ───────────────────────────── UPDATE / CONTROL ─────────────────────────────
   Si en algún momento lo quieres “a mano” desde app.js:
   navigator.serviceWorker.controller?.postMessage({ type:"SKIP_WAITING" })
*/
self.addEventListener("message", (event) => {
  const msg = event.data || {};
  if (msg && msg.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  if (msg && msg.type === "CLIENTS_RELOAD") {
    event.waitUntil((async () => {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of clients) {
        try { await c.navigate(c.url); } catch {}
        await sleep(150);
      }
    })());
  }
});

/* ───────────────────────────── FETCH ROUTER ───────────────────────────── */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Evita cachear ranges
  if (isRangeRequest(req)) return;

  const url = req.url;
  const same = isSameOrigin(url);

  // En cada navegación, pedimos update del SW en background (auto-update real)
  // (No bloquea la respuesta)
  const maybeUpdate = () => {
    try {
      if (self.registration && typeof self.registration.update === "function") {
        return self.registration.update();
      }
    } catch {}
    return null;
  };

  // 1) NAVIGATION: network-first con fallback a index.html del shell
  if (req.mode === "navigate" || (same && isHtml(req))) {
    event.waitUntil(Promise.resolve(maybeUpdate()));

    event.respondWith((async () => {
      // Si hay navigation preload, úsalo primero (si existe)
      try {
        const preload = await event.preloadResponse;
        if (preload) {
          // cachea también la navegación en runtime
          try {
            const cache = await caches.open(CACHE_RUNTIME);
            cache.put(req, preload.clone());
          } catch {}
          return preload;
        }
      } catch {}

      const fresh = await networkFirst(req, CACHE_RUNTIME, 9000);
      if (fresh && fresh.ok) return fresh;

      const cache = await caches.open(CACHE_SHELL);
      return (await cache.match("./index.html")) ||
             (await cache.match("./")) ||
             offlineText("Offline");
    })());
    return;
  }

  // 2) SHELL ASSETS (same-origin): cache-first
  if (same && isAsset(url)) {
    event.respondWith(cacheFirst(req, CACHE_SHELL, 12000));
    return;
  }

  // 3) FEEDS/APIs/proxies/translate: network-first
  if (isFeedLike(url)) {
    event.respondWith(networkFirst(req, CACHE_FEEDS, 14000));
    return;
  }

  // 4) IMAGES / favicons: stale-while-revalidate
  if (isImageLike(url)) {
    event.respondWith(staleWhileRevalidate(req, CACHE_IMAGES, 14000));
    return;
  }

  // 5) RESTO: runtime SWR
  event.respondWith(staleWhileRevalidate(req, CACHE_RUNTIME, 12000));
});
