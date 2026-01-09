/* app.js — News → Tweet Template Panel (tnp-v4.0.1) — PRO FAST+ (50+ feeds + ES robust + AUTO-UPDATE PWA)
   ✅ Rendimiento PRO:
      - Render estable + firma (evita re-render inútil)
      - Visible-only para resolve/OG (no bloquea UI)
      - Traducción ES prioritaria y agresiva (visible-first + retries)
      - Concurrencias ajustadas + colas dedup + backoff por feed
      - Batch feeds (auto-refresh por lotes) + “force refresh” con Shift
   ✅ ES “siempre” (modo por defecto):
      - Traduce títulos visibles si falta titleEs (sin depender del detector)
      - Parser robusto del endpoint de Google Translate + fallback AllOrigins
   ✅ Auto-update PWA real:
      - update() periódica + al volver a la pestaña
      - si hay SW nuevo -> SKIP_WAITING -> reload 1 vez (guard session)
   ✅ Mantiene tus IDs/UI + localStorage v4, migra v3→v4
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

  /* ───────────────────────────── REALTIME / LIMITS ───────────────────────────── */
  const AUTO_REFRESH_FEEDS_SEC_DEFAULT = 30;
  const AUTO_TICK_UI_SEC = 10;

  // feeds
  const FEED_CONCURRENCY = 6;

  // resolve links (visible-only)
  const RESOLVE_CONCURRENCY = 3;
  const VISIBLE_RESOLVE_LIMIT = 60;   // se ajusta por showLimit

  // translate (prioridad)
  const TR_CONCURRENCY = 4;           // agresivo pero estable
  const VISIBLE_TRANSLATE_LIMIT = 80; // se ajusta por showLimit

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
  const VERSION = "tnp-v4.0.1";

  // PWA update checks
  const SW_UPDATE_CHECK_MS = 5 * 60_000;   // 5 min
  const SW_FORCE_RELOAD_GUARD = "tnp_sw_reloaded_once";

  /* ───────────────────────────── TEMPLATE ───────────────────────────── */
  const DEFAULT_TEMPLATE =
