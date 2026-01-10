/* sw.js — News → Tweet Template Panel (tnp-v4.1.1) — PWA Service Worker (AUTO-UPDATE REAL, HARDENED)
   ✅ Objetivo real: que SI cambias app.js/styles/index SIN tocar versión, el usuario recargue y vea lo nuevo (online).
   ✅ NAV/HTML: Network-first (cache fallback)
   ✅ Shell CRÍTICO (index.html, app.js, styles.css, manifest): Network-first (cache fallback) + fetch cache:"reload"
      -> evita quedarte “pegado” con un app.js viejo servido desde cache del SW.
   ✅ Shell NO crítico (otros .css/.js/.json): Stale-while-revalidate
   ✅ RSS/feeds/proxies/APIs: Network-first (cache fallback)
   ✅ Imágenes/favicons: Stale-while-revalidate
   ✅ Limpieza automática de caches antiguos
   ✅ skipWaiting + clients.claim
   ✅ message: SKIP_WAITING / CLEAR_CACHES
   ✅ Anti-explosión de cache: normaliza cache-key quitando ?__tnp= (cache-bust de app.js)
*/

"use strict";

/* ───────────────────────────── CONFIG ───────────────────────────── */
const SW_VERSION = "tnp-v4.1.1";
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

// OJO: si algo no existe, no rompe (allSettled)
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",

  "./assets/icons/favicon-32.png",
  "./assets/icons/apple-touch-icon-152.png",
  "./assets/icons/apple-touch-icon-167.png",
  "./assets/icons/apple-touch-icon-180.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-192-maskable.png",
  "./assets/icons/icon-512-maskable.png",
];

/* ───────────────────────────── URL HELPERS ───────────────────────────── */
function isSameOrigin(reqUrl) {
  try { return new URL(reqUrl).origin === self.location.origin; } catch { return false; }
}

function pathOf(reqUrl) {
  try { return new URL(reqUrl).pathname.toLowerCase(); } catch { return ""; }
}

function isHtml(req) {
  const acc = req.headers.get("accept") || "";
  return acc.includes("text/html");
}

function isCriticalShellAsset(reqUrl) {
  const p = pathOf(reqUrl);
  // IMPORTANT: aquí priorizamos “siempre fresco cuando online”
  // (resuelve el típico “me quedé con app.js viejo”)
  return (
    p.endsWith("/") ||
    p.endsWith("/index.html") ||
    p.endsWith("/app.js") ||
    p.endsWith("/styles.css") ||
    p.endsWith("/manifest.webmanifest")
  );
}

function isShellAsset(reqUrl) {
  const p = pathOf(reqUrl);

  // Evita tocar el propio sw.js en fetch handler (la update del SW la gestiona el browser)
  if (p.endsWith("/sw.js")) return false;

  return (
    p.endsWith("/") ||
    p.endsWith("/index.html") ||
    p.endsWith(".html") ||
    p.endsWith(".js") ||
    p.endsWith(".css") ||
    p.endsWith(".webmanifest") ||
    p.endsWith(".json")
  );
}

function isFontAsset(reqUrl) {
  const p = pathOf(reqUrl);
  return (p.endsWith(".woff") || p.endsWith(".woff2") || p.endsWith(".ttf") || p.endsWith(".otf"));
}

function isFeedLike(reqUrl) {
  let u;
  try { u = new URL(reqUrl); } catch { return false; }

  const p = u.pathname.toLowerCase();
  const h = u.hostname.toLowerCase();
  const qs = u.search.toLowerCase();

  // proxies usados por app.js
  if (h.includes("allorigins.win")) return true;
  if (h.includes("codetabs.com")) return true;
  if (h.includes("thingproxy.freeboard.io")) return true;

  // Google News RSS
  if (h.includes("news.google.com") && (p.includes("/rss") || p.endsWith("/rss"))) return true;

  // heurística general RSS/Atom/XML/JSON
  if (p.includes("rss") || p.includes("atom") || p.endsWith(".xml")) return true;
  if (p.endsWith(".json") || qs.includes("format=json") || qs.includes("output=json")) return true;

  return false;
}

