/* boot-config.js — TNP v4.2.0 — buildTag tnp-v4.2.0_2026-01-12c
   ⚠️ No sube versión.
   ✅ Config central para app.js
*/

(() => {
  "use strict";

  // Base para archivos .json en raíz del repo (GitHub Pages)
  const CONFIG_BASE = "./";

  // Tag de build para cache-bust controlado (ojo: NO subimos versión)
  const BUILD_TAG = "tnp-v4.2.0_2026-01-12c";

  window.__TNP_BOOT__ = {
    buildTag: BUILD_TAG,

    // ───────────────────────────── AUTH / LOGIN ─────────────────────────────
    auth: {
      // Si está vacío, login GIS queda desactivado (app.js lo indica)
      googleClientId: "",
      // Si quieres restringir a un dominio (Workspace), pon algo tipo "midominio.com"
      hd: "",
      // Login requerido (hardGate)
      requireLogin: true,
      hardGate: true,
      // URL para “Gestionar” (opcional)
      manageUrl: "https://github.com/smouj013/tweet-news-panel",
    },

    // ───────────────────────────── MEMBERSHIP ─────────────────────────────
    membership: {
      enabled: true,

      // Endpoint remoto (opcional). Si lo dejas vacío, usa allowlist.
      apiBase: "",

      // Allowlist local (opcional). Si lo usas, suele ser "member.json" o "members.json".
      // allowlistUrl: `${CONFIG_BASE}members.json`, (ejemplo)
      allowlistUrl: `${CONFIG_BASE}member.json`,
      allowLocalOverride: true,

      // Salt (solo para modo hash, si lo usas)
      membershipSalt: "tnp",
    },

    // ───────────────────────────── UI / FEATURES ─────────────────────────────
    ui: {
      // Favicons por dominio (Google s2 favicons)
      enableFavicons: true,
      // Mostrar panel X mock
      enableXMock: true,
    },

    features: {
      // Tendencias opcionales
      enableTrends: true,
    },

    network: {
      // Proxies / hints
      proxiesUrl: `${CONFIG_BASE}tnp.proxies.json`,
      // Fuentes por defecto (feeds)
      feedsDefaultsUrl: `${CONFIG_BASE}tnp.feeds.defaults.json`,
      // Keywords
      keywordsUrl: `${CONFIG_BASE}tnp.keywords.json`,
      // Tendencias sources
      trendsSourcesUrl: `${CONFIG_BASE}tnp.trends.sources.json`,
      // Version file
      versionUrl: `${CONFIG_BASE}tnp.version.json`,
      // UI defaults
      uiDefaultsUrl: `${CONFIG_BASE}tnp.ui.defaults.json`,
    },

    // ───────────────────────────── MONETIZATION / SUPPORT (opcional) ─────────────────────────────
    // OJO: app.js ahora también lee ./monetization.json (si existe) para ads/support.
    donations: {
      enabled: true,
      links: {
        kofi: "https://ko-fi.com/global_eye",
        paypal: "",
        githubSponsors: "",
        patreon: "",
      },
    },
  };
})();