`🚨 ÚLTIMA HORA: {{HEADLINE}}

🔴#ENVIVO >>> {{LIVE_URL}}

Fuente:
{{SOURCE_URL}}

{{HASHTAGS}}`;

  /* ───────────────────────────── FEEDS (50+ TOP, robustos) ───────────────────────────── */
  const gn = (q, hl="es", gl="ES", ceid="ES:es") =>
    `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=${encodeURIComponent(hl)}&gl=${encodeURIComponent(gl)}&ceid=${encodeURIComponent(ceid)}`;

  const gnTop = (q) => gn(`${q} when:1d`);
  const gnSite = (domain, q="") => gnTop(`site:${domain} ${q}`.trim());

  const gdeltDoc = (query, max=60) =>
    `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=ArtList&format=json&maxrecords=${encodeURIComponent(String(max))}&sort=HybridRel`;

  // NOTA: RSS “directos” cambian mucho; GN RSS (site:dominio) suele ser más estable.
  const DEFAULT_FEEDS = [
    // ── España (Top)
    { name: "Google News — España (Top)", url: gnTop("España OR Madrid OR Barcelona OR Valencia OR Sevilla"), enabled: true },
    { name: "El País (GN)", url: gnSite("elpais.com", "(última hora OR urgente OR breaking OR directo)"), enabled: true },
    { name: "El Mundo (GN)", url: gnSite("elmundo.es", "(última hora OR urgente OR breaking OR directo)"), enabled: true },
    { name: "La Vanguardia (GN)", url: gnSite("lavanguardia.com", "(última hora OR urgente OR breaking)"), enabled: true },
    { name: "ABC (GN)", url: gnSite("abc.es", "(última hora OR urgente OR breaking)"), enabled: true },
    { name: "20minutos (GN)", url: gnSite("20minutos.es", "(última hora OR urgente OR breaking)"), enabled: true },
    { name: "El Confidencial (GN)", url: gnSite("elconfidencial.com", "(última hora OR urgente OR breaking)"), enabled: true },
    { name: "El Diario (GN)", url: gnSite("eldiario.es", "(última hora OR urgente OR breaking)"), enabled: true },
    { name: "RTVE (GN)", url: gnSite("rtve.es", "(última hora OR urgente OR breaking)"), enabled: true },
    { name: "Europa Press (GN)", url: gnSite("europapress.es", "(última hora OR urgente OR breaking)"), enabled: true },

    // ── Política / Gobierno ES
    { name: "España — Política (GN)", url: gnTop("Pedro Sánchez OR Moncloa OR Congreso OR Senado OR elecciones"), enabled: true },
    { name: "España — Justicia/Sucesos (GN)", url: gnTop("juzgado OR detenido OR juicio OR policía OR crimen España"), enabled: true },

    // ── Economía ES
    { name: "España — Economía (GN)", url: gnTop("IBEX OR inflación OR PIB OR BCE OR tipos OR Euribor OR bolsa España"), enabled: true },
    { name: "Expansión (GN)", url: gnSite("expansion.com", "(mercados OR bolsa OR empresa OR banca OR ibex)"), enabled: false },
    { name: "El Economista (GN)", url: gnSite("eleconomista.es", "(mercados OR bolsa OR ibex OR bancos)"), enabled: false },

    // ── Tech ES/Global
    { name: "Tech — IA (GN)", url: gnTop("OpenAI OR ChatGPT OR Microsoft OR Google OR Meta OR Apple OR Nvidia OR IA"), enabled: true },
    { name: "Xataka (GN)", url: gnSite("xataka.com", "(IA OR inteligencia artificial OR Apple OR Android OR seguridad)"), enabled: false },
    { name: "Genbeta (GN)", url: gnSite("genbeta.com", "(seguridad OR IA OR Microsoft OR Google)"), enabled: false },

    // ── Mundo (Top)
    { name: "Google News — Mundo (Top)", url: gnTop("World OR International OR ONU OR UE OR NATO OR G7"), enabled: true },
    { name: "Reuters — World (GN)", url: gnSite("reuters.com", "world"), enabled: true },
    { name: "AP — World (GN)", url: gnSite("apnews.com", "world"), enabled: true },
    { name: "BBC — World (RSS)", url: "https://feeds.bbci.co.uk/news/world/rss.xml", enabled: false },
    { name: "The Guardian — World (RSS)", url: "https://www.theguardian.com/world/rss", enabled: false },
    { name: "Al Jazeera (RSS)", url: "https://www.aljazeera.com/xml/rss/all.xml", enabled: false },
    { name: "DW Español (RSS)", url: "https://rss.dw.com/rdf/rss-es-all", enabled: true },
    { name: "Euronews (MRSS)", url: "https://www.euronews.com/rss?format=mrss", enabled: true },

    // ── Guerra / Geopolítica
    { name: "Ucrania/Rusia — Última hora (GN)", url: gnTop("Ucrania OR Rusia OR Putin OR Kiev OR misil OR dron OR ofensiva"), enabled: true },
    { name: "OTAN/NATO — Última hora (GN)", url: gnTop("OTAN OR NATO OR Article 5 OR alliance OR cumbre"), enabled: true },
    { name: "Israel/Gaza — Última hora (GN)", url: gnTop("Israel OR Gaza OR Hamas OR ceasefire OR ataque OR bombardeo"), enabled: true },

    // ── Economía global
    { name: "Mercados — Global (GN)", url: gnTop("stocks OR markets OR inflation OR oil OR gas OR recession OR Fed OR ECB"), enabled: true },
    { name: "Financial Times (GN)", url: gnSite("ft.com", "(markets OR global economy OR inflation)"), enabled: false },

    // ── Salud
    { name: "Salud — Global (GN)", url: gnTop("salud OR OMS OR virus OR brote OR vacuna OR hospital"), enabled: false },

    // ── Deportes
    { name: "Deportes — Top (GN)", url: gnTop("fútbol OR LaLiga OR Champions OR Real Madrid OR Barcelona OR NBA"), enabled: false },

    // ── Entretenimiento
    { name: "Entretenimiento — Top (GN)", url: gnTop("Netflix OR estreno OR serie OR película OR música OR festival"), enabled: false },

    // ── Sucesos / Crimen global
    { name: "Sucesos — Global (GN)", url: gnTop("tiroteo OR atentado OR detenido OR explosión OR crimen"), enabled: false },

    // ── GDELT (JSON)
    { name: "GDELT — Breaking (JSON)", url: gdeltDoc("breaking OR urgent OR developing", 70), enabled: false },
    { name: "GDELT — Spain (JSON)", url: gdeltDoc("(Spain OR España) AND (breaking OR urgent OR developing)", 70), enabled: false },

    // ── Más fuentes GN por site: (llegar sobrado a 50)
    { name: "CNN (GN)", url: gnSite("cnn.com", "world"), enabled: false },
    { name: "NYTimes (GN)", url: gnSite("nytimes.com", "world"), enabled: false },
    { name: "Washington Post (GN)", url: gnSite("washingtonpost.com", "world"), enabled: false },
    { name: "Bloomberg (GN)", url: gnSite("bloomberg.com", "(markets OR economy)"), enabled: false },
    { name: "Politico (GN)", url: gnSite("politico.com", "(europe OR ukraine OR nato)"), enabled: false },
    { name: "Le Monde (GN)", url: gnSite("lemonde.fr", "(international OR ukraine OR russie)"), enabled: false },
    { name: "Der Spiegel (GN)", url: gnSite("spiegel.de", "(international OR ukraine OR russland)"), enabled: false },
    { name: "France24 (GN)", url: gnSite("france24.com", "(world OR europe)"), enabled: false },
    { name: "Sky News (GN)", url: gnSite("skynews.com", "(world OR ukraine)"), enabled: false },

    { name: "CNBC (GN)", url: gnSite("cnbc.com", "(markets OR economy)"), enabled: false },
    { name: "WSJ (GN)", url: gnSite("wsj.com", "(markets OR economy)"), enabled: false },
    { name: "The Economist (GN)", url: gnSite("economist.com", "(world OR economy)"), enabled: false },

    { name: "Marca (GN)", url: gnSite("marca.com", "(fútbol OR última hora)"), enabled: false },
    { name: "AS (GN)", url: gnSite("as.com", "(fútbol OR última hora)"), enabled: false },

    { name: "HuffPost ES (GN)", url: gnSite("huffingtonpost.es", "(última hora OR política)"), enabled: false },
    { name: "La Sexta (GN)", url: gnSite("lasexta.com", "(última hora OR directo)"), enabled: false },
    { name: "Antena 3 (GN)", url: gnSite("antena3.com", "(última hora OR directo)"), enabled: false },
  ];

  /* ───────────────────────────── STATE ───────────────────────────── */
  const state = {
    feeds: [],
    items: [],
    template: "",
    settings: {},
    used: new Set(),

    refreshInFlight: false,
    refreshPending: false,
    refreshSeq: 0,
    refreshAbort: null,

    rerenderQueued: false,
    feedCursor: 0,

    lastRenderSig: "",
  };

  const trCache = loadJsonPreferNew(LS_TR_CACHE, LS_TR_CACHE_V3, {});
  const resolveCache = loadJsonPreferNew(LS_RESOLVE_CACHE, LS_RESOLVE_CACHE_V3, {});
  const imgCache = loadJsonPreferNew(LS_IMG_CACHE, null, {});

  const trInFlight = new Map();
  const resInFlight = new Map();
  const imgInFlight = new Map();

  const feedFail = new Map();       // url -> { fails, nextAt }
  const feedTextHash = new Map();   // url -> hash (sesión)

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
    el.timeFilter = must("#timeFilter");
    el.showLimit = q("#showLimit");
    el.fetchCap = q("#fetchCap");

    el.searchBox = must("#searchBox");
    el.btnRefresh = must("#btnRefresh");
    el.btnFeeds = must("#btnFeeds");

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
    syncTopbarHeight();
    setupOgObserver();

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

    // primer render “vacío” para que el layout esté estable antes de meter items
    renderNewsList({ silent: true });

    refreshAll({ reason: "boot", force: true });
    startRealtime();

    // debug
    window.TNP_DEBUG = { state, trCache, resolveCache, imgCache, VERSION };

    // SW + auto update
    registerServiceWorker();
  }

  function crashOverlay(err){
    console.error(err);
    const div = document.createElement("div");
    div.style.cssText = `
      position:fixed; inset:0; z-index:99999;
      background:rgba(0,0,0,.88); color:#fff; padding:16px;
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
      const force = !!ev.shiftKey;
      if (force) {
        feedFail.clear();
        feedTextHash.clear();
        toast("⚡ Force refresh (shift) · backoff reseteado");
      }
      refreshAll({ reason: force ? "manual_force" : "manual", force: true });
    });

    el.btnFeeds.addEventListener("click", () => openModal(true));
    el.btnCloseModal.addEventListener("click", () => openModal(false));
    el.modal.addEventListener("click", (e) => { if (e.target === el.modal) openModal(false); });

    el.timeFilter.addEventListener("change", () => {
      renderNewsList({ silent: true, hardPurge: true });
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
    });

    el.searchBox.addEventListener("input", debounce(() => renderNewsList({ silent: true }), 120));

    el.delayMin.addEventListener("input", () => {
      saveSetting("delayMin", clampNum(el.delayMin.value, 0, 120));
      renderNewsList({ silent: true });
    });

    el.optOnlyReady.addEventListener("change", () => {
      saveSetting("onlyReady", !!el.optOnlyReady.checked);
      renderNewsList({ silent: true });
    });

    el.optOnlySpanish.addEventListener("change", () => {
      saveSetting("onlySpanish", !!el.optOnlySpanish.checked);
      renderNewsList({ silent: true });
    });

    el.sortBy.addEventListener("change", () => {
      saveSetting("sortBy", el.sortBy.value);
      renderNewsList({ silent: true });
    });

    if (el.catFilter) el.catFilter.addEventListener("change", () => {
      saveSetting("catFilter", el.catFilter.value);
      renderNewsList({ silent: true });
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
    });

    if (el.optShowOriginal) el.optShowOriginal.addEventListener("change", () => {
      saveSetting("showOriginal", !!el.optShowOriginal.checked);
      renderNewsList({ silent: true });
    });

    if (el.optHideUsed) el.optHideUsed.addEventListener("change", () => {
      saveSetting("hideUsed", !!el.optHideUsed.checked);
      renderNewsList({ silent: true });
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
      state.feeds.push(normalizeFeed({ name, url, enabled: true }));
      el.newFeedName.value = "";
      el.newFeedUrl.value = "";
      renderFeedsModal();
    });

    el.btnExportFeeds.addEventListener("click", () => {
      el.feedsJson.value = JSON.stringify((state.feeds || []).map(normalizeFeed), null, 2);
      toast("📦 Exportado al textarea.");
    });

    el.btnImportFeeds.addEventListener("click", () => {
      const raw = String(el.feedsJson.value || "").trim();
      if (!raw) return toast("⚠️ Pega JSON primero.");
      const j = safeJson(raw);
      if (!Array.isArray(j)) return toast("❌ JSON inválido (debe ser array).");
      state.feeds = j.map(normalizeFeed).filter(f => f.url);
      renderFeedsModal();
      toast("✅ Importado. Dale a Guardar.");
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
          // chequea SW update al volver
          try { swReg?.update?.(); } catch {}
          const auto = state.settings.autoRefresh !== false;
          if (auto) refreshAll({ reason: "visible", force: false });
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

    const delay = clampNum(el.delayMin.value, 0, 120);
    const onlyReady = !!el.optOnlyReady.checked;

    const wantSpanish = state.settings.onlySpanish !== false;
    const hideUsed = !!state.settings.hideUsed;
    const sortBy = String(state.settings.sortBy || "recent");
    const cat = String(state.settings.catFilter || "all");

    const now = Date.now();
    const minMs = now - (hours * 60 * 60 * 1000);

    const filtered = items.filter(it => {
      if (!it) return false;
      const ms = Number(it.publishedMs || 0) || 0;
      if (ms && ms < minMs) return false;

      if (hideUsed && state.used.has(it.id)) return false;
      if (cat && cat !== "all" && String(it.cat || "all") !== cat) return false;

      const shownTitle = String(it.titleEs || it.title || "");
      const hay = it._hay || ((shownTitle + " " + String(it.feed || "")).toLowerCase());
      it._hay = hay;
      if (search && !hay.includes(search)) return false;

      const isReady = ms ? ((now - ms) >= (delay * 60 * 1000)) : false;
      if (onlyReady && !isReady) return false;

      it._ready = isReady;
      it._ageMin = ms ? Math.max(0, Math.floor((now - ms) / 60000)) : 0;
      it.impact = it.impact || calcImpact(it);

      return true;
    });

    // sort
    if (sortBy === "impact") {
      filtered.sort((a, b) => (calcImpact(b) - calcImpact(a)) || (b.publishedMs - a.publishedMs));
    } else if (sortBy === "source") {
      filtered.sort((a, b) => String(a.feed).localeCompare(String(b.feed)) || (b.publishedMs - a.publishedMs));
    } else {
      filtered.sort((a, b) => {
        const ai = calcImpact(a), bi = calcImpact(b);
        const aTop = ai >= 70 ? 1 : 0;
        const bTop = bi >= 70 ? 1 : 0;
        if (bTop !== aTop) return bTop - aTop;
        return (b.publishedMs - a.publishedMs);
      });
    }

    const limited = filtered.slice(0, showLimit);

    // firma de render
    const sig = `${showLimit}|${hours}|${search}|${cat}|${sortBy}|${onlyReady}|${hideUsed}|${limited.length}|${limited[0]?.id||""}|${limited[0]?.publishedMs||0}|${limited[0]?.titleEs||""}`;
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
      const origNeeded = !!(state.settings.showOriginal !== false) && !!it.titleEs && it.titleEs !== it.title;

      const card = document.createElement("div");
      card.className = "newsItem" + (top ? " top" : "");
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
        const orig = document.createElement("span");
        orig.className = "orig";
        orig.textContent = it.title || "";
        title.appendChild(orig);
      }

      const meta = document.createElement("div");
      meta.className = "newsMeta";

      meta.appendChild(badge("cat", it.cat || "all"));
      if (top) meta.appendChild(badge("top", "🔥 TOP"));

      meta.appendChild(badge(it._ready ? "ready" : "queue", it._ready ? "LISTO" : "EN COLA"));
      meta.appendChild(badge("domain", domain || "link"));

      const time = document.createElement("span");
      time.dataset.role = "age";
      time.textContent = ageLabel(it._ageMin);
      meta.appendChild(time);

      const src = document.createElement("span");
      src.textContent = "· " + String(it.feed || "Feed");
      meta.appendChild(src);

      const actions = document.createElement("div");
      actions.className = "actionsRow";

      const btnUse = linkBtn("Usar", "#");
      btnUse.addEventListener("click", async (e) => {
        e.preventDefault();
        await useItem(it);
      });

      const btnOpen = linkBtn("Abrir", shownUrl || it.link);
      btnOpen.target = "_blank";
      btnOpen.rel = "noopener noreferrer";

      const btnMark = linkBtn(state.used.has(it.id) ? "Desmarcar" : "Marcar", "#");
      btnMark.addEventListener("click", (e) => {
        e.preventDefault();
        toggleUsed(it.id);
        renderNewsList({ silent: true });
      });

      actions.appendChild(btnUse);
      actions.appendChild(btnOpen);
      actions.appendChild(btnMark);

      body.appendChild(title);
      body.appendChild(meta);
      body.appendChild(actions);

      card.appendChild(thumbWrap);
      card.appendChild(body);
      frag.appendChild(card);

      if (visibleForResolve.length < Math.min(VISIBLE_RESOLVE_LIMIT, showLimit)) visibleForResolve.push(it);
      if (wantSpanish && visibleForTranslate.length < Math.min(VISIBLE_TRANSLATE_LIMIT, showLimit)) visibleForTranslate.push(it);

      if (ogObserver && observed < Math.min(OBSERVE_OG_VISIBLE_LIMIT, showLimit)) {
        const lacks = !(it.image || it.ogImage || readCache(imgCache, imgCacheKey(shownUrl || it.link)));
        if (lacks && shownUrl && !isGoogleNews(shownUrl)) {
          ogObserver.observe(card);
          observed++;
        }
      }
    }

    el.newsList.appendChild(frag);
    if (silent) el.newsList.scrollTop = prevScroll;

    // (1) Traducción primero (se nota muchísimo)
    runSoon(() => maybeTranslateVisible(visibleForTranslate).catch(() => {}));
    // (2) Resolve después
    runSoon(() => maybeResolveVisible(visibleForResolve).catch(() => {}));

    setStatus(`Listo · mostrando ${limited.length}/${filtered.length} · ventana ${hours}h`);
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

      // batch: auto rota, manual/force refresca todos
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
          bumpFeedFail(String(f?.url||""));
          return [];
        });
        if (out && out.length) results.push(...out);
      });

      // merge + dedupe
      const merged = dedupeNormalize([...(state.items || []), ...results]);

      // purga por ventana
      const fresh = merged
        .filter(it => Number(it.publishedMs || 0) >= minMs)
        .sort((a,b) => (Number(b.publishedMs||0) - Number(a.publishedMs||0)))
        .slice(0, keepCap);

      state.items = fresh;

      lastRefreshAt = Date.now();
      setStatus(`✅ OK · ${state.items.length} en memoria · ${new Date(lastRefreshAt).toLocaleTimeString()}`);

      // Render en el siguiente frame (mejor “feel” en móviles)
      requestAnimationFrame(() => renderNewsList({ silent: true, hardPurge: false }));

      // tras refrescar, prioriza traducción de lo visible
      runSoon(() => {
        const wantSpanish = state.settings.onlySpanish !== false;
        if (!wantSpanish) return;
        const showLimit = clampNum(state.settings.showLimit ?? (el.showLimit ? el.showLimit.value : 10), 10, 50);
        const visibles = (state.items || []).slice(0, Math.min(80, showLimit * 2));
        maybeTranslateVisible(visibles).catch(() => {});
      });

    } catch (e) {
      if (abort.signal.aborted) setStatus("⛔ Refresh abortado.");
      else {
        setStatus("❌ Error refrescando. (mira consola)");
        console.error(e);
      }
    } finally {
      state.refreshInFlight = false;
      state.refreshAbort = null;

      if (state.refreshPending) {
        state.refreshPending = false;
        refreshAll({ reason: "queued", force: false });
      }
    }
  }

  function pickBatchRoundRobin(arr, batchSize) {
    if (!arr.length) return [];
    if (arr.length <= batchSize) return arr.slice();
    const out = [];
    let idx = state.feedCursor % arr.length;
    for (let i=0; i<batchSize; i++) {
      out.push(arr[idx]);
      idx = (idx + 1) % arr.length;
    }
    state.feedCursor = idx;
    return out;
  }

  async function fetchOneFeed(feed, parentSignal, force, fetchCap) {
    const name = String(feed?.name || "Feed");
    const url = String(feed?.url || "").trim();
    if (!url) return [];

    // backoff tracking
    const ff0 = feedFail.get(url) || { fails: 0, nextAt: 0 };
    if (!force && ff0.nextAt && Date.now() < ff0.nextAt) return [];

    const txt = await fetchTextWithFallbacks(url, 16_000, parentSignal);
    if (!txt) throw new Error("empty feed " + url);

    // hash rápido: si es idéntico, no parsees otra vez en esta sesión
    const h = fastHash(txt);
    if (!force && feedTextHash.get(url) === h) return [];
    feedTextHash.set(url, h);

    let items = [];
    const t = String(txt || "").trim();
    if (t.startsWith("{") || t.startsWith("[")) items = parseJsonFeed(t, name, fetchCap);
    else items = parseFeed(t, name, fetchCap);

    // ok => reset fail
    feedFail.set(url, { fails: 0, nextAt: 0 });

    return items || [];
  }

  function bumpFeedFail(url) {
    const u = String(url || "");
    if (!u) return;
    const prev = feedFail.get(u) || { fails: 0, nextAt: 0 };
    const fails = (prev.fails || 0) + 1;
    const wait = Math.min(FEED_FAIL_BACKOFF_MAX_MS, FEED_FAIL_BACKOFF_BASE_MS * Math.pow(2, Math.min(6, fails)));
    feedFail.set(u, { fails, nextAt: Date.now() + wait });
  }

  /* ───────────────────────────── PARSERS ───────────────────────────── */
  function parseJsonFeed(jsonText, feedName, cap) {
    const out = [];
    const j = safeJson(jsonText);
    if (!j) return out;

    let arr = [];
    if (Array.isArray(j)) arr = j;
    else if (Array.isArray(j.articles)) arr = j.articles;
    else if (Array.isArray(j.results)) arr = j.results;
    else if (Array.isArray(j.data)) arr = j.data;
    else if (Array.isArray(j.items)) arr = j.items;
    else arr = [];

    const max = Math.min(Math.max(10, cap), 2000);
    for (const a of arr) {
      if (out.length >= max) break;

      const title = cleanText(a?.title || a?.name || a?.headline || "");
      const link = cleanText(a?.url || a?.link || a?.sourceurl || a?.sourceUrl || "");
      const pub = cleanText(a?.seendate || a?.pubDate || a?.published || a?.datetime || "");
      const ms = parseDateMs(pub) || Number(a?.timestamp || 0) || Date.now();

      const img = cleanText(a?.image || a?.socialimage || a?.urlToImage || a?.thumbnail || "");
      if (!title || !link) continue;

      out.push(makeItem({
        feed: feedName,
        title,
        link,
        publishedMs: ms,
        image: canonicalizeUrl(img)
      }));
    }
    return out;
  }

  function parseFeed(xmlText, feedName, cap) {
    const out = [];
    const s = String(xmlText || "");
    const dp = new DOMParser();
    const doc = dp.parseFromString(s, "text/xml");
    if (doc.querySelector("parsererror")) return out;

    const max = Math.min(Math.max(10, cap), 2000);

    const rssItems = doc.querySelectorAll("item");
    if (rssItems && rssItems.length) {
      for (const item of rssItems) {
        if (out.length >= max) break;

        const title = cleanText(textOf(item, "title"));
        const link = cleanText(textOf(item, "link")) || pickRssGuid(item);
        const pub = cleanText(textOf(item, "pubDate")) || cleanText(textOf(item, "date")) || cleanText(textOf(item, "dc\\:date"));
        const ms = parseDateMs(pub) || Date.now();

        const img = pickRssImage(item);

        if (!title || !link) continue;
        out.push(makeItem({ feed: feedName, title, link, publishedMs: ms, image: img }));
      }
      return out;
    }

    const entries = doc.querySelectorAll("entry");
    if (entries && entries.length) {
      for (const entry of entries) {
        if (out.length >= max) break;

        const title = cleanText(textOf(entry, "title"));
        const link = cleanText(pickAtomLink(entry));
        const pub = cleanText(textOf(entry, "updated")) || cleanText(textOf(entry, "published"));
        const ms = parseDateMs(pub) || Date.now();

        const img = pickAtomImage(entry);

        if (!title || !link) continue;
        out.push(makeItem({ feed: feedName, title, link, publishedMs: ms, image: img }));
      }
    }
    return out;
  }

  function makeItem({ feed, title, link, publishedMs, image = "" }) {
    const fixedLink = canonicalizeUrl(link);
    const fixedTitle = cleanText(title);
    const cat = detectCategory(fixedTitle, feed);

    const id = hashId(fixedLink || (fixedTitle + "|" + feed));
    const isEs = looksSpanish(fixedTitle);

    return {
      id,
      feed: String(feed || "Feed"),
      title: fixedTitle,
      titleEs: isEs ? fixedTitle : "",
      link: fixedLink,
      linkResolved: "",
      publishedMs: Number(publishedMs || Date.now()),
      cat,
      impact: 0,
      image: canonicalizeUrl(image),
      ogImage: "",

      _hay: (fixedTitle + " " + String(feed || "")).toLowerCase(),
    };
  }

  function parseDateMs(s) {
    const t = String(s || "").trim();
    if (!t) return 0;
    const ms = Date.parse(t);
    if (Number.isFinite(ms)) return ms;
    try {
      const u = t.replace(" ", "T");
      const m2 = Date.parse(u);
      if (Number.isFinite(m2)) return m2;
    } catch {}
    return 0;
  }

  function pickRssGuid(itemEl) {
    const g = itemEl.querySelector("guid");
    const t = g ? (g.textContent || "").trim() : "";
    if (t && /^https?:\/\//i.test(t)) return t;
    return "";
  }

  function pickRssImage(itemEl) {
    const mc = itemEl.querySelector("media\\:content");
    const mcu = mc ? (mc.getAttribute("url") || "") : "";
    if (mcu) return canonicalizeUrl(mcu);

    const mt = itemEl.querySelector("media\\:thumbnail");
    const mtu = mt ? (mt.getAttribute("url") || "") : "";
    if (mtu) return canonicalizeUrl(mtu);

    const encs = itemEl.querySelectorAll("enclosure");
    for (const e of encs) {
      const type = (e.getAttribute("type") || "").toLowerCase();
      const url = e.getAttribute("url") || "";
      if (!url) continue;
      if (!type || type.startsWith("image/")) return canonicalizeUrl(url);
    }

    const desc = String(textOf(itemEl, "description"));
    const ce = String(textOf(itemEl, "content\\:encoded"));
    const html = (ce && ce.length > desc.length) ? ce : desc;
    const img = firstImgFromHtml(html);
    return canonicalizeUrl(img);
  }

  function pickAtomLink(entryEl) {
    const linkEl = entryEl.querySelector("link[rel='alternate']") || entryEl.querySelector("link");
    if (linkEl) {
      const href = (linkEl.getAttribute("href") || "").trim();
      if (href) return href;
    }
    return cleanText(textOf(entryEl, "link"));
  }

  function pickAtomImage(entryEl) {
    const mc = entryEl.querySelector("media\\:content");
    const mct = mc ? (mc.getAttribute("url") || "") : "";
    if (mct) return canonicalizeUrl(mct);

    const mt = entryEl.querySelector("media\\:thumbnail");
    const mtt = mt ? (mt.getAttribute("url") || "") : "";
    if (mtt) return canonicalizeUrl(mtt);

    const links = entryEl.querySelectorAll("link");
    for (const l of links) {
      const rel = (l.getAttribute("rel") || "").toLowerCase();
      const type = (l.getAttribute("type") || "").toLowerCase();
      const href = l.getAttribute("href") || "";
      if (!href) continue;
      if (rel === "enclosure" && (!type || type.startsWith("image/"))) return canonicalizeUrl(href);
    }

    const content = String(textOf(entryEl, "content"));
    const summary = String(textOf(entryEl, "summary"));
    const html = (content && content.length > summary.length) ? content : summary;
    const img = firstImgFromHtml(html);
    return canonicalizeUrl(img);
  }

  function firstImgFromHtml(html) {
    const s = String(html || "");
    if (!s) return "";
    const m = s.match(/<img[^>]+src=["']([^"']+)["']/i);
    return m && m[1] ? safeDecode(m[1]) : "";
  }

  function textOf(root, sel) {
    const n = root.querySelector(sel);
    return n ? (n.textContent || "").trim() : "";
  }

  function dedupeNormalize(items) {
    const map = new Map();
    for (const it of (items || [])) {
      const link = canonicalizeUrl(it?.link || "");
      if (!link) continue;

      const title = cleanText(it?.title || "");
      if (!title) continue;

      const feed = String(it?.feed || "Feed");
      const publishedMs = Number(it?.publishedMs || Date.now());

      const fixed = {
        ...it,
        id: it?.id || hashId(link),
        feed,
        link,
        title,
        publishedMs,
        cat: it?.cat || detectCategory(title, feed),
        image: canonicalizeUrl(it?.image || ""),
        ogImage: canonicalizeUrl(it?.ogImage || ""),
      };

      const prev = map.get(link);
      if (prev) {
        if (!fixed.image && prev.image) fixed.image = prev.image;
        if (!fixed.ogImage && prev.ogImage) fixed.ogImage = prev.ogImage;
        if (!fixed.linkResolved && prev.linkResolved) fixed.linkResolved = prev.linkResolved;
        if (!fixed.titleEs && prev.titleEs) fixed.titleEs = prev.titleEs;
      }

      if (!prev || publishedMs > Number(prev.publishedMs || 0)) map.set(link, fixed);
    }

    // dedupe adicional por título (evita duplicados de distintas URLs)
    const byTitle = new Map();
    for (const it of map.values()) {
      const tkey = normalizeTitleKey(it.title);
      const prev = byTitle.get(tkey);
      if (!prev) { byTitle.set(tkey, it); continue; }

      const a = prev, b = it;
      const aScore = (isGoogleNews(a.link) ? 0 : 1) + (Number(a.publishedMs || 0) / 1e13);
      const bScore = (isGoogleNews(b.link) ? 0 : 1) + (Number(b.publishedMs || 0) / 1e13);
      if (bScore > aScore) byTitle.set(tkey, b);
    }

    const out = Array.from(byTitle.values());
    for (const it of out) {
      const shown = String(it.titleEs || it.title || "");
      it._hay = (shown + " " + String(it.feed || "")).toLowerCase();
    }
    return out;
  }

  function normalizeTitleKey(t) {
    return String(t || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[^\p{L}\p{N} ]/gu, "")
      .trim()
      .slice(0, 180);
  }

  /* ───────────────────────────── IMPACT ───────────────────────────── */
  function calcImpact(it) {
    if (!it) return 0;
    if (Number.isFinite(it.impact) && it.impact > 0) return it.impact;

    let score = 0;
    const title = String((it.titleEs || it.title || "")).toLowerCase();
    const feed = String(it.feed || "").toLowerCase();

    if (/reuters|apnews|associated press|bbc|financial times|ft\.com|bloomberg/.test(feed)) score += 18;
    if (/elpais|el país|elmundo|la vanguardia|abc|expansión|eleconomista|rtve|europa press/.test(feed)) score += 12;

    const hot = [
      "última hora","breaking","urgent","en directo","atentado","misil","ataque","explosión",
      "otan","nato","ucrania","rusia","israel","gaza","trump","biden","sánchez","putin",
      "dimite","detenido","juicio","sanciones","crisis","apagón","hackeo","ciberataque"
    ];
    for (const k of hot) if (title.includes(k)) score += 8;

    if (/presidente|gobierno|elecciones|parlamento|congreso|senado|ue|unión europea|onu/.test(title)) score += 6;
    if (/inflación|pib|tipos|banco central|bolsa|petróleo|gas|recesión|deuda/.test(title)) score += 6;

    const ageMin = Math.max(0, Math.floor((Date.now() - Number(it.publishedMs || Date.now())) / 60000));
    if (ageMin <= 10) score += 18;
    else if (ageMin <= 30) score += 12;
    else if (ageMin <= 60) score += 8;
    else if (ageMin <= 180) score += 4;

    score = Math.max(0, Math.min(100, score));
    it.impact = score;
    return score;
  }

  /* ───────────────────────────── CATEGORY ───────────────────────────── */
  function detectCategory(title, feed) {
    const t = String(title || "").toLowerCase();
    const f = String(feed || "").toLowerCase();

    const sp = /(españa|madrid|barcelona|valencia|sevilla|andaluc|catalu|galicia|bilbao|zaragoza)/i;
    if (sp.test(t) || /españa|rtve|europa press|elpais|elmundo|lavanguardia|abc/.test(f)) return "spain";

    if (/(otan|nato|ucrania|rusia|gaza|israel|misil|ataque|defensa|ejército|dron|bombardeo)/i.test(t)) return "war";
    if (/(elecciones|presidente|gobierno|parlamento|congreso|senado|partido|ministro|moncloa)/i.test(t)) return "politics";
    if (/(bolsa|ibex|dow|nasdaq|inflación|pib|banco|tipos|petróleo|gas|mercados|euribor)/i.test(t)) return "economy";
    if (/(ia|ai|openai|microsoft|google|meta|apple|android|iphone|chip|nvidia|ciber|hack|ciberataque|seguridad)/i.test(t)) return "tech";
    if (/(asesin|tiroteo|secuestro|narc|policía|detenido|crimen|sucesos|atentado)/i.test(t)) return "crime";
    if (/(salud|oms|virus|covid|vacuna|hospital|epidemia|brote)/i.test(t)) return "health";
    if (/(fútbol|liga|champions|nba|nfl|tenis|golf|baloncesto)/i.test(t)) return "sports";
    if (/(cine|serie|netflix|música|festival|oscar|grammy|estreno)/i.test(t)) return "ent";

    return "world";
  }

  /* ───────────────────────────── OG OBSERVER ───────────────────────────── */
  function setupOgObserver() {
    if (!("IntersectionObserver" in window)) return;
    ogObserver = new IntersectionObserver(async (entries) => {
      const visible = entries.filter(e => e.isIntersecting).slice(0, IMG_CONCURRENCY);
      for (const e of visible) {
        ogObserver.unobserve(e.target);
        const card = e.target;
        const id = card.dataset.id;
        const it = (state.items || []).find(x => x.id === id);
        if (!it) continue;

        const got = await maybeFetchOgForItem(it);
        if (!got) continue;

        const img = card.querySelector("img.newsThumb");
        if (img && got) img.src = got;
      }
    }, { root: el.newsList, threshold: 0.12 });
  }

  function pickBestThumb(it, articleUrl) {
    const a = canonicalizeUrl(it?.image || "");
    if (a) return a;
    const b = canonicalizeUrl(it?.ogImage || "");
    if (b) return b;
    const cached = readCache(imgCache, imgCacheKey(articleUrl));
    if (cached) return cached;
    return "";
  }

  function imgCacheKey(url) {
    return "img|" + hashId(canonicalizeUrl(url));
  }

  async function maybeFetchOgForItem(it) {
    const resolveLinks = state.settings.resolveLinks !== false;
    const shownUrl = canonicalizeUrl((resolveLinks ? (it.linkResolved || it.link) : it.link) || it.link);
    if (!shownUrl) return "";

    if (it.image || it.ogImage) return it.image || it.ogImage;

    const ck = imgCacheKey(shownUrl);
    const cached = readCache(imgCache, ck);
    if (cached) return cached;

    if (isGoogleNews(shownUrl)) return "";
    if (imgInFlight.has(ck)) return imgInFlight.get(ck);

    const p = (async () => {
      const html = await fetchTextWithFallbacks(shownUrl, OG_FETCH_TIMEOUT_MS);
      const og = pickMeta(html, "property", "og:image") || pickMeta(html, "name", "og:image");
      const tw = pickMeta(html, "name", "twitter:image") || pickMeta(html, "property", "twitter:image");
      const img = canonicalizeUrl(absoluteMaybe(og || tw, shownUrl));
      if (img) {
        it.ogImage = img;
        writeCache(imgCache, ck, img, IMG_CACHE_LIMIT, LS_IMG_CACHE);
        return img;
      }
      return "";
    })().catch(() => "");

    imgInFlight.set(ck, p);
    const out = await p;
    imgInFlight.delete(ck);
    return out || "";
  }

  function pickMeta(html, attr, val) {
    const re = new RegExp(`<meta[^>]+${attr}=["']${escapeRe(val)}["'][^>]+content=["']([^"']+)["']`, "i");
    const m = String(html || "").match(re);
    return m && m[1] ? safeDecode(m[1]) : "";
  }

  function absoluteMaybe(img, baseUrl) {
    const s = String(img || "").trim();
    if (!s) return "";
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith("//")) return "https:" + s;
    try {
      const u = new URL(baseUrl);
      if (s.startsWith("/")) return u.origin + s;
      return u.origin + "/" + s;
    } catch { return ""; }
  }

  function faviconUrl(url) {
    try {
      const u = new URL(String(url || ""));
      return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(u.hostname)}&sz=128`;
    } catch {
      return "https://www.google.com/s2/favicons?domain=example.com&sz=128";
    }
  }

  /* ───────────────────────────── RESOLVE LINKS (visible-only) ───────────────────────────── */
  async function maybeResolveVisible(items) {
    const on = state.settings.resolveLinks !== false;
    if (!on) return;

    const targets = (items || []).filter(it => it && it.link && (!it.linkResolved) && (isGoogleNews(it.link) || looksLikeRedirect(it.link)));
    if (!targets.length) return;

    await pool(targets, RESOLVE_CONCURRENCY, (it) => maybeResolveOne(it));
    renderNewsList({ silent: true });
  }

  async function maybeResolveOne(it) {
    const url = canonicalizeUrl(it.link || "");
    if (!url) return "";

    const cached = readCache(resolveCache, url);
    if (cached) { it.linkResolved = cached; return cached; }

    if (resInFlight.has(url)) return resInFlight.get(url);

    const p = (async () => {
      let out = "";

      out = extractUrlParam(url);
      out = canonicalizeUrl(out);
      out = cleanTracking(out);
      if (out) return out;

      const html = await fetchTextWithFallbacks(url, 11_000).catch(() => "");
      if (html) {
        out = pickCanonical(html) || pickMetaRefresh(html) || pickJsonLdUrl(html) || extractUrlFromHtml(html);
        out = canonicalizeUrl(out);
        out = cleanTracking(out);
        if (out) return out;
      }

      out = await tryFollowRedirect(url).catch(() => "");
      out = canonicalizeUrl(out);
      out = cleanTracking(out);
      return out || "";
    })();

    resInFlight.set(url, p);
    const out = await p.catch(() => "");
    resInFlight.delete(url);

    if (out) {
      it.linkResolved = out;
      writeCache(resolveCache, url, out, RESOLVE_CACHE_LIMIT, LS_RESOLVE_CACHE);
    }
    return out || "";
  }

  async function tryFollowRedirect(url) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10_000);
    try {
      const res = await fetch(url, { method: "GET", redirect: "follow", cache: "no-store", signal: ctrl.signal });
      return res && res.url ? res.url : "";
    } finally { clearTimeout(t); }
  }

  function pickCanonical(html) {
    const m = String(html || "").match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
    return m && m[1] ? safeDecode(m[1]) : "";
  }

  function pickMetaRefresh(html) {
    const m = String(html || "").match(/http-equiv=["']refresh["'][^>]+content=["'][^"']*url=([^"']+)["']/i);
    return m && m[1] ? safeDecode(m[1]) : "";
  }

  function extractUrlFromHtml(html) {
    const m = String(html || "").match(/https?:\/\/www\.google\.com\/url\?[^"'<> ]+/i);
    if (m && m[0]) {
      const u = extractUrlParam(m[0]);
      if (u) return u;
    }
    return "";
  }

  function pickJsonLdUrl(html) {
    const s = String(html || "");
    const blocks = s.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi);
    if (!blocks) return "";
    for (const b of blocks) {
      const raw = b.replace(/^[\s\S]*?>/,"").replace(/<\/script>[\s\S]*$/,"");
      const j = safeJson(raw);
      const cand =
        j?.url ||
        j?.mainEntityOfPage?.["@id"] ||
        j?.mainEntityOfPage?.url ||
        (Array.isArray(j) ? (j.find(x => x?.url)?.url || "") : "");
      if (cand) return cleanText(cand);
    }
    return "";
  }

  function extractUrlParam(s) {
    try {
      const u = new URL(String(s || "").trim());
      const p = u.searchParams;
      const keys = ["url","u","q","target","dest","destination","redirect","r"];
      for (const k of keys) {
        const v = p.get(k);
        if (v && /^https?:\/\//i.test(v)) return v;
      }
    } catch {}
    const m = String(s || "").match(/[?&](?:url|u|q|target|dest|destination|redirect|r)=([^&"'<>\s]+)/i);
    if (m && m[1]) {
      const v = safeDecode(m[1]);
      if (/^https?:\/\//i.test(v)) return v;
    }
    return "";
  }

  function looksLikeRedirect(u) {
    const s = String(u || "");
    return /\/url\?|redirect|destination|dest=|target=|u=|url=|r=/i.test(s);
  }

  /* ───────────────────────────── TRANSLATE (ES siempre) ───────────────────────────── */
  async function maybeTranslateVisible(items) {
    const wantSpanish = state.settings.onlySpanish !== false;
    if (!wantSpanish) return;

    const targets = (items || [])
      .filter(it => it && it.title && !it.titleEs)
      .slice(0, 120);

    if (!targets.length) return;

    await pool(targets, TR_CONCURRENCY, async (it) => {
      const es = await translateToEsCached(it.title);
      if (es) {
        it.titleEs = es;
        it._hay = (String(es) + " " + String(it.feed || "")).toLowerCase();
      }
    });

    renderNewsList({ silent: true });
  }

  async function translateToEsCached(text) {
    const t = cleanText(text);
    if (!t) return "";

    // Si claramente es español, no gastes
    if (looksSpanishStrong(t)) return t;

    const key = "tr|" + t.toLowerCase().slice(0, 360);
    const cached = readCache(trCache, key);
    if (cached) return cached;
    if (trInFlight.has(key)) return trInFlight.get(key);

    const p = (async () => {
      const base = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=es&dt=t&q=" + encodeURIComponent(t);

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const raw = await tryFetchText(base, 14_000);
          const out = parseGoogleTranslate(raw);
          const clean = cleanText(out);
          if (clean) {
            writeCache(trCache, key, clean, TR_CACHE_LIMIT, LS_TR_CACHE);
            return clean;
          }
        } catch {}

        // fallback: allorigins
        try {
          const ao = "https://api.allorigins.win/raw?url=" + encodeURIComponent(base);
          const raw2 = await tryFetchText(ao, 14_000);
          const out2 = parseGoogleTranslate(raw2);
          const clean2 = cleanText(out2);
          if (clean2) {
            writeCache(trCache, key, clean2, TR_CACHE_LIMIT, LS_TR_CACHE);
            return clean2;
          }
        } catch {}

        await sleep(220 + attempt * 220);
      }
      return "";
    })();

    trInFlight.set(key, p);
    const out = await p.catch(() => "");
    trInFlight.delete(key);
    return out || "";
  }

  function parseGoogleTranslate(raw) {
    const j = safeJson(raw);
    if (!j) return "";
    try {
      if (Array.isArray(j) && Array.isArray(j[0])) {
        return j[0].map(x => (x && x[0]) ? String(x[0]) : "").join("");
      }
    } catch {}
    return "";
  }

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  /* ───────────────────────────── FEEDS MODAL ───────────────────────────── */
  function renderFeedsModal() {
    el.feedList.innerHTML = "";

    (state.feeds || []).forEach((f, idx) => {
      const row = document.createElement("div");
      row.className = "feedRow";

      const togWrap = document.createElement("div");
      togWrap.className = "feedToggle";
      const tog = document.createElement("input");
      tog.type = "checkbox";
      tog.checked = f.enabled !== false;
      tog.addEventListener("change", () => { f.enabled = !!tog.checked; });
      togWrap.appendChild(tog);

      const nameInput = document.createElement("input");
      nameInput.className = "input";
      nameInput.value = f.name || "";
      nameInput.placeholder = "Nombre";
      nameInput.addEventListener("input", () => { f.name = nameInput.value; });

      const urlInput = document.createElement("input");
      urlInput.className = "input";
      urlInput.value = f.url || "";
      urlInput.placeholder = "URL RSS/Atom o JSON";
      urlInput.addEventListener("input", () => { f.url = urlInput.value; });

      const del = document.createElement("button");
      del.className = "btn";
      del.type = "button";
      del.textContent = "Borrar";
      del.addEventListener("click", () => {
        state.feeds.splice(idx, 1);
        renderFeedsModal();
      });

      row.appendChild(togWrap);
      row.appendChild(nameInput);
      row.appendChild(urlInput);
      row.appendChild(del);

      el.feedList.appendChild(row);
    });
  }

  function normalizeFeed(f) {
    const name = String(f?.name || "Feed").trim() || "Feed";
    let url = String(f?.url || "").trim();
    if (url && url.startsWith("//")) url = "https:" + url;
    if (url && !/^https?:\/\//i.test(url) && /^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(url)) url = "https://" + url;
    return { name, url, enabled: f?.enabled !== false };
  }

  /* ───────────────────────────── SETTINGS / LOAD-SAVE ───────────────────────────── */
  function loadFeeds() {
    try {
      const raw = localStorage.getItem(LS_FEEDS) || localStorage.getItem(LS_FEEDS_V3);
      if (!raw) return DEFAULT_FEEDS.map(f => ({ ...f }));
      const arr = JSON.parse(raw);
      const feeds = Array.isArray(arr)
        ? arr.map(normalizeFeed).filter(f => f.url)
        : DEFAULT_FEEDS.map(f => ({ ...f }));
      safeSetLS(LS_FEEDS, JSON.stringify(feeds));
      return feeds;
    } catch {
      return DEFAULT_FEEDS.map(f => ({ ...f }));
    }
  }

  function saveFeeds(feeds) {
    safeSetLS(LS_FEEDS, JSON.stringify(feeds || []));
  }

  function loadTemplate() {
    try {
      const raw = localStorage.getItem(LS_TEMPLATE) || localStorage.getItem(LS_TEMPLATE_V3);
      if (!raw) return DEFAULT_TEMPLATE;
      safeSetLS(LS_TEMPLATE, String(raw));
      return String(raw || DEFAULT_TEMPLATE);
    } catch {
      return DEFAULT_TEMPLATE;
    }
  }

  function saveTemplate(tpl) {
    safeSetLS(LS_TEMPLATE, String(tpl || DEFAULT_TEMPLATE));
  }

  function loadSettings() {
    const fallback = {
      liveUrl: "https://twitch.com/globaleyetv",
      hashtags: "",
      includeLive: true,
      includeSource: true,
      delayMin: 10,
      onlyReady: false,

      // ES by default
      onlySpanish: true,

      sortBy: "recent",
      autoRefresh: true,
      refreshSec: AUTO_REFRESH_FEEDS_SEC_DEFAULT,
      resolveLinks: true,
      showOriginal: true,
      hideUsed: false,
      catFilter: "all",

      // PRO
      showLimit: 10,
      fetchCap: 240,
      batchFeeds: 12,

      version: VERSION
    };
    const j = loadJsonPreferNew(LS_SETTINGS, LS_SETTINGS_V3, fallback);
    return { ...fallback, ...(j || {}) };
  }

  function saveSetting(k, v) {
    state.settings = state.settings || {};
    state.settings[k] = v;
    safeSetLS(LS_SETTINGS, JSON.stringify(state.settings));
  }

  function loadUsedSet() {
    try {
      const raw = localStorage.getItem(LS_USED) || localStorage.getItem(LS_USED_V3);
      if (!raw) return new Set();
      const arr = JSON.parse(raw);
      const s = new Set(Array.isArray(arr) ? arr.filter(Boolean) : []);
      safeSetLS(LS_USED, JSON.stringify(Array.from(s)));
      return s;
    } catch {
      return new Set();
    }
  }

  function saveUsedSet(setObj) {
    safeSetLS(LS_USED, JSON.stringify(Array.from(setObj || [])));
  }

  function toggleUsed(id, forceOn) {
    if (!id) return;
    const has = state.used.has(id);
    const want = (typeof forceOn === "boolean") ? forceOn : (!has);
    if (want) state.used.add(id);
    else state.used.delete(id);
    saveUsedSet(state.used);
  }

  function loadJsonPreferNew(keyNew, keyOld, fallback) {
    try {
      const raw = localStorage.getItem(keyNew) || (keyOld ? localStorage.getItem(keyOld) : null);
      if (!raw) return fallback;
      const j = JSON.parse(raw);
      if (j && typeof j === "object") {
        safeSetLS(keyNew, JSON.stringify(j));
        return j;
      }
      return fallback;
    } catch {
      return fallback;
    }
  }

  function safeSetLS(key, value) {
    try { localStorage.setItem(key, value); } catch {}
  }

  function readCache(cacheObj, key) {
    const v = cacheObj && cacheObj[key];
    if (!v) return "";
    if (typeof v === "string") return v;
    return String(v?.v || "");
  }

  function writeCache(cacheObj, key, value, limit, lsKey) {
    if (!cacheObj || !key || !value) return;
    cacheObj[key] = { v: String(value), t: Date.now() };
    pruneCache(cacheObj, limit);
    safeSetLS(lsKey, JSON.stringify(cacheObj));
  }

  function pruneCache(cacheObj, limit) {
    const keys = Object.keys(cacheObj || {});
    if (keys.length <= limit) return;
    keys.sort((a,b) => Number((cacheObj[a]?.t)||0) - Number((cacheObj[b]?.t)||0));
    const kill = keys.length - limit;
    for (let i=0; i<kill; i++) delete cacheObj[keys[i]];
  }

  function hardTrimAndPurge() {
    const hours = clampNum(el.timeFilter.value, 1, 72);
    const minMs = Date.now() - hours * 60 * 60 * 1000;
    const fetchCap = clampNum(state.settings.fetchCap ?? 240, 80, 2000);
    const keepCap = Math.max(140, Math.min(2400, fetchCap * 2));

    state.items = (state.items || [])
      .filter(it => Number(it?.publishedMs || 0) >= minMs)
      .sort((a,b) => Number(b.publishedMs||0) - Number(a.publishedMs||0))
      .slice(0, keepCap);
  }

  /* ───────────────────────────── FETCH (CORS FALLBACKS) ───────────────────────────── */
  async function fetchTextWithFallbacks(url, timeoutMs, parentSignal) {
    // direct
    try { return await tryFetchText(url, timeoutMs, parentSignal); }
    catch {}

    // AllOrigins raw
    try {
      const ao = "https://api.allorigins.win/raw?url=" + encodeURIComponent(url);
      return await tryFetchText(ao, timeoutMs, parentSignal);
    } catch {}

    // r.jina.ai (proxy)
    const forced = url.startsWith("http") ? url : ("https://" + url);
    try {
      const viaJina = await tryFetchText("https://r.jina.ai/" + forced, timeoutMs, parentSignal);
      return stripToPayload(viaJina);
    } catch {}

    const viaJina2 = await tryFetchText("https://r.jina.ai/" + url, timeoutMs, parentSignal);
    return stripToPayload(viaJina2);
  }

  async function tryFetchText(url, timeoutMs, parentSignal) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);

    const onAbort = () => { try { ctrl.abort(); } catch {} };
    if (parentSignal) {
      if (parentSignal.aborted) onAbort();
      else parentSignal.addEventListener("abort", onAbort, { once: true });
    }

    try {
      const res = await fetch(url, {
        method: "GET",
        signal: ctrl.signal,
        cache: "no-store",
        headers: { "accept": "text/html,application/xml,application/rss+xml,application/atom+xml,application/json;q=0.9,*/*;q=0.8" }
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.text();
    } finally {
      clearTimeout(t);
      if (parentSignal && parentSignal.removeEventListener) {
        try { parentSignal.removeEventListener("abort", onAbort); } catch {}
      }
    }
  }

  function stripToPayload(s) {
    const t = String(s || "");
    const looks = /^\s*(<\?xml|<rss|<feed|<!doctype|<html|\{|\[)/i.test(t);
    if (looks) return t;
    const i = t.search(/(<\?xml|<rss|<feed|<!doctype|<html|\{|\[)/i);
    return i >= 0 ? t.slice(i) : t;
  }

  function safeJson(txt) {
    try {
      const t = String(txt || "").trim();
      if (!t) return null;
      if (!(t.startsWith("{") || t.startsWith("["))) return null;
      return JSON.parse(t);
    } catch { return null; }
  }

  /* ───────────────────────────── HELPERS ───────────────────────────── */
  function cleanText(s) {
    // limpia tags + entidades básicas + espacios
    return String(s || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, "\"")
      .replace(/&#39;/g, "'")
      .trim();
  }

  function safeDecode(s) {
    try { return decodeURIComponent(String(s || "")); } catch { return String(s || ""); }
  }

  function canonicalizeUrl(u) {
    const s = String(u || "").trim();
    if (!s) return "";

    if (s.startsWith("//")) return canonicalizeUrl("https:" + s);

    if (!/^https?:\/\//i.test(s) && /^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(s)) {
      return canonicalizeUrl("https://" + s);
    }

    try {
      const url = new URL(s);
      url.hash = "";

      [...url.searchParams.keys()].forEach(k => {
        if (/^utm_/i.test(k)) url.searchParams.delete(k);
      });
      ["fbclid", "gclid", "dclid", "gbraid", "wbraid", "igshid", "mc_cid", "mc_eid", "mkt_tok", "ref", "ref_src"]
        .forEach(k => url.searchParams.delete(k));

      let out = url.toString();
      if (out.endsWith("/") && !/https?:\/\/[^/]+\/$/.test(out)) out = out.slice(0, -1);
      return out;
    } catch {
      return s;
    }
  }

  function cleanTracking(u) {
    return canonicalizeUrl(u);
  }

  function isGoogleNews(u) {
    try { return new URL(u).hostname.includes("news.google.com"); }
    catch { return false; }
  }

  function getDomain(u) {
    try { return new URL(u).hostname.replace(/^www\./, ""); }
    catch { return ""; }
  }

  function looksSpanish(t) {
    const s = String(t || "").toLowerCase();
    if (!s) return false;
    const hits =
      (s.match(/[áéíóúñ]/g) || []).length +
      (s.match(/\b(el|la|los|las|de|del|y|en|para|con|por|una|un)\b/g) || []).length;
    return hits >= 2;
  }

  function looksSpanishStrong(t) {
    const s = String(t || "").toLowerCase();
    if (!s) return false;
    const hits =
      (s.match(/[áéíóúñ]/g) || []).length +
      (s.match(/\b(el|la|los|las|de|del|y|en|para|con|por|una|un|que|se|su|sus)\b/g) || []).length;
    return hits >= 4;
  }

  function hashId(s) {
    return "id_" + fastHash(String(s || ""));
  }

  function fastHash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
    return (h >>> 0).toString(16);
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function escapeRe(s) {
    return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function clampNum(v, min, max) {
    const n = Number(v);
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
  }

  function debounce(fn, ms) {
    let t = 0;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  function runSoon(fn) {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(() => fn(), { timeout: 700 });
    } else {
      setTimeout(fn, 0);
    }
  }

  function pool(items, concurrency, worker) {
    return new Promise((resolve) => {
      const arr = (items || []).slice();
      if (!arr.length) return resolve();
      let active = 0;

      const next = () => {
        if (!arr.length && active === 0) return resolve();
        while (active < concurrency && arr.length) {
          const it = arr.shift();
          active++;
          Promise.resolve()
            .then(() => worker(it))
            .catch(() => {})
            .finally(() => { active--; next(); });
        }
      };
      next();
    });
  }

  function twCharCount(text) {
    // Para el panel, el conteo humano (len) es suficiente.
    // (X luego acorta URLs con t.co)
    return String(text || "").length;
  }

  function smartTrimHeadline(h, maxLen) {
    const s = String(h || "").trim();
    if (s.length <= maxLen) return s;
    const cut = s.slice(0, maxLen);
    const lastSpace = cut.lastIndexOf(" ");
    return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim() + "…";
  }

  function genHashtags(headline) {
    const s = String(headline || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N} ]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!s) return "";

    const stop = new Set(["de","del","la","las","el","los","y","o","en","por","para","con","un","una","unos","unas","a","al","que","se","su","sus","es"]);
    const words = s.split(" ").filter(w => w.length >= 4 && !stop.has(w));
    const top = words.slice(0, 4).map(w => "#" + w.replace(/ñ/g,"n"));
    return top.join(" ");
  }

  async function copyToClipboard(text) {
    const t = String(text || "");
    if (!t) return;
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(t);
    const ta = document.createElement("textarea");
    ta.value = t;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }

  /* ───────────────────────────── PWA SW (AUTO-UPDATE) ───────────────────────────── */
  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;

    window.addEventListener("load", async () => {
      try {
        swReg = await navigator.serviceWorker.register("./sw.js", { scope: "./" });

        // si ya hay waiting al cargar (update previo)
        try { swReg.waiting?.postMessage({ type: "SKIP_WAITING" }); } catch {}

        // check update now
        try { await swReg.update(); } catch {}

        // periodic update checks
        if (swUpdateTimer) clearInterval(swUpdateTimer);
        swUpdateTimer = setInterval(() => {
          try { swReg?.update?.(); } catch {}
        }, SW_UPDATE_CHECK_MS);

        swReg.addEventListener("updatefound", () => {
          const nw = swReg.installing;
          if (!nw) return;
          nw.addEventListener("statechange", () => {
            if (nw.state === "installed" && navigator.serviceWorker.controller) {
              try { swReg.waiting?.postMessage({ type: "SKIP_WAITING" }); } catch {}
              toast("⬆️ Actualización lista…");
            }
          });
        });

        navigator.serviceWorker.addEventListener("controllerchange", () => {
          try {
            const already = sessionStorage.getItem(SW_FORCE_RELOAD_GUARD);
            if (already) return;
            sessionStorage.setItem(SW_FORCE_RELOAD_GUARD, "1");
          } catch {}
          toast("♻️ Actualizando…");
          setTimeout(() => location.reload(), 350);
        });

      } catch (e) {
        console.warn("SW register failed:", e);
      }
    });
  }

  /* ───────────────────────────── BOOT ───────────────────────────── */
  try {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
      init();
    }
  } catch (e) {
    crashOverlay(e);
  }
})();
