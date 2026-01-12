/* config/boot-config.js — TNP BOOT CONFIG (AUTH + MEMBERSHIP) — v4.2.0 (2026-01-12d)
   Carga ANTES de app.js.

   ✅ Google GIS client_id configurado
   ✅ 3 tiers visibles: FREE / PRO / ELITE
   ✅ Config “real” (API) o “demo” (override local)
   ✅ Alias compat: TNP_CONFIG.googleClientId
   ✅ URLs de config JSON (version/config/proxies/trends/feeds/keywords) para carga dinámica
*/
(() => {
  "use strict";

  const APP_VERSION = "tnp-v4.2.0";
  const BUILD_ID = "2026-01-12d";
  const BUILD_TAG = `${APP_VERSION}_${BUILD_ID}`;

  const GOOGLE_CLIENT_ID =
    "96486611781-9o20cpbk3vqt0r5qb6deifmjvk10sk67.apps.googleusercontent.com";

  // Base para tus JSON (si los tienes en raíz, deja "./")
  const CONFIG_BASE = "./";

  window.TNP_CONFIG = {
    // Debe coincidir con tu deploy (cache-bust coherente con index.html / sw.js)
    buildTag: BUILD_TAG,

    /* ───────────────────────────── CONFIG URLS (JSON) ───────────────────────────── */
    // Si tu app.js soporta cargar config externa, aquí tienes rutas coherentes.
    // Puedes moverlos a /config/ si quieres: cambia CONFIG_BASE.
    configUrls: {
      version: `${CONFIG_BASE}tnp.version.json`,
      config: `${CONFIG_BASE}tnp.config.json`,
      proxies: `${CONFIG_BASE}tnp.proxies.json`,
      trendsSources: `${CONFIG_BASE}tnp.trends.sources.json`,
      feedsDefaults: `${CONFIG_BASE}tnp.feeds.defaults.json`,
      keywords: `${CONFIG_BASE}tnp.keywords.json`
    },

    /* ───────────────────────────── PROXIES ───────────────────────────── */
    proxyFirst: true,
    // customProxyTemplate: "https://tuworker.workers.dev/?url={{ENCODED_URL}}",
    customProxyTemplate: "",

    /* ───────────────────────────── DEFAULTS COMPOSER ───────────────────────────── */
    defaultLiveUrl: "https://twitch.tv/globaleyetv",
    // Recomendación: sin acentos en hashtag para evitar rarezas (#ÚltimaHora -> #UltimaHora)
    defaultHashtags: "#UltimaHora #España",

    // Plantilla si tu app.js la soporta (si no, se ignora)
    defaultTemplate:
      "🚨 ÚLTIMA HORA: {{HEADLINE}}\n\n{{LIVE_LINE}}\n\nFuente:\n{{SOURCE_URL}}\n\n{{HASHTAGS}}",
    defaultLiveLine: "🔴#ENVIVO >>> {{LIVE_URL}}",

    /* ───────────────────────────── TRADUCCIÓN ───────────────────────────── */
    trEnabledDefault: true,

    /* ───────────────────────────── LÍMITES BASE ───────────────────────────── */
    maxItemsKeep: 600,
    visibleTranslateLimit: 80,

    /* ───────────────────────────── AUTH (Google) ───────────────────────────── */
    auth: {
      enabled: true,

      // Obligar login
      requireLogin: true,

      provider: "google",

      // ✅ TU CLIENT ID (GIS)
      googleClientId: GOOGLE_CLIENT_ID,

      // One Tap (si el navegador lo permite)
      autoPrompt: true,

      // Persistencia de sesión (si tu app.js lo usa)
      rememberSession: true

      // Opcional: restringir dominio (solo cuentas @tuempresa.com)
      // hd: "tuempresa.com",
    },

    /* ───────────────────────────── MEMBERSHIP ───────────────────────────── */
    membership: {
      enabled: true,

      // Si tienes backend (Cloudflare Worker), pon aquí tu API:
      // apiBase: "https://tu-worker.workers.dev",
      apiBase: "",

      // Allowlist local (opcional). Si tu app.js lo soporta, puedes usar member.json.
      // allowlistUrl: `${CONFIG_BASE}member.json`,
      allowlistUrl: "",
      allowLocalOverride: true,

      // Demo override:
      // localStorage.setItem("tnp_membership_override", "pro")
      // localStorage.setItem("tnp_membership_override", "elite")

      // URLs si NO usas apiBase (Stripe/Gumroad/Ko-fi/etc.)
      checkoutUrlTemplate: "https://tusitio.com/checkout?tier={{TIER}}",
      manageUrl: "https://tusitio.com/account",

      tiers: [
        {
          id: "free",
          name: "FREE",
          priceLabel: "0€",
          badge: "FREE",
          accent: "#9aa4b2",
          perks: [
            "RSS + ticker básico",
            "Resolver links (best-effort)",
            "Copiar plantilla + abrir en X"
          ],
          limits: {
            maxFeedsEnabled: 40,
            fetchCapMax: 400,
            showLimitMax: 180,
            minAutoRefreshSec: 60,
            ogLookupsMax: 50,
            resolveMax: 60
          }
        },
        {
          id: "pro",
          name: "PRO",
          priceLabel: "4.99€/mes",
          badge: "PRO",
          accent: "#2ED3B7",
          perks: [
            "Más feeds + más items",
            "Auto-refresh más rápido",
            "Más OG/imágenes + cachés",
            "Prioridad en proxies (si api)"
          ],
          limits: {
            maxFeedsEnabled: 90,
            fetchCapMax: 1200,
            showLimitMax: 300,
            minAutoRefreshSec: 25,
            ogLookupsMax: 120,
            resolveMax: 160
          }
        },
        {
          id: "elite",
          name: "ELITE",
          priceLabel: "9.99€/mes",
          badge: "ELITE",
          accent: "#F5C451",
          perks: [
            "Máximo rendimiento (límite alto)",
            "Auto-refresh ultra",
            "Más extracción OG",
            "Ready para features premium (tendencias API, etc.)"
          ],
          limits: {
            maxFeedsEnabled: 200,
            fetchCapMax: 2000,
            showLimitMax: 500,
            minAutoRefreshSec: 15,
            ogLookupsMax: 220,
            resolveMax: 260
          }
        }
      ]
    },

    /* ───────────────────────────── UI ───────────────────────────── */
    ui: {
      showMembershipBar: true,
      showTierCards: true,
      // si true, bloquea la app hasta login (además de requireLogin)
      hardGate: true
    }
  };

  // ───────────────────────────── COMPAT SHIM ─────────────────────────────
  // Por si tu app.js (o versiones previas) leen googleClientId en raíz:
  if (!window.TNP_CONFIG.googleClientId) {
    window.TNP_CONFIG.googleClientId =
      (window.TNP_CONFIG.auth && window.TNP_CONFIG.auth.googleClientId) || "";
  }

  // Exponer build de forma cómoda (no rompe nada si no se usa)
  window.TNP_BUILD = { version: APP_VERSION, buildId: BUILD_ID, tag: BUILD_TAG };

  // Opcional: “congelar” config para evitar mutaciones accidentales (si rompe algo, coméntalo)
  try { Object.freeze(window.TNP_CONFIG); } catch (_) {}
})();
