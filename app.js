/* app.js — News → Tweet Template Panel (tnp-v4.0.1) — PRO FAST+ (50+ feeds + ES robust + AUTO-UPDATE PWA)
   ✅ Rendimiento PRO:
      - Render estable + firma (evita re-render inútil)
      - Visible-only para resolve/OG, pero traducción ES prioritaria
      - Concurrencias ajustadas y colas dedup
      - Batch feeds (auto-refresh por lotes) + backoff por feed
   ✅ ES “siempre” (modo por defecto):
      - Traduce agresivamente títulos visibles (aunque el detector falle)
      - Retries + parsing robusto del endpoint de Google Translate
   ✅ Auto-update PWA real:
      - update() periódica
      - si hay SW nuevo -> SKIP_WAITING -> reload 1 vez (guard)
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
  const VERSION = "tnp-v4.0.1";

  // PWA update checks
  const SW_UPDATE_CHECK_MS = 5 * 60_000; // 5 min
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

  // GDELT JSON (no siempre “última hora”, pero muy útil)
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

    // ── Salud
    { name: "Salud (GN)", url: gnTop("OMS OR WHO OR brote OR vacuna OR alerta sanitaria"), enabled: false },

    // ── Deportes
    { name: "Deportes (GN)", url: gnTop("Real Madrid OR Barcelona OR LaLiga OR Champions OR fichaje OR lesión"), enabled: false },

    // ── Entretenimiento / Cultura
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

  function crashOverlay(err) {
    console.error(err);
    const div = document.createElement("div");
    div.style.cssText = `
      position:fixed; inset:0; z-index:99999;
      background:rgba(0,0,0,88); color:#fff; padding:16px;
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
    const cat = String(state.settings.catFilter || (el.catFilter ? el.catFilter.value : "all") || "all");
    const sortBy = String(state.settings.sortBy || (el.sortBy ? el.sortBy.value : "recent") || "recent");

    const delayMin = clampNum(state.settings.delayMin ?? (el.delayMin ? el.delayMin.value : 10), 0, 120);
    const onlyReady = !!(state.settings.onlyReady ?? (el.optOnlyReady ? el.optOnlyReady.checked : false));
    const hideUsed = !!(state.settings.hideUsed ?? (el.optHideUsed ? el.optHideUsed.checked : false));

    const now = Date.now();
    const minMs = now - (hours * 60 * 60 * 1000);

    // annotate readiness (cheap)
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
      filtered.sort((a,b) => {
        const ai = calcImpact(a);
        const bi = calcImpact(b);
        const aTop = ai >= 70 ? 1 : 0;
        const bTop = bi >= 70 ? 1 : 0;
        if (bTop !== aTop) return bTop - aTop;
        if (bi !== ai) return bi - ai;
        return (Number(b.publishedMs||0) - Number(a.publishedMs||0));
      });
    } else {
      filtered.sort((a,b) => (Number(b.publishedMs||0) - Number(a.publishedMs||0)));
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

      const age = document.createElement("span");
      age.className = "mini muted";
      age.dataset.role = "age";
      age.textContent = ageLabel(Math.max(0, Math.floor((Date.now() - Number(it.publishedMs || 0)) / 60000)));
      meta.appendChild(age);

      const actions = document.createElement("div");
      actions.className = "actionsRow";

      const btnUse = document.createElement("button");
      btnUse.className = "newsLink";
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
        // solo observa si no tenemos imagen buena todavía
        const hasGood = !!(it.imageOg || (it.image && String(it.image).startsWith("http")));
        if (!hasGood) ogObserver.observe(thumbWrap);
      }
    }

    el.newsList.appendChild(frag);
    el.newsList.scrollTop = prevScroll;

    // resolve visible (best-effort)
    if (resolveLinks && visibleForResolve.length) {
      const cap = Math.min(VISIBLE_RESOLVE_LIMIT, Math.max(20, showLimit * 2));
      const subset = visibleForResolve.slice(0, cap);
      runSoon(() => maybeResolveVisible(subset).catch(() => {}));
    }

    // translate visible (prioridad)
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
          bumpFeedFail(String(f?.url || ""));
          return [];
        });
        if (out && out.length) results.push(...out);
      });

      // merge + dedupe
      const merged = dedupeNormalize([ ...(state.items || []), ...results ]);

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
    for (let i = 0; i < batchSize; i++) {
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

    // RSS
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

    // Atom
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

  function textOf(root, sel) {
    try {
      const n = root.querySelector(sel);
      return n ? n.textContent : "";
    } catch {
      return "";
    }
  }

  function pickRssGuid(item) {
    const guid = cleanText(textOf(item, "guid"));
    if (guid && /^https?:\/\//i.test(guid)) return guid;
    return "";
  }

  function pickRssImage(item) {
    const media = item.querySelector("media\\:content, content, enclosure, media\\:thumbnail, thumbnail");
    if (media) {
      const u = media.getAttribute("url") || media.getAttribute("href") || media.getAttribute("src") || "";
      const clean = canonicalizeUrl(cleanText(u));
      if (clean) return clean;
    }
    // try <image> inside item (some feeds)
    const imgTag = item.querySelector("image, media\\:image");
    if (imgTag) {
      const u = cleanText(imgTag.textContent || imgTag.getAttribute("url") || "");
      const clean = canonicalizeUrl(u);
      if (clean) return clean;
    }
    return "";
  }

  function pickAtomLink(entry) {
    const links = entry.querySelectorAll("link");
    for (const l of links) {
      const rel = String(l.getAttribute("rel") || "").toLowerCase();
      if (!rel || rel === "alternate") {
        const href = l.getAttribute("href");
        if (href) return href;
      }
    }
    const fallback = entry.querySelector("link");
    return fallback ? (fallback.getAttribute("href") || "") : "";
  }

  function pickAtomImage(entry) {
    // <media:thumbnail> etc.
    const media = entry.querySelector("media\\:thumbnail, thumbnail, media\\:content, content");
    if (media) {
      const u = media.getAttribute("url") || media.getAttribute("href") || media.getAttribute("src") || "";
      const clean = canonicalizeUrl(cleanText(u));
      if (clean) return clean;
    }
    // content html
    const c = cleanText(textOf(entry, "content"));
    if (c) {
      const m = c.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (m && m[1]) return canonicalizeUrl(cleanText(m[1]));
    }
    return "";
  }

  function makeItem({ feed, title, link, publishedMs, image }) {
    const t = cleanText(title);
    const l = cleanText(link);
    const ms = Number(publishedMs || 0) || Date.now();
    const id = hashId(`${normalizeTitleKey(t)}|${l}|${ms}`);
    const cat = detectCategory(`${t} ${feed} ${l}`);
    return {
      id,
      feed: String(feed || "Feed"),
      title: t,
      titleEs: "",
      link: l,
      linkResolved: "",
      publishedMs: ms,
      image: canonicalizeUrl(image || ""),
      imageOg: "",
      cat,
      _hay: "",
      _ready: false,
    };
  }

  function dedupeNormalize(arr) {
    const map = new Map(); // id -> item
    for (const it of (arr || [])) {
      if (!it) continue;
      const id = it.id || hashId(`${normalizeTitleKey(it.title||"")}|${it.link||""}|${it.publishedMs||0}`);
      const prev = map.get(id);
      if (!prev) {
        map.set(id, it);
      } else {
        // merge fields (prefer resolved/img)
        prev.title = prev.title || it.title;
        prev.titleEs = prev.titleEs || it.titleEs;
        prev.feed = prev.feed || it.feed;
        prev.link = prev.link || it.link;
        prev.linkResolved = prev.linkResolved || it.linkResolved;
        prev.publishedMs = Math.max(Number(prev.publishedMs||0), Number(it.publishedMs||0));
        prev.image = prev.image || it.image;
        prev.imageOg = prev.imageOg || it.imageOg;
        prev.cat = prev.cat || it.cat;
      }
      map.get(id).id = id;
    }
    return Array.from(map.values());
  }

  function hardTrimAndPurge() {
    const fetchCap = clampNum(state.settings.fetchCap ?? (el.fetchCap ? el.fetchCap.value : 240), 80, 2000);
    const keepCap = Math.max(140, Math.min(2400, fetchCap * 2));
    state.items = (state.items || [])
      .sort((a,b) => Number(b.publishedMs||0) - Number(a.publishedMs||0))
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
    const u = String(url || "").trim();
    if (!u) return "";

    // 1) Si ya trae parámetro url/u/q/etc
    const directParam = extractUrlParam(u);
    if (directParam) return directParam;

    // 2) Intentar seguir redirect con fetch (a veces CORS bloquea, pero response.url suele estar)
    const followed = await tryFollowRedirect(u, 9_000);
    if (followed && followed !== u) {
      // si el destino parece redirect, intenta extraer param también
      const p2 = extractUrlParam(followed);
      return p2 || followed;
    }

    // 3) HTML parse (jina/allorigins) para encontrar canonical / meta refresh / json-ld / url=...
    const html = await fetchTextWithFallbacks(u, 14_000);
    if (!html) return "";

    const cand =
      pickCanonical(html) ||
      pickMetaRefresh(html) ||
      pickJsonLdUrl(html) ||
      pickFirstHttpUrlFromHtml(html) ||
      "";

    const viaParam = extractUrlParam(cand) || extractUrlParam(html);
    if (viaParam) return viaParam;

    // 4) Si encontramos algo, intenta normalizar y seguir 1 salto
    const clean = canonicalizeUrl(cand);
    if (clean && clean !== u) {
      const followed2 = await tryFollowRedirect(clean, 9_000);
      return canonicalizeUrl(followed2 || clean);
    }

    return "";
  }

  function pickCanonical(html) {
    const s = String(html || "");
    // <link rel="canonical" href="...">
    const m = s.match(/<link[^>]+rel=["']canonical["'][^>]*>/i);
    if (m && m[0]) {
      const u = extractHref(m[0]);
      if (u) return u;
    }
    // og:url
    const og = pickMeta(s, ["og:url", "twitter:url"]);
    if (og) return og;
    return "";
  }

  function pickMetaRefresh(html) {
    const s = String(html || "");
    // <meta http-equiv="refresh" content="0;url=...">
    const m = s.match(/<meta[^>]+http-equiv=["']refresh["'][^>]*>/i);
    if (!m || !m[0]) return "";
    const content = (m[0].match(/content=["']([^"']+)["']/i) || [])[1] || "";
    const mm = content.match(/url\s*=\s*([^;]+)/i);
    if (mm && mm[1]) return cleanText(mm[1]);
    return "";
  }

  function pickJsonLdUrl(html) {
    const s = String(html || "");
    const blocks = s.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi);
    if (!blocks) return "";
    for (const b of blocks) {
      const raw = b.replace(/^[\s\S]*?>/, "").replace(/<\/script>[\s\S]*$/, "");
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

  function pickFirstHttpUrlFromHtml(html) {
    const s = String(html || "");
    // Busca patrones comunes de salida tipo "...?url=https://..."
    const m = s.match(/https?:\/\/[^"'<> ]+/i);
    if (m && m[0]) {
      const u = extractUrlParam(m[0]);
      if (u) return u;
    }
    return "";
  }

  function extractHref(tag) {
    const m = String(tag || "").match(/href=["']([^"']+)["']/i);
    return m && m[1] ? cleanText(m[1]) : "";
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

  function isGoogleNews(u) {
    try {
      const x = new URL(String(u || ""));
      const h = x.hostname.toLowerCase();
      return h === "news.google.com" || h.endsWith(".news.google.com");
    } catch {
      return false;
    }
  }

  async function tryFollowRedirect(url, timeoutMs) {
    const u = String(url || "").trim();
    if (!u) return "";
    const ctrl = new AbortController();
    const t = setTimeout(() => { try { ctrl.abort(); } catch {} }, Math.max(1000, timeoutMs|0));
    try {
      const res = await fetch(u, {
        method: "GET",
        redirect: "follow",
        signal: ctrl.signal,
        // mode cors por defecto; si falla lo intentamos con fallbacks HTML
      });
      // aunque no podamos leer body, res.url suele venir
      const finalUrl = String(res?.url || "");
      if (finalUrl) return finalUrl;
    } catch {}
    finally { clearTimeout(t); }
    return "";
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

  function looksSpanishStrong(t) {
    const s = String(t || "");
    if (/[¡¿]/.test(s)) return true;
    const lower = s.toLowerCase();
    const hits = [
      " el ", " la ", " los ", " las ", " de ", " del ", " y ", " que ",
      " para ", " con ", " por ", " una ", " un ", " en "
    ];
    let score = 0;
    for (const w of hits) if (lower.includes(w)) score++;
    return score >= 3;
  }

  /* ───────────────────────────── OG / IMAGES ───────────────────────────── */
  function setupOgObserver() {
    if (!("IntersectionObserver" in window)) return;

    if (ogObserver) {
      try { ogObserver.disconnect(); } catch {}
      ogObserver = null;
    }

    ogObserver = new IntersectionObserver((entries) => {
      const visible = entries.filter(e => e && e.isIntersecting).slice(0, 18);
      for (const e of visible) {
        try { ogObserver.unobserve(e.target); } catch {}
        const card = e.target.closest(".newsItem");
        if (!card) continue;
        const id = card.dataset.id;
        const it = (state.items || []).find(x => x && x.id === id);
        if (!it) continue;
        const shownUrl = String(card.dataset.url || it.linkResolved || it.link || "");
        if (!shownUrl) continue;

        // fetch OG only if needed
        const hasGood = !!(it.imageOg || (it.image && String(it.image).startsWith("http")));
        if (!hasGood) {
          maybeFetchOgForItem(it, shownUrl).catch(() => {});
        }
      }
    }, { root: null, threshold: 0.15 });

    // (los nodos se observan en renderNewsList)
  }

  async function maybeFetchOgForItem(it, shownUrl) {
    if (!it || !shownUrl) return;

    const key = "img|" + shownUrl;
    const cached = readCache(imgCache, key);
    if (cached) {
      it.imageOg = cached;
      patchDomThumb(it.id, cached);
      return;
    }
    if (imgInFlight.has(key)) {
      const out = await imgInFlight.get(key).catch(() => "");
      if (out) {
        it.imageOg = out;
        patchDomThumb(it.id, out);
      }
      return;
    }

    const p = (async () => {
      const html = await fetchTextWithFallbacks(shownUrl, OG_FETCH_TIMEOUT_MS);
      if (!html) return "";

      const img =
        pickMeta(html, ["og:image:secure_url","og:image","twitter:image","twitter:image:src"]) ||
        pickJsonLdImage(html) ||
        pickLinkImageSrc(html) ||
        "";

      const clean = canonicalizeUrl(img);
      if (clean) {
        writeCache(imgCache, key, clean, IMG_CACHE_LIMIT, LS_IMG_CACHE);
        return clean;
      }
      return "";
    })();

    imgInFlight.set(key, p);
    const out = await p.catch(() => "");
    imgInFlight.delete(key);

    if (out) {
      it.imageOg = out;
      patchDomThumb(it.id, out);
    }
  }

  function patchDomThumb(id, url) {
    try {
      const card = el.newsList.querySelector(`.newsItem[data-id="${cssEscape(String(id))}"]`);
      if (!card) return;
      const img = card.querySelector("img.newsThumb");
      if (!img) return;
      // no pisar si ya es mejor
      if (img.src && img.src.startsWith("http") && img.src.includes("favicons")) {
        img.src = url;
      } else if (!img.src || img.src.includes("favicons")) {
        img.src = url;
      }
    } catch {}
  }

  function pickMeta(html, keys) {
    const s = String(html || "");
    for (const k of (keys || [])) {
      const re = new RegExp(`<meta[^>]+(?:property|name)=["']${escapeRe(k)}["'][^>]*>`, "i");
      const m = s.match(re);
      if (m && m[0]) {
        const c = (m[0].match(/content=["']([^"']+)["']/i) || [])[1] || "";
        if (c) return cleanText(c);
      }
    }
    return "";
  }

  function pickLinkImageSrc(html) {
    const s = String(html || "");
    const m = s.match(/<link[^>]+rel=["']image_src["'][^>]*>/i);
    if (m && m[0]) {
      const u = extractHref(m[0]);
      if (u) return u;
    }
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

  /* ───────────────────────────── NETWORK HELPERS ───────────────────────────── */
  async function fetchTextWithFallbacks(url, timeoutMs, parentSignal) {
    const u = String(url || "").trim();
    if (!u) return "";

    // 1) Direct
    try {
      const t = await tryFetchText(u, timeoutMs, parentSignal);
      if (t) return t;
    } catch {}

    // 2) AllOrigins raw
    try {
      const ao = "https://api.allorigins.win/raw?url=" + encodeURIComponent(u);
      const t = await tryFetchText(ao, timeoutMs, parentSignal);
      if (t) return t;
    } catch {}

    // 3) jina.ai (muy útil para CORS)
    try {
      const j = "https://r.jina.ai/http://" + u.replace(/^https?:\/\//i, "");
      const t = await tryFetchText(j, timeoutMs, parentSignal);
      if (t) return t;
    } catch {}

    return "";
  }

  async function tryFetchText(url, timeoutMs, parentSignal) {
    const ctrl = new AbortController();
    const t = setTimeout(() => { try { ctrl.abort(); } catch {} }, Math.max(1000, timeoutMs|0));
    try {
      const signal = mergeAbortSignals(parentSignal, ctrl.signal);
      const res = await fetch(url, { method: "GET", signal, redirect: "follow" });
      // algunos endpoints devuelven no-200 pero con body útil
      const text = await res.text().catch(() => "");
      return String(text || "");
    } finally {
      clearTimeout(t);
    }
  }

  function mergeAbortSignals(a, b) {
    if (!a) return b;
    if (!b) return a;
    // Si AbortSignal.any existe
    if (typeof AbortSignal !== "undefined" && AbortSignal.any) {
      try { return AbortSignal.any([a, b]); } catch {}
    }
    // fallback simple: si uno aborta, aborta el otro controller en fetch; aquí devolvemos b
    // (direct fetch usa b; pero parent se controla en llamador con abort global)
    return b;
  }

  /* ───────────────────────────── CACHE HELPERS ───────────────────────────── */
  function readCache(obj, key) {
    try {
      const v = obj && obj[key];
      if (!v) return "";
      // estructura: { v, t }
      if (typeof v === "string") return v;
      if (v && typeof v === "object" && v.v) return String(v.v);
    } catch {}
    return "";
  }

  function writeCache(obj, key, value, limit, persistKey) {
    if (!obj || !key) return;
    try {
      obj[key] = { v: String(value || ""), t: Date.now() };
      // trim LRU-ish
      const keys = Object.keys(obj);
      if (keys.length > limit) {
        keys.sort((a,b) => Number(obj[a]?.t||0) - Number(obj[b]?.t||0));
        const kill = keys.slice(0, Math.max(10, keys.length - limit));
        for (const k of kill) delete obj[k];
      }
      safeSetLS(persistKey, JSON.stringify(obj));
    } catch {}
  }

  /* ───────────────────────────── SMALL UTILS ───────────────────────────── */
  function debounce(fn, ms) {
    let t = 0;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  function runSoon(fn) {
    try { setTimeout(fn, 0); } catch {}
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function clampNum(v, min, max) {
    const n = Number(v);
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function cleanText(s) {
    return String(s || "").replace(/\s+/g, " ").trim();
  }

  function canonicalizeUrl(u) {
    const s = cleanText(u);
    if (!s) return "";
    if (s.startsWith("//")) return "https:" + s;
    if (!/^https?:\/\//i.test(s)) return s; // dejamos tal cual si no es URL (evita romper)
    try {
      const x = new URL(s);
      // limpia tracking simple
      ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","fbclid","gclid","mc_cid","mc_eid"].forEach(k => x.searchParams.delete(k));
      return x.toString();
    } catch {
      return s;
    }
  }

  function getDomain(u) {
    try {
      const x = new URL(String(u || ""));
      return x.hostname.replace(/^www\./i, "");
    } catch {
      return "";
    }
  }

  function safeJson(text) {
    try { return JSON.parse(String(text || "")); } catch { return null; }
  }

  function safeDecode(s) {
    try { return decodeURIComponent(String(s || "")); } catch { return String(s || ""); }
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeRe(s) {
    return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function cssEscape(s) {
    // minimal escape for attribute selector usage
    return String(s || "").replace(/"/g, '\\"');
  }

  function fastHash(s) {
    const str = String(s || "");
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    // uint32
    return (h >>> 0).toString(16);
  }

  function hashId(s) {
    return fastHash(s);
  }

  function parseDateMs(s) {
    const t = String(s || "").trim();
    if (!t) return 0;
    const ms = Date.parse(t);
    if (Number.isFinite(ms) && ms > 0) return ms;
    // ISO-like already covered; try unix seconds
    const n = Number(t);
    if (Number.isFinite(n)) {
      if (n > 10_000_000_000) return n; // ms
      if (n > 1_000_000_000) return n * 1000; // sec
    }
    return 0;
  }

  function normalizeTitleKey(t) {
    return String(t || "")
      .toLowerCase()
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
    // heurístico rápido: fuente + keywords + frescura
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
      "última hora","urgente","breaking","explosión","atentado","tiroteo","dimite","dimisión",
      "sanciones","misil","dron","ofensiva","bombardeo","muertos","heridos","detenido",
      "juicio","tribunal","nato","otan","ucrania","rusia","bce","inflación","ibex"
    ];
    for (const k of hot) if (title.includes(k)) score += 6;

    return Math.max(0, Math.min(100, score));
  }

  function genHashtags(headline) {
    const h = normalizeTitleKey(headline);
    if (!h) return "";

    const stop = new Set([
      "el","la","los","las","de","del","y","en","a","un","una","unos","unas","que","por","para","con","sin",
      "al","se","su","sus","como","más","menos","sobre","tras","ante","entre","desde","hasta","hoy","ayer"
    ]);

    const words = h.split(" ").filter(w => w && w.length >= 4 && !stop.has(w));
    if (!words.length) return "";

    // prefer “nombres” por simple heurística (frecuencia)
    const freq = new Map();
    for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);

    const top = Array.from(freq.entries())
      .sort((a,b) => b[1] - a[1])
      .map(x => x[0])
      .slice(0, 4);

    const tags = top.map(w => "#" + w.replace(/[^\p{L}\p{N}]/gu, "")).filter(Boolean).slice(0, 3);
    return tags.join(" ");
  }

  function smartTrimHeadline(s, maxLen) {
    const t = cleanText(s);
    if (t.length <= maxLen) return t;
    const cut = t.slice(0, Math.max(0, maxLen - 1));
    // intenta cortar por palabra
    const lastSpace = cut.lastIndexOf(" ");
    const base = (lastSpace > 18) ? cut.slice(0, lastSpace) : cut;
    return base.trimEnd() + "…";
  }

  // Twitter/X count approximation: URLs cuentan como 23
  function twCharCount(text) {
    const s = String(text || "");
    if (!s) return 0;
    const urlRe = /https?:\/\/\S+/gi;
    let count = 0;
    let lastIndex = 0;
    let m;
    while ((m = urlRe.exec(s)) !== null) {
      count += (m.index - lastIndex);
      count += 23;
      lastIndex = m.index + m[0].length;
    }
    count += (s.length - lastIndex);
    return count;
  }

  async function copyToClipboard(text) {
    const t = String(text || "");
    if (!t) return;
    try {
      await navigator.clipboard.writeText(t);
      return;
    } catch {}
    // fallback
    const ta = document.createElement("textarea");
    ta.value = t;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch {}
    document.body.removeChild(ta);
  }

  /* ───────────────────────────── PWA / SERVICE WORKER ───────────────────────────── */
  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;

    // 1) register
    navigator.serviceWorker.register("./sw.js")
      .then((reg) => {
        swReg = reg;

        // 2) periodic update checks
        if (swUpdateTimer) clearInterval(swUpdateTimer);
        swUpdateTimer = setInterval(() => {
          try { swReg.update(); } catch {}
        }, SW_UPDATE_CHECK_MS);

        // 3) reload once when controller changes (new SW activated)
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

        // 4) if waiting, ask it to activate
        if (reg.waiting) {
          try { reg.waiting.postMessage({ type: "SKIP_WAITING" }); } catch {}
        }

        // 5) listen for updates
        reg.addEventListener("updatefound", () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener("statechange", () => {
            if (nw.state === "installed") {
              // if new worker installed and there is already a controller => update available
              if (navigator.serviceWorker.controller) {
                try { reg.waiting?.postMessage({ type: "SKIP_WAITING" }); } catch {}
              }
            }
          });
        });
      })
      .catch(() => {});
  }

  /* ───────────────────────────── BOOT ───────────────────────────── */
  try {
    init();
  } catch (e) {
    crashOverlay(e);
  }
})();
