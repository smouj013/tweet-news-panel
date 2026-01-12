/* config/boot-config.js — TNP BOOT CONFIG (AUTH + MEMBERSHIP)
   Carga ANTES de app.js.

   ✅ Google GIS client_id configurado
   ✅ 3 tiers visibles: FREE / PRO / ELITE
   ✅ Config “real” (API) o “demo” (override local)
   ✅ Alias de compatibilidad: TNP_CONFIG.googleClientId (por si tu app.js lo usa en raíz)
*/
(() => {
  "use strict";

  const GOOGLE_CLIENT_ID = "96486611781-9o20cpbk3vqt0r5qb6deifmjvk10sk67.apps.googleusercontent.com";

  window.TNP_CONFIG = {
    // Debe coincidir con tu deploy (cache-bust coherente)
    // TIP: pon este mismo string en el BUILD_TAG de index.html para que SW/app vayan alineados.
    buildTag: "tnp-v4.2.0_2026-01-12c",

    /* ───────────────────────────── PROXIES ───────────────────────────── */
    proxyFirst: true,
    // customProxyTemplate: "https://tuworker.workers.dev/?url={{ENCODED_URL}}",
    customProxyTemplate: "",

    /* ───────────────────────────── DEFAULTS COMPOSER ───────────────────────────── */
    defaultLiveUrl: "https://twitch.tv/globaleyetv",
    defaultHashtags: "#ÚltimaHora #España",

    // defaultTemplate: `🚨 ÚLTIMA HORA: {{HEADLINE}}\n\n{{LIVE_LINE}}\n\nFuente:\n{{SOURCE_URL}}\n\n{{HASHTAGS}}`,
    // defaultLiveLine: "🔴#ENVIVO >>> {{LIVE_URL}}",

    /* ───────────────────────────── TRADUCCIÓN ───────────────────────────── */
    trEnabledDefault: true,

    /* ───────────────────────────── LÍMITES BASE ───────────────────────────── */
    maxItemsKeep: 600,
    visibleTranslateLimit: 80,

    /* ───────────────────────────── AUTH (Google) ───────────────────────────── */
    auth: {
      enabled: true,

      // “obligar login”
      requireLogin: true,

      provider: "google",

      // ✅ TU CLIENT ID (GIS)
      googleClientId: GOOGLE_CLIENT_ID,

      // Auto prompt (One Tap) si el navegador lo permite
      autoPrompt: true,

      // Guardar sesión (sessionStorage). Si true, dura hasta cerrar la pestaña.
      rememberSession: true,

      // Opcional: restringir dominio (solo cuentas @tuempresa.com)
      // hd: "tuempresa.com",
    },

    /* ───────────────────────────── MEMBERSHIP ───────────────────────────── */
    membership: {
      enabled: true,

      // Si tienes backend (Cloudflare Worker), pon aquí tu API:
      // apiBase: "https://tu-worker.workers.dev",
      apiBase: "",

      // Demo override:
      // localStorage.setItem("tnp_membership_override", "pro")
      // localStorage.setItem("tnp_membership_override", "elite")
      allowLocalOverride: true,

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
            "Copiar plantilla + abrir en X",
          ],
          limits: {
            maxFeedsEnabled: 40,
            fetchCapMax: 400,
            showLimitMax: 180,
            minAutoRefreshSec: 60,
            ogLookupsMax: 50,
            resolveMax: 60,
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
            "Más OG/imagenes + cachés",
            "Prioridad en proxies (si api)",
          ],
          limits: {
            maxFeedsEnabled: 90,
            fetchCapMax: 1200,
            showLimitMax: 300,
            minAutoRefreshSec: 25,
            ogLookupsMax: 120,
            resolveMax: 160,
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
            "Ready para features premium (tendencias API, etc.)",
          ],
          limits: {
            maxFeedsEnabled: 200,
            fetchCapMax: 2000,
            showLimitMax: 500,
            minAutoRefreshSec: 15,
            ogLookupsMax: 220,
            resolveMax: 260,
          }
        }
      ],
    },

    /* ───────────────────────────── UI ───────────────────────────── */
    ui: {
      showMembershipBar: true,
      showTierCards: true,
      // si true, bloquea la app hasta login (además de requireLogin)
      hardGate: true,
    },

    /* ───────────────────────────── (OPCIONAL) DEFAULT FEEDS ───────────────────────────── */
    // defaultFeeds: [ { name:"...", url:"https://...", enabled:true, cat:"spain" } ],
  };

  // ───────────────────────────── COMPAT SHIM ─────────────────────────────
  // Por si tu app.js (o versiones previas) leen googleClientId en raíz:
  if (!window.TNP_CONFIG.googleClientId) {
    window.TNP_CONFIG.googleClientId = window.TNP_CONFIG.auth?.googleClientId || "";
  }
})();
