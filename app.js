/* app.js — News → Tweet Template Panel (tnp-v4.0.0) — PRO HARDENED + IMAGES + THREAD (MAX UPGRADE)
   ✅ Anti “pantalla en blanco”: overlay + window.onerror + unhandledrejection
   ✅ Refresh PRO: no solapa (cola), force abort, backoff por feed, pool concurrency
   ✅ Rendimiento: render por chunks (no bloquea), tick UI sin re-render, visible-only translate/resolve/OG
   ✅ Links reales: resolver Google News + redirects + clean tracking + cache
   ✅ Imágenes: RSS media/enclosure + <img> en description + og:image/twitter:image + favicon fallback
   ✅ De-dupe: por URL canónica + por título normalizado
   ✅ 🧵 Thread: parte automáticamente en varios tweets (con 1/N) y copia al portapapeles
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

  /* ───────────────────────────── REALTIME ───────────────────────────── */
  const AUTO_REFRESH_FEEDS_SEC_DEFAULT = 30;
  const AUTO_TICK_UI_SEC = 10;

  const MAX_ITEMS_KEEP = 900;

  const FEED_CONCURRENCY = 6;
  const RESOLVE_CONCURRENCY = 3;
  const TR_CONCURRENCY = 2;

  const IMG_CONCURRENCY = 2;
  const VISIBLE_TRANSLATE_LIMIT = 70;
  const VISIBLE_RESOLVE_LIMIT = 60;
  const OBSERVE_OG_VISIBLE_LIMIT = 80;

  const OG_FETCH_TIMEOUT_MS = 14_000;

  const TR_CACHE_LIMIT = 1400;
  const RESOLVE_CACHE_LIMIT = 1600;
  const IMG_CACHE_LIMIT = 1200;

  const FEED_FAIL_BACKOFF_BASE_MS = 60_000;
  const FEED_FAIL_BACKOFF_MAX_MS = 15 * 60_000;

  const MAX_SMART_HEADLINE_LEN = 130;
  const VERSION = "tnp-v4.0.0";

  /* ───────────────────────────── TEMPLATE ───────────────────────────── */
  const DEFAULT_TEMPLATE =
