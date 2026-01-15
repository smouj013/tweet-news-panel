/* config/boot-config.js — TNP BOOT CONFIG (AUTH + MEMBERSHIP) — v4.2.0 (2026-01-12d)
   Carga ANTES de app.js.

   ✅ Google GIS client_id configurado
   ✅ 3 tiers visibles: FREE / PRO / ELITE
   ✅ Config “real” (API) o “demo” (override local)
   ✅ Alias compat: TNP_CONFIG.googleClientId
   ✅ URLs de config JSON (version/config/proxies/trends/feeds/keywords) para carga dinámica
   ✅ Ko-fi actualizado (ko-fi.com/global_eye)
   ✅ Descripciones/beneficios tiers ajustados a lo que REALMENTE hace la app (límites + frecuencia + OG/resolve)
   ✅ Compatibilizado: expone membership.kofiUrl + ui.kofiUrl (si app.js lo usa) sin romper nada
*/
(() => {
  "use strict";

  const APP_VERSION = "tnp-v4.2.0";
  const BUILD_ID = "2026-01-12d";
  const BUILD_TAG = `${APP_VERSION}_${BUILD_ID}`;

  const GOOGLE_CLIENT_ID =
    "96486611781-9o20cpbk3vqt0r5qb6deifmjvk10sk67.apps.googleusercontent.com";

  // ✅ TU KO-FI
  const KOFI_URL = "https://ko-fi.com/global_eye";

  // Base para tus JSON (si los tienes en raíz, deja "./")
  // Si los mueves a /config/, usa: "./config/"
  const CONFIG_BASE = "./";

  window.TNP_CONFIG = {
    // Debe coincidir con tu deploy (cache-bust coherente con index.html / sw.js)
    buildTag: BUILD_TAG,

    /* ───────────────────────────── CONFIG URLS (JSON) ───────────────────────────── */
    // Rutas coherentes para carga dinámica (si app.js lo soporta)
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

    /* ───────────────────────────── LÍMITES BASE (APP) ───────────────────────────── */
    maxItemsKeep: 600,
    visibleTranslateLimit: 80,

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

      // Opcional: restringir dominio (solo cuentas @tuempresa.com)
      // hd: "tuempresa.com",
    },

    /* ───────────────────────────── MEMBERSHIP ───────────────────────────── */
    membership: {
      enabled: true,

      // Si tienes backend (Cloudflare Worker), pon aquí tu API:
      // apiBase: "https://tu-worker.workers.dev",
      apiBase: "",

      // Allowlist local (opcional). Si lo usas, suele ser "member.json" o "members.json".
      // allowlistUrl: `${CONFIG_BASE}member.json`,
      allowlistUrl: "",
      allowLocalOverride: true,

      // ✅ Ko-fi (para que el UI pueda enlazarlo si app.js lee config)
      kofiUrl: KOFI_URL,

      // Demo override:
      // localStorage.setItem("tnp_membership_override", "free")
      // localStorage.setItem("tnp_membership_override", "pro")
      // localStorage.setItem("tnp_membership_override", "elite")

      // URLs si NO usas apiBase (Stripe/Gumroad/Ko-fi/etc.)
      // Si tu estrategia es Ko-fi como “upgrade”, puedes dejar checkout a Ko-fi:
      checkoutUrlTemplate: `${KOFI_URL}`,
      manageUrl: `${KOFI_URL}`,

      // ⚠️ Nota realista: OG/imagenes/resolve dependen de CORS, proxies y calidad del feed.
      // Los tiers “mejoran límites y frecuencia”, no garantizan 100% de extracción.

      tiers: [
        {
          id: "free",
          name: "FREE",
          priceLabel: "0€",
          badge: "FREE",
          accent: "#9aa4b2",
          perks: [
            "Panel completo: RSS + lista + ticker + plantilla X",
            "Resolver enlaces y extraer OG (best-effort, con límites)",
            "Traducción/normalización ES prioritaria (best-effort)",
            "Límites moderados para evitar bloqueos (ideal para empezar)"
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
          priceLabel: "Apoyo Ko-fi",
          badge: "PRO",
          accent: "#2ED3B7",
          perks: [
            "Más feeds activos + más noticias por refresh",
            "Auto-refresh más rápido (menos espera)",
            "Más intentos de resolve + más OG/imagenes por ciclo",
            "Ideal para directos: ticker más “vivo” sin saturar"
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
          priceLabel: "Apoyo Ko-fi+",
          badge: "ELITE",
          accent: "#F5C451",
          perks: [
            "Máximos límites (feeds/items) para curación intensiva",
            "Auto-refresh ultra (ideal para ‘última hora’ continua)",
            "Más OG/imagenes + más resolve por ciclo",
            "Preparado para features premium cuando uses backend (si lo activas)"
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

      // ✅ extra compat: algunas UIs leen esto directamente
      kofiUrl: KOFI_URL,

      // Si true, bloquea el panel hasta login (además de auth.requireLogin)
      hardGate: true
    }
  };

  // ───────────────────────────── COMPAT SHIM ─────────────────────────────
  // Por si app.js (o versiones previas) leen googleClientId en raíz:
  if (!window.TNP_CONFIG.googleClientId) {
    window.TNP_CONFIG.googleClientId =
      (window.TNP_CONFIG.auth && window.TNP_CONFIG.auth.googleClientId) || "";
  }

  // Por si alguna parte lee KOFI en raíz:
  if (!window.TNP_CONFIG.kofiUrl) window.TNP_CONFIG.kofiUrl = KOFI_URL;

  // Exponer build de forma cómoda (no rompe nada si no se usa)
  window.TNP_BUILD = { version: APP_VERSION, buildId: BUILD_ID, tag: BUILD_TAG };

  // ⚠️ NO congelamos por defecto para evitar romper app.js si ajusta config en runtime.
  // Si quieres “hardening” y estás seguro de que app.js no muta config, descomenta:
  // try { Object.freeze(window.TNP_CONFIG); } catch (_) {}
})();
