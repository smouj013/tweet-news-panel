/* config/boot-config.js — TNP BOOT CONFIG (AUTH + MEMBERSHIP)
   ✅ No sube versión.
   ✅ Compatible con app.js actual (lee window.TNP_CONFIG)
   ✅ Alias compat: __TNP_BOOT__ / TNP_BOOT_CONFIG
   ✅ Fix: allowlistUrl apunta a member.json (suscripciones)
*/

(() => {
  "use strict";

  // ─────────────────────────────────────────────────────────────────────────────
  // Build / Tag (cache-bust coherente con index.html / sw.js)
  // ─────────────────────────────────────────────────────────────────────────────
  const APP_VERSION = "tnp-v4.2.0";
  const BUILD_ID = "2026-01-12d";
  const BUILD_TAG = "tnp-v4.2.0_2026-01-12d";

  // Base para JSON (si están en raíz, deja "./")
  // Si los mueves a /config/, usa: "./config/"
  const CONFIG_BASE = "./";

  // ─────────────────────────────────────────────────────────────────────────────
  // URLs externas / donaciones
  // ─────────────────────────────────────────────────────────────────────────────
  const KOFI_URL = "https://ko-fi.com/global_eye";

  // ✅ TU CLIENT ID (GIS) (el que ya tenías en tu boot-config real)
  const GOOGLE_CLIENT_ID =
    "96486611781-9o20cpbk3vqt0r5qb6deifmjvk10sk67.apps.googleusercontent.com";

  window.TNP_CONFIG = {
    // Debe coincidir con tu deploy (cache-bust coherente con index.html / sw.js)
    buildTag: BUILD_TAG,

    /* ───────────────────────────── CONFIG URLS (JSON) ───────────────────────── */
    network: {
      proxiesUrl: `${CONFIG_BASE}tnp.proxies.json`,
      feedsDefaultsUrl: `${CONFIG_BASE}tnp.feeds.defaults.json`,
      keywordsUrl: `${CONFIG_BASE}tnp.keywords.json`,
      trendsSourcesUrl: `${CONFIG_BASE}tnp.trends.sources.json`,
      versionUrl: `${CONFIG_BASE}tnp.version.json`,
      uiDefaultsUrl: `${CONFIG_BASE}tnp.ui.defaults.json`,
      // opcional: config extra (si lo usas en runtime)
      configUrl: `${CONFIG_BASE}tnp.config.json`
    },

    /* ───────────────────────────── UI / FEATURES ───────────────────────────── */
    ui: {
      enableFavicons: true,
      enableXMock: true,
      kofiUrl: KOFI_URL
    },

    features: {
      enableTrends: true
    },

    /* ───────────────────────────── AUTH (Google) ───────────────────────────── */
    auth: {
      enabled: true,

      // Obligar login (si true, el panel se bloquea hasta iniciar sesión)
      requireLogin: true,

      provider: "google",

      // ✅ TU CLIENT ID (GIS)
      googleClientId: GOOGLE_CLIENT_ID,

      // One Tap (si el navegador lo permite)
      autoPrompt: true,

      // Persistencia de sesión (si tu app.js lo usa)
      rememberSession: true
    },

    /* ───────────────────────────── MEMBERSHIP ───────────────────────────── */
    membership: {
      enabled: true,

      // Si tienes backend (Cloudflare Worker), pon aquí tu API:
      // apiBase: "https://tu-worker.workers.dev",
      apiBase: "",

      // Allowlist local (GitHub Pages). Puede ser público.
      // ✅ FIX: ahora apunta a member.json
      allowlistUrl: `${CONFIG_BASE}member.json`,
      allowLocalOverride: true,

      // Ko-fi (para el UI)
      kofiUrl: KOFI_URL,

      // URLs si NO usas apiBase (Stripe/Gumroad/Ko-fi/etc.)
      checkoutUrlTemplate: `${KOFI_URL}`,
      manageUrl: `${KOFI_URL}`
    }
  };

  // Compat: expone build de forma cómoda
  window.TNP_BUILD = { version: APP_VERSION, buildId: BUILD_ID, tag: BUILD_TAG };

  // Alias de compatibilidad: algunos builds leen estos nombres antiguos.
  try{
    if (!window.TNP_BOOT_CONFIG) window.TNP_BOOT_CONFIG = window.TNP_CONFIG;
    if (!window.__TNP_CONFIG__) window.__TNP_CONFIG__ = window.TNP_CONFIG;
    if (!window.__TNP_BOOT__) window.__TNP_BOOT__ = window.TNP_CONFIG;
    if (!window.__TNP_BOOT_CONFIG__) window.__TNP_BOOT_CONFIG__ = window.TNP_CONFIG;
  }catch(_){}

  // ⚠️ NO congelamos por defecto para evitar romper app.js si ajusta config en runtime.
  // try { Object.freeze(window.TNP_CONFIG); } catch (_) {}
})();
