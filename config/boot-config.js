/* config/boot-config.js — TNP BOOT CONFIG
   Carga ANTES de app.js (en tu index.html ya lo añadimos).
   Aquí puedes ajustar TODO sin tocar app.js.
*/
(() => {
  "use strict";

  window.TNP_CONFIG = {
    // Debe coincidir con tu deploy (sirve para cache-bust coherente)
    buildTag: "tnp-v4.1.2_2026-01-12b",

    // Proxies
    proxyFirst: true,

    // Si montas un Cloudflare Worker proxy propio:
    // customProxyTemplate: "https://tuworker.workers.dev/?url={{ENCODED_URL}}",
    customProxyTemplate: "",

    // Defaults del composer
    defaultLiveUrl: "https://twitch.tv/globaleyetv",
    defaultHashtags: "#ÚltimaHora #España",

    // Plantilla por defecto (si quieres cambiarla aquí)
    // defaultTemplate: `🚨 ÚLTIMA HORA: {{HEADLINE}}\n\n{{LIVE_LINE}}\n\nFuente:\n{{SOURCE_URL}}\n\n{{HASHTAGS}}`,
    // defaultLiveLine: "🔴#ENVIVO >>> {{LIVE_URL}}",

    // Traducción ES
    trEnabledDefault: true,

    // (Opcional) feeds por defecto (si lo pones, sustituye los defaults de app.js)
    // defaultFeeds: [ { name:"...", url:"https://...", enabled:true, cat:"spain" } ],

    // (Opcional) límites
    maxItemsKeep: 300,
    visibleTranslateLimit: 80,
  };
})();
