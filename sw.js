/* sw.js — News → Tweet Template Panel — PWA Service Worker (AUTO-UPDATE REAL, HARDENED)
   ✅ Alineado con app.js (tnp-v4.2.0 / 2026-01-12d)
   ✅ GitHub Pages friendly: evita quedarte pegado con app.js viejo
   ✅ NAV/HTML: Network-first (cache fallback)
   ✅ Shell CRÍTICO (index/app/styles/manifest): Network-first + cache:"reload"
   ✅ Shell no crítico: Stale-while-revalidate
   ✅ RSS/feeds/proxies/APIs: Network-first
   ✅ Imágenes/favicons: Stale-while-revalidate
   ✅ Terceros (GIS/Google/etc): Network-only (NO cache) para evitar “pegado” + explosión de cache
   ✅ Limpieza automática de caches antiguos
   ✅ skipWaiting + clients.claim
   ✅ message: SKIP_WAITING / CLEAR_CACHES
   ✅ Anti-explosión: normaliza cache-key quitando ?__tnp= y ?v= (y otros cb comunes)
   ✅ Precache best-effort: member.json + monetization.json (y rutas variantes) sin romper si faltan
*/

"use strict";

/* ───────────────────────────── CONFIG ───────────────────────────── */
const SW_VERSION  = "tnp-v4.2.0";
const SW_BUILD_ID = "2026-01-12d";

const CACHE_PREFIX = "tnp";

const CACHE_SHELL   = `${CACHE_PREFIX}-shell-${SW_VERSION}-${SW_BUILD_ID}`;
const CACHE_RUNTIME = `${CACHE_PREFIX}-runtime-${SW_VERSION}-${SW_BUILD_ID}`;
const CACHE_FEEDS   = `${CACHE_PREFIX}-feeds-${SW_VERSION}-${SW_BUILD_ID}`;
const CACHE_IMAGES  = `${CACHE_PREFIX}-img-${SW_VERSION}-${SW_BUILD_ID}`;

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

  // Config opcional (si existe). No rompe si falta.
  "./config/boot-config.js",

  // ✅ Membership / monetización: probamos varias rutas (best-effort)
  "./member.json",
  "./members.json",
  "./monetization.json",
  "./config/member.json",
  "./config/members.json",
  "./config/monetization.json",

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
function safeUrl(reqUrl) {
  try { return new URL(reqUrl); } catch { return null; }
}

function isSameOrigin(reqUrl) {
  const u = safeUrl(reqUrl);
  return !!u && u.origin === self.location.origin;
}

function pathOf(reqUrl) {
  const u = safeUrl(reqUrl);
  return u ? u.pathname.toLowerCase() : "";
}

function isHtml(req) {
  const acc = req.headers.get("accept") || "";
  return acc.includes("text/html");
}

function isCriticalShellAsset(reqUrl) {
  const p = pathOf(reqUrl);
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
  return p.endsWith(".woff") || p.endsWith(".woff2") || p.endsWith(".ttf") || p.endsWith(".otf");
}

function isFeedLike(reqUrl) {
  const u = safeUrl(reqUrl);
  if (!u) return false;

  const p = u.pathname.toLowerCase();
  const h = u.hostname.toLowerCase();
  const qs = u.search.toLowerCase();

  // Proxies usados por app.js
  if (h.includes("corsproxy.io")) return true;
  if (h.includes("allorigins.win")) return true;
  if (h.includes("codetabs.com")) return true;
  if (h.includes("thingproxy.freeboard.io")) return true;
  if (h.includes("r.jina.ai")) return true;

  // Google News RSS
  if (h.includes("news.google.com") && (p.includes("/rss") || p.endsWith("/rss"))) return true;

  // heurística general RSS/Atom/XML/JSON
  if (p.includes("rss") || p.includes("atom") || p.endsWith(".xml")) return true;
  if (p.endsWith(".json") || qs.includes("format=json") || qs.includes("output=json")) return true;

  return false;
}