function isImageLike(reqUrl) {
  let u;
  try { u = new URL(reqUrl); } catch { return false; }

  const p = u.pathname.toLowerCase();
  const h = u.hostname.toLowerCase();

  // favicons endpoint
  if (h.includes("google.com") && p.includes("/s2/favicons")) return true;

  return (
    p.endsWith(".png") || p.endsWith(".jpg") || p.endsWith(".jpeg") ||
    p.endsWith(".webp") || p.endsWith(".gif") || p.endsWith(".svg") ||
    p.endsWith(".ico") || p.endsWith(".avif")
  );
}

/* ───────────────────────────── CACHE KEY NORMALIZATION ───────────────────────────── */
function normalizeCacheKeyRequest(req) {
  // Para evitar que ?__tnp= (cache-bust) te cree 5000 entradas
  // (tu app.js mete __tnp para forzar fresh en proxies)
  try {
    const url = new URL(req.url);

    if (url.searchParams.has("__tnp")) {
      url.searchParams.delete("__tnp");
      // si queda sin params, limpia el "?"
      if ([...url.searchParams.keys()].length === 0) url.search = "";
    }

    // también normaliza algunas basuras comunes (por si acaso)
    if (url.searchParams.has("_")) url.searchParams.delete("_");
    if (url.searchParams.has("cb")) url.searchParams.delete("cb");
    if ([...url.searchParams.keys()].length === 0) url.search = "";

    // No copiamos headers: el cache key depende de URL + método principalmente.
    // Preservamos method GET.
    return new Request(url.toString(), {
      method: "GET",
      // para cross-origin, omit evita problemas raros; same-origin mantiene credenciales si hiciera falta
      credentials: isSameOrigin(url.toString()) ? "same-origin" : "omit",
      redirect: "follow",
    });
  } catch {
    return req;
  }
}

/* ───────────────────────────── TIMEOUT ───────────────────────────── */
function withTimeout(timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort("timeout"), timeoutMs);
  return { ctrl, cancel: () => clearTimeout(t) };
}

/* ───────────────────────────── CACHE PUT SAFE ───────────────────────────── */
async function putIfCacheable(cache, cacheKeyReq, res) {
  try {
    if (!res) return;
    // Guardamos ok y también opaque (sirve para algunos proxies/imagenes)
    if (res.ok || res.type === "opaque") {
      await cache.put(cacheKeyReq, res.clone());
    }
  } catch {
    // ignore quota / opaque restrictions / etc.
  }
}

/* ───────────────────────────── STRATEGIES ───────────────────────────── */
async function networkFirst(req, cacheName, timeoutMs = 9000, fetchCacheMode = "no-store") {
  const cache = await caches.open(cacheName);
  const cacheKeyReq = normalizeCacheKeyRequest(req);

  const { ctrl, cancel } = withTimeout(timeoutMs);

  try {
    const res = await fetch(req, { signal: ctrl.signal, cache: fetchCacheMode });
    if (res) {
      if (res.ok || res.type === "opaque") await putIfCacheable(cache, cacheKeyReq, res);
      if (res.ok) return res;
    }
    const cached = await cache.match(cacheKeyReq);
    return cached || res || new Response("", { status: 504, statusText: "Offline" });
  } catch {
    const cached = await cache.match(cacheKeyReq);
    return cached || new Response("", { status: 504, statusText: "Offline" });
  } finally {
    cancel();
  }
}

async function staleWhileRevalidate(req, cacheName, timeoutMs = 12000, fetchCacheMode = "no-store") {
  const cache = await caches.open(cacheName);
  const cacheKeyReq = normalizeCacheKeyRequest(req);

  const cached = await cache.match(cacheKeyReq);

  const { ctrl, cancel } = withTimeout(timeoutMs);
  const refresh = fetch(req, { signal: ctrl.signal, cache: fetchCacheMode })
    .then(async (res) => {
      if (res && (res.ok || res.type === "opaque")) await putIfCacheable(cache, cacheKeyReq, res);
      return res;
    })
    .catch(() => null)
    .finally(cancel);

  return cached || (await refresh) || new Response("", { status: 504, statusText: "Offline" });
}

