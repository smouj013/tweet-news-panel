/* app.js — News → Tweet Template Panel (tnp-v4.1.0) — NEWSROOM PRO
   ✅ UI estable (sin CSS inyectado)
   ✅ Ticker integrado (#tnpTickerInner / #tnpTrendsPop)
   ✅ Actualizar versión (SW update + SKIP_WAITING)
   ✅ Reset + Vaciar caché (localStorage + caches + unregister SW)
   ✅ Render suave + filtros + plantilla
*/
(() => {
  "use strict";

  const APP_VERSION = "tnp-v4.1.0";

  /* ───────────────────────────── STORAGE ───────────────────────────── */
  const LS_TEMPLATE = "tnp_template_v4";
  const LS_FEEDS = "tnp_feeds_v4";
  const LS_SETTINGS = "tnp_settings_v4";
  const LS_USED = "tnp_used_v4";
  const LS_TR_CACHE = "tnp_tr_cache_v4";
  const LS_RESOLVE_CACHE = "tnp_resolve_cache_v4";
  const LS_IMG_CACHE = "tnp_img_cache_v4";

  /* ───────────────────────────── DEFAULT TEMPLATE (TU PLANTILLA) ───────────────────────────── */
  const DEFAULT_TEMPLATE =
`🚨 ÚLTIMA HORA: {{HEADLINE}}

🔴#ENVIVO >>> {{LIVE_URL}}

Fuente:
{{SOURCE_URL}}`;

  /* ───────────────────────────── DEFAULT FEEDS ───────────────────────────── */
  const gnTop = (q) => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=es&gl=ES&ceid=ES:es`;
  const gnSite = (site, q) => gnTop(`site:${site} ${q}`);

  const DEFAULT_FEEDS = [
    { name: "Google News — España (Top)", url: gnTop("última hora España OR urgente OR breaking"), enabled: true },
    { name: "El País (GN)", url: gnSite("elpais.com", "(última hora OR urgente OR breaking)"), enabled: true },
    { name: "El Mundo (GN)", url: gnSite("elmundo.es", "(última hora OR urgente OR breaking)"), enabled: true },
    { name: "RTVE (GN)", url: gnSite("rtve.es", "(última hora OR urgente OR breaking)"), enabled: true },
    { name: "Europa Press (GN)", url: gnSite("europapress.es", "(última hora OR urgente OR breaking)"), enabled: true },

    { name: "Google News — Mundo (Top)", url: gnTop("breaking world OR crisis OR conflicto OR última hora mundo"), enabled: true },
    { name: "Reuters (GN)", url: gnSite("reuters.com", "(breaking OR exclusive OR urgent)"), enabled: true },

    { name: "OTAN / Ucrania (GN)", url: gnTop("OTAN OR NATO OR Ucrania OR Ukraine OR Rusia OR Russia"), enabled: true },

    { name: "Tech (GN)", url: gnTop("Apple OR Google OR Microsoft OR OpenAI OR AI OR ciberataque OR cybersecurity"), enabled: true }
  ];

  /* ───────────────────────────── STATE ───────────────────────────── */
  const state = {
    feeds: [],
    settings: {},
    template: "",
    used: new Set(),
    items: [],
    selectedId: null,

    refreshInFlight: false,
    refreshAbort: null,

    ticker: {
      timer: 0,
      popTimer: 0,
      popIdx: 0,
      lastSig: ""
    }
  };

  const trCache = loadJson(LS_TR_CACHE, {});
  const resolveCache = loadJson(LS_RESOLVE_CACHE, {});
  const imgCache = loadJson(LS_IMG_CACHE, {});

  let swReg = null;
  let uiTickTimer = 0;
  let autoRefreshTimer = 0;

  /* ───────────────────────────── DOM ───────────────────────────── */
  const el = {};
  const q = (sel) => document.querySelector(sel);
  const must = (sel) => {
    const n = document.querySelector(sel);
    if (!n) throw new Error("Missing element " + sel);
    return n;
  };

  function grabEls(){
    el.topbar = must("#topbar");
    el.ticker = must("#ticker");

    el.timeFilter = must("#timeFilter");
    el.searchBox = must("#searchBox");
    el.btnRefresh = must("#btnRefresh");
    el.btnFeeds = must("#btnFeeds");

    el.btnCheckUpdate = must("#btnCheckUpdate");
    el.btnHardReset = must("#btnHardReset");

    el.status = must("#status");

    // composer
    el.liveUrl = must("#liveUrl");
    el.headline = must("#headline");
    el.sourceUrl = must("#sourceUrl");
    el.hashtags = must("#hashtags");
    el.optIncludeLive = must("#optIncludeLive");
    el.optIncludeSource = must("#optIncludeSource");

    el.template = must("#template");
    el.preview = must("#preview");
    el.warn = must("#warn");
    el.charCount = must("#charCount");

    el.btnTrim = must("#btnTrim");
    el.btnGenTags = must("#btnGenTags");
    el.btnCopyUrl = must("#btnCopyUrl");
    el.btnCopy = must("#btnCopy");
    el.btnX = must("#btnX");
    el.btnResetTemplate = must("#btnResetTemplate");

    // filters
    el.delayMin = must("#delayMin");
    el.optOnlyReady = must("#optOnlyReady");
    el.optOnlySpanish = must("#optOnlySpanish");
    el.sortBy = must("#sortBy");

    el.optAutoRefresh = must("#optAutoRefresh");
    el.refreshSec = must("#refreshSec");
    el.optResolveLinks = must("#optResolveLinks");
    el.optShowOriginal = must("#optShowOriginal");
    el.optHideUsed = must("#optHideUsed");
    el.catFilter = must("#catFilter");
    el.showLimit = must("#showLimit");
    el.fetchCap = must("#fetchCap");
    el.batchFeeds = must("#batchFeeds");

    // news
    el.newsList = must("#newsList");

    // ticker
    el.tickerInner = must("#tnpTickerInner");
    el.trendsPop = must("#tnpTrendsPop");

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
  function init(){
    grabEls();
    syncStickyVars();

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

    el.delayMin.value = String(clampNum(state.settings.delayMin ?? 10, 0, 180));
    el.optOnlyReady.checked = !!state.settings.onlyReady;
    el.optOnlySpanish.checked = state.settings.onlySpanish !== false;
    el.sortBy.value = String(state.settings.sortBy || "recent");

    el.optAutoRefresh.checked = state.settings.autoRefresh !== false;
    el.refreshSec.value = String(clampNum(state.settings.refreshSec ?? 60, 15, 600));
    el.optResolveLinks.checked = state.settings.resolveLinks !== false;
    el.optShowOriginal.checked = !!state.settings.showOriginal;
    el.optHideUsed.checked = !!state.settings.hideUsed;
    el.catFilter.value = String(state.settings.catFilter || "all");

    el.showLimit.value = String(clampNum(state.settings.showLimit ?? 10, 10, 50));
    el.fetchCap.value = String(clampNum(state.settings.fetchCap ?? 240, 80, 2000));
    el.batchFeeds.value = String(clampNum(state.settings.batchFeeds ?? 12, 4, 50));

    bindUI();
    renderFeedsModal();
    updatePreview();

    registerSW();
    startTimers();

    // carga inicial
    refreshAll({ force: true }).catch(() => {});
  }

  /* ───────────────────────────── Sticky vars ───────────────────────────── */
  function syncStickyVars(){
    const topbarH = Math.round(el.topbar.getBoundingClientRect().height || 70);
    const tickerH = Math.round(el.ticker.getBoundingClientRect().height || 46);
    document.documentElement.style.setProperty("--topbarH", `${topbarH}px`);
    document.documentElement.style.setProperty("--tickerH", `${tickerH}px`);
  }

  window.addEventListener("resize", () => {
    syncStickyVars();
  }, { passive: true });

  /* ───────────────────────────── UI ───────────────────────────── */
  function setStatus(msg){
    el.status.textContent = msg;
  }

  function warn(msg){
    el.warn.textContent = msg || "";
  }

  function updatePreview(){
    const tweet = buildTweet();
    el.preview.textContent = tweet;

    const count = countForX(tweet);
    el.charCount.textContent = String(count);

    if (count > 280) warn(`⚠️ ${count}/280 (demasiado largo)`);
    else warn("");
  }

  function bindUI(){
    // basic inputs
    el.template.addEventListener("input", () => {
      state.template = el.template.value;
      saveTemplate(state.template);
      updatePreview();
    });

    [el.liveUrl, el.headline, el.sourceUrl, el.hashtags].forEach((n) => {
      n.addEventListener("input", () => {
        saveSettingsFromUI();
        updatePreview();
      });
    });

    [el.optIncludeLive, el.optIncludeSource].forEach((n) => {
      n.addEventListener("change", () => {
        saveSettingsFromUI();
        updatePreview();
      });
    });

    // filters
    [
      el.timeFilter, el.searchBox, el.delayMin, el.optOnlyReady, el.optOnlySpanish,
      el.sortBy, el.optResolveLinks, el.optShowOriginal, el.optHideUsed, el.catFilter,
      el.showLimit, el.fetchCap, el.batchFeeds
    ].forEach((n) => {
      n.addEventListener("input", () => {
        saveSettingsFromUI();
        renderNews();
      });
      n.addEventListener("change", () => {
        saveSettingsFromUI();
        renderNews();
      });
    });

    el.optAutoRefresh.addEventListener("change", () => {
      saveSettingsFromUI();
      restartAutoRefresh();
    });
    el.refreshSec.addEventListener("change", () => {
      saveSettingsFromUI();
      restartAutoRefresh();
    });

    // buttons
    el.btnRefresh.addEventListener("click", (ev) => {
      const force = !!ev.shiftKey;
      refreshAll({ force }).catch(() => {});
    });

    el.btnFeeds.addEventListener("click", openModal);
    el.btnCloseModal.addEventListener("click", closeModal);
    el.modal.addEventListener("click", (ev) => {
      if (ev.target === el.modal) closeModal();
    });

    el.btnAddFeed.addEventListener("click", () => {
      const name = (el.newFeedName.value || "").trim();
      const url = (el.newFeedUrl.value || "").trim();
      if (!name || !url) return;

      state.feeds.unshift({ name, url, enabled: true });
      el.newFeedName.value = "";
      el.newFeedUrl.value = "";
      saveFeeds(state.feeds);
      renderFeedsModal();
      setStatus("Feed añadido.");
    });

    el.btnExportFeeds.addEventListener("click", () => {
      el.feedsJson.value = JSON.stringify(state.feeds, null, 2);
      setStatus("Export listo (JSON).");
    });

    el.btnImportFeeds.addEventListener("click", () => {
      try{
        const arr = JSON.parse(el.feedsJson.value);
        if (!Array.isArray(arr)) throw new Error("Formato inválido");
        state.feeds = arr.map((f) => ({
          name: String(f.name || "Feed"),
          url: String(f.url || ""),
          enabled: f.enabled !== false
        })).filter((f) => !!f.url);

        saveFeeds(state.feeds);
        renderFeedsModal();
        setStatus("Import OK.");
      }catch(e){
        setStatus("Error importando JSON.");
      }
    });

    el.btnRestoreDefaultFeeds.addEventListener("click", () => {
      state.feeds = DEFAULT_FEEDS.map((f) => ({ ...f }));
      saveFeeds(state.feeds);
      renderFeedsModal();
      setStatus("Defaults restaurados.");
    });

    el.btnSaveFeeds.addEventListener("click", () => {
      saveFeeds(state.feeds);
      closeModal();
      setStatus("Feeds guardados.");
    });

    el.btnTrim.addEventListener("click", () => {
      el.headline.value = smartTrim(el.headline.value, 130);
      saveSettingsFromUI();
      updatePreview();
    });

    el.btnGenTags.addEventListener("click", () => {
      const tags = suggestHashtags(el.headline.value);
      el.hashtags.value = tags;
      saveSettingsFromUI();
      updatePreview();
    });

    el.btnCopyUrl.addEventListener("click", async () => {
      const u = (el.sourceUrl.value || "").trim();
      if (!u) return;
      await copyText(u);
      setStatus("URL copiada.");
    });

    el.btnCopy.addEventListener("click", async () => {
      const t = buildTweet();
      await copyText(t);
      setStatus("Tweet copiado.");
      markSelectedUsed();
    });

    el.btnX.addEventListener("click", () => {
      const t = buildTweet();
      const url = "https://x.com/intent/tweet?text=" + encodeURIComponent(t);
      window.open(url, "_blank", "noopener,noreferrer");
      markSelectedUsed();
    });

    el.btnResetTemplate.addEventListener("click", () => {
      el.template.value = DEFAULT_TEMPLATE;
      state.template = DEFAULT_TEMPLATE;
      saveTemplate(DEFAULT_TEMPLATE);
      updatePreview();
      setStatus("Plantilla reseteada.");
    });

    // update + reset
    el.btnCheckUpdate.addEventListener("click", async () => {
      await forceUpdateNow();
    });

    el.btnHardReset.addEventListener("click", async () => {
      await hardResetEverything();
    });
  }

  function saveSettingsFromUI(){
    state.settings = {
      liveUrl: el.liveUrl.value,
      hashtags: el.hashtags.value,
      includeLive: el.optIncludeLive.checked,
      includeSource: el.optIncludeSource.checked,

      delayMin: clampNum(parseInt(el.delayMin.value || "10", 10), 0, 180),
      onlyReady: !!el.optOnlyReady.checked,
      onlySpanish: el.optOnlySpanish.checked,
      sortBy: el.sortBy.value || "recent",

      autoRefresh: el.optAutoRefresh.checked,
      refreshSec: clampNum(parseInt(el.refreshSec.value || "60", 10), 15, 600),
      resolveLinks: el.optResolveLinks.checked,
      showOriginal: el.optShowOriginal.checked,
      hideUsed: el.optHideUsed.checked,
      catFilter: el.catFilter.value || "all",

      showLimit: clampNum(parseInt(el.showLimit.value || "10", 10), 10, 50),
      fetchCap: clampNum(parseInt(el.fetchCap.value || "240", 10), 80, 2000),
      batchFeeds: clampNum(parseInt(el.batchFeeds.value || "12", 10), 4, 50)
    };
    saveSettings(state.settings);
  }

  /* ───────────────────────────── Modal ───────────────────────────── */
  function openModal(){
    el.modal.classList.remove("hidden");
    el.modal.setAttribute("aria-hidden", "false");
  }
  function closeModal(){
    el.modal.classList.add("hidden");
    el.modal.setAttribute("aria-hidden", "true");
  }

  function renderFeedsModal(){
    el.feedList.innerHTML = "";
    const frag = document.createDocumentFragment();

    state.feeds.forEach((f, idx) => {
      const row = document.createElement("div");
      row.className = "feedRow";

      const tog = document.createElement("input");
      tog.type = "checkbox";
      tog.checked = f.enabled !== false;
      tog.addEventListener("change", () => {
        f.enabled = tog.checked;
        saveFeeds(state.feeds);
      });

      const name = document.createElement("div");
      name.className = "name";
      name.textContent = f.name || "Feed";

      const url = document.createElement("div");
      url.className = "url";
      url.title = f.url || "";
      url.textContent = f.url || "";

      const del = document.createElement("button");
      del.className = "btn btn--sm";
      del.type = "button";
      del.textContent = "Eliminar";
      del.addEventListener("click", () => {
        state.feeds.splice(idx, 1);
        saveFeeds(state.feeds);
        renderFeedsModal();
      });

      row.appendChild(tog);
      row.appendChild(name);
      row.appendChild(url);
      row.appendChild(del);
      frag.appendChild(row);
    });

    el.feedList.appendChild(frag);
  }

  /* ───────────────────────────── News: refresh ───────────────────────────── */
  async function refreshAll({ force = false } = {}){
    if (state.refreshInFlight) return;

    const feeds = state.feeds.filter((f) => f.enabled !== false);
    if (!feeds.length){
      setStatus("No hay feeds activados.");
      return;
    }

    setStatus(force ? "Refrescando (force)…" : "Refrescando…");
    state.refreshInFlight = true;

    const cap = state.settings.fetchCap ?? 240;
    const batch = state.settings.batchFeeds ?? 12;

    const allItems = [];
    const now = Date.now();

    // batches
    for (let i = 0; i < feeds.length; i += batch){
      const slice = feeds.slice(i, i + batch);

      const results = await Promise.allSettled(slice.map(async (f) => {
        const txt = await fetchFeedText(f.url);
        const items = parseFeed(txt, f.url, f.name);
        return items;
      }));

      for (const r of results){
        if (r.status === "fulfilled") allItems.push(...r.value);
      }

      // pequeña pausa para no bloquear UI
      await sleep(40);
    }

    // dedup + cap
    const map = new Map();
    for (const it of allItems){
      if (!it.link || !it.title) continue;
      map.set(it.id, it);
      if (map.size >= cap) break;
    }

    state.items = Array.from(map.values())
      .sort((a,b) => (b.dateMs - a.dateMs));

    // auto-resolve (best-effort) para lo más reciente
    const doResolve = state.settings.resolveLinks !== false;
    const topN = Math.min(30, state.items.length);

    if (doResolve){
      setStatus("Resolviendo links/imágenes…");
      for (let i = 0; i < topN; i++){
        const it = state.items[i];
        await hydrateItem(it).catch(() => {});
        // no te bloquea
        if (i % 6 === 0) await sleep(20);
      }
    }

    setStatus(`OK · ${state.items.length} items · ${minsAgo(now)} min tick`);
    state.refreshInFlight = false;

    renderNews();
    updateTicker();
  }

  async function hydrateItem(it){
    // resolve link
    const resolved = await resolveRealUrl(it.link);
    if (resolved) it.resolvedUrl = resolved;

    // translate title if needed
    if (state.settings.onlySpanish !== false){
      const baseTitle = it.title;
      if (!isProbablySpanish(baseTitle)){
        it.titleEs = await translateToEs(baseTitle);
      } else {
        it.titleEs = baseTitle;
      }
    } else {
      it.titleEs = it.title;
    }

    // og image (de resolved si existe)
    const img = await fetchOgImage(it.resolvedUrl || it.link);
    if (img) it.ogImage = img;

    it.ready = !!(it.resolvedUrl || it.link);
    return it;
  }

  /* ───────────────────────────── Render news ───────────────────────────── */
  function renderNews(){
    const items = filterItems(state.items);

    el.newsList.innerHTML = "";
    const frag = document.createDocumentFragment();

    for (const it of items){
      frag.appendChild(renderNewsItem(it));
    }
    el.newsList.appendChild(frag);

    updateTicker();
  }

  function renderNewsItem(it){
    const row = document.createElement("div");
    row.className = "newsItem" + (it.id === state.selectedId ? " sel" : "");
    row.tabIndex = 0;

    row.addEventListener("click", () => selectItem(it));
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") selectItem(it);
    });

    const thumb = document.createElement("div");
    thumb.className = "thumb";
    if (it.ogImage){
      const img = document.createElement("img");
      img.loading = "lazy";
      img.decoding = "async";
      img.referrerPolicy = "no-referrer";
      img.src = it.ogImage;
      thumb.innerHTML = "";
      thumb.appendChild(img);
    } else {
      thumb.textContent = "IMG";
    }

    const main = document.createElement("div");
    main.className = "newsMain";

    const top = document.createElement("div");
    top.className = "newsTop";

    const meta = document.createElement("div");
    meta.className = "newsMeta";

    const age = document.createElement("span");
    age.className = "badge";
    age.textContent = formatAge(it.dateMs);

    const dom = document.createElement("span");
    dom.className = "badge";
    dom.textContent = it.domain || hostOf(it.resolvedUrl || it.link) || "source";

    meta.appendChild(age);
    meta.appendChild(dom);

    if (it.ready) {
      const ok = document.createElement("span");
      ok.className = "badge ok";
      ok.textContent = "LISTO";
      meta.appendChild(ok);
    }

    if (scoreImpact(it) >= 6){
      const topb = document.createElement("span");
      topb.className = "badge top";
      topb.textContent = "TOP";
      meta.appendChild(topb);
    }

    const right = document.createElement("div");
    right.className = "mini muted";
    right.textContent = it.feedName || "";

    top.appendChild(meta);
    top.appendChild(right);

    const title = document.createElement("div");
    title.className = "newsTitle";
    title.textContent = (it.titleEs || it.title || "").trim();

    const link = document.createElement("div");
    link.className = "newsLink";
    link.textContent = it.resolvedUrl || it.link;

    main.appendChild(top);
    main.appendChild(title);
    main.appendChild(link);

    row.appendChild(thumb);
    row.appendChild(main);
    return row;
  }

  function selectItem(it){
    state.selectedId = it.id;

    const headline = (it.titleEs || it.title || "").trim();
    const url = (it.resolvedUrl || it.link || "").trim();

    el.headline.value = headline;
    el.sourceUrl.value = url;

    saveSettingsFromUI();
    updatePreview();
    renderNews();

    // precarga suave si faltaba
    hydrateItem(it).then(() => {
      renderNews();
      updatePreview();
    }).catch(() => {});
  }

  function markSelectedUsed(){
    if (!state.selectedId) return;
    state.used.add(state.selectedId);
    saveUsedSet(state.used);
    if (state.settings.hideUsed) renderNews();
  }

  /* ───────────────────────────── Filtering ───────────────────────────── */
  function filterItems(items){
    const tf = el.timeFilter.value || "all";
    const qtxt = (el.searchBox.value || "").trim().toLowerCase();
    const minAge = clampNum(parseInt(el.delayMin.value || "10", 10), 0, 180) * 60 * 1000;
    const onlyReady = !!el.optOnlyReady.checked;
    const hideUsed = !!el.optHideUsed.checked;
    const cat = (el.catFilter.value || "all");

    const now = Date.now();
    let maxAgeMs = Infinity;
    if (tf === "10m") maxAgeMs = 10 * 60 * 1000;
    else if (tf === "30m") maxAgeMs = 30 * 60 * 1000;
    else if (tf === "1h") maxAgeMs = 60 * 60 * 1000;
    else if (tf === "2h") maxAgeMs = 2 * 60 * 60 * 1000;
    else if (tf === "24h") maxAgeMs = 24 * 60 * 60 * 1000;

    let out = items.filter((it) => {
      const age = now - it.dateMs;
      if (age < 0) return false;
      if (age > maxAgeMs) return false;
      if (age < minAge) return false;

      if (onlyReady && !it.ready) return false;
      if (hideUsed && state.used.has(it.id)) return false;

      if (cat !== "all" && it.category && it.category !== cat) return false;

      if (qtxt){
        const hay = `${it.title} ${it.titleEs || ""} ${it.domain || ""} ${it.feedName || ""}`.toLowerCase();
        if (!hay.includes(qtxt)) return false;
      }
      return true;
    });

    // sort
    const sortBy = el.sortBy.value || "recent";
    if (sortBy === "impact"){
      out.sort((a,b) => scoreImpact(b) - scoreImpact(a) || (b.dateMs - a.dateMs));
    } else {
      out.sort((a,b) => (b.dateMs - a.dateMs));
    }

    // limit
    const lim = clampNum(parseInt(el.showLimit.value || "10", 10), 10, 50);
    out = out.slice(0, lim);
    return out;
  }

  function scoreImpact(it){
    const t = (it.titleEs || it.title || "").toLowerCase();
    let s = 0;
    if (/(última hora|urgente|breaking|alerta)/.test(t)) s += 4;
    if (/(explosión|ataque|muertos|guerra|otan|ucrania|rusia)/.test(t)) s += 3;
    if (/(pedro sánchez|gobierno|congreso|elecciones)/.test(t)) s += 2;
    if (it.domain && /(reuters\.com|elpais\.com|elmundo\.es|rtve\.es)/.test(it.domain)) s += 2;
    return s;
  }

  /* ───────────────────────────── Ticker ───────────────────────────── */
  function updateTicker(){
    const visible = filterItems(state.items).slice(0, 10);
    const sig = visible.map(x => x.id).join("|");
    if (!visible.length){
      el.tickerInner.textContent = "Sin noticias aún…";
      return;
    }
    if (sig === state.ticker.lastSig) return;

    state.ticker.lastSig = sig;

    const text = visible.map((it) => {
      const ttl = (it.titleEs || it.title || "").trim();
      const dom = it.domain || hostOf(it.resolvedUrl || it.link) || "source";
      return `• ${ttl} — ${dom}`;
    }).join("   ");

    el.tickerInner.textContent = text;

    // pop trends (hashtags sugeridos)
    const tags = collectTagsFromItems(visible);
    state.ticker.tags = tags;
    state.ticker.popIdx = 0;
  }

  function startTickerPop(){
    if (state.ticker.popTimer) clearInterval(state.ticker.popTimer);
    state.ticker.popTimer = setInterval(() => {
      const tags = state.ticker.tags || [];
      if (!tags.length){
        el.trendsPop.classList.remove("on");
        return;
      }
      const tag = tags[state.ticker.popIdx++ % tags.length];
      el.trendsPop.textContent = tag;
      el.trendsPop.classList.add("on");
      setTimeout(() => el.trendsPop.classList.remove("on"), 2200);
    }, 4200);
  }

  function collectTagsFromItems(items){
    const out = [];
    const seen = new Set();
    for (const it of items){
      const t = (it.titleEs || it.title || "");
      const maybe = suggestHashtags(t).split(/\s+/).filter(Boolean);
      for (const tag of maybe){
        if (!seen.has(tag) && out.length < 10){
          seen.add(tag);
          out.push(tag);
        }
      }
    }
    // siempre mete #ENVIVO si no está
    if (!seen.has("#ENVIVO")) out.unshift("#ENVIVO");
    return out.slice(0, 10);
  }

  /* ───────────────────────────── Tweet build ───────────────────────────── */
  function buildTweet(){
    const tpl = (el.template.value || DEFAULT_TEMPLATE);

    const headline = (el.headline.value || "").trim();
    const live = (el.liveUrl.value || "").trim();
    const src = (el.sourceUrl.value || "").trim();
    const hashtags = (el.hashtags.value || "").trim();

    let out = tpl;

    // si el usuario no pone “🚨 ÚLTIMA HORA:” lo respetamos, pero tú ya lo pones en plantilla por defecto
    out = out.replaceAll("{{HEADLINE}}", headline || "…");
    out = out.replaceAll("{{LIVE_URL}}", live || "https://twitch.com/globaleyetv");
    out = out.replaceAll("{{SOURCE_URL}}", src || "https://");

    // control de secciones
    if (!el.optIncludeLive.checked){
      out = out.replace(/\n\n🔴#ENVIVO[^\n]*\n\n?/g, "\n\n");
      out = out.replace(/\n🔴#ENVIVO[^\n]*\n?/g, "\n");
    }
    if (!el.optIncludeSource.checked){
      out = out.replace(/\n\nFuente:\n[^\n]*\n?/g, "\n\n");
      out = out.replace(/\nFuente:\n[^\n]*\n?/g, "\n");
    }

    // hashtags al final si hay y no están ya
    if (hashtags){
      if (!out.includes(hashtags)){
        out = out.trimEnd() + "\n\n" + hashtags;
      }
    }

    return out.trim().replace(/\n{3,}/g, "\n\n");
  }

  // Cuenta “simple” para X (sin acortar automático de URLs)
  function countForX(text){
    return String(text || "").length;
  }

  /* ───────────────────────────── Translation ───────────────────────────── */
  function isProbablySpanish(s){
    const t = (s || "").toLowerCase();
    if (/[áéíóúñ¿¡]/.test(t)) return true;
    const hits = [" el ", " la ", " los ", " las ", " de ", " del ", " y ", " en ", " que ", " por ", " para "];
    let c = 0;
    for (const w of hits) if (t.includes(w)) c++;
    return c >= 2;
  }

  async function translateToEs(text){
    const key = (text || "").trim();
    if (!key) return key;
    if (trCache[key]) return trCache[key];

    // endpoint simple (client=gtx)
    const url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=es&dt=t&q=" + encodeURIComponent(key);
    try{
      const res = await fetch(url);
      const data = await res.json();
      const out = (data?.[0] || []).map(x => x?.[0]).filter(Boolean).join("");
      if (out){
        trCache[key] = out;
        saveJson(LS_TR_CACHE, trCache);
        return out;
      }
    }catch{}
    return key;
  }

  /* ───────────────────────────── Link resolve (GN + tracking) ───────────────────────────── */
  function hostOf(u){
    try{ return new URL(u).hostname.replace(/^www\./,""); }catch{ return ""; }
  }

  async function resolveRealUrl(url){
    if (!url) return "";
    if (resolveCache[url]) return resolveCache[url];

    let out = url;

    // decode url= param
    try{
      const U = new URL(url);
      const p = U.searchParams.get("url") || U.searchParams.get("u");
      if (p && /^https?:\/\//i.test(p)) out = p;
      if (p && /^https?:%2f%2f/i.test(p)) out = decodeURIComponent(p);
    }catch{}

    // Google News RSS articles
    if (hostOf(out) === "news.google.com"){
      const resolved = await resolveFromJina(out);
      if (resolved) out = resolved;
    }

    out = stripTrackers(out);

    resolveCache[url] = out;
    saveJson(LS_RESOLVE_CACHE, resolveCache);
    return out;
  }

  function stripTrackers(u){
    try{
      const U = new URL(u);
      const kill = ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","fbclid","gclid","ocid","cmpid"];
      kill.forEach(k => U.searchParams.delete(k));
      return U.toString();
    }catch{
      return u;
    }
  }

  async function resolveFromJina(gnUrl){
    // r.jina.ai te devuelve el HTML como texto sin CORS
    const proxy = "https://r.jina.ai/" + gnUrl;
    try{
      const txt = await (await fetch(proxy)).text();

      // busca url=https%3A%2F%2F...
      const m1 = txt.match(/url=(https%3A%2F%2F[^\s"'<>]+)/i);
      if (m1?.[1]) return decodeURIComponent(m1[1]);

      // busca primer https:// fuera de news.google.com
      const candidates = txt.match(/https?:\/\/[^\s"'<>]+/g) || [];
      for (const c of candidates){
        const h = hostOf(c);
        if (!h) continue;
        if (h === "news.google.com") continue;
        if (h.includes("googleusercontent.com")) continue;
        if (h.includes("gstatic.com")) continue;
        return c;
      }
    }catch{}
    return "";
  }

  /* ───────────────────────────── OG image ───────────────────────────── */
  async function fetchOgImage(url){
    if (!url) return "";
    if (imgCache[url]) return imgCache[url];

    const proxy = "https://r.jina.ai/" + url;
    try{
      const txt = await (await fetch(proxy)).text();
      const og = extractMeta(txt, "property", "og:image") || extractMeta(txt, "name", "og:image");
      if (og){
        const clean = absolutize(url, og);
        imgCache[url] = clean;
        saveJson(LS_IMG_CACHE, imgCache);
        return clean;
      }
    }catch{}
    return "";
  }

  function extractMeta(html, attr, value){
    const re = new RegExp(`<meta[^>]+${attr}\\s*=\\s*["']${value}["'][^>]+content\\s*=\\s*["']([^"']+)["']`, "i");
    const m = html.match(re);
    return m?.[1] || "";
  }

  function absolutize(base, u){
    try{
      return new URL(u, base).toString();
    }catch{
      return u;
    }
  }

  /* ───────────────────────────── Feed fetch + parse ───────────────────────────── */
  async function fetchFeedText(url){
    // Intenta directo, si falla -> allorigins
    try{
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) return await res.text();
    }catch{}

    const ao = "https://api.allorigins.win/raw?url=" + encodeURIComponent(url);
    const res2 = await fetch(ao, { cache: "no-store" });
    if (res2.ok) return await res2.text();
    throw new Error("Feed fetch failed");
  }

  function parseFeed(text, feedUrl, feedName){
    const t = (text || "").trim();
    if (!t) return [];

    // JSON feed
    if (t.startsWith("{") || t.startsWith("[")){
      try{
        const j = JSON.parse(t);
        const items = (j.items || j.articles || j.results || j) || [];
        return (Array.isArray(items) ? items : []).map((x) => normalizeItem({
          title: x.title || x.name,
          link: x.url || x.link,
          date: x.date_published || x.publishedAt || x.pubDate || x.time || x.published,
          feedName,
          feedUrl
        })).filter(Boolean);
      }catch{
        return [];
      }
    }

    // XML
    let doc;
    try{
      doc = new DOMParser().parseFromString(t, "text/xml");
    }catch{
      return [];
    }

    const isRss = doc.querySelector("rss, channel, item");
    const isAtom = doc.querySelector("feed, entry");

    const out = [];

    if (isRss){
      const items = Array.from(doc.querySelectorAll("item"));
      for (const n of items){
        const title = textOf(n, "title");
        let link = textOf(n, "link") || textOf(n, "guid");
        const pub = textOf(n, "pubDate") || textOf(n, "date") || textOf(n, "dc\\:date");
        out.push(normalizeItem({ title, link, date: pub, feedName, feedUrl }));
      }
    } else if (isAtom){
      const items = Array.from(doc.querySelectorAll("entry"));
      for (const n of items){
        const title = textOf(n, "title");
        let link = "";
        const ln = n.querySelector("link[rel='alternate']") || n.querySelector("link");
        if (ln) link = ln.getAttribute("href") || "";
        const pub = textOf(n, "updated") || textOf(n, "published");
        out.push(normalizeItem({ title, link, date: pub, feedName, feedUrl }));
      }
    }

    return out.filter(Boolean);
  }

  function normalizeItem({ title, link, date, feedName, feedUrl }){
    title = String(title || "").trim();
    link = String(link || "").trim();
    if (!title || !link) return null;

    const dateMs = parseDate(date) || Date.now();
    const id = hash(`${title}|${link}|${dateMs}`);

    return {
      id,
      title,
      link,
      dateMs,
      feedName: feedName || "",
      domain: hostOf(link),
      category: guessCategory(title, feedUrl),
      ready: false,
      resolvedUrl: "",
      ogImage: "",
      titleEs: ""
    };
  }

  function guessCategory(title, feedUrl){
    const t = (title || "").toLowerCase();
    const u = (feedUrl || "").toLowerCase();

    if (/(otan|nato|ucrania|ukraine|rusia|russia|guerra|war)/.test(t) || /(otan|ucrania)/.test(u)) return "war";
    if (/(bolsa|ibex|economía|inflación|eur|dólar|deuda)/.test(t)) return "economy";
    if (/(openai|ia|ai|google|microsoft|apple|ciber)/.test(t)) return "tech";
    if (/(asesin|tiroteo|polic|crimen|robo)/.test(t)) return "crime";
    if (/(salud|hospital|virus|covid)/.test(t)) return "health";
    if (/(fútbol|liga|nba|tenis|sport)/.test(t)) return "sports";
    if (/(cine|serie|netflix|música|famos)/.test(t)) return "ent";
    if (/(gobierno|congreso|elecciones|partido|pedro sánchez|pp|psoe)/.test(t)) return "politics";
    return "all";
  }

  function textOf(node, tag){
    const n = node.querySelector(tag);
    return n ? (n.textContent || "").trim() : "";
  }

  function parseDate(s){
    if (!s) return 0;
    const ms = Date.parse(s);
    return Number.isFinite(ms) ? ms : 0;
  }

  /* ───────────────────────────── Auto refresh + UI tick ───────────────────────────── */
  function startTimers(){
    if (uiTickTimer) clearInterval(uiTickTimer);
    uiTickTimer = setInterval(() => {
      // solo mantiene preview/contador
      updatePreview();
    }, 15000);

    restartAutoRefresh();
    startTickerPop();
  }

  function restartAutoRefresh(){
    if (autoRefreshTimer) clearInterval(autoRefreshTimer);
    if (!el.optAutoRefresh.checked) return;

    const sec = clampNum(parseInt(el.refreshSec.value || "60", 10), 15, 600);
    autoRefreshTimer = setInterval(() => {
      refreshAll({ force: false }).catch(() => {});
    }, sec * 1000);
  }

  /* ───────────────────────────── Service Worker update/reset ───────────────────────────── */
  async function registerSW(){
    if (!("serviceWorker" in navigator)) return;
    try{
      swReg = await navigator.serviceWorker.register("./sw.js");
      setStatus(`Listo · ${APP_VERSION}`);
      // intenta update suave
      swReg.update().catch(() => {});
    }catch{
      setStatus(`Listo · ${APP_VERSION} (sin SW)`);
    }
  }

  async function forceUpdateNow(){
    if (!swReg){
      setStatus("SW no disponible.");
      return;
    }
    setStatus("Buscando actualización…");
    await swReg.update();

    const waiting = swReg.waiting;
    if (waiting){
      setStatus("Actualización encontrada. Aplicando…");
      waiting.postMessage({ type: "SKIP_WAITING" });
      // recarga cuando controle
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        location.reload();
      }, { once: true });
      return;
    }
    setStatus("No hay update (ya estás al día).");
  }

  async function hardResetEverything(){
    setStatus("Reseteando + vaciando caché…");

    // 1) LocalStorage (solo claves tnp_)
    try{
      const keys = [];
      for (let i=0;i<localStorage.length;i++){
        const k = localStorage.key(i);
        if (k && k.startsWith("tnp_")) keys.push(k);
      }
      keys.forEach(k => localStorage.removeItem(k));
    }catch{}

    // 2) Caches
    try{
      if ("caches" in window){
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    }catch{}

    // 3) SW purge + unregister
    try{
      if (swReg?.active) swReg.active.postMessage({ type: "PURGE_CACHES" });
    }catch{}
    try{
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }catch{}

    // 4) recarga limpia
    const bust = `?r=${Date.now()}`;
    location.replace("./" + bust);
  }

  /* ───────────────────────────── Helpers ───────────────────────────── */
  function clampNum(n, a, b){
    n = Number(n);
    if (!Number.isFinite(n)) n = a;
    return Math.max(a, Math.min(b, n));
  }

  function saveTemplate(t){ try{ localStorage.setItem(LS_TEMPLATE, String(t||"")); }catch{} }
  function loadTemplate(){ try{ return localStorage.getItem(LS_TEMPLATE) || ""; }catch{ return ""; } }

  function saveFeeds(arr){ saveJson(LS_FEEDS, arr); }
  function loadFeeds(){
    const v = loadJson(LS_FEEDS, null);
    if (Array.isArray(v) && v.length) return v;
    return DEFAULT_FEEDS.map(x => ({ ...x }));
  }

  function saveSettings(obj){ saveJson(LS_SETTINGS, obj); }
  function loadSettings(){ return loadJson(LS_SETTINGS, {}) || {}; }

  function saveUsedSet(set){
    try{ localStorage.setItem(LS_USED, JSON.stringify(Array.from(set))); }catch{}
  }
  function loadUsedSet(){
    try{
      const raw = localStorage.getItem(LS_USED);
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    }catch{
      return new Set();
    }
  }

  function saveJson(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch{} }
  function loadJson(k, def){
    try{
      const raw = localStorage.getItem(k);
      if (!raw) return def;
      return JSON.parse(raw);
    }catch{
      return def;
    }
  }

  function hash(s){
    // FNV-1a simple
    let h = 2166136261;
    for (let i=0;i<s.length;i++){
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return "h" + (h >>> 0).toString(16);
  }

  function smartTrim(s, maxLen){
    s = String(s || "").trim();
    if (s.length <= maxLen) return s;
    return s.slice(0, maxLen - 1).trimEnd() + "…";
  }

  function suggestHashtags(text){
    const t = (text || "").toLowerCase();
    const tags = [];
    const add = (x) => { if (!tags.includes(x)) tags.push(x); };

    add("#ENVIVO");
    if (/(otan|nato)/.test(t)) add("#OTAN");
    if (/(ucrania|ukraine)/.test(t)) add("#Ucrania");
    if (/(rusia|russia)/.test(t)) add("#Rusia");
    if (/(guerra|war)/.test(t)) add("#Guerra");
    if (/(economía|ibex|bolsa|inflación)/.test(t)) add("#Economía");
    if (/(openai|ia|ai|ciber)/.test(t)) add("#Tecnología");
    if (/(pedro sánchez|gobierno|congreso|elecciones)/.test(t)) add("#España");

    return tags.slice(0, 6).join(" ");
  }

  function formatAge(ms){
    const m = Math.max(0, Math.floor((Date.now() - ms) / 60000));
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    return `${h}h`;
  }
  function minsAgo(ms){ return Math.floor((Date.now() - ms) / 60000); }

  async function copyText(text){
    try{
      await navigator.clipboard.writeText(text);
      return true;
    }catch{
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      return true;
    }
  }

  function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

  /* ───────────────────────────── Boot ───────────────────────────── */
  document.addEventListener("DOMContentLoaded", () => {
    try{ init(); }
    catch(e){
      console.error(e);
      alert("Error inicializando la app. Revisa consola.");
    }
  });
})();