function isImageLike(reqUrl) {
  const u = safeUrl(reqUrl);
  if (!u) return false;

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

/* ───────────────────────────── CACHE KEY NORMALIZATION ─────────────────────────────
   IMPORTANT:
   - index.html suele cargar app.js con `?v=...` o app.js mete `?__tnp=...`
   - Si NO normalizamos, se crean MIL entradas
*/
function normalizeCacheKeyRequest(req) {
  try {
    const url = new URL(req.url);

    // Evita que cache-bust cree miles de entradas
    const killParams = ["__tnp", "v", "_", "cb", "ts", "t", "cachebust"];
    for (const k of killParams) {
      if (url.searchParams.has(k)) url.searchParams.delete(k);
    }
    if ([...url.searchParams.keys()].length === 0) url.search = "";

    return new Request(url.toString(), {
      method: "GET",
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

// Terceros (Google GIS, etc.) => NO cache: evita “pegado” y evita llenar caches con opaque
async function networkOnly(req, timeoutMs = 12000, fetchCacheMode = "no-store") {
  const { ctrl, cancel } = withTimeout(timeoutMs);
  try {
    const res = await fetch(req, { signal: ctrl.signal, cache: fetchCacheMode });
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

  // "cache: reload" fuerza a ir a red en instalación (si hay red)
  const requests = SHELL_ASSETS.map((u) => {
    try { return new Request(u, { cache: "reload" }); }
    catch { return u; }
  });

  await Promise.allSettled(requests.map((r) => cache.add(r)));
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

    // Aviso opcional a clientes
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of clients) {
      try { c.postMessage({ type: "SW_ACTIVATED", version: SW_VERSION, build: SW_BUILD_ID }); } catch {}
    }
  })());
});

self.addEventListener("message", (event) => {
  const msg = event.data || {};
  if (!msg || typeof msg !== "object") return;

  if (msg.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (msg.type === "CLEAR_CACHES") {
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
  if (!req || req.method !== "GET") return;

  const u = safeUrl(req.url);
  if (!u) return;
  if (u.protocol !== "http:" && u.protocol !== "https:") return;

  const url = req.url;
  const same = isSameOrigin(url);

  // NAVIGATION / HTML
  if (req.mode === "navigate" || (same && isHtml(req))) {
    event.respondWith((async () => {
      // HTML: online -> fresh (reload) | offline -> cache
      const fresh = await networkFirst(req, CACHE_RUNTIME, 12000, "reload");
      if (fresh && fresh.ok) return fresh;

      const shell = await caches.open(CACHE_SHELL);
      return (
        (await shell.match(normalizeCacheKeyRequest(new Request("./index.html")))) ||
        (await shell.match(normalizeCacheKeyRequest(new Request("./")))) ||
        new Response("Offline", { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } })
      );
    })());
    return;
  }

  // SAME-ORIGIN: Shell CRÍTICO (siempre red primero)
  if (same && isCriticalShellAsset(url)) {
    event.respondWith(networkFirst(req, CACHE_SHELL, 15000, "reload"));
    return;
  }

  // SAME-ORIGIN: otros shell assets (SWR)
  if (same && isShellAsset(url)) {
    event.respondWith(staleWhileRevalidate(req, CACHE_SHELL, 15000, "no-store"));
    return;
  }

  // FONTS (cache-first) — solo same-origin
  if (same && isFontAsset(url)) {
    event.respondWith(cacheFirst(req, CACHE_SHELL, 15000, "no-store"));
    return;
  }

  // FEEDS / APIs / PROXIES (incluye cross-origin)
  if (isFeedLike(url)) {
    event.respondWith(networkFirst(req, CACHE_FEEDS, 16000, "no-store"));
    return;
  }

  // IMAGES / FAVICONS (incluye cross-origin)
  if (isImageLike(url)) {
    event.respondWith(staleWhileRevalidate(req, CACHE_IMAGES, 16000, "no-store"));
    return;
  }

  // CROSS-ORIGIN: por defecto NO cache (evita GIS/third-party “pegado” + cache gigante)
  if (!same) {
    event.respondWith(networkOnly(req, 15000, "no-store"));
    return;
  }

  // RESTO same-origin
  event.respondWith(staleWhileRevalidate(req, CACHE_RUNTIME, 15000, "no-store"));
});
