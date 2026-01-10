/* app.js — News → Tweet Template Panel (tnp-v4.0.1) — PRO + REALTIME TICKERS (NewsTicker + X-Trends PopTicker)
   ✅ NEWS TICKER (scroll) con noticias más relevantes (impacto + frescura) en tiempo real
   ✅ TRENDS/Hashtags PopTicker (estilo X) con tendencias actuales (best-effort) desde fuentes públicas
   ✅ 0 cambios en index.html: el ticker se crea/inserta por JS (compat total con tus IDs/clases)
   ✅ VISUAL HOMOGÉNEO: el CSS inyectado es mínimo y “no pisa” tu styles.css (y usa tus variables)
   ✅ Mantiene: feeds 50+, batch refresh, backoff, resolver links, OG images, ES auto, PWA update checks
*/

(() => {
  "use strict";

  /* ───────────────────────────── STORAGE ───────────────────────────── */
  const LS_FEEDS_V3 = "tnp_feeds_v3";
  const LS_TEMPLATE_V3 = "tnp_template_v3";
  const LS_SETTINGS_V3 = "tnp_settings_v3";
  const LS_TR_CACHE_V3 = "tnp_tr_cache_v3";
  const LS_RESOLVE_CACHE_V3 = "tnp_resolve_cache_v3";
  const LS_USED_V3 = "tnp_used_v3";

  const LS_FEEDS = "tnp_feeds_v4";
  const LS_TEMPLATE = "tnp_template_v4";
  const LS_SETTINGS = "tnp_settings_v4";
  const LS_TR_CACHE = "tnp_tr_cache_v4";
  const LS_RESOLVE_CACHE = "tnp_resolve_cache_v4";
  const LS_USED = "tnp_used_v4";
  const LS_IMG_CACHE = "tnp_img_cache_v4";

  const LS_TRENDS_CACHE = "tnp_trends_cache_v1";
  const LS_TRENDS_TS = "tnp_trends_ts_v1";

  /* ───────────────────────────── REALTIME / LIMITS ───────────────────────────── */
  const AUTO_REFRESH_FEEDS_SEC_DEFAULT = 30;
  const AUTO_TICK_UI_SEC = 10;

  // feeds
  const FEED_CONCURRENCY = 6;

  // resolve links (visible-only)
  const RESOLVE_CONCURRENCY = 3;
  const VISIBLE_RESOLVE_LIMIT = 60;

  // translate (prioridad)
  const TR_CONCURRENCY = 4;
  const VISIBLE_TRANSLATE_LIMIT = 80;

  // OG visible-only
  const IMG_CONCURRENCY = 2;
  const OBSERVE_OG_VISIBLE_LIMIT = 70;
  const OG_FETCH_TIMEOUT_MS = 12_000;

  const TR_CACHE_LIMIT = 2200;
  const RESOLVE_CACHE_LIMIT = 1800;
  const IMG_CACHE_LIMIT = 1400;

  const FEED_FAIL_BACKOFF_BASE_MS = 60_000;
  const FEED_FAIL_BACKOFF_MAX_MS = 15 * 60_000;

  const MAX_SMART_HEADLINE_LEN = 130;
  const VERSION = "tnp-v4.0.1"; // (mantengo la versión para compat; si actualizas SW, súbela allí)

  // PWA update checks
  const SW_UPDATE_CHECK_MS = 5 * 60_000; // 5 min
  const SW_FORCE_RELOAD_GUARD = "tnp_sw_reloaded_once";

  // TICKERS
  const TICKER_NEWS_MAX = 14;
  const TICKER_NEWS_MIN_IMPACT = 55;

  const TRENDS_REFRESH_MS = 3 * 60_000; // cada 3 min
  const TRENDS_CACHE_MAX_AGE_MS = 12 * 60_000; // cache 12 min
  const TRENDS_POP_INTERVAL_MS = 4500; // cada 4.5s cambia el pop
  const TRENDS_MAX = 24;

  /* ───────────────────────────── TU PLANTILLA ───────────────────────────── */
  const DEFAULT_TEMPLATE =
`🚨 ÚLTIMA HORA: {{HEADLINE}}

🔴#ENVIVO >>> {{LIVE_URL}}

Fuente:
{{SOURCE_URL}}

{{HASHTAGS}}`;

  /* ───────────────────────────── FEEDS (50+ TOP, robustos) ───────────────────────────── */
  const gn = (q, hl = "es", gl = "ES", ceid = "ES:es") =>
    `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=${encodeURIComponent(hl)}&gl=${encodeURIComponent(gl)}&ceid=${encodeURIComponent(ceid)}`;

  const gnTop = (q) => gn(`${q} when:1d`);
  const gnSite = (domain, q = "") => gnTop(`site:${domain} ${q}`.trim());

  const gdeltDoc = (query, max = 60) =>
    `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=ArtList&format=json&maxrecords=${encodeURIComponent(String(max))}&sort=HybridRel`;

  const DEFAULT_FEEDS = [
    // ── España (Top)
    { name: "Google News — España (Top)", url: gnTop("España OR Madrid OR Barcelona OR Valencia OR Sevilla"), enabled: true },
    { name: "El País (GN)", url: gnSite("elpais.com", "(última hora OR urgente OR breaking OR directo)"), enabled: true },
    { name: "El Mundo (GN)", url: gnSite("elmundo.es", "(última hora OR urgente OR breaking OR directo)"), enabled: true },
    { name: "La Vanguardia (GN)", url: gnSite("lavanguardia.com", "(última hora OR urgente OR breaking)"), enabled: true },
    { name: "ABC (GN)", url: gnSite("abc.es", "(última hora OR urgente OR breaking)"), enabled: true },
    { name: "20minutos (GN)", url: gnSite("20minutos.es", "(última hora OR urgente OR breaking)"), enabled: true },
    { name: "El Confidencial (GN)", url: gnSite("elconfidencial.com", "(última hora OR urgente OR breaking)"), enabled: true },
    { name: "eldiario.es (GN)", url: gnSite("eldiario.es", "(última hora OR urgente OR breaking)"), enabled: true },
    { name: "RTVE (GN)", url: gnSite("rtve.es", "(última hora OR urgente OR breaking)"), enabled: true },
    { name: "Europa Press (GN)", url: gnSite("europapress.es", "(última hora OR urgente OR breaking)"), enabled: true },

    // ── Política / Gobierno ES
    { name: "España — Política (GN)", url: gnTop("Pedro Sánchez OR Moncloa OR Congreso OR Senado OR elecciones"), enabled: true },
    { name: "España — Justicia/Sucesos (GN)", url: gnTop("juzgado OR detenido OR juicio OR policía OR crimen España"), enabled: true },

    // ── Economía ES
    { name: "España — Economía (GN)", url: gnTop("IBEX OR inflación OR PIB OR BCE OR tipos OR Euribor OR bolsa España"), enabled: true },
    { name: "Expansión (GN)", url: gnSite("expansion.com", "(última hora OR mercados OR bolsa OR ibex OR bce)"), enabled: true },
    { name: "El Economista (GN)", url: gnSite("eleconomista.es", "(última hora OR bolsa OR ibex OR bce OR euribor)"), enabled: true },
    { name: "Cinco Días (GN)", url: gnSite("cincodias.elpais.com", "(mercados OR ibex OR bce OR inflación)"), enabled: false },

    // ── Mundo / Geopolítica
    { name: "Google News — Mundo (Top)", url: gnTop("última hora mundo OR breaking world OR conflicto OR crisis"), enabled: true },
    { name: "Reuters (GN)", url: gnSite("reuters.com", "(breaking OR exclusive OR urgent)"), enabled: true },
    { name: "AP News (GN)", url: gnSite("apnews.com", "(breaking OR latest)"), enabled: false },
    { name: "BBC (GN)", url: gnSite("bbc.com", "(breaking OR live)"), enabled: false },
    { name: "Al Jazeera (GN)", url: gnSite("aljazeera.com", "(breaking OR live OR latest)"), enabled: false },

    // ── Guerra / Defensa / OTAN-Ucrania
    { name: "Ucrania/OTAN (GN)", url: gnTop("OTAN OR NATO OR Ucrania OR Ukraine OR Rusia OR Russia"), enabled: true },
    { name: "Defense (GN)", url: gnTop("defensa OR missiles OR drones OR military aid OR sanctions"), enabled: false },

    // ── Tech
    { name: "Tech (GN)", url: gnTop("Apple OR Google OR Microsoft OR OpenAI OR AI OR ciberataque OR cybersecurity"), enabled: true },
    { name: "The Verge (GN)", url: gnSite("theverge.com", "(breaking OR update OR report)"), enabled: false },
    { name: "Wired (GN)", url: gnSite("wired.com", "(security OR ai OR breaking)"), enabled: false },

    // ── Salud / Deportes / Cultura
    { name: "Salud (GN)", url: gnTop("OMS OR WHO OR brote OR vacuna OR alerta sanitaria"), enabled: false },
    { name: "Deportes (GN)", url: gnTop("Real Madrid OR Barcelona OR LaLiga OR Champions OR fichaje OR lesión"), enabled: false },
    { name: "Entretenimiento (GN)", url: gnTop("Netflix OR estreno OR concierto OR festival OR polémica"), enabled: false },

    // ── GDELT (JSON)
    { name: "GDELT — España (Doc)", url: gdeltDoc("Spain OR España", 80), enabled: false },
    { name: "GDELT — Ukraine (Doc)", url: gdeltDoc("Ukraine OR Ucrania", 80), enabled: false },
    { name: "GDELT — Economy (Doc)", url: gdeltDoc("inflation OR recession OR ECB OR BCE OR interest rates", 80), enabled: false },
  ];

  /* ───────────────────────────── STATE ───────────────────────────── */
  const state = {
    feeds: [],
    settings: {},
    template: "",
    used: new Set(),
    items: [],

    refreshInFlight: false,
    refreshPending: false,
    refreshSeq: 0,
    refreshAbort: null,

    lastRenderSig: "",

    // tickers
    ticker: {
      ready: false,
      news: [],
      newsSig: "",
      trends: [],
      trendsIdx: 0,
      trendsPopTimer: 0,
      trendsRefreshTimer: 0,
    },
  };

  const trCache = loadJsonPreferNew(LS_TR_CACHE, LS_TR_CACHE_V3, {});
  const resolveCache = loadJsonPreferNew(LS_RESOLVE_CACHE, LS_RESOLVE_CACHE_V3, {});
  const imgCache = loadJsonPreferNew(LS_IMG_CACHE, null, {});

  const trInFlight = new Map();
  const resInFlight = new Map();
  const imgInFlight = new Map();

  const feedFail = new Map();     // url -> { fails, nextAt }
  const feedTextHash = new Map(); // url -> hash (sesión)

  let uiTickTimer = 0;
  let autoRefreshTimer = 0;
  let visHandlerInstalled = false;
  let lastRefreshAt = 0;

  // OG visible-only
  let ogObserver = null;

  // SW
  let swReg = null;
  let swUpdateTimer = 0;

  /* ───────────────────────────── DOM ───────────────────────────── */
  const el = {};
  const q = (sel) => document.querySelector(sel);
  const must = (sel) => {
    const n = document.querySelector(sel);
    if (!n) throw new Error("Missing element " + sel);
    return n;
  };

  function grabEls() {
    // top controls
    el.timeFilter = must("#timeFilter");
    el.showLimit = q("#showLimit");
    el.fetchCap = q("#fetchCap");

    el.searchBox = must("#searchBox");
    el.btnRefresh = must("#btnRefresh");
    el.btnFeeds = must("#btnFeeds");

    // composer
    el.charCount = must("#charCount");
    el.btnTrim = must("#btnTrim");
    el.btnGenTags = must("#btnGenTags");
    el.btnCopyUrl = must("#btnCopyUrl");
    el.btnX = must("#btnX");
    el.btnCopy = must("#btnCopy");
    el.btnResetTemplate = must("#btnResetTemplate");

    el.liveUrl = must("#liveUrl");
    el.headline = must("#headline");
    el.sourceUrl = must("#sourceUrl");
    el.hashtags = must("#hashtags");
    el.optIncludeLive = must("#optIncludeLive");
    el.optIncludeSource = must("#optIncludeSource");
    el.template = must("#template");
    el.preview = must("#preview");
    el.warn = must("#warn");

    el.status = must("#status");

    // filters
    el.delayMin = must("#delayMin");
    el.optOnlyReady = must("#optOnlyReady");
    el.optOnlySpanish = must("#optOnlySpanish");
    el.sortBy = must("#sortBy");

    el.optAutoRefresh = q("#optAutoRefresh");
    el.refreshSec = q("#refreshSec");
    el.optResolveLinks = q("#optResolveLinks");
    el.optShowOriginal = q("#optShowOriginal");
    el.optHideUsed = q("#optHideUsed");
    el.catFilter = q("#catFilter");
    el.batchFeeds = q("#batchFeeds");

    // list
    el.newsList = must("#newsList");

    // modal
    el.modal = must("#modal");
    el.btnCloseModal = must("#btnCloseModal");
    el.newFeedName = must("#newFeedName");
    el.newFeedUrl = must("#newFeedUrl");
    el.btnAddFeed = must("#btnAddFeed");
    el.feedList = must("#feedList");
    el.feedsJson = must("#feedsJson");
    el.btnExportFeeds = must("#btnExportFeeds");
    el.btnImportFeeds = must("#btnImportFeeds");
    el.btnRestoreDefaultFeeds = must("#btnRestoreDefaultFeeds");
    el.btnSaveFeeds = must("#btnSaveFeeds");
  }

  /* ───────────────────────────── INIT ───────────────────────────── */
  function init() {
    grabEls();

    // 1) CSS ticker: minimal + compatible (no “mezcla rara”)
    //    Si tu styles.css ya define .tnpTicker*, esto no lo pisa; es sólo fallback.
    injectTickerCssFallback();

    // 2) Insert tickers in DOM (sin tocar index)
    ensureTickers();

    // 3) altura topbar para sticky ticker
    syncTopbarHeight();

    // 4) OG observer
    setupOgObserver();

    // load persisted
    state.template = loadTemplate();
    state.feeds = loadFeeds();
    state.settings = loadSettings();
    state.used = loadUsedSet();

    // defaults UI
    el.template.value = state.template || DEFAULT_TEMPLATE;

    el.liveUrl.value = String(state.settings.liveUrl || "https://twitch.com/globaleyetv");
    el.hashtags.value = String(state.settings.hashtags || "");
    el.optIncludeLive.checked = state.settings.includeLive !== false;
    el.optIncludeSource.checked = state.settings.includeSource !== false;

    el.delayMin.value = String(clampNum(state.settings.delayMin ?? 10, 0, 120));
    el.optOnlyReady.checked = !!state.settings.onlyReady;

    // ES always by default
    el.optOnlySpanish.checked = state.settings.onlySpanish !== false;

    el.sortBy.value = String(state.settings.sortBy || "recent");

    if (el.optAutoRefresh) el.optAutoRefresh.checked = state.settings.autoRefresh !== false;
    if (el.refreshSec) el.refreshSec.value = String(clampNum(state.settings.refreshSec ?? AUTO_REFRESH_FEEDS_SEC_DEFAULT, 15, 600));
    if (el.optResolveLinks) el.optResolveLinks.checked = state.settings.resolveLinks !== false;
    if (el.optShowOriginal) el.optShowOriginal.checked = state.settings.showOriginal !== false;
    if (el.optHideUsed) el.optHideUsed.checked = !!state.settings.hideUsed;
    if (el.catFilter) el.catFilter.value = String(state.settings.catFilter || "all");

    if (el.showLimit) el.showLimit.value = String(clampNum(state.settings.showLimit ?? 10, 10, 50));
    if (el.fetchCap) el.fetchCap.value = String(clampNum(state.settings.fetchCap ?? 240, 80, 2000));
    if (el.batchFeeds) el.batchFeeds.value = String(clampNum(state.settings.batchFeeds ?? 12, 4, 50));

    bindUI();
    renderFeedsModal();
    updatePreview();

    // primer render “vacío” (layout estable)
    renderNewsList({ silent: true });
    updateNewsTicker(true);

    // trends: arranque
    startTrendsRealtime();

    refreshAll({ reason: "boot", force: true });
    startRealtime();

    // debug
    window.TNP_DEBUG = { state, trCache, resolveCache, imgCache, VERSION };

    // SW + auto update
    registerServiceWorker();
  }

  function crashOverlay(err) {
    console.error(err);
    const div = document.createElement("div");
    div.style.cssText = `
      position:fixed; inset:0; z-index:99999;
      background:rgba(0,0,0,0.88); color:#fff; padding:16px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New";
      overflow:auto;
    `;
    div.innerHTML = `
      <h2 style="margin:0 0 10px 0;color:#ff6b6b;">❌ Error en app.js</h2>
      <p style="margin:0 0 14px 0;color:#ddd;">
        Abre consola (F12) para más detalle. Esto evita “pantalla en blanco”.
      </p>
      <pre style="white-space:pre-wrap;word-break:break-word;color:#cfe8ff;">${escapeHtml(String(err && (err.stack || err.message) || err))}</pre>
    `;
    document.body.appendChild(div);
  }

  /* ───────────────────────────── UI ───────────────────────────── */
  function bindUI() {
    el.btnRefresh.addEventListener("click", (ev) => {
      // shift-click => force + reset backoff
      const forceShift = !!ev.shiftKey;
      if (forceShift) {
        feedFail.clear();
        feedTextHash.clear();
        toast("⚡ Force refresh (shift) · backoff reseteado");
      }
      refreshAll({ reason: forceShift ? "manual_force" : "manual", force: true });
    });

    el.btnFeeds.addEventListener("click", () => openModal(true));
    el.btnCloseModal.addEventListener("click", () => openModal(false));

    // close modal on backdrop click
    el.modal.addEventListener("click", (e) => {
      const t = e.target;
      if (!t) return;
      if (t.classList && t.classList.contains("modalBackdrop")) return openModal(false);
      if (t.dataset && t.dataset.close === "1") return openModal(false);
    });

    el.timeFilter.addEventListener("change", () => {
      renderNewsList({ silent: true, hardPurge: true });
      updateNewsTicker(true);
      refreshAll({ reason: "window", force: false });
    });

    if (el.showLimit) el.showLimit.addEventListener("change", () => {
      saveSetting("showLimit", clampNum(el.showLimit.value, 10, 50));
      renderNewsList({ silent: true });
    });

    if (el.fetchCap) el.fetchCap.addEventListener("change", () => {
      saveSetting("fetchCap", clampNum(el.fetchCap.value, 80, 2000));
      hardTrimAndPurge();
      renderNewsList({ silent: true });
      updateNewsTicker(true);
    });

    el.searchBox.addEventListener("input", debounce(() => renderNewsList({ silent: true }), 120));

    el.delayMin.addEventListener("input", () => {
      saveSetting("delayMin", clampNum(el.delayMin.value, 0, 120));
      renderNewsList({ silent: true });
      updateNewsTicker(true);
    });

    el.optOnlyReady.addEventListener("change", () => {
      saveSetting("onlyReady", !!el.optOnlyReady.checked);
      renderNewsList({ silent: true });
      updateNewsTicker(true);
    });

    el.optOnlySpanish.addEventListener("change", () => {
      saveSetting("onlySpanish", !!el.optOnlySpanish.checked);
      renderNewsList({ silent: true });
      updateNewsTicker(true);
    });

    el.sortBy.addEventListener("change", () => {
      saveSetting("sortBy", el.sortBy.value);
      renderNewsList({ silent: true });
      updateNewsTicker(true);
    });

    if (el.catFilter) el.catFilter.addEventListener("change", () => {
      saveSetting("catFilter", el.catFilter.value);
      renderNewsList({ silent: true });
      updateNewsTicker(true);
    });

    if (el.optAutoRefresh) el.optAutoRefresh.addEventListener("change", () => {
      saveSetting("autoRefresh", !!el.optAutoRefresh.checked);
      startRealtime();
    });

    if (el.refreshSec) el.refreshSec.addEventListener("input", () => {
      saveSetting("refreshSec", clampNum(el.refreshSec.value, 15, 600));
      startRealtime();
    });

    if (el.batchFeeds) el.batchFeeds.addEventListener("input", () => {
      saveSetting("batchFeeds", clampNum(el.batchFeeds.value, 4, 50));
    });

    if (el.optResolveLinks) el.optResolveLinks.addEventListener("change", () => {
      saveSetting("resolveLinks", !!el.optResolveLinks.checked);
      renderNewsList({ silent: true });
      updateNewsTicker(true);
    });

    if (el.optShowOriginal) el.optShowOriginal.addEventListener("change", () => {
      saveSetting("showOriginal", !!el.optShowOriginal.checked);
      renderNewsList({ silent: true });
    });

    if (el.optHideUsed) el.optHideUsed.addEventListener("change", () => {
      saveSetting("hideUsed", !!el.optHideUsed.checked);
      renderNewsList({ silent: true });
      updateNewsTicker(true);
    });

    // composer inputs
    const composerInputs = [el.liveUrl, el.hashtags, el.optIncludeLive, el.optIncludeSource, el.template, el.headline, el.sourceUrl];
    composerInputs.forEach(n => {
      const ev = (n.tagName === "INPUT" || n.tagName === "TEXTAREA") ? "input" : "change";
      n.addEventListener(ev, onComposerChanged);
      n.addEventListener("change", onComposerChanged);
    });

    el.btnResetTemplate.addEventListener("click", () => {
      el.template.value = DEFAULT_TEMPLATE;
      saveTemplate(DEFAULT_TEMPLATE);
      updatePreview();
      toast("↩️ Template reseteada.");
    });

    el.btnCopy.addEventListener("click", async () => {
      const txt = String(el.preview.textContent || "");
      if (!txt.trim()) return toast("⚠️ Nada que copiar.");
      await copyToClipboard(txt);
      toast("📋 Copiado.");
    });

    el.btnCopyUrl.addEventListener("click", async () => {
      const u = cleanText(el.sourceUrl.value || "");
      if (!u) return toast("⚠️ Falta SOURCE_URL.");
      await copyToClipboard(u);
      toast("🔗 URL copiada.");
    });

    el.btnX.addEventListener("click", () => {
      const txt = String(el.preview.textContent || "");
      if (!txt.trim()) return toast("⚠️ No hay texto.");
      const url = "https://twitter.com/intent/tweet?text=" + encodeURIComponent(txt);
      window.open(url, "_blank", "noopener,noreferrer");
    });

    el.btnTrim.addEventListener("click", () => {
      const out = String(el.preview.textContent || "");
      const count = twCharCount(out);
      if (count <= 280) return toast("✅ Ya cabe en 280.");

      const tpl = String(el.template.value || DEFAULT_TEMPLATE);
      const includeLive = !!el.optIncludeLive.checked;
      const includeSource = !!el.optIncludeSource.checked;

      const liveUrl = cleanText(el.liveUrl.value || "");
      const sourceUrl = cleanText(el.sourceUrl.value || "");
      const hashtags = cleanText(el.hashtags.value || "");

      let base = tpl
        .replace(/\{\{LIVE_URL\}\}/g, liveUrl)
        .replace(/\{\{SOURCE_URL\}\}/g, sourceUrl)
        .replace(/\{\{HASHTAGS\}\}/g, hashtags)
        .replace(/\{\{HEADLINE\}\}/g, "");

      if (!includeLive) base = base.replace(/^\s*🔴#ENVIVO[^\n]*\n?/mi, "").trim();
      if (!includeSource) base = base.replace(/^\s*Fuente:\s*\n[^\n]*\n?/mi, "").trim();

      const budget = 280 - twCharCount(base);
      if (budget <= 10) return toast("⚠️ Muy poco margen (quita hashtags o fuente).");

      let h = cleanText(el.headline.value || "");
      h = smartTrimHeadline(h, Math.min(budget - 2, MAX_SMART_HEADLINE_LEN));
      el.headline.value = h;
      updatePreview();
      toast("✂️ Ajustado.");
    });

    el.btnGenTags.addEventListener("click", () => {
      const h = cleanText(el.headline.value || "");
      const tags = genHashtags(h);
      if (tags) {
        el.hashtags.value = tags;
        onComposerChanged();
        toast("🏷 Hashtags generados.");
      } else {
        toast("⚠️ No pude generar hashtags.");
      }
    });

    // feeds modal
    el.btnAddFeed.addEventListener("click", () => {
      const name = cleanText(el.newFeedName.value || "") || "Feed";
      const url = cleanText(el.newFeedUrl.value || "");
      if (!url) return toast("⚠️ Falta URL.");
      state.feeds = state.feeds || [];
      state.feeds.push(normalizeFeed({ name, url, enabled: true }));
      el.newFeedName.value = "";
      el.newFeedUrl.value = "";
      renderFeedsModal();
      toast("➕ Feed añadido (no olvides Guardar).");
    });

    el.btnExportFeeds.addEventListener("click", async () => {
      const out = JSON.stringify(state.feeds || [], null, 2);
      el.feedsJson.value = out;
      await copyToClipboard(out);
      toast("📤 Feeds exportados (y copiados).");
    });

    el.btnImportFeeds.addEventListener("click", () => {
      const raw = String(el.feedsJson.value || "").trim();
      if (!raw) return toast("⚠️ Pega el JSON primero.");
      const j = safeJson(raw);
      if (!Array.isArray(j)) return toast("⚠️ JSON inválido (esperaba array).");
      state.feeds = j.map(normalizeFeed).filter(f => f.url);
      renderFeedsModal();
      toast("📥 Feeds importados. Dale a Guardar.");
    });

    el.btnRestoreDefaultFeeds.addEventListener("click", () => {
      state.feeds = DEFAULT_FEEDS.map(f => ({ ...f }));
      renderFeedsModal();
      toast("↩️ Defaults cargados. Dale a Guardar.");
    });

    el.btnSaveFeeds.addEventListener("click", () => {
      state.feeds = (state.feeds || []).map(normalizeFeed).filter(f => f.url);
      saveFeeds(state.feeds);
      openModal(false);
      toast("✅ Feeds guardados.");
      refreshAll({ reason: "feeds", force: true });
    });

    // visibilitychange (solo 1 vez)
    if (!visHandlerInstalled) {
      visHandlerInstalled = true;
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          updateDynamicLabels();
          updateNewsTicker(true);

          // SW update check al volver
          try { swReg?.update?.(); } catch {}

          const auto = state.settings.autoRefresh !== false;
          if (auto) refreshAll({ reason: "visible", force: false });

          // trends: refresh best-effort al volver
          requestTrendsRefresh({ reason: "visible" }).catch(() => {});
        }
      });
    }
  }

  function onComposerChanged() {
    saveSetting("liveUrl", (el.liveUrl.value || "").trim());
    saveSetting("hashtags", (el.hashtags.value || "").trim());
    saveSetting("includeLive", !!el.optIncludeLive.checked);
    saveSetting("includeSource", !!el.optIncludeSource.checked);

    saveTemplate(el.template.value || DEFAULT_TEMPLATE);
    updatePreview();
  }

  function openModal(show) {
    el.modal.classList.toggle("hidden", !show);
    el.modal.setAttribute("aria-hidden", show ? "false" : "true");
    if (show) el.feedsJson.value = "";
  }

  function setStatus(s) {
    el.status.textContent = String(s || "Listo");
  }

  function toast(msg) {
    setStatus(msg);
    const mySeq = ++state.refreshSeq;
    setTimeout(() => {
      if (state.refreshInFlight) return;
      if (mySeq !== state.refreshSeq) return;
      setStatus("Listo");
    }, 2200);
  }

  function syncTopbarHeight() {
    const topbar = document.querySelector(".topbar");
    if (!topbar) return;
    const apply = () => document.documentElement.style.setProperty("--topbarH", `${topbar.offsetHeight}px`);
    apply();
    if ("ResizeObserver" in window) {
      const ro = new ResizeObserver(apply);
      ro.observe(topbar);
    }
    window.addEventListener("resize", apply, { passive: true });
  }

  /* ───────────────────────────── PREVIEW ───────────────────────────── */
  function updatePreview() {
    const includeLive = !!el.optIncludeLive.checked;
    const includeSource = !!el.optIncludeSource.checked;

    const tpl = String(el.template.value || DEFAULT_TEMPLATE);

    const liveUrl = cleanText(el.liveUrl.value || "https://twitch.com/globaleyetv");
    const headline = cleanText(el.headline.value || "");
    const sourceUrl = cleanText(el.sourceUrl.value || "");
    const hashtags = cleanText(el.hashtags.value || "");

    let out = tpl;
    out = out.replace(/\{\{HEADLINE\}\}/g, headline);
    out = out.replace(/\{\{LIVE_URL\}\}/g, liveUrl);
    out = out.replace(/\{\{SOURCE_URL\}\}/g, sourceUrl);
    out = out.replace(/\{\{HASHTAGS\}\}/g, hashtags);

    if (!includeLive) out = out.replace(/^\s*🔴#ENVIVO[^\n]*\n?/mi, "").trim();
    if (!includeSource) out = out.replace(/^\s*Fuente:\s*\n[^\n]*\n?/mi, "").trim();

    el.preview.textContent = String(out || "");

    const count = twCharCount(out);
    el.charCount.textContent = String(count);

    const warn = [];
    if (count > 280) warn.push(`Te pasas: ${count}/280`);
    if (!headline) warn.push("Falta HEADLINE.");
    if (includeSource && !sourceUrl) warn.push("Falta SOURCE_URL.");
    if (includeLive && !liveUrl) warn.push("Falta LIVE_URL.");
    setWarn(warn);
  }

  function setWarn(lines) {
    const arr = (lines || []).filter(Boolean);
    if (!arr.length) {
      el.warn.classList.add("hidden");
      el.warn.textContent = "";
      return;
    }
    el.warn.classList.remove("hidden");
    el.warn.textContent = arr.join("\n");
  }

  /* ───────────────────────────── NEWS LIST ───────────────────────────── */
  function renderNewsList({ silent = false, hardPurge = false } = {}) {
    if (hardPurge) hardTrimAndPurge();

    const items = (state.items || []).slice();

    const hours = clampNum(el.timeFilter.value, 1, 72);
    const showLimit = clampNum(state.settings.showLimit ?? (el.showLimit ? el.showLimit.value : 10), 10, 50);
    const search = String(el.searchBox.value || "").trim().toLowerCase();
    const cat = String(state.settings.catFilter || (el.catFilter ? el.catFilter.value : "all") || "all");
    const sortBy = String(state.settings.sortBy || (el.sortBy ? el.sortBy.value : "recent") || "recent");

    const delayMin = clampNum(state.settings.delayMin ?? (el.delayMin ? el.delayMin.value : 10), 0, 120);
    const onlyReady = !!(state.settings.onlyReady ?? (el.optOnlyReady ? el.optOnlyReady.checked : false));
    const hideUsed = !!(state.settings.hideUsed ?? (el.optHideUsed ? el.optHideUsed.checked : false));

    const now = Date.now();
    const minMs = now - (hours * 60 * 60 * 1000);

    // annotate readiness
    for (const it of items) {
      const ms = Number(it.publishedMs || 0);
      it._ready = ms ? ((now - ms) >= (delayMin * 60 * 1000)) : false;
    }

    let filtered = items
      .filter(it => it && Number(it.publishedMs || 0) >= minMs)
      .filter(it => (cat === "all") ? true : String(it.cat || "all") === cat)
      .filter(it => !hideUsed || !state.used.has(it.id))
      .filter(it => !onlyReady || !!it._ready);

    if (search) {
      filtered = filtered.filter(it => {
        const hay = it._hay || ((String(it.titleEs || it.title || "") + " " + String(it.feed || "")).toLowerCase());
        it._hay = hay;
        return hay.includes(search);
      });
    }

    // sorting
    if (sortBy === "impact") {
      filtered.sort((a, b) => {
        const ai = calcImpact(a);
        const bi = calcImpact(b);
        const aTop = ai >= 70 ? 1 : 0;
        const bTop = bi >= 70 ? 1 : 0;
        if (bTop !== aTop) return bTop - aTop;
        if (bi !== ai) return bi - ai;
        return (Number(b.publishedMs || 0) - Number(a.publishedMs || 0));
      });
    } else if (sortBy === "source") {
      filtered.sort((a, b) => String(a.feed || "").localeCompare(String(b.feed || "")) || (Number(b.publishedMs || 0) - Number(a.publishedMs || 0)));
    } else {
      filtered.sort((a, b) => (Number(b.publishedMs || 0) - Number(a.publishedMs || 0)));
    }

    const limited = filtered.slice(0, showLimit);

    // firma de render
    const sig = `${showLimit}|${hours}|${search}|${cat}|${sortBy}|${onlyReady}|${hideUsed}|${limited.length}|${limited[0]?.id || ""}|${limited[0]?.publishedMs || 0}|${limited[0]?.titleEs || ""}`;
    if (silent && sig === state.lastRenderSig) {
      updateDynamicLabels();
      return;
    }
    state.lastRenderSig = sig;

    const prevScroll = el.newsList.scrollTop;
    el.newsList.innerHTML = "";
    const frag = document.createDocumentFragment();

    const resolveLinks = state.settings.resolveLinks !== false;

    const visibleForResolve = [];
    const visibleForTranslate = [];
    let observed = 0;

    for (const it of limited) {
      const shownUrl = canonicalizeUrl((resolveLinks ? (it.linkResolved || it.link) : it.link) || it.link);
      const domain = shownUrl ? getDomain(shownUrl) : "";

      const top = calcImpact(it) >= 70;
      const showOriginal = state.settings.showOriginal !== false;
      const origNeeded = showOriginal && !!it.titleEs && it.titleEs !== it.title;

      const card = document.createElement("div");
      card.className = "newsItem" + (top ? " top" : "") + (state.used.has(it.id) ? " used" : "");
      card.dataset.id = it.id;
      card.dataset.url = shownUrl || it.link || "";
      card.dataset.link = it.link || "";
      card.dataset.published = String(it.publishedMs || 0);

      // thumb
      const thumbWrap = document.createElement("div");
      thumbWrap.className = "newsThumbWrap";
      const img = document.createElement("img");
      img.className = "newsThumb";
      img.alt = "";
      const best = pickBestThumb(it, shownUrl || it.link);
      img.src = best || faviconUrl(shownUrl || it.link);
      thumbWrap.appendChild(img);

      thumbWrap.addEventListener("click", (e) => {
        e.preventDefault();
        if (shownUrl) window.open(shownUrl, "_blank", "noopener,noreferrer");
      });

      // body
      const body = document.createElement("div");
      body.className = "newsBody";

      const title = document.createElement("div");
      title.className = "newsTitle";
      title.textContent = it.titleEs || it.title || "—";

      if (origNeeded) {
        const orig = document.createElement("div");
        orig.className = "newsMeta"; // reutiliza estilo muted
        orig.style.marginTop = "6px";
        orig.style.opacity = "0.9";
        orig.textContent = "Original: " + String(it.title || "");
        body.appendChild(orig);
      }

      const meta = document.createElement("div");
      meta.className = "newsMeta";

      meta.appendChild(badge("cat", it.cat || "all"));
      if (top) meta.appendChild(badge("hot", "🔥 TOP"));
      meta.appendChild(badge(it._ready ? "ready" : "queue", it._ready ? "LISTO" : "EN COLA"));
      meta.appendChild(badge("domain", domain || "link"));

      const age = document.createElement("span");
      age.className = "mini muted";
      age.dataset.role = "age";
      age.textContent = ageLabel(Math.max(0, Math.floor((Date.now() - Number(it.publishedMs || 0)) / 60000)));
      meta.appendChild(age);

      const actions = document.createElement("div");
      actions.className = "actionsRow";

      const btnUse = document.createElement("button");
      btnUse.className = "newsLink primary";
      btnUse.type = "button";
      btnUse.textContent = "Usar";
      btnUse.addEventListener("click", () => useItem(it).catch(() => {}));

      const aOpen = linkBtn("Abrir", shownUrl || it.link || "#");
      aOpen.target = "_blank";
      aOpen.rel = "noopener noreferrer";

      const btnMark = document.createElement("button");
      btnMark.className = "newsLink";
      btnMark.type = "button";
      const usedNow = state.used.has(it.id);
      btnMark.textContent = usedNow ? "Desmarcar" : "Marcar";
      btnMark.addEventListener("click", () => {
        toggleUsed(it.id);
        renderNewsList({ silent: true });
        updateNewsTicker(true);
      });

      actions.appendChild(btnUse);
      actions.appendChild(aOpen);
      actions.appendChild(btnMark);

      body.appendChild(title);
      body.appendChild(meta);
      body.appendChild(actions);

      card.appendChild(thumbWrap);
      card.appendChild(body);

      frag.appendChild(card);

      // visible-only queues
      if (resolveLinks && it.link && !it.linkResolved && (isGoogleNews(it.link) || looksLikeRedirect(it.link))) {
        visibleForResolve.push(it);
      }
      if (state.settings.onlySpanish !== false && it.title && !it.titleEs) {
        visibleForTranslate.push(it);
      }

      // OG observer (limit)
      if (ogObserver && observed < OBSERVE_OG_VISIBLE_LIMIT) {
        observed++;
        // observa si no tenemos imagen buena
        const hasGood = !!(it.imageOg || (it.image && String(it.image).startsWith("http")));
        if (!hasGood) ogObserver.observe(thumbWrap);
      }
    }

    el.newsList.appendChild(frag);
    el.newsList.scrollTop = prevScroll;

    // resolve visible
    if (resolveLinks && visibleForResolve.length) {
      const cap = Math.min(VISIBLE_RESOLVE_LIMIT, Math.max(20, showLimit * 2));
      const subset = visibleForResolve.slice(0, cap);
      runSoon(() => maybeResolveVisible(subset).catch(() => {}));
    }

    // translate visible
    if (visibleForTranslate.length) {
      const cap = Math.min(VISIBLE_TRANSLATE_LIMIT, Math.max(20, showLimit * 2));
      const subset = visibleForTranslate.slice(0, cap);
      runSoon(() => maybeTranslateVisible(subset).catch(() => {}));
    }
  }

  async function useItem(it) {
    if (!it) return;
    const resolveLinks = state.settings.resolveLinks !== false;
    const wantSpanish = state.settings.onlySpanish !== false;

    if (resolveLinks && it.link && !it.linkResolved && (isGoogleNews(it.link) || looksLikeRedirect(it.link))) {
      await maybeResolveOne(it);
    }

    // ES “siempre”: si no hay titleEs, traduce
    if (wantSpanish && !it.titleEs) {
      const es = await translateToEsCached(it.title);
      if (es) it.titleEs = es;
    }

    const shownUrl = canonicalizeUrl((resolveLinks ? (it.linkResolved || it.link) : it.link) || it.link) || "";
    const headline = cleanText((it.titleEs || it.title || "").trim());

    el.headline.value = headline;
    el.sourceUrl.value = shownUrl;

    toggleUsed(it.id, true);

    updatePreview();
    toast("✅ Cargado en plantilla.");

    // Sugerir hashtags si vacío
    if (!String(el.hashtags.value || "").trim()) {
      const h = genHashtags(headline);
      if (h) el.hashtags.value = h;
      onComposerChanged();
    }
  }

  function updateDynamicLabels() {
    const now = Date.now();
    const delay = clampNum(el.delayMin.value, 0, 120);
    const cards = el.newsList.querySelectorAll(".newsItem");
    cards.forEach(card => {
      const ms = Number(card.dataset.published || 0);
      const min = ms ? Math.max(0, Math.floor((now - ms) / 60000)) : 0;
      const ageEl = card.querySelector("[data-role='age']");
      if (ageEl) ageEl.textContent = ageLabel(min);

      const isReady = ms ? ((now - ms) >= (delay * 60 * 1000)) : false;
      const badgeEl = card.querySelector(".badge.ready, .badge.queue");
      if (badgeEl) {
        badgeEl.className = "badge " + (isReady ? "ready" : "queue");
        badgeEl.textContent = isReady ? "LISTO" : "EN COLA";
      }
    });

    tickTickerTimers();
  }

  function badge(cls, text) {
    const b = document.createElement("span");
    b.className = "badge " + cls;
    b.textContent = text;
    return b;
  }

  function linkBtn(text, href) {
    const a = document.createElement("a");
    a.className = "newsLink";
    a.href = href || "#";
    a.textContent = text;
    return a;
  }

  function ageLabel(min) {
    if (min <= 0) return "ahora";
    if (min < 60) return `hace ${min} min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `hace ${h}h ${m}m` : `hace ${h}h`;
  }

  /* ───────────────────────────── REALTIME ───────────────────────────── */
  function startRealtime() {
    if (uiTickTimer) clearInterval(uiTickTimer);
    if (autoRefreshTimer) clearInterval(autoRefreshTimer);

    uiTickTimer = setInterval(() => updateDynamicLabels(), AUTO_TICK_UI_SEC * 1000);

    const auto = state.settings.autoRefresh !== false;
    const sec = clampNum(state.settings.refreshSec ?? AUTO_REFRESH_FEEDS_SEC_DEFAULT, 15, 600);

    if (auto) {
      autoRefreshTimer = setInterval(() => refreshAll({ reason: "auto", force: false }), sec * 1000);
    }
  }

  /* ───────────────────────────── REFRESH ───────────────────────────── */
  async function refreshAll({ reason = "manual", force = false } = {}) {
    if (state.refreshInFlight) {
      state.refreshPending = true;
      if (force && state.refreshAbort) {
        try { state.refreshAbort.abort(); } catch {}
      }
      return;
    }

    state.refreshInFlight = true;
    state.refreshPending = false;

    const abort = new AbortController();
    state.refreshAbort = abort;

    try {
      setStatus(`⟳ Refrescando… (${reason})`);

      const enabled = (state.feeds || []).filter(f => f && f.url && f.enabled !== false);
      if (!enabled.length) {
        toast("⚠️ No hay feeds activos.");
        return;
      }

      const hours = clampNum(el.timeFilter.value, 1, 72);
      const minMs = Date.now() - hours * 60 * 60 * 1000;

      // caps
      const fetchCap = clampNum(state.settings.fetchCap ?? (el.fetchCap ? el.fetchCap.value : 240), 80, 2000);
      const keepCap = Math.max(140, Math.min(2400, fetchCap * 2));

      // batch
      const batch = clampNum(state.settings.batchFeeds ?? (el.batchFeeds ? el.batchFeeds.value : 12), 4, 50);

      const jobsAll = enabled.filter(f => {
        if (force) return true;
        const ff = feedFail.get(f.url);
        if (!ff) return true;
        return Date.now() >= Number(ff.nextAt || 0);
      });

      const jobs = force ? jobsAll : pickBatchRoundRobin(jobsAll, batch);

      const results = [];
      await pool(jobs, FEED_CONCURRENCY, async (f) => {
        const out = await fetchOneFeed(f, abort.signal, force, fetchCap).catch(() => {
          bumpFeedFail(String(f?.url || ""));
          return [];
        });
        if (out && out.length) results.push(...out);
      });

      // merge + dedupe
      const merged = dedupeNormalize([...(state.items || []), ...results]);

      // purga por ventana
      const fresh = merged
        .filter(it => Number(it.publishedMs || 0) >= minMs)
        .sort((a, b) => (Number(b.publishedMs || 0) - Number(a.publishedMs || 0)))
        .slice(0, keepCap);

      state.items = fresh;

      lastRefreshAt = Date.now();
      setStatus(`✅ OK · ${state.items.length} items`);

      hardTrimAndPurge();

      renderNewsList({ silent: true });
      updateNewsTicker(true);

      // trends: refresca en boot / manual
      if (reason === "boot" || reason.startsWith("manual")) {
        requestTrendsRefresh({ reason: "news_refresh" }).catch(() => {});
      }
    } catch (e) {
      console.warn(e);
      toast("⚠️ Error refrescando.");
    } finally {
      state.refreshInFlight = false;
      state.refreshAbort = null;

      if (state.refreshPending) {
        state.refreshPending = false;
        refreshAll({ reason: "queued", force: false }).catch(() => {});
      }
    }
  }

  function pickBatchRoundRobin(arr, n) {
    const list = arr || [];
    if (list.length <= n) return list.slice();
    const start = Math.floor(Math.random() * list.length);
    const out = [];
    for (let i = 0; i < list.length && out.length < n; i++) {
      out.push(list[(start + i) % list.length]);
    }
    return out;
  }

  function bumpFeedFail(url) {
    const u = String(url || "");
    if (!u) return;
    const prev = feedFail.get(u) || { fails: 0, nextAt: 0 };
    const fails = Math.min(20, Number(prev.fails || 0) + 1);
    const backoff = Math.min(FEED_FAIL_BACKOFF_MAX_MS, FEED_FAIL_BACKOFF_BASE_MS * fails);
    feedFail.set(u, { fails, nextAt: Date.now() + backoff });
  }

  /* ───────────────────────────── FETCH & PARSE FEEDS ───────────────────────────── */
  async function fetchOneFeed(feed, signal, force, fetchCap) {
    const url = cleanText(feed?.url || "");
    if (!url) return [];

    // de-dup “texto igual” en sesión
    const text = await fetchTextSmart(url, signal, 14_000);
    if (!text) return [];

    const h = hashId(text.slice(0, 8000));
    const prevHash = feedTextHash.get(url);
    if (!force && prevHash && prevHash === h) return [];
    feedTextHash.set(url, h);

    // JSON?
    if (looksJson(text) || url.includes("format=json") || url.includes("mode=ArtList")) {
      const j = safeJson(text);
      return parseJsonFeed(j, feed?.name || "Feed").slice(0, fetchCap);
    }

    // XML?
    return parseXmlFeed(text, feed?.name || "Feed").slice(0, fetchCap);
  }

  async function fetchTextSmart(url, signal, timeoutMs = 12_000) {
    const u = String(url || "").trim();
    if (!u) return "";

    // 1) direct
    const direct = await fetchText(u, { signal, timeoutMs }).catch(() => "");
    if (direct) return direct;

    // 2) allorigins raw
    const ao = `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`;
    const viaAo = await fetchText(ao, { signal, timeoutMs }).catch(() => "");
    if (viaAo) return viaAo;

    // 3) r.jina.ai (último recurso)
    const jina = `https://r.jina.ai/http://${u.replace(/^https?:\/\//i, "")}`;
    const viaJina = await fetchText(jina, { signal, timeoutMs }).catch(() => "");
    return viaJina || "";
  }

  async function fetchText(url, { signal, timeoutMs = 12_000 } = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const sig = mergeSignals(signal, ctrl.signal);

    try {
      const res = await fetch(url, { signal: sig, cache: "no-store" });
      if (!res || !res.ok) return "";
      return await res.text();
    } catch {
      return "";
    } finally {
      clearTimeout(t);
    }
  }

  function mergeSignals(a, b) {
    if (!a) return b;
    if (!b) return a;
    if ("AbortSignal" in window && AbortSignal.any) {
      try { return AbortSignal.any([a, b]); } catch {}
    }
    // fallback: devolvemos b para garantizar timeout
    return b;
  }

  function parseXmlFeed(xmlText, feedName) {
    const out = [];
    let doc = null;
    try {
      doc = new DOMParser().parseFromString(xmlText, "text/xml");
    } catch {
      return out;
    }
    if (!doc) return out;

    const isRss = !!doc.querySelector("rss, channel, item");
    const isAtom = !!doc.querySelector("feed, entry");

    if (isRss) {
      const items = Array.from(doc.querySelectorAll("item"));
      for (const it of items) {
        const title = pickText(it, "title");
        const link = pickText(it, "link") || pickAttr(it, "link", "href");
        const pub = pickText(it, "pubDate") || pickText(it, "date") || pickText(it, "dc\\:date") || pickText(it, "published");
        const publishedMs = parseDateMs(pub) || Date.now();

        const img =
          pickAttr(it, "enclosure", "url") ||
          pickAttr(it, "media\\:content", "url") ||
          pickAttr(it, "media\\:thumbnail", "url") ||
          "";

        const cat = detectCategory(title + " " + feedName);

        out.push({
          id: "",
          title: cleanText(title),
          titleEs: "",
          feed: String(feedName || "Feed"),
          link: canonicalizeUrl(link),
          linkResolved: "",
          publishedMs,
          image: canonicalizeUrl(img),
          imageOg: "",
          cat,
        });
      }
      return out.map(normalizeItem).filter(Boolean);
    }

    if (isAtom) {
      const entries = Array.from(doc.querySelectorAll("entry"));
      for (const en of entries) {
        const title = pickText(en, "title");
        const link =
          pickAttrByRel(en, "link", "alternate", "href") ||
          pickAttr(en, "link", "href") ||
          pickText(en, "link");

        const pub = pickText(en, "published") || pickText(en, "updated") || pickText(en, "dc\\:date");
        const publishedMs = parseDateMs(pub) || Date.now();

        const img =
          pickAttr(en, "media\\:content", "url") ||
          pickAttr(en, "media\\:thumbnail", "url") ||
          "";

        const cat = detectCategory(title + " " + feedName);

        out.push({
          id: "",
          title: cleanText(title),
          titleEs: "",
          feed: String(feedName || "Feed"),
          link: canonicalizeUrl(link),
          linkResolved: "",
          publishedMs,
          image: canonicalizeUrl(img),
          imageOg: "",
          cat,
        });
      }
      return out.map(normalizeItem).filter(Boolean);
    }

    return out;
  }

  function parseJsonFeed(j, feedName) {
    const out = [];
    const name = String(feedName || "Feed");

    // GDELT doc
    if (j && j.articles && Array.isArray(j.articles)) {
      for (const a of j.articles) {
        const title = cleanText(a?.title || "");
        const link = canonicalizeUrl(a?.url || "");
        const publishedMs = parseDateMs(a?.seendate) || parseDateMs(a?.date) || Date.now();
        const img = canonicalizeUrl(a?.image || a?.socialimage || "");
        const cat = detectCategory(title + " " + name);

        out.push({
          id: "",
          title,
          titleEs: "",
          feed: name,
          link,
          linkResolved: "",
          publishedMs,
          image: img,
          imageOg: "",
          cat,
        });
      }
      return out.map(normalizeItem).filter(Boolean);
    }

    // JSONFeed (spec)
    if (j && Array.isArray(j.items)) {
      for (const it of j.items) {
        const title = cleanText(it?.title || "");
        const link = canonicalizeUrl(it?.url || it?.external_url || "");
        const publishedMs = parseDateMs(it?.date_published || it?.date_modified) || Date.now();
        const img = canonicalizeUrl(it?.image || it?.banner_image || "");
        const cat = detectCategory(title + " " + name);

        out.push({
          id: "",
          title,
          titleEs: "",
          feed: name,
          link,
          linkResolved: "",
          publishedMs,
          image: img,
          imageOg: "",
          cat,
        });
      }
      return out.map(normalizeItem).filter(Boolean);
    }

    return out;
  }

  function normalizeItem(it) {
    if (!it) return null;
    it.title = cleanText(it.title || "");
    it.link = canonicalizeUrl(it.link || "");
    it.publishedMs = Number(it.publishedMs || 0) || 0;
    it.feed = String(it.feed || "Feed");
    it.cat = String(it.cat || "all");
    it.image = canonicalizeUrl(it.image || "");
    it.imageOg = canonicalizeUrl(it.imageOg || "");
    it.linkResolved = canonicalizeUrl(it.linkResolved || "");
    it.id = it.id || hashId(`${normalizeTitleKey(it.title || "")}|${it.link || ""}|${it.publishedMs || 0}`);
    return it;
  }

  function dedupeNormalize(arr) {
    const map = new Map();
    for (const it of (arr || [])) {
      if (!it) continue;
      const n = normalizeItem({ ...it });
      if (!n || !n.id) continue;
      const prev = map.get(n.id);
      if (!prev) {
        map.set(n.id, n);
      } else {
        prev.title = prev.title || n.title;
        prev.titleEs = prev.titleEs || n.titleEs;
        prev.feed = prev.feed || n.feed;
        prev.link = prev.link || n.link;
        prev.linkResolved = prev.linkResolved || n.linkResolved;
        prev.publishedMs = Math.max(Number(prev.publishedMs || 0), Number(n.publishedMs || 0));
        prev.image = prev.image || n.image;
        prev.imageOg = prev.imageOg || n.imageOg;
        prev.cat = prev.cat || n.cat;
        map.set(prev.id, prev);
      }
    }
    return Array.from(map.values());
  }

  function hardTrimAndPurge() {
    const fetchCap = clampNum(state.settings.fetchCap ?? (el.fetchCap ? el.fetchCap.value : 240), 80, 2000);
    const keepCap = Math.max(140, Math.min(2400, fetchCap * 2));
    state.items = (state.items || [])
      .sort((a, b) => Number(b.publishedMs || 0) - Number(a.publishedMs || 0))
      .slice(0, keepCap);
  }

  /* ───────────────────────────── RESOLVE LINKS ───────────────────────────── */
  async function maybeResolveVisible(items) {
    const resolveLinks = state.settings.resolveLinks !== false;
    if (!resolveLinks) return;

    const targets = (items || [])
      .filter(it => it && it.link && !it.linkResolved && (isGoogleNews(it.link) || looksLikeRedirect(it.link)))
      .slice(0, VISIBLE_RESOLVE_LIMIT);

    if (!targets.length) return;

    await pool(targets, RESOLVE_CONCURRENCY, async (it) => {
      await maybeResolveOne(it).catch(() => {});
    });

    renderNewsList({ silent: true });
    updateNewsTicker(true);
  }

  async function maybeResolveOne(it) {
    if (!it || !it.link) return;
    const link = canonicalizeUrl(it.link);
    if (!link) return;

    const key = "res|" + link;
    const cached = readCache(resolveCache, key);
    if (cached) {
      it.linkResolved = cached;
      return;
    }

    if (resInFlight.has(key)) {
      const out = await resInFlight.get(key).catch(() => "");
      if (out) it.linkResolved = out;
      return;
    }

    const p = (async () => {
      const resolved = await resolveToRealUrl(link);
      const clean = canonicalizeUrl(resolved);
      if (clean) {
        writeCache(resolveCache, key, clean, RESOLVE_CACHE_LIMIT, LS_RESOLVE_CACHE);
        return clean;
      }
      return "";
    })();

    resInFlight.set(key, p);
    const out = await p.catch(() => "");
    resInFlight.delete(key);
    if (out) it.linkResolved = out;
  }

  async function resolveToRealUrl(url) {
    const u = canonicalizeUrl(url);
    if (!u) return "";

    // 1) follow redirect (best-effort)
    const direct = await tryFollowRedirect(u);
    if (direct && !isGoogleNews(direct)) return direct;

    // 2) allorigins/html parse
    const html = await fetchTextSmart(u, null, 12_000);
    if (html) {
      const fromMeta = pickMetaRefresh(html);
      if (fromMeta) return fromMeta;

      const gn = pickFirstHttpUrl(html, u);
      if (gn) return gn;
    }

    // 3) r.jina.ai
    const jina = `https://r.jina.ai/http://${u.replace(/^https?:\/\//i, "")}`;
    const html2 = await fetchText(jina, { timeoutMs: 12_000 }).catch(() => "");
    if (html2) {
      const fromMeta2 = pickMetaRefresh(html2);
      if (fromMeta2) return fromMeta2;
      const gn2 = pickFirstHttpUrl(html2, u);
      if (gn2) return gn2;
    }

    return direct || "";
  }

  async function tryFollowRedirect(url) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 9000);
      const res = await fetch(url, { method: "GET", redirect: "follow", cache: "no-store", signal: ctrl.signal });
      clearTimeout(t);
      if (!res) return "";
      return canonicalizeUrl(res.url || "");
    } catch {
      return "";
    }
  }

  function pickMetaRefresh(html) {
    const s = String(html || "");
    const m = s.match(/http-equiv=["']refresh["'][^>]*content=["'][^"']*url=([^"']+)["']/i);
    if (m && m[1]) return canonicalizeUrl(decodeHtml(m[1]));
    const m2 = s.match(/content=["'][^"']*url=['"]?([^"']+)['"]?["']/i);
    if (m2 && m2[1]) return canonicalizeUrl(decodeHtml(m2[1]));
    return "";
  }

  function pickFirstHttpUrl(html, fallbackBase) {
    const s = String(html || "");
    const urls = s.match(/https?:\/\/[^\s"'<>]+/g) || [];
    const clean = urls
      .map(u => canonicalizeUrl(u))
      .filter(Boolean)
      .filter(u => !/news\.google\.com|accounts\.google\.com|google\.com\/s2\/favicons/i.test(u));

    if (clean.length) return clean[0];

    const all = urls.map(u => canonicalizeUrl(u)).filter(Boolean);
    const base = canonicalizeUrl(fallbackBase);
    for (const u of all) {
      if (!base || u !== base) return u;
    }
    return "";
  }

  /* ───────────────────────────── TRANSLATE ES ───────────────────────────── */
  async function maybeTranslateVisible(items) {
    const wantSpanish = state.settings.onlySpanish !== false;
    if (!wantSpanish) return;

    const targets = (items || [])
      .filter(it => it && it.title && !it.titleEs)
      .slice(0, VISIBLE_TRANSLATE_LIMIT);

    if (!targets.length) return;

    await pool(targets, TR_CONCURRENCY, async (it) => {
      const es = await translateToEsCached(it.title).catch(() => "");
      if (es) it.titleEs = es;
    });

    renderNewsList({ silent: true });
    updateNewsTicker(true);
  }

  async function translateToEsCached(text) {
    const t = cleanText(text || "");
    if (!t) return "";

    const key = "tr|es|" + normalizeTitleKey(t).slice(0, 220);
    const cached = readCache(trCache, key);
    if (cached) return cached;

    if (trInFlight.has(key)) return await trInFlight.get(key).catch(() => "");

    const p = (async () => {
      const url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=es&dt=t&q=" + encodeURIComponent(t);
      const raw = await fetchTextSmart(url, null, 12_000);
      if (!raw) return "";
      const j = safeJson(raw);
      const out = Array.isArray(j) ? String(((j[0] || [])[0] || [])[0] || "") : "";
      const es = cleanText(out) || "";
      if (es) writeCache(trCache, key, es, TR_CACHE_LIMIT, LS_TR_CACHE);
      return es;
    })();

    trInFlight.set(key, p);
    const out = await p.catch(() => "");
    trInFlight.delete(key);
    return out || "";
  }

  /* ───────────────────────────── OG IMAGES (visible-only) ───────────────────────────── */
  function setupOgObserver() {
    if (!("IntersectionObserver" in window)) return;
    ogObserver = new IntersectionObserver((entries) => {
      const visible = entries.filter(e => e.isIntersecting).map(e => e.target).slice(0, OBSERVE_OG_VISIBLE_LIMIT);
      if (!visible.length) return;

      const items = [];
      for (const elThumb of visible) {
        const card = elThumb.closest(".newsItem");
        const id = card?.dataset?.id || "";
        const it = (state.items || []).find(x => x.id === id);
        if (it) items.push(it);
      }

      if (items.length) {
        pool(items, IMG_CONCURRENCY, async (it) => {
          await maybeFetchOgImage(it).catch(() => {});
        }).then(() => {
          renderNewsList({ silent: true });
          updateNewsTicker(true);
        }).catch(() => {});
      }

      for (const e of entries) if (e.isIntersecting) ogObserver.unobserve(e.target);
    }, { root: null, threshold: 0.15 });
  }

  async function maybeFetchOgImage(it) {
    if (!it) return;
    if (it.imageOg) return;

    const resolveLinks = state.settings.resolveLinks !== false;
    const shownUrl = canonicalizeUrl((resolveLinks ? (it.linkResolved || it.link) : it.link) || it.link);
    if (!shownUrl) return;

    const key = "og|" + shownUrl;
    const cached = readCache(imgCache, key);
    if (cached) {
      it.imageOg = cached;
      return;
    }

    if (imgInFlight.has(key)) {
      const out = await imgInFlight.get(key).catch(() => "");
      if (out) it.imageOg = out;
      return;
    }

    const p = (async () => {
      const html = await fetchTextSmart(shownUrl, null, OG_FETCH_TIMEOUT_MS);
      if (!html) return "";

      const og =
        pickMetaImage(html, "og:image") ||
        pickMetaImage(html, "twitter:image") ||
        pickMetaImage(html, "twitter:image:src") ||
        pickJsonLdImage(html);

      const clean = canonicalizeUrl(og);
      if (clean) {
        writeCache(imgCache, key, clean, IMG_CACHE_LIMIT, LS_IMG_CACHE);
        return clean;
      }
      return "";
    })();

    imgInFlight.set(key, p);
    const out = await p.catch(() => "");
    imgInFlight.delete(key);
    if (out) it.imageOg = out;
  }

  function pickMetaImage(html, prop) {
    const s = String(html || "");
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${escapeReg(prop)}["'][^>]+content=["']([^"']+)["']`, "i");
    const m = s.match(re);
    if (m && m[1]) return cleanText(decodeHtml(m[1]));
    return "";
  }

  function pickJsonLdImage(html) {
    const s = String(html || "");
    const blocks = s.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi);
    if (!blocks) return "";
    for (const b of blocks) {
      const raw = b.replace(/^[\s\S]*?>/, "").replace(/<\/script>[\s\S]*$/, "");
      const j = safeJson(raw);
      const img =
        j?.image?.url ||
        j?.image ||
        (Array.isArray(j?.image) ? (j.image[0]?.url || j.image[0] || "") : "") ||
        (Array.isArray(j) ? (j.find(x => x?.image)?.image?.url || j.find(x => x?.image)?.image || "") : "");
      const sImg = (typeof img === "string") ? img : "";
      if (sImg) return cleanText(sImg);
    }
    return "";
  }

  function pickBestThumb(it, shownUrl) {
    if (!it) return "";
    const og = canonicalizeUrl(it.imageOg);
    if (og) return og;

    const rss = canonicalizeUrl(it.image);
    if (rss) return rss;

    if (shownUrl) return faviconUrl(shownUrl);
    return "";
  }

  function faviconUrl(url) {
    try {
      const u = new URL(String(url || ""));
      return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(u.hostname)}&sz=128`;
    } catch {
      return "";
    }
  }

  /* ───────────────────────────── FEEDS MODAL ───────────────────────────── */
  function renderFeedsModal() {
    el.feedList.innerHTML = "";
    const feeds = state.feeds || [];
    feeds.forEach((f, idx) => {
      const row = document.createElement("div");
      row.className = "feedRow";

      const tog = document.createElement("input");
      tog.type = "checkbox";
      tog.checked = f.enabled !== false;
      tog.addEventListener("change", () => { f.enabled = !!tog.checked; });

      const nameInput = document.createElement("input");
      nameInput.className = "ctl";
      nameInput.value = f.name || "";
      nameInput.placeholder = "Nombre";
      nameInput.addEventListener("input", () => { f.name = nameInput.value; });

      const urlInput = document.createElement("input");
      urlInput.className = "ctl";
      urlInput.value = f.url || "";
      urlInput.placeholder = "URL RSS/Atom o JSON";
      urlInput.addEventListener("input", () => { f.url = urlInput.value; });

      const del = document.createElement("button");
      del.className = "btn ghost";
      del.type = "button";
      del.textContent = "Borrar";
      del.addEventListener("click", () => {
        state.feeds.splice(idx, 1);
        renderFeedsModal();
      });

      row.appendChild(tog);
      row.appendChild(nameInput);
      row.appendChild(urlInput);
      row.appendChild(del);

      el.feedList.appendChild(row);
    });
  }

  function normalizeFeed(f) {
    const o = { ...f };
    o.name = cleanText(o.name || "Feed") || "Feed";
    o.url = cleanText(o.url || "");
    o.enabled = o.enabled !== false;
    return o;
  }

  /* ───────────────────────────── SETTINGS / STORAGE HELPERS ───────────────────────────── */
  function loadTemplate() {
    const t = String(localStorage.getItem(LS_TEMPLATE) || "");
    if (t) return t;
    const v3 = String(localStorage.getItem(LS_TEMPLATE_V3) || "");
    if (v3) {
      localStorage.setItem(LS_TEMPLATE, v3);
      return v3;
    }
    return DEFAULT_TEMPLATE;
  }

  function saveTemplate(t) {
    try { localStorage.setItem(LS_TEMPLATE, String(t || "")); } catch {}
  }

  function loadFeeds() {
    const j = loadJsonPreferNew(LS_FEEDS, LS_FEEDS_V3, null);
    if (Array.isArray(j) && j.length) return j.map(normalizeFeed);
    const d = DEFAULT_FEEDS.map(f => ({ ...f }));
    try { localStorage.setItem(LS_FEEDS, JSON.stringify(d)); } catch {}
    return d.map(normalizeFeed);
  }

  function saveFeeds(feeds) {
    try { localStorage.setItem(LS_FEEDS, JSON.stringify(feeds || [])); } catch {}
  }

  function loadSettings() {
    const j = loadJsonPreferNew(LS_SETTINGS, LS_SETTINGS_V3, {});
    return (j && typeof j === "object") ? j : {};
  }

  function saveSetting(k, v) {
    try {
      state.settings = state.settings || {};
      state.settings[k] = v;
      localStorage.setItem(LS_SETTINGS, JSON.stringify(state.settings));
    } catch {}
  }

  function loadUsedSet() {
    const arr = loadJsonPreferNew(LS_USED, LS_USED_V3, []);
    const s = new Set();
    if (Array.isArray(arr)) arr.forEach(x => s.add(String(x)));
    return s;
  }

  function toggleUsed(id, forceVal = null) {
    const key = String(id || "");
    if (!key) return;

    const has = state.used.has(key);
    const want = (forceVal === null) ? !has : !!forceVal;

    if (want) state.used.add(key);
    else state.used.delete(key);

    try {
      const arr = Array.from(state.used).slice(0, 4000);
      localStorage.setItem(LS_USED, JSON.stringify(arr));
    } catch {}
  }

  function loadJsonPreferNew(kNew, kOld, fallback) {
    const a = safeJson(localStorage.getItem(kNew));
    if (a !== null && a !== undefined) return a;
    if (kOld) {
      const b = safeJson(localStorage.getItem(kOld));
      if (b !== null && b !== undefined) {
        try { localStorage.setItem(kNew, JSON.stringify(b)); } catch {}
        return b;
      }
    }
    return fallback;
  }

  function safeJson(s) {
    try {
      if (s === null || s === undefined) return null;
      const str = String(s).trim();
      if (!str) return null;
      return JSON.parse(str);
    } catch {
      return null;
    }
  }

  function readCache(cacheObj, key) {
    try {
      const v = cacheObj?.[key];
      if (!v) return "";
      if (typeof v === "string") return v;
      if (v && typeof v === "object" && v.v && (!v.t || (Date.now() - Number(v.t)) < 30 * 24 * 60 * 60 * 1000)) {
        return String(v.v || "");
      }
      return "";
    } catch {
      return "";
    }
  }

  function writeCache(cacheObj, key, value, limit, lsKey) {
    try {
      cacheObj[key] = { v: String(value || ""), t: Date.now() };

      const keys = Object.keys(cacheObj);
      if (keys.length > limit) {
        keys.sort((a, b) => Number(cacheObj[a]?.t || 0) - Number(cacheObj[b]?.t || 0));
        const drop = keys.slice(0, Math.max(20, keys.length - limit));
        drop.forEach(k => { delete cacheObj[k]; });
      }

      localStorage.setItem(lsKey, JSON.stringify(cacheObj));
    } catch {}
  }

  /* ───────────────────────────── HELPERS ───────────────────────────── */
  function clampNum(v, min, max) {
    const n = Number(v);
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function cleanText(s) {
    return String(s || "").replace(/\s+/g, " ").trim();
  }

  function looksJson(text) {
    const s = String(text || "").trim();
    return s.startsWith("{") || s.startsWith("[");
  }

  function canonicalizeUrl(u) {
    const s = String(u || "").trim();
    if (!s) return "";
    const d = decodeHtml(s);
    const x = d.replace(/^["']|["']$/g, "").trim();
    if (!/^https?:\/\//i.test(x)) return x.startsWith("www.") ? ("https://" + x) : x;
    try {
      const url = new URL(x);
      ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"].forEach(p => url.searchParams.delete(p));
      return url.toString();
    } catch {
      return x;
    }
  }

  function getDomain(url) {
    try { return new URL(String(url || "")).hostname.replace(/^www\./i, ""); } catch { return ""; }
  }

  function parseDateMs(s) {
    const t = String(s || "").trim();
    if (!t) return 0;
    const ms = Date.parse(t);
    if (Number.isFinite(ms) && ms > 0) return ms;
    const ms2 = Date.parse(t.replace(" ", "T"));
    if (Number.isFinite(ms2) && ms2 > 0) return ms2;
    return 0;
  }

  function pickText(root, sel) {
    try {
      const n = root.querySelector(sel);
      return n ? (n.textContent || "") : "";
    } catch {
      return "";
    }
  }

  function pickAttr(root, sel, attr) {
    try {
      const n = root.querySelector(sel);
      return n ? (n.getAttribute(attr) || "") : "";
    } catch {
      return "";
    }
  }

  function pickAttrByRel(root, sel, relValue, attr) {
    try {
      const nodes = Array.from(root.querySelectorAll(sel));
      const found = nodes.find(n => String(n.getAttribute("rel") || "").toLowerCase() === String(relValue || "").toLowerCase());
      return found ? (found.getAttribute(attr) || "") : "";
    } catch {
      return "";
    }
  }

  function decodeHtml(s) {
    const str = String(s || "");
    if (!str.includes("&")) return str;
    const txt = document.createElement("textarea");
    txt.innerHTML = str;
    return txt.value;
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeReg(s) {
    return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function normalizeTitleKey(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/https?:\/\/\S+/g, "")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function detectCategory(text) {
    const s = normalizeTitleKey(text);
    const has = (re) => re.test(s);

    if (has(/\b(otannato|ucrania|ukraine|rusia|russia|misil|dron|drone|guerra|war|sanction|sancion)\b/i)) return "war";
    if (has(/\b(pedro sanchez|moncloa|congreso|senado|eleccion|gobierno|ministro|parlamento|pp|psoe|vox)\b/i)) return "politics";
    if (has(/\b(ibex|bce|ecb|inflacion|pib|euribor|bolsa|mercado|tipo(s)? de interes|interest rate|recesion)\b/i)) return "economy";
    if (has(/\b(openai|ia|ai|ciber|hack|malware|microsoft|google|apple|meta|amazon)\b/i)) return "tech";
    if (has(/\b(crimen|detenido|policia|juzgado|juicio|suceso|asesin|robo|fraude)\b/i)) return "crime";
    if (has(/\b(oms|who|vacuna|brote|salud|virus|hospital)\b/i)) return "health";
    if (has(/\b(real madrid|barcelona|laliga|champions|gol|fichaje|lesion)\b/i)) return "sports";
    if (has(/\b(netflix|serie|pelicula|concierto|festival|musica|actor|actriz)\b/i)) return "ent";
    return "all";
  }

  function calcImpact(it) {
    const now = Date.now();
    const ageMin = Math.max(0, Math.floor((now - Number(it?.publishedMs || 0)) / 60000));
    const title = String(it?.titleEs || it?.title || "").toLowerCase();
    const feed = String(it?.feed || "").toLowerCase();
    const link = String(it?.linkResolved || it?.link || "").toLowerCase();

    let score = 0;

    // frescura
    if (ageMin <= 10) score += 35;
    else if (ageMin <= 30) score += 25;
    else if (ageMin <= 90) score += 15;
    else score += 5;

    // fuentes fuertes
    if (feed.includes("reuters") || link.includes("reuters.com")) score += 22;
    if (feed.includes("europa press") || link.includes("europapress.es")) score += 14;
    if (feed.includes("rtve") || link.includes("rtve.es")) score += 10;
    if (feed.includes("google news")) score += 6;

    // keywords
    const hot = [
      "última hora", "urgente", "breaking", "explosión", "atentado", "tiroteo", "dimite", "dimisión",
      "sanciones", "misil", "dron", "ofensiva", "bombardeo", "muertos", "heridos", "detenido",
      "juicio", "tribunal", "nato", "otan", "ucrania", "rusia", "bce", "inflación", "ibex"
    ];
    for (const k of hot) if (title.includes(k)) score += 6;

    return Math.max(0, Math.min(100, score));
  }

  function genHashtags(headline) {
    const h = normalizeTitleKey(headline);
    if (!h) return "";

    const stop = new Set([
      "el", "la", "los", "las", "de", "del", "y", "en", "a", "un", "una", "unos", "unas", "que", "por", "para", "con", "sin",
      "al", "se", "su", "sus", "como", "mas", "menos", "sobre", "tras", "ante", "entre", "desde", "hasta", "hoy", "ayer"
    ]);

    const words = h.split(" ").filter(w => w && w.length >= 4 && !stop.has(w));
    if (!words.length) return "";

    const freq = new Map();
    for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);

    const top = Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .map(x => x[0])
      .slice(0, 4);

    const tags = top.map(w => "#" + w.replace(/[^\p{L}\p{N}]/gu, "")).filter(Boolean).slice(0, 3);
    return tags.join(" ");
  }

  function smartTrimHeadline(s, maxLen = 120) {
    const t = cleanText(s || "");
    if (t.length <= maxLen) return t;
    const slice = t.slice(0, maxLen + 1);
    const cut = slice.lastIndexOf(" ");
    const out = (cut > 30 ? slice.slice(0, cut) : t.slice(0, maxLen)).trim();
    return out.replace(/[,:;\-–—]\s*$/g, "").trim() + "…";
  }

  function twCharCount(text) {
    return String(text || "").length;
  }

  function hashId(s) {
    const str = String(s || "");
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
  }

  function isGoogleNews(url) {
    return /(^|\/\/)news\.google\.com\//i.test(String(url || ""));
  }

  function looksLikeRedirect(url) {
    const u = String(url || "").toLowerCase();
    return u.includes("news.google.com/rss/articles") || u.includes("news.google.com/articles") || u.includes("news.google.com/rss");
  }

  function debounce(fn, ms) {
    let t = 0;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  function runSoon(fn) {
    setTimeout(fn, 0);
  }

  async function pool(items, concurrency, worker) {
    const arr = items || [];
    const n = Math.max(1, Number(concurrency || 1));
    let i = 0;
    const runners = new Array(Math.min(n, arr.length)).fill(0).map(async () => {
      while (i < arr.length) {
        const idx = i++;
        await worker(arr[idx]);
      }
    });
    await Promise.all(runners);
  }

  async function copyToClipboard(text) {
    const t = String(text || "");
    if (!t) return;
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(t);
      return;
    }
    const ta = document.createElement("textarea");
    ta.value = t;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }

  /* ───────────────────────────── PWA / SERVICE WORKER ───────────────────────────── */
  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("./sw.js")
      .then((reg) => {
        swReg = reg;

        if (swUpdateTimer) clearInterval(swUpdateTimer);
        swUpdateTimer = setInterval(() => {
          try { swReg.update(); } catch {}
        }, SW_UPDATE_CHECK_MS);

        navigator.serviceWorker.addEventListener("controllerchange", () => {
          try {
            const already = sessionStorage.getItem(SW_FORCE_RELOAD_GUARD);
            if (already) return;
            sessionStorage.setItem(SW_FORCE_RELOAD_GUARD, "1");
            location.reload();
          } catch {
            location.reload();
          }
        });

        if (reg.waiting) {
          try { reg.waiting.postMessage({ type: "SKIP_WAITING" }); } catch {}
        }

        reg.addEventListener("updatefound", () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener("statechange", () => {
            if (nw.state === "installed") {
              if (navigator.serviceWorker.controller) {
                try { reg.waiting?.postMessage({ type: "SKIP_WAITING" }); } catch {}
              }
            }
          });
        });
      })
      .catch(() => {});
  }

  /* ───────────────────────────── TICKERS (NEWS + TRENDS) ───────────────────────────── */

  // IMPORTANT: visual homogéneo:
  // - Este CSS es SOLO fallback. Si tu styles.css ya tiene .tnpTicker*, manda tu CSS.
  // - Usamos tus variables: --border y --blue.
  function injectTickerCssFallback() {
    if (document.getElementById("tnpTickerCSS")) return;

    // Si detectamos que el styles.css ya define tnpTickerBar (por ejemplo por overrides), evitamos inyectar mucho.
    // Aun así, metemos solo keyframes + básicos mínimos para que no “rompa” en caso de ausencia.
    const css = document.createElement("style");
    css.id = "tnpTickerCSS";
    css.textContent = `
      /* ── TNP TICKERS (fallback minimal, homogéneo con styles.css) ── */
      @keyframes tnpMarquee {
        0% { transform: translateX(0); }
        100% { transform: translateX(-50%); }
      }
      .tnpTickerInner{
        will-change: transform;
        animation: tnpMarquee 28s linear infinite;
      }
      .tnpTickerBar:hover .tnpTickerInner{ animation-play-state: paused; }
      .tnpTickerDot{
        background: var(--blue, #1d9bf0);
      }
    `;
    document.head.appendChild(css);
  }

  function ensureTickers() {
    if (state.ticker.ready) return;

    const topbar = document.querySelector(".topbar");
    if (!topbar) return;

    const existing = document.getElementById("tnpTickerBar");
    if (existing) {
      state.ticker.ready = true;
      return;
    }

    const bar = document.createElement("div");
    bar.className = "tnpTickerBar";
    bar.id = "tnpTickerBar";
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "Ticker de noticias y tendencias");

    const left = document.createElement("div");
    left.className = "tnpTickerLabel";
    left.innerHTML = `<span class="tnpTickerDot" aria-hidden="true"></span><span>LIVE</span>`;

    const track = document.createElement("div");
    track.className = "tnpTickerTrack";

    const inner = document.createElement("div");
    inner.className = "tnpTickerInner";
    inner.id = "tnpTickerInner";
    inner.setAttribute("aria-live", "polite");
    inner.setAttribute("aria-atomic", "true");

    track.appendChild(inner);

    const pop = document.createElement("div");
    pop.className = "tnpPop";

    const popChip = document.createElement("div");
    popChip.className = "tnpPopChip";
    popChip.id = "tnpTrendsPop";
    popChip.title = "Click: añadir al campo HASHTAGS";
    popChip.innerHTML = `<span class="tnpPopTag">#Tendencias</span><span class="tnpPopMeta">cargando…</span>`;
    popChip.addEventListener("click", () => {
      const tag = String(popChip.dataset.tag || "").trim();
      if (!tag) return;
      const cur = String(el.hashtags.value || "").trim();
      const add = tag.startsWith("#") ? tag : ("#" + tag.replace(/\s+/g, ""));
      const next = mergeHashtags(cur, add);
      el.hashtags.value = next;
      onComposerChanged();
      toast(`🏷 Añadido: ${add}`);
    });

    pop.appendChild(popChip);

    bar.appendChild(left);
    bar.appendChild(track);
    bar.appendChild(pop);

    // Insert after header (no rompe layout del header)
    topbar.insertAdjacentElement("afterend", bar);

    state.ticker.ready = true;
  }

  function mergeHashtags(cur, add) {
    const a = String(add || "").trim();
    if (!a) return String(cur || "").trim();
    const set = new Set(String(cur || "").split(/\s+/g).map(x => x.trim()).filter(Boolean));
    set.add(a);
    return Array.from(set).slice(0, 6).join(" ");
  }

  function updateNewsTicker(force = false) {
    if (!state.ticker.ready) return;

    const resolveLinks = state.settings.resolveLinks !== false;
    const wantSpanish = state.settings.onlySpanish !== false;

    const hours = clampNum(el.timeFilter.value, 1, 72);
    const minMs = Date.now() - (hours * 60 * 60 * 1000);

    const items = (state.items || [])
      .filter(it => it && Number(it.publishedMs || 0) >= minMs)
      .map(it => ({ it, impact: calcImpact(it) }))
      .filter(x => x.impact >= TICKER_NEWS_MIN_IMPACT)
      .sort((a, b) => (b.impact - a.impact) || (Number(b.it.publishedMs || 0) - Number(a.it.publishedMs || 0)))
      .slice(0, TICKER_NEWS_MAX);

    const sig = items.map(x => x.it.id).join("|") + "|" + String(wantSpanish) + "|" + String(resolveLinks);
    if (!force && sig === state.ticker.newsSig) return;
    state.ticker.newsSig = sig;

    state.ticker.news = items.map(x => x.it);

    const inner = document.getElementById("tnpTickerInner");
    if (!inner) return;

    inner.innerHTML = "";

    const buildItemEl = (it) => {
      const shownUrl = canonicalizeUrl((resolveLinks ? (it.linkResolved || it.link) : it.link) || it.link) || "";
      const title = cleanText((wantSpanish ? (it.titleEs || it.title) : (it.title || it.titleEs)) || "");
      const domain = shownUrl ? getDomain(shownUrl) : (it.feed || "news");

      const pill = document.createElement("span");
      pill.className = "tnpTickerPill";
      pill.textContent = domain ? domain : "news";

      const btn = document.createElement("span");
      btn.className = "tnpTickerItem";
      btn.title = "Click: cargar en plantilla · Alt+Click: abrir";
      btn.appendChild(pill);

      const txt = document.createElement("span");
      txt.textContent = title || "—";
      btn.appendChild(txt);

      btn.addEventListener("click", (ev) => {
        if (ev.altKey) {
          if (shownUrl) window.open(shownUrl, "_blank", "noopener,noreferrer");
          return;
        }
        useItem(it).catch(() => {});
      });

      return btn;
    };

    if (!state.ticker.news.length) {
      const ph = document.createElement("span");
      ph.className = "tnpTickerItem";
      ph.style.cursor = "default";
      ph.innerHTML = `<span class="tnpTickerPill">news</span><span>Cargando titulares…</span>`;
      inner.appendChild(ph);
      inner.appendChild(ph.cloneNode(true));
      return;
    }

    // Duplicar para marquee
    const fragA = document.createDocumentFragment();
    const fragB = document.createDocumentFragment();

    for (const it of state.ticker.news) fragA.appendChild(buildItemEl(it));
    for (const it of state.ticker.news) fragB.appendChild(buildItemEl(it));

    inner.appendChild(fragA);
    const sep = document.createElement("span");
    sep.style.width = "16px";
    inner.appendChild(sep);
    inner.appendChild(fragB);

    const dur = Math.max(18, Math.min(42, 18 + state.ticker.news.length * 1.8));
    inner.style.animationDuration = `${dur}s`;
  }

  function tickTickerTimers() {
    // aquí podrías meter micro-lógica por tiempo (no hace falta)
  }

  /* ───────────────────────────── TRENDS (best-effort) ───────────────────────────── */
  function startTrendsRealtime() {
    if (state.ticker.trendsPopTimer) clearInterval(state.ticker.trendsPopTimer);
    if (state.ticker.trendsRefreshTimer) clearInterval(state.ticker.trendsRefreshTimer);

    state.ticker.trendsPopTimer = setInterval(() => rotateTrendsPop(), TRENDS_POP_INTERVAL_MS);
    state.ticker.trendsRefreshTimer = setInterval(() => requestTrendsRefresh({ reason: "timer" }).catch(() => {}), TRENDS_REFRESH_MS);

    requestTrendsRefresh({ reason: "boot" }).catch(() => {});
    rotateTrendsPop();
  }

  function setTrendsPop(tag, meta = "") {
    const pop = document.getElementById("tnpTrendsPop");
    if (!pop) return;
    const t = String(tag || "").trim();
    pop.dataset.tag = t;
    if (!t) {
      pop.innerHTML = `<span class="tnpPopTag">#Tendencias</span><span class="tnpPopMeta">${escapeHtml(meta || "sin datos")}</span>`;
      return;
    }
    const shown = t.startsWith("#") ? t : ("#" + t.replace(/\s+/g, ""));
    pop.innerHTML = `<span class="tnpPopTag">${escapeHtml(shown)}</span><span class="tnpPopMeta">${escapeHtml(meta || "click para añadir")}</span>`;
  }

  function rotateTrendsPop() {
    const list = state.ticker.trends || [];
    if (!list.length) {
      setTrendsPop("", "cargando…");
      return;
    }
    state.ticker.trendsIdx = (state.ticker.trendsIdx + 1) % list.length;
    const cur = list[state.ticker.trendsIdx];
    const label = cur?.label || cur?.tag || cur || "";
    const src = cur?.src ? `via ${cur.src}` : "tendencia";
    setTrendsPop(label, src);
  }

  async function requestTrendsRefresh({ reason = "manual" } = {}) {
    const lastTs = Number(localStorage.getItem(LS_TRENDS_TS) || "0") || 0;
    const age = Date.now() - lastTs;

    if (age < TRENDS_CACHE_MAX_AGE_MS) {
      const cached = safeJson(localStorage.getItem(LS_TRENDS_CACHE)) || [];
      if (Array.isArray(cached) && cached.length) {
        state.ticker.trends = cached.slice(0, TRENDS_MAX);
        rotateTrendsPop();
        return;
      }
    }

    const out = await fetchTrendsBestEffort().catch(() => []);
    if (Array.isArray(out) && out.length) {
      state.ticker.trends = out.slice(0, TRENDS_MAX);
      try {
        localStorage.setItem(LS_TRENDS_CACHE, JSON.stringify(state.ticker.trends));
        localStorage.setItem(LS_TRENDS_TS, String(Date.now()));
      } catch {}
      rotateTrendsPop();
      if (reason === "boot") toast("📡 Tendencias cargadas.");
    } else {
      const cached = safeJson(localStorage.getItem(LS_TRENDS_CACHE)) || [];
      if (Array.isArray(cached) && cached.length) {
        state.ticker.trends = cached.slice(0, TRENDS_MAX);
        rotateTrendsPop();
      } else {
        setTrendsPop("", "sin datos (bloqueo/CORS)");
      }
    }
  }

  async function fetchTrendsBestEffort() {
    const providers = [
      () => fetchTrendsTrends24("spain", "Trends24"),
      () => fetchTrendsGetDayTrends("spain", "GetDayTrends"),
      () => fetchTrendsGoogleDaily("ES", "GoogleTrends"),
    ];

    for (const fn of providers) {
      const res = await fn().catch(() => []);
      const cleaned = (res || []).map(x => normalizeTrend(x)).filter(Boolean);
      if (cleaned.length) return cleaned.slice(0, TRENDS_MAX);
    }
    return [];
  }

  function normalizeTrend(x) {
    if (!x) return null;
    if (typeof x === "string") {
      const t = cleanTrendLabel(x);
      if (!t) return null;
      return { label: t, src: "" };
    }
    const label = cleanTrendLabel(x.label || x.tag || x.name || "");
    if (!label) return null;
    return { label, src: String(x.src || "") };
  }

  function cleanTrendLabel(s) {
    const t = String(s || "").trim();
    if (!t) return "";
    const x = t
      .replace(/\s{2,}/g, " ")
      .replace(/^\d+\.\s+/, "")
      .replace(/\b(tweets|tweet|posts)\b.*$/i, "")
      .trim();
    if (!x) return "";
    return x.length > 42 ? (x.slice(0, 41) + "…") : x;
  }

  async function fetchTrendsTrends24(countrySlug = "spain", src = "Trends24") {
    const url = `https://trends24.in/${encodeURIComponent(countrySlug)}/`;
    const html = await fetchTextSmart(url, null, 14_000);
    if (!html) return [];
    const tags = [];
    const re = /<a[^>]+href="\/[^"]+"[^>]*>([^<]+)<\/a>/gi;
    let m;
    while ((m = re.exec(html))) {
      const label = decodeHtml(m[1]);
      const t = cleanTrendLabel(label);
      if (!t) continue;
      if (t.length < 2) continue;
      tags.push({ label: t, src });
      if (tags.length >= TRENDS_MAX) break;
    }
    return uniqTrends(tags);
  }

  async function fetchTrendsGetDayTrends(countrySlug = "spain", src = "GetDayTrends") {
    const url = `https://getdaytrends.com/${encodeURIComponent(countrySlug)}/`;
    const html = await fetchTextSmart(url, null, 14_000);
    if (!html) return [];
    const tags = [];
    const re = /class=["'][^"']*trend-link[^"']*["'][^>]*>([^<]+)<\/a>/gi;
    let m;
    while ((m = re.exec(html))) {
      const label = decodeHtml(m[1]);
      const t = cleanTrendLabel(label);
      if (!t) continue;
      tags.push({ label: t, src });
      if (tags.length >= TRENDS_MAX) break;
    }
    return uniqTrends(tags);
  }

  async function fetchTrendsGoogleDaily(geo = "ES", src = "GoogleTrends") {
    const url = `https://trends.google.com/trends/trendingsearches/daily/rss?geo=${encodeURIComponent(geo)}`;
    const xml = await fetchTextSmart(url, null, 14_000);
    if (!xml) return [];
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    const items = Array.from(doc.querySelectorAll("item")).slice(0, TRENDS_MAX);
    const out = items.map(it => ({
      label: cleanTrendLabel((it.querySelector("title")?.textContent || "").trim()),
      src,
    })).filter(x => x.label);
    return uniqTrends(out);
  }

  function uniqTrends(arr) {
    const out = [];
    const seen = new Set();
    for (const x of (arr || [])) {
      const k = normalizeTitleKey(x?.label || x || "");
      if (!k) continue;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(x);
      if (out.length >= TRENDS_MAX) break;
    }
    return out;
  }

  /* ───────────────────────────── BOOT ───────────────────────────── */
  try {
    // Como tu script se carga con defer, DOM ya está listo.
    // Aun así, por seguridad: si por alguna razón no hay body, espera microtask.
    if (!document.body) {
      setTimeout(() => init(), 0);
    } else {
      init();
    }
  } catch (e) {
    crashOverlay(e);
  }
})();