async function cacheFirst(req, cacheName, timeoutMs = 12000, fetchCacheMode = "no-store") {
  const cache = await caches.open(cacheName);
  const cacheKeyReq = normalizeCacheKeyRequest(req);

  const cached = await cache.match(cacheKeyReq);
  if (cached) return cached;

  const { ctrl, cancel } = withTimeout(timeoutMs);
  try {
    const res = await fetch(req, { signal: ctrl.signal, cache: fetchCacheMode });
    if (res && (res.ok || res.type === "opaque")) await putIfCacheable(cache, cacheKeyReq, res);
    return res || new Response("", { status: 504, statusText: "Offline" });
  } catch {
    return new Response("", { status: 504, statusText: "Offline" });
  } finally {
    cancel();
  }
}

/* ───────────────────────────── PRECACHE ───────────────────────────── */
async function precacheShell() {
  const cache = await caches.open(CACHE_SHELL);

  // "cache: reload" fuerza a ir a red (cuando se instala el SW)
  const requests = SHELL_ASSETS.map((u) => {
    try { return new Request(u, { cache: "reload" }); }
    catch { return u; }
  });

  await Promise.allSettled(
    requests.map((r) => cache.add(r))
  );
}

/* ───────────────────────────── LIFECYCLE ───────────────────────────── */
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    await precacheShell();
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Limpia caches antiguos (solo los nuestros)
    const keys = await caches.keys();
    const keepExact = new Set([CACHE_SHELL, CACHE_RUNTIME, CACHE_FEEDS, CACHE_IMAGES]);

    await Promise.allSettled(keys.map(async (k) => {
      const isOurs = CACHE_KEEP_PREFIXES.some((pref) => k.startsWith(pref));
      if (isOurs && !keepExact.has(k)) {
        await caches.delete(k);
      }
    }));

    await self.clients.claim();

    // Aviso opcional
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of clients) {
      try { c.postMessage({ type: "SW_ACTIVATED", version: SW_VERSION }); } catch {}
    }
  })());
});

self.addEventListener("message", (event) => {
  const msg = event.data || {};
  if (msg && msg.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  if (msg && msg.type === "CLEAR_CACHES") {
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.allSettled(keys.map((k) => {
        const isOurs = CACHE_KEEP_PREFIXES.some((pref) => k.startsWith(pref));
        return isOurs ? caches.delete(k) : Promise.resolve();
      }));
    })());
  }
});

/* ───────────────────────────── FETCH ROUTER ───────────────────────────── */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = req.url;
  const same = isSameOrigin(url);

  // NAVIGATION / HTML
  if (req.mode === "navigate" || (same && isHtml(req))) {
    event.respondWith((async () => {
      // HTML: online -> fresh (reload) | offline -> cache
      const fresh = await networkFirst(req, CACHE_RUNTIME, 9000, "reload");
      if (fresh && fresh.ok) return fresh;

      const shell = await caches.open(CACHE_SHELL);

      // Fallback robusto
      return (
        (await shell.match(normalizeCacheKeyRequest(new Request("./index.html")))) ||
        (await shell.match(normalizeCacheKeyRequest(new Request("./")))) ||
        new Response("Offline", { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } })
      );
    })());
    return;
  }

  // SAME-ORIGIN: Shell CRÍTICO (SIEMPRE intento red primero)
  if (same && isCriticalShellAsset(url)) {
    // cache:"reload" = “quiero lo nuevo cuando online”
    event.respondWith(networkFirst(req, CACHE_SHELL, 12000, "reload"));
    return;
  }

  // SAME-ORIGIN: otros shell assets (SWR)
  if (same && isShellAsset(url)) {
    event.respondWith(staleWhileRevalidate(req, CACHE_SHELL, 12000, "no-store"));
    return;
  }

  // FONTS
  if (same && isFontAsset(url)) {
    event.respondWith(cacheFirst(req, CACHE_SHELL, 12000, "no-store"));
    return;
  }

  // FEEDS / APIs / PROXIES
  if (isFeedLike(url)) {
    event.respondWith(networkFirst(req, CACHE_FEEDS, 14000, "no-store"));
    return;
  }

  // IMAGES / FAVICONS
  if (isImageLike(url)) {
    event.respondWith(staleWhileRevalidate(req, CACHE_IMAGES, 14000, "no-store"));
    return;
  }

  // RESTO
  event.respondWith(staleWhileRevalidate(req, CACHE_RUNTIME, 12000, "no-store"));
});