`🚨 ÚLTIMA HORA: {{HEADLINE}}

🔴#ENVIVO >>> {{LIVE_URL}}

Fuente:
{{SOURCE_URL}}

{{HASHTAGS}}`;

  /* ───────────────────────────── FEEDS ───────────────────────────── */
  const gn = (q, hl="es", gl="ES", ceid="ES:es") =>
    `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=${encodeURIComponent(hl)}&gl=${encodeURIComponent(gl)}&ceid=${encodeURIComponent(ceid)}`;

  const gdeltDoc = (query, max=50) =>
    `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=ArtList&format=json&maxrecords=${encodeURIComponent(String(max))}&sort=HybridRel`;

  const DEFAULT_FEEDS = [
    { name: "DW Español (RSS)", url: "https://rss.dw.com/rdf/rss-es-all", enabled: true },
    { name: "Euronews (MRSS)", url: "https://www.euronews.com/rss?format=mrss", enabled: true },
    { name: "Google News — España (RSS)", url: gn("España OR Madrid OR Barcelona"), enabled: true },
    { name: "Google News — Mundo (RSS)", url: gn("World OR International OR ONU OR UE"), enabled: true },
    { name: "Reuters — World (via GN)", url: gn("site:reuters.com world"), enabled: false },
    { name: "AP — World (via GN)", url: gn("site:apnews.com world"), enabled: false },
    { name: "BBC World (RSS)", url: "https://feeds.bbci.co.uk/news/world/rss.xml", enabled: false },
    { name: "The Guardian World (RSS)", url: "https://www.theguardian.com/world/rss", enabled: false },
    { name: "Al Jazeera (RSS)", url: "https://www.aljazeera.com/xml/rss/all.xml", enabled: false },
    { name: "GDELT — Breaking", url: gdeltDoc("breaking OR urgent OR developing", 50), enabled: false },
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
  };

  const trCache = loadJsonPreferNew(LS_TR_CACHE, LS_TR_CACHE_V3, {});
  const resolveCache = loadJsonPreferNew(LS_RESOLVE_CACHE, LS_RESOLVE_CACHE_V3, {});
  const imgCache = loadJsonPreferNew(LS_IMG_CACHE, null, {});

  const trInFlight = new Map();
  const resInFlight = new Map();
  const imgInFlight = new Map();

  const feedFail = new Map(); // url -> { fails, nextAt }
  const feedTextHash = new Map(); // url -> hash (para saltar parse si igual dentro de sesión)

  let uiTickTimer = 0;
  let autoRefreshTimer = 0;
  let visHandlerInstalled = false;
  let lastRefreshAt = 0;

  // OG visible-only
  let ogObserver = null;

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
    el.searchBox = must("#searchBox");
    el.btnRefresh = must("#btnRefresh");
    el.btnFeeds = must("#btnFeeds");

    el.charCount = must("#charCount");
    el.btnTrim = must("#btnTrim");
    el.btnGenTags = must("#btnGenTags");
    el.btnCopyUrl = must("#btnCopyUrl");
    el.btnX = must("#btnX");
    el.btnThread = must("#btnThread");
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
    el.optOnlySpanish.checked = state.settings.onlySpanish !== false;
    el.sortBy.value = String(state.settings.sortBy || "recent");

    if (el.optAutoRefresh) el.optAutoRefresh.checked = state.settings.autoRefresh !== false;
    if (el.refreshSec) el.refreshSec.value = String(clampNum(state.settings.refreshSec ?? AUTO_REFRESH_FEEDS_SEC_DEFAULT, 15, 600));
    if (el.optResolveLinks) el.optResolveLinks.checked = state.settings.resolveLinks !== false;
    if (el.optShowOriginal) el.optShowOriginal.checked = state.settings.showOriginal !== false;
    if (el.optHideUsed) el.optHideUsed.checked = !!state.settings.hideUsed;
    if (el.catFilter) el.catFilter.value = String(state.settings.catFilter || "all");

    bindUI();
    renderFeedsModal();
    updatePreview();

    refreshAll({ reason: "boot", force: true });
    startRealtime();

    window.TNP_DEBUG = { state, trCache, resolveCache, imgCache, VERSION };
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
    el.btnRefresh.addEventListener("click", () => refreshAll({ reason: "manual", force: true }));
    el.btnFeeds.addEventListener("click", () => openModal(true));
    el.btnCloseModal.addEventListener("click", () => openModal(false));
    el.modal.addEventListener("click", (e) => { if (e.target === el.modal) openModal(false); });

    el.timeFilter.addEventListener("change", () => renderNewsList({ silent: true }));
    el.searchBox.addEventListener("input", debounce(() => renderNewsList({ silent: true }), 120));

    el.delayMin.addEventListener("input", () => {
      saveSetting("delayMin", clampNum(el.delayMin.value, 0, 120));
      renderNewsList({ silent: true });
    });

    el.optOnlyReady.addEventListener("change", () => { saveSetting("onlyReady", !!el.optOnlyReady.checked); renderNewsList({ silent: true }); });
    el.optOnlySpanish.addEventListener("change", () => { saveSetting("onlySpanish", !!el.optOnlySpanish.checked); renderNewsList({ silent: true }); });
    el.sortBy.addEventListener("change", () => { saveSetting("sortBy", el.sortBy.value); renderNewsList({ silent: true }); });
    if (el.catFilter) el.catFilter.addEventListener("change", () => { saveSetting("catFilter", el.catFilter.value); renderNewsList({ silent: true }); });

    if (el.optAutoRefresh) el.optAutoRefresh.addEventListener("change", () => { saveSetting("autoRefresh", !!el.optAutoRefresh.checked); startRealtime(); });
    if (el.refreshSec) el.refreshSec.addEventListener("input", () => { saveSetting("refreshSec", clampNum(el.refreshSec.value, 15, 600)); startRealtime(); });

    if (el.optResolveLinks) el.optResolveLinks.addEventListener("change", () => { saveSetting("resolveLinks", !!el.optResolveLinks.checked); renderNewsList({ silent: true }); });
    if (el.optShowOriginal) el.optShowOriginal.addEventListener("change", () => { saveSetting("showOriginal", !!el.optShowOriginal.checked); renderNewsList({ silent: true }); });
    if (el.optHideUsed) el.optHideUsed.addEventListener("change", () => { saveSetting("hideUsed", !!el.optHideUsed.checked); renderNewsList({ silent: true }); });

    // composer
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

    el.btnThread.addEventListener("click", async () => {
      const txt = String(el.preview.textContent || "");
      if (!txt.trim()) return toast("⚠️ No hay texto.");
      const parts = buildThreadFromText(txt);
      if (parts.length <= 1) {
        await copyToClipboard(parts[0] || txt);
        toast("🧵 Cabe en 1 tweet (copiado).");
        return;
      }
      const joined = parts.map((p, i) => `(${i+1}/${parts.length})\n${p}`).join("\n\n— — —\n\n");
      await copyToClipboard(joined);
      toast(`🧵 Thread listo: ${parts.length} tweets (copiado).`);
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
    // FIX: ya NO buscamos "{{SOURCE_URL}}" (porque ya fue reemplazado)
    if (!includeSource) out = out.replace(/^\s*Fuente:\s*\n[^\n]*\n?/mi, "").trim();

    el.preview.textContent = String(out || "");

    const count = twCharCount(out);
    el.charCount.textContent = String(count);

    const warn = [];
    if (count > 280) warn.push(`Te pasas: ${count}/280 (usa ✂ o 🧵)`);
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

  /* ───────────────────────────── STATUS / TOAST ───────────────────────────── */
  function setStatus(msg) {
    el.status.textContent = String(msg || "Listo");
  }

  let toastTimer = 0;
  function toast(msg) {
    setStatus(msg);
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      const tail = lastRefreshAt ? `Listo · ${state.items.length}` : "Listo";
      setStatus(tail);
    }, 2200);
  }

  /* ───────────────────────────── REFRESH PIPELINE ───────────────────────────── */
  async function refreshAll({ reason = "manual", force = false } = {}) {
    if (state.refreshInFlight) {
      state.refreshPending = true;
      if (force) { try { state.refreshAbort?.abort(); } catch {} }
      return;
    }

    state.refreshInFlight = true;
    state.refreshPending = false;

    const seq = ++state.refreshSeq;
    const abort = new AbortController();
    state.refreshAbort = abort;

    try {
      setStatus(`⟳ Refrescando… (${reason})`);

      const enabled = (state.feeds || []).filter(f => f && f.url && f.enabled !== false);
      if (!enabled.length) { toast("⚠️ No hay feeds activos."); return; }

      // backoff skip
      const jobs = enabled.filter(f => {
        if (force) return true;
        const ff = feedFail.get(f.url);
        if (!ff) return true;
        return Date.now() >= Number(ff.nextAt || 0);
      });

      const results = [];
      await pool(jobs, FEED_CONCURRENCY, async (f) => {
        const out = await fetchOneFeed(f, abort.signal, force).catch(() => null);
        if (out && out.length) results.push(...out);
      });

      // merge + dedupe + trim
      const merged = dedupeNormalize([...(state.items || []), ...results]);
      merged.sort((a,b) => (Number(b.publishedMs||0) - Number(a.publishedMs||0)));

      state.items = merged.slice(0, MAX_ITEMS_KEEP);

      lastRefreshAt = Date.now();
      setStatus(`✅ OK · ${state.items.length} items · ${new Date(lastRefreshAt).toLocaleTimeString()}`);

      renderNewsList({ silent: true });

    } catch (e) {
      if (abort.signal.aborted) {
        setStatus("⛔ Refresh abortado.");
      } else {
        setStatus("❌ Error refrescando. (mira consola)");
        console.error(e);
      }
    } finally {
      if (seq === state.refreshSeq) {
        state.refreshInFlight = false;
        state.refreshAbort = null;
      } else {
        state.refreshInFlight = false;
        state.refreshAbort = null;
      }

      if (state.refreshPending) {
        state.refreshPending = false;
        refreshAll({ reason: "queued", force: false });
      }
    }
  }

  async function fetchOneFeed(feed, parentSignal, force) {
    const name = String(feed?.name || "Feed");
    const url = String(feed?.url || "").trim();
    if (!url) return [];

    // backoff tracking
    const ff = feedFail.get(url) || { fails: 0, nextAt: 0 };
    if (!force && ff.nextAt && Date.now() < ff.nextAt) return [];

    const txt = await fetchTextWithFallbacks(url, 18_000, parentSignal);
    if (!txt) throw new Error("empty feed " + url);

    // si en esta sesión el texto es igual, saltamos parse
    const h = fastHash(txt);
    if (!force && feedTextHash.get(url) === h) return [];
    feedTextHash.set(url, h);

    let items = [];
    const t = String(txt || "").trim();
    if (t.startsWith("{") || t.startsWith("[")) items = parseJsonFeed(t, name);
    else items = parseFeed(t, name);

    // ok => reset fail
    feedFail.set(url, { fails: 0, nextAt: 0 });

    return items || [];
  }

  function feedFailBump(url) {
    const cur = feedFail.get(url) || { fails: 0, nextAt: 0 };
    const fails = Math.min(50, (cur.fails || 0) + 1);
    const backoff = Math.min(FEED_FAIL_BACKOFF_MAX_MS, FEED_FAIL_BACKOFF_BASE_MS * Math.pow(1.6, fails - 1));
    feedFail.set(url, { fails, nextAt: Date.now() + backoff });
  }

  /* ───────────────────────────── PARSERS ───────────────────────────── */
  function parseJsonFeed(jsonText, feedName) {
    const out = [];
    const j = safeJson(jsonText);
    if (!j) return out;

    let arr = [];
    if (Array.isArray(j)) arr = j;
    else if (Array.isArray(j.articles)) arr = j.articles;
    else if (Array.isArray(j.results)) arr = j.results;
    else if (Array.isArray(j.data)) arr = j.data;

    for (const a of arr) {
      const title = cleanText(a?.title || a?.name || a?.headline || "");
      const link = cleanText(a?.url || a?.link || a?.sourceurl || "");
      const pub = cleanText(a?.seendate || a?.pubDate || a?.published || a?.datetime || "");
      const ms = parseDateMs(pub) || Number(a?.timestamp || 0) || Date.now();

      const img = cleanText(a?.image || a?.socialimage || a?.urlToImage || "");
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

  function parseFeed(xmlText, feedName) {
    const out = [];
    const s = String(xmlText || "");
    const dp = new DOMParser();
    const doc = dp.parseFromString(s, "text/xml");
    if (doc.querySelector("parsererror")) return out;

    const rssItems = doc.querySelectorAll("item");
    if (rssItems && rssItems.length) {
      rssItems.forEach(item => {
        const title = cleanText(textOf(item, "title"));
        const link = cleanText(textOf(item, "link")) || pickRssGuid(item);
        const pub = cleanText(textOf(item, "pubDate")) || cleanText(textOf(item, "date")) || cleanText(textOf(item, "dc\\:date"));
        const ms = parseDateMs(pub) || Date.now();

        const img = pickRssImage(item);

        if (!title || !link) return;
        out.push(makeItem({ feed: feedName, title, link, publishedMs: ms, image: img }));
      });
      return out;
    }

    const entries = doc.querySelectorAll("entry");
    if (entries && entries.length) {
      entries.forEach(entry => {
        const title = cleanText(textOf(entry, "title"));
        const link = cleanText(pickAtomLink(entry));
        const pub = cleanText(textOf(entry, "updated")) || cleanText(textOf(entry, "published"));
        const ms = parseDateMs(pub) || Date.now();

        const img = pickAtomImage(entry);

        if (!title || !link) return;
        out.push(makeItem({ feed: feedName, title, link, publishedMs: ms, image: img }));
      });
    }
    return out;
  }

  function makeItem({ feed, title, link, publishedMs, image = "" }) {
    const fixedLink = canonicalizeUrl(link);
    const fixedTitle = cleanText(title);
    const cat = detectCategory(fixedTitle, feed);

    return {
      id: hashId(fixedLink || (fixedTitle + "|" + feed)),
      feed: String(feed || "Feed"),
      title: fixedTitle,
      titleEs: looksSpanish(fixedTitle) ? fixedTitle : "",
      link: fixedLink,
      linkResolved: "",
      publishedMs: Number(publishedMs || Date.now()),
      cat,
      impact: 0,
      image: canonicalizeUrl(image),
      ogImage: "",
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

    const desc = textOf(itemEl, "description");
    const ce = textOf(itemEl, "content\\:encoded");
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
    const t = cleanText(textOf(entryEl, "link"));
    return t;
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

    const content = textOf(entryEl, "content");
    const summary = textOf(entryEl, "summary");
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

  /* ───────────────────────────── DEDUPE ───────────────────────────── */
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
        linkResolved: canonicalizeUrl(it?.linkResolved || ""),
        titleEs: cleanText(it?.titleEs || ""),
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

    // extra de-dupe por título normalizado
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

    return Array.from(byTitle.values());
  }

  function normalizeTitleKey(t) {
    return String(t || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[“”"']/g, "")
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .trim()
      .slice(0, 160);
  }

  /* ───────────────────────────── IMPACT ───────────────────────────── */
  function calcImpact(it) {
    if (!it) return 0;
    if (Number.isFinite(it.impact) && it.impact > 0) return it.impact;

    let score = 0;
    const title = String((it.titleEs || it.title || "")).toLowerCase();
    const feed = String(it.feed || "").toLowerCase();

    if (/reuters|apnews|associated press|bbc|financial times|ft\.com/.test(feed)) score += 18;
    if (/elpais|el país|elmundo|la vanguardia|abc|expansión|eleconomista/.test(feed)) score += 10;

    const hot = [
      "última hora","breaking","urgent","en directo","atentado","misil","ataque","explosión",
      "otan","nato","ucrania","rusia","israel","gaza","trump","biden","sánchez","putin",
      "dimite","detenido","juicio","sanciones","crisis","apagón","hackeo"
    ];
    for (const k of hot) if (title.includes(k)) score += 8;

    if (/presidente|gobierno|elecciones|parlamento|congreso|ue|unión europea|onu/.test(title)) score += 6;
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
    if (sp.test(t) || /españa/.test(f)) return "spain";

    if (/(otan|nato|ucrania|rusia|gaza|israel|misil|ataque|defensa|ejército)/i.test(t)) return "war";
    if (/(elecciones|presidente|gobierno|parlamento|congreso|senado|partido|ministro)/i.test(t)) return "politics";
    if (/(bolsa|ibex|dow|nasdaq|inflación|pib|banco|tipos|petróleo|gas|mercados)/i.test(t)) return "economy";
    if (/(energía|petróleo|gas|opep|repsol|chevron|shell|bp)/i.test(t)) return "energy";
    if (/(ia|ai|openai|microsoft|google|meta|apple|android|iphone|chip|nvidia|ciber|hack)/i.test(t)) return "tech";
    if (/(asesin|tiroteo|secuestro|narc|policía|detenido|crimen|sucesos)/i.test(t)) return "crime";
    if (/(salud|virus|covid|vacuna|hospital|epidemia)/i.test(t)) return "health";
    if (/(fútbol|liga|champions|nba|nfl|tenis|golf|baloncesto)/i.test(t)) return "sports";
    if (/(cultura|arte|libro|premio|exposición)/i.test(t)) return "culture";
    if (/(cine|serie|netflix|música|festival|oscar|grammy)/i.test(t)) return "ent";

    return "world";
  }

  /* ───────────────────────────── NEWS LIST (FAST RENDER) ───────────────────────────── */
  function renderNewsList({ silent = false } = {}) {
    const items = (state.items || []).slice();

    const hours = clampNum(el.timeFilter.value, 1, 72);
    const search = String(el.searchBox.value || "").trim().toLowerCase();

    const delay = clampNum(el.delayMin.value, 0, 120);
    const onlyReady = !!el.optOnlyReady.checked;

    const wantSpanish = !!el.optOnlySpanish.checked;
    const hideUsed = !!(el.optHideUsed && el.optHideUsed.checked);
    const sortBy = String(el.sortBy.value || "recent");
    const cat = String((el.catFilter && el.catFilter.value) || "all");

    const now = Date.now();
    const minMs = now - (hours * 60 * 60 * 1000);

    const filtered = items.filter(it => {
      if (!it) return false;
      const ms = Number(it.publishedMs || 0) || 0;
      if (ms && ms < minMs) return false;

      if (hideUsed && state.used.has(it.id)) return false;
      if (cat && cat !== "all" && String(it.cat || "all") !== cat) return false;

      const shownTitle = String(it.titleEs || it.title || "");
      const hay = (shownTitle + " " + String(it.feed || "")).toLowerCase();
      if (search && !hay.includes(search)) return false;

      const isReady = (now - Number(it.publishedMs || 0)) >= (delay * 60 * 1000);
      if (onlyReady && !isReady) return false;

      it._ready = isReady;
      it._ageMin = Math.max(0, Math.floor((now - Number(it.publishedMs || 0)) / 60000));
      it.impact = it.impact || calcImpact(it);
      return true;
    });

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

    const prevScroll = el.newsList.scrollTop;

    // reset observer (evita leaks al re-render)
    if (ogObserver) {
      try { ogObserver.disconnect(); } catch {}
      setupOgObserver();
    }

    el.newsList.innerHTML = "";

    const resolveLinks = state.settings.resolveLinks !== false;

    const visibleForResolve = [];
    const visibleForTranslate = [];

    // Render por chunks (más fluido con listas largas)
    let i = 0;
    const CHUNK = 40;

    const renderChunk = () => {
      const frag = document.createDocumentFragment();

      for (let c = 0; c < CHUNK && i < filtered.length; c++, i++) {
        const it = filtered[i];

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
        img.loading = "lazy";

        const best = pickBestThumb(it, shownUrl || it.link);
        img.src = best || faviconUrl(shownUrl || it.link);

        img.addEventListener("error", () => {
          const fallback = faviconUrl(shownUrl || it.link);
          if (img.src !== fallback) img.src = fallback;
        });

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
        time.className = "small";
        time.dataset.role = "age";
        time.textContent = ageLabel(it._ageMin);
        meta.appendChild(time);

        const src = document.createElement("span");
        src.className = "small";
        src.textContent = "· " + String(it.feed || "Feed");
        meta.appendChild(src);

        const actions = document.createElement("div");
        actions.className = "actionsRow";

        const btnUse = linkBtn("Usar", "#");
        btnUse.addEventListener("click", async (e) => { e.preventDefault(); await useItem(it); });

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

        // visibles-only pools (primeros N)
        if (visibleForResolve.length < VISIBLE_RESOLVE_LIMIT) visibleForResolve.push(it);
        if (wantSpanish && visibleForTranslate.length < VISIBLE_TRANSLATE_LIMIT) visibleForTranslate.push(it);

        // observe OG si falta thumb y no es GN
        if (ogObserver && i < OBSERVE_OG_VISIBLE_LIMIT) {
          const lacks = !(it.image || it.ogImage || readCache(imgCache, imgCacheKey(shownUrl || it.link)));
          if (lacks && shownUrl && !isGoogleNews(shownUrl)) {
            try { ogObserver.observe(card); } catch {}
          }
        }
      }

      el.newsList.appendChild(frag);

      if (i < filtered.length) {
        requestAnimationFrame(renderChunk);
      } else {
        if (silent) el.newsList.scrollTop = prevScroll;

        // async visible-only (no bloquea UI)
        queueRerenderSoft();
        maybeResolveVisible(visibleForResolve).catch(() => {});
        maybeTranslateVisible(visibleForTranslate).catch(() => {});
      }
    };

    requestAnimationFrame(renderChunk);
  }

  function queueRerenderSoft() {
    if (state.rerenderQueued) return;
    state.rerenderQueued = true;
    setTimeout(() => {
      state.rerenderQueued = false;
      renderNewsList({ silent: true });
    }, 420);
  }

  async function useItem(it) {
    if (!it) return;

    const resolveLinks = state.settings.resolveLinks !== false;

    // 1) resolver si procede
    if (resolveLinks && it.link && !it.linkResolved && (isGoogleNews(it.link) || looksLikeRedirect(it.link))) {
      await maybeResolveOne(it);
    }

    // 2) traducir si procede
    if (!!el.optOnlySpanish.checked && !it.titleEs && !looksSpanish(it.title)) {
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
    const cards = el.newsList.querySelectorAll(".newsItem");
    cards.forEach(card => {
      const ms = Number(card.dataset.published || 0);
      const min = ms ? Math.max(0, Math.floor((now - ms) / 60000)) : 0;
      const ageEl = card.querySelector("[data-role='age']");
      if (ageEl) ageEl.textContent = ageLabel(min);

      const delay = clampNum(el.delayMin.value, 0, 120);
      const isReady = (now - ms) >= (delay * 60 * 1000);
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

  /* ───────────────────────────── OG OBSERVER ───────────────────────────── */
  function setupOgObserver() {
    if (!("IntersectionObserver" in window)) { ogObserver = null; return; }

    ogObserver = new IntersectionObserver(async (entries) => {
      const visible = entries.filter(e => e.isIntersecting).slice(0, IMG_CONCURRENCY);
      for (const e of visible) {
        try { ogObserver.unobserve(e.target); } catch {}
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

  function getDomain(url) {
    try { return new URL(url).hostname.replace(/^www\./i, ""); } catch { return ""; }
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

      // 1) extraer param
      out = extractUrlParam(url);
      out = canonicalizeUrl(out);
      out = cleanTracking(out);
      if (out) return out;

      // 2) fetch html y rascar redirect/canonical/json-ld
      const html = await fetchTextWithFallbacks(url, 12_000).catch(() => "");
      if (html) {
        out = pickCanonical(html) || pickMetaRefresh(html) || pickJsonLdUrl(html) || extractUrlFromHtml(html);
        out = canonicalizeUrl(out);
        out = cleanTracking(out);
        if (out) return out;
      }

      // 3) último: si se puede, seguir redirect (a veces CORS lo impide)
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
    // Google News a veces incluye "https://www.google.com/url?url=..."
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
      const keys = ["url","u","q","target","dest","destination","redirect"];
      for (const k of keys) {
        const v = p.get(k);
        if (v && /^https?:\/\//i.test(v)) return v;
      }
    } catch {}
    const m = String(s || "").match(/[?&](?:url|u|q|target|dest|destination|redirect)=([^&"'<>\s]+)/i);
    if (m && m[1]) {
      const v = safeDecode(m[1]);
      if (/^https?:\/\//i.test(v)) return v;
    }
    return "";
  }

  function looksLikeRedirect(u) {
    const s = String(u || "");
    return /\/url\?|redirect|destination|dest=|target=|u=|url=/i.test(s);
  }

  /* ───────────────────────────── TRANSLATE (visible-only) ───────────────────────────── */
  async function maybeTranslateVisible(items) {
    const wantSpanish = !!el.optOnlySpanish.checked;
    if (!wantSpanish) return;

    const targets = (items || []).filter(it => it && it.title && !it.titleEs && !looksSpanish(it.title));
    if (!targets.length) return;

    await pool(targets, TR_CONCURRENCY, async (it) => {
      const es = await translateToEsCached(it.title);
      if (es) it.titleEs = es;
    });

    renderNewsList({ silent: true });
  }

  async function translateToEsCached(text) {
    const t = cleanText(text);
    if (!t) return "";
    const key = "tr|" + t.toLowerCase().slice(0, 300);
    const cached = readCache(trCache, key);
    if (cached) return cached;
    if (trInFlight.has(key)) return trInFlight.get(key);

    const p = (async () => {
      const u = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=es&dt=t&q=" + encodeURIComponent(t);
      let raw = "";
      try { raw = await tryFetchText(u, 14_000); } catch { return ""; }
      const j = safeJson(raw);
      if (!j || !Array.isArray(j) || !Array.isArray(j[0])) return "";
      const out = j[0].map(x => x && x[0]).filter(Boolean).join("");
      const clean = cleanText(out);
      if (clean) writeCache(trCache, key, clean, TR_CACHE_LIMIT, LS_TR_CACHE);
      return clean;
    })();

    trInFlight.set(key, p);
    const out = await p.catch(() => "");
    trInFlight.delete(key);
    return out || "";
  }

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
    return {
      name: String(f?.name || "Feed").trim(),
      url: String(f?.url || "").trim(),
      enabled: f?.enabled !== false,
    };
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
      try { localStorage.setItem(LS_FEEDS, JSON.stringify(feeds)); } catch {}
      return feeds;
    } catch {
      return DEFAULT_FEEDS.map(f => ({ ...f }));
    }
  }

  function saveFeeds(feeds) {
    try { localStorage.setItem(LS_FEEDS, JSON.stringify(feeds || [])); } catch {}
  }

  function loadTemplate() {
    try {
      const raw = localStorage.getItem(LS_TEMPLATE) || localStorage.getItem(LS_TEMPLATE_V3);
      if (!raw) return DEFAULT_TEMPLATE;
      try { localStorage.setItem(LS_TEMPLATE, raw); } catch {}
      return String(raw || DEFAULT_TEMPLATE);
    } catch {
      return DEFAULT_TEMPLATE;
    }
  }

  function saveTemplate(tpl) {
    try { localStorage.setItem(LS_TEMPLATE, String(tpl || DEFAULT_TEMPLATE)); } catch {}
  }

  function loadSettings() {
    const fallback = {
      liveUrl: "https://twitch.com/globaleyetv",
      hashtags: "",
      includeLive: true,
      includeSource: true,
      delayMin: 10,
      onlyReady: false,
      onlySpanish: true,
      sortBy: "recent",
      autoRefresh: true,
      refreshSec: AUTO_REFRESH_FEEDS_SEC_DEFAULT,
      resolveLinks: true,
      showOriginal: true,
      hideUsed: false,
      catFilter: "all",
      version: VERSION
    };
    const j = loadJsonPreferNew(LS_SETTINGS, LS_SETTINGS_V3, fallback);
    return { ...fallback, ...(j || {}) };
  }

  function saveSetting(k, v) {
    state.settings = state.settings || {};
    state.settings[k] = v;
    try { localStorage.setItem(LS_SETTINGS, JSON.stringify(state.settings)); } catch {}
  }

  function loadUsedSet() {
    try {
      const raw = localStorage.getItem(LS_USED) || localStorage.getItem(LS_USED_V3);
      if (!raw) return new Set();
      const arr = JSON.parse(raw);
      const s = new Set(Array.isArray(arr) ? arr.filter(Boolean) : []);
      try { localStorage.setItem(LS_USED, JSON.stringify(Array.from(s))); } catch {}
      return s;
    } catch {
      return new Set();
    }
  }

  function saveUsedSet(setObj) {
    try { localStorage.setItem(LS_USED, JSON.stringify(Array.from(setObj || []))); } catch {}
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
        try { localStorage.setItem(keyNew, JSON.stringify(j)); } catch {}
        return j;
      }
      return fallback;
    } catch {
      return fallback;
    }
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
    try { localStorage.setItem(lsKey, JSON.stringify(cacheObj)); } catch {}
  }

  function pruneCache(cacheObj, limit) {
    const keys = Object.keys(cacheObj || {});
    if (keys.length <= limit) return;
    keys.sort((a,b) => Number((cacheObj[a]?.t)||0) - Number((cacheObj[b]?.t)||0));
    const kill = keys.length - limit;
    for (let i=0; i<kill; i++) delete cacheObj[keys[i]];
  }

  /* ───────────────────────────── FETCH (CORS FALLBACKS) ───────────────────────────── */
  async function fetchTextWithFallbacks(url, timeoutMs, parentSignal) {
    // direct
    try { return await tryFetchText(url, timeoutMs, parentSignal); } catch {}

    // AllOrigins raw
    try {
      const ao = "https://api.allorigins.win/raw?url=" + encodeURIComponent(url);
      return await tryFetchText(ao, timeoutMs, parentSignal);
    } catch {}

    // r.jina.ai (HTML/JSON proxy)
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
      if (parentSignal) parentSignal.removeEventListener?.("abort", onAbort);
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
    return String(s || "")
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
    try {
      const url = new URL(s, location.href);
      // normaliza trackers comunes
      return url.toString();
    } catch {
      return s;
    }
  }

  function isGoogleNews(u) {
    const s = String(u || "").toLowerCase();
    return s.includes("news.google.") || s.includes("news.google.com");
  }

  function cleanTracking(u) {
    const s = String(u || "").trim();
    if (!s) return "";
    try {
      const url = new URL(s);
      const bad = [
        "utm_source","utm_medium","utm_campaign","utm_term","utm_content",
        "fbclid","gclid","igshid","mc_cid","mc_eid","ref","ref_src","cmpid","mkt_tok",
        "s","spm","ved","usg","opi"
      ];
      bad.forEach(k => url.searchParams.delete(k));
      // limpia query vacía
      if ([...url.searchParams.keys()].length === 0) url.search = "";
      return url.toString();
    } catch {
      return s;
    }
  }

  function looksSpanish(t) {
    const s = String(t || "");
    if (!s) return false;
    // heurística: tildes/ñ/palabras típicas
    const marks = /[áéíóúñ¿¡]/i.test(s);
    const common = /\b(el|la|los|las|de|del|y|en|para|con|por|un|una|hoy|última)\b/i.test(s);
    return marks || common;
  }

  function debounce(fn, ms) {
    let t = 0;
    return (...args) => {
      if (t) clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  async function pool(list, concurrency, worker) {
    const arr = Array.isArray(list) ? list : [];
    const n = Math.max(1, Number(concurrency || 1));
    let i = 0;
    const run = async () => {
      while (i < arr.length) {
        const idx = i++;
        await worker(arr[idx], idx);
      }
    };
    const workers = Array.from({ length: Math.min(n, arr.length) }, () => run());
    await Promise.all(workers);
  }

  function clampNum(v, min, max) {
    const n = Number(v);
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeRe(s) {
    return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function fastHash(str) {
    // FNV-1a 32-bit
    let h = 0x811c9dc5;
    const s = String(str || "");
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + (h<<1) + (h<<4) + (h<<7) + (h<<8) + (h<<24)) >>> 0;
    }
    return h >>> 0;
  }

  function hashId(s) {
    return String(fastHash(String(s || "")));
  }

  async function copyToClipboard(text) {
    const t = String(text || "");
    try {
      await navigator.clipboard.writeText(t);
      return true;
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = t;
      ta.setAttribute("readonly", "true");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch {}
      document.body.removeChild(ta);
      return true;
    }
  }

  function smartTrimHeadline(h, maxLen) {
    const s = cleanText(h);
    if (s.length <= maxLen) return s;
    const cut = s.slice(0, maxLen);
    const lastSpace = cut.lastIndexOf(" ");
    const out = (lastSpace > 30 ? cut.slice(0, lastSpace) : cut).trim();
    return out.replace(/[,:;.-]$/,"") + "…";
  }

  function genHashtags(headline) {
    const s = String(headline || "").toLowerCase();
    if (!s.trim()) return "";

    const stop = new Set([
      "el","la","los","las","de","del","y","en","para","con","por","un","una","unos","unas",
      "a","al","se","su","sus","que","como","más","menos","hoy","ayer","mañana","última","hora",
      "nuevo","nueva","sobre","tras","ante","durante","contra","entre","sin","desde","hasta"
    ]);

    const words = s
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter(w => w.length >= 4 && !stop.has(w));

    // prefer “entities” por mayúsculas en original (simple) + frecuencia
    const freq = new Map();
    for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);

    const sorted = [...freq.entries()].sort((a,b) => b[1]-a[1] || b[0].length-a[0].length);
    const pick = sorted.slice(0, 4).map(([w]) => "#" + toTag(w));
    const base = ["#ÚltimaHora"];
    const all = [...base, ...pick].slice(0, 5);

    // evita duplicados
    return Array.from(new Set(all)).join(" ");
  }

  function toTag(w) {
    return String(w || "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\p{L}\p{N}]/gu, "")
      .replace(/^\d+/, "")
      .slice(0, 24);
  }

  /* ───────────────────────────── X (Twitter) COUNT ───────────────────────────── */
  function twCharCount(text) {
    // aproximación buena: URLs cuentan como 23 (t.co), resto por codepoints
    const s = String(text || "");
    const urlRe = /https?:\/\/[^\s]+/gi;
    let count = 0;
    let last = 0;
    let m;
    while ((m = urlRe.exec(s))) {
      count += countCodepoints(s.slice(last, m.index));
      count += 23;
      last = m.index + m[0].length;
    }
    count += countCodepoints(s.slice(last));
    return count;
  }

  function countCodepoints(s) {
    // cuenta por codepoints (emoji = 1)
    let c = 0;
    for (const _ch of String(s || "")) c++;
    return c;
  }

  function buildThreadFromText(text) {
    const raw = String(text || "").trim();
    if (!raw) return [""];

    if (twCharCount(raw) <= 280) return [raw];

    // Intento: mantener bloques por líneas (más bonito para tu plantilla)
    const lines = raw.split("\n");
    const parts = [];
    let cur = "";

    const pushCur = () => {
      const t = cur.trim();
      if (t) parts.push(t);
      cur = "";
    };

    for (const line of lines) {
      const next = cur ? (cur + "\n" + line) : line;
      if (twCharCount(next) <= 280) {
        cur = next;
      } else {
        // si la línea sola es demasiado larga, partir por palabras
        if (!cur) {
          const chunks = splitByWords(line, 260); // deja margen para (1/N)
          for (const ch of chunks) parts.push(ch.trim());
          cur = "";
        } else {
          pushCur();
          if (twCharCount(line) <= 280) cur = line;
          else {
            const chunks = splitByWords(line, 260);
            for (const ch of chunks) parts.push(ch.trim());
            cur = "";
          }
        }
      }
    }
    pushCur();

    // añade sufijo 1/N dentro del límite (mejor UX para threads)
    const N = parts.length;
    return parts.map((p, i) => {
      const suffix = ` ${i+1}/${N}`;
      if (twCharCount(p + suffix) <= 280) return p + suffix;
      // si no cabe, recorta un poco
      return smartTrimHeadline(p, Math.max(40, 280 - twCharCount(suffix) - 2)) + suffix;
    });
  }

  function splitByWords(line, max) {
    const words = String(line || "").split(/\s+/);
    const out = [];
    let cur = "";
    for (const w of words) {
      const next = cur ? (cur + " " + w) : w;
      if (twCharCount(next) <= max) cur = next;
      else {
        if (cur) out.push(cur);
        cur = w;
      }
    }
    if (cur) out.push(cur);
    return out;
  }

  /* ───────────────────────────── BOOT HARDENING ───────────────────────────── */
  window.addEventListener("error", (e) => {
    try { crashOverlay(e.error || e.message || e); } catch {}
  });

  window.addEventListener("unhandledrejection", (e) => {
    try { crashOverlay(e.reason || e); } catch {}
  });

  try {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
  } catch (err) {
    crashOverlay(err);
  }

})();
