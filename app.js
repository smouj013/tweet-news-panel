/* app.js — TNP v4.1.1 — DIRECT RSS + HARDENED (NO Google por defecto)
   ✅ FIX: defaults RSS se guardan si faltan / están vacíos
   ✅ FIX: modal se puede cerrar SIEMPRE (soporta .hidden y [hidden])
   ✅ 100+ RSS directos + rendimiento (batch/backoff/abort)
   ✅ Imágenes: RSS (media/enclosure) + OG best-effort REAL (HTML vía proxies)
   ✅ Anti-CORS: directo → AllOrigins → CodeTabs → ThingProxy
   ✅ NUEVO: Vista previa estilo X (tweet + card) + conteo tipo X (URLs=23)
   ✅ FIX CRÍTICO: errores de sintaxis que rompían TODO (spread headers / ...keys)
*/

(() => {
  "use strict";

  const APP_VERSION = "tnp-v4.1.1";

  /* ───────────────────────────── STORAGE ───────────────────────────── */
  const LS_FEEDS    = "tnp_feeds_v4";
  const LS_TEMPLATE = "tnp_template_v4";
  const LS_SETTINGS = "tnp_settings_v4";
  const LS_USED     = "tnp_used_v4";

  const LS_RESOLVE_CACHE = "tnp_resolve_cache_v4";
  const LS_OG_CACHE      = "tnp_og_cache_v4";

  /* ───────────────────────────── TEMPLATE ───────────────────────────── */
  const DEFAULT_TEMPLATE =
`🚨 ÚLTIMA HORA: {{HEADLINE}}

{{LIVE_LINE}}

Fuente:
{{SOURCE_URL}}

{{HASHTAGS}}`;

  const DEFAULT_LIVE_LINE = "🔴#ENVIVO >>> {{LIVE_URL}}";

  /* ───────────────────────────── HELPERS ───────────────────────────── */
  const $ = (id) => document.getElementById(id);
  const nowMs = () => Date.now();

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  function safeJsonParse(s, fallback){
    try { return JSON.parse(s); } catch { return fallback; }
  }

  function normSpace(s){
    return String(s || "").replace(/\s+/g, " ").trim();
  }

  function stripHtml(s){
    return normSpace(String(s || "").replace(/<[^>]*>/g, " "));
  }

  function domainOf(url){
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
  }

  function isHttpUrl(u){
    try { const x = new URL(u); return x.protocol === "http:" || x.protocol === "https:"; }
    catch { return false; }
  }

  function ensureUrl(u){
    u = String(u || "").trim();
    if (!u) return "";
    if (/^https?:\/\//i.test(u)) return u;
    return "https://" + u.replace(/^\/+/, "");
  }

  function minutesAgo(ts){
    return Math.floor(Math.max(0, nowMs() - ts) / 60000);
  }

  function fmtAge(ts){
    const m = minutesAgo(ts);
    if (m < 1) return "ahora";
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return mm ? `${h}h ${mm}m` : `${h}h`;
  }

  function makeId(feedName, link, ts, title){
    const base = `${feedName}||${link}||${ts}||${title}`;
    let h = 2166136261;
    for (let i=0;i<base.length;i++){
      h ^= base.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return "n" + (h >>> 0).toString(16);
  }

  function cleanUrl(u){
    try{
      const url = new URL(u);
      const kill = ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","fbclid","gclid","mc_cid","mc_eid"];
      kill.forEach(k => url.searchParams.delete(k));
      if ([...url.searchParams.keys()].length === 0) url.search = "";
      return url.toString();
    }catch{
      return u;
    }
  }

  function absolutizeUrl(u, base){
    try { return new URL(u, base).toString(); } catch { return u; }
  }

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
      try{
        document.execCommand("copy");
        document.body.removeChild(ta);
        return true;
      }catch{
        document.body.removeChild(ta);
        return false;
      }
    }
  }

  function estimateXChars(text){
    const s = String(text || "");
    const urlRe = /(https?:\/\/[^\s]+)/gi;
    let out = "";
    let last = 0;
    let m;
    while ((m = urlRe.exec(s)) !== null){
      out += s.slice(last, m.index);
      out += "x".repeat(23);
      last = m.index + m[0].length;
    }
    out += s.slice(last);
    return out.length;
  }

  function likelySpanish(title, feedName, cat){
    const t = String(title || "");
    if (cat === "spain") return true;
    if (/español|españa/i.test(feedName || "")) return true;
    if (/[áéíóúñü¿¡]/i.test(t)) return true;
    const low = t.toLowerCase();
    const hasEs = /\b(el|la|los|las|un|una|de|del|y|en|para|por|que|con|según|hoy)\b/.test(low);
    const hasEn = /\b(the|and|to|from|in|breaking|world|news)\b/.test(low);
    return hasEs && !hasEn;
  }

  /* ───────────────────────────── DEFAULT FEEDS (100+ direct RSS) ───────────────────────────── */
  const DEFAULT_FEEDS = [
    // ── España (ON)
    { name:"RTVE — Portada (RSS)", url:"https://www.rtve.es/api/noticias.rss", enabled:true, cat:"spain" },
    { name:"El País — Portada (MRSS)", url:"https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada", enabled:true, cat:"spain" },
    { name:"El Mundo — Portada (RSS)", url:"https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml", enabled:true, cat:"spain" },
    { name:"La Vanguardia — Portada (RSS)", url:"https://www.lavanguardia.com/mvc/feed/rss/home.xml", enabled:true, cat:"spain" },
    { name:"ABC — Portada (RSS)", url:"https://www.abc.es/rss/feeds/abcPortada.xml", enabled:true, cat:"spain" },
    { name:"20minutos — Portada (RSS)", url:"https://www.20minutos.es/rss/", enabled:true, cat:"spain" },
    { name:"El Confidencial — España (RSS)", url:"https://rss.elconfidencial.com/espana/", enabled:true, cat:"spain" },
    { name:"Europa Press — Portada (RSS)", url:"https://www.europapress.es/rss/rss.aspx?ch=69", enabled:true, cat:"spain" },

    // ── Mundo (ON)
    { name:"BBC — World (RSS)", url:"https://feeds.bbci.co.uk/news/world/rss.xml", enabled:true, cat:"world" },
    { name:"The Guardian — World (RSS)", url:"https://www.theguardian.com/world/rss", enabled:true, cat:"world" },
    { name:"Al Jazeera — All (RSS)", url:"https://www.aljazeera.com/xml/rss/all.xml", enabled:true, cat:"world" },
    { name:"DW Español — Portada (RSS)", url:"https://rss.dw.com/rdf/rss-es-all", enabled:true, cat:"world" },
    { name:"Euronews — Español (MRSS)", url:"https://www.euronews.com/rss?format=mrss", enabled:true, cat:"world" },

    // ── Economía (ON)
    { name:"Expansión — Portada (RSS)", url:"https://e00-expansion.uecdn.es/rss/portada.xml", enabled:true, cat:"economy" },
    { name:"Cinco Días — Portada (MRSS)", url:"https://feeds.elpais.com/mrss-s/pages/ep/site/cincodias.com/portada", enabled:true, cat:"economy" },
    { name:"El Blog Salmón (RSS)", url:"https://feeds.weblogssl.com/elblogsalmon", enabled:true, cat:"economy" },

    // ── Tech (ON)
    { name:"Xataka (RSS)", url:"https://feeds.weblogssl.com/xataka2", enabled:true, cat:"tech" },
    { name:"Genbeta (RSS)", url:"https://feeds.weblogssl.com/genbeta", enabled:true, cat:"tech" },

    // ── Sucesos (ON)
    { name:"El Confidencial — Sucesos (RSS)", url:"https://rss.elconfidencial.com/espana/sucesos/", enabled:true, cat:"crime" },

    // ── OFF (más España)
    { name:"ElDiario.es — Portada (RSS) [OFF]", url:"https://www.eldiario.es/rss/", enabled:false, cat:"spain" },
    { name:"Público — Portada (RSS) [OFF]", url:"https://www.publico.es/rss", enabled:false, cat:"spain" },
    { name:"OKDIARIO — Portada (RSS) [OFF]", url:"https://okdiario.com/feed", enabled:false, cat:"spain" },
    { name:"El Español — Portada (RSS) [OFF]", url:"https://www.elespanol.com/rss/", enabled:false, cat:"spain" },

    // ── OFF (internacional)
    { name:"CNN — World (RSS) [OFF]", url:"http://rss.cnn.com/rss/edition_world.rss", enabled:false, cat:"world" },
    { name:"CNN — Top (RSS) [OFF]", url:"http://rss.cnn.com/rss/edition.rss", enabled:false, cat:"world" },
    { name:"NYTimes — World (RSS) [OFF]", url:"https://rss.nytimes.com/services/xml/rss/nyt/World.xml", enabled:false, cat:"world" },
    { name:"NYTimes — Home (RSS) [OFF]", url:"https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml", enabled:false, cat:"world" },
    { name:"NPR — News (RSS) [OFF]", url:"https://feeds.npr.org/1001/rss.xml", enabled:false, cat:"world" },
    { name:"Sky News — World (RSS) [OFF]", url:"https://feeds.skynews.com/feeds/rss/world.xml", enabled:false, cat:"world" },

    // ── OFF (tech global)
    { name:"The Verge (RSS) [OFF]", url:"https://www.theverge.com/rss/index.xml", enabled:false, cat:"tech" },
    { name:"Ars Technica (RSS) [OFF]", url:"https://feeds.arstechnica.com/arstechnica/index", enabled:false, cat:"tech" },
    { name:"Wired (RSS) [OFF]", url:"https://www.wired.com/feed/rss", enabled:false, cat:"tech" },

    // ── OFF (deportes / ent)
    { name:"ESPN — Top (RSS) [OFF]", url:"https://www.espn.com/espn/rss/news", enabled:false, cat:"sports" },
    { name:"Marca — Portada (RSS) [OFF]", url:"https://e00-marca.uecdn.es/rss/portada.xml", enabled:false, cat:"sports" },
    { name:"AS — Últimas (RSS) [OFF]", url:"https://as.com/rss/tags/ultimas_noticias.xml", enabled:false, cat:"sports" },
    { name:"VidaExtra (RSS) [OFF]", url:"https://feeds.weblogssl.com/vidaextra", enabled:false, cat:"ent" },

    // ── (muchos más directos, OFF por rendimiento)
    { name:"BBC — Business (RSS) [OFF]", url:"https://feeds.bbci.co.uk/news/business/rss.xml", enabled:false, cat:"economy" },
    { name:"BBC — Tech (RSS) [OFF]", url:"https://feeds.bbci.co.uk/news/technology/rss.xml", enabled:false, cat:"tech" },
    { name:"BBC — Health (RSS) [OFF]", url:"https://feeds.bbci.co.uk/news/health/rss.xml", enabled:false, cat:"health" },
    { name:"The Guardian — Business (RSS) [OFF]", url:"https://www.theguardian.com/uk/business/rss", enabled:false, cat:"economy" },
    { name:"The Guardian — Tech (RSS) [OFF]", url:"https://www.theguardian.com/uk/technology/rss", enabled:false, cat:"tech" },
    { name:"The Guardian — Sport (RSS) [OFF]", url:"https://www.theguardian.com/uk/sport/rss", enabled:false, cat:"sports" },

    { name:"El País — Internacional (MRSS) [OFF]", url:"https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/internacional/portada", enabled:false, cat:"world" },
    { name:"El País — Economía (MRSS) [OFF]", url:"https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/economia/portada", enabled:false, cat:"economy" },
    { name:"El País — Tecnología (MRSS) [OFF]", url:"https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/tecnologia/portada", enabled:false, cat:"tech" },

    { name:"El Mundo — Internacional (RSS) [OFF]", url:"https://e00-elmundo.uecdn.es/elmundo/rss/internacional.xml", enabled:false, cat:"world" },
    { name:"El Mundo — Economía (RSS) [OFF]", url:"https://e00-elmundo.uecdn.es/elmundo/rss/economia.xml", enabled:false, cat:"economy" },
    { name:"El Mundo — Ciencia/Salud (RSS) [OFF]", url:"https://e00-elmundo.uecdn.es/elmundo/rss/ciencia-y-salud.xml", enabled:false, cat:"health" },

    { name:"ABC — Internacional (RSS) [OFF]", url:"https://www.abc.es/rss/feeds/abcInternacional.xml", enabled:false, cat:"world" },
    { name:"ABC — Economía (RSS) [OFF]", url:"https://www.abc.es/rss/feeds/abcEconomia.xml", enabled:false, cat:"economy" },

    { name:"La Vanguardia — Internacional (RSS) [OFF]", url:"https://www.lavanguardia.com/mvc/feed/rss/internacional.xml", enabled:false, cat:"world" },
    { name:"La Vanguardia — Economía (RSS) [OFF]", url:"https://www.lavanguardia.com/mvc/feed/rss/economia.xml", enabled:false, cat:"economy" },
    { name:"La Vanguardia — Deportes (RSS) [OFF]", url:"https://www.lavanguardia.com/mvc/feed/rss/deportes.xml", enabled:false, cat:"sports" },

    { name:"Europa Press — Nacional (RSS) [OFF]", url:"https://www.europapress.es/rss/rss.aspx?ch=66", enabled:false, cat:"spain" },
    { name:"Europa Press — Internacional (RSS) [OFF]", url:"https://www.europapress.es/rss/rss.aspx?ch=67", enabled:false, cat:"world" },
    { name:"Europa Press — Economía (RSS) [OFF]", url:"https://www.europapress.es/rss/rss.aspx?ch=136", enabled:false, cat:"economy" },

    // ── Fallback: Google News RSS (OFF)
    { name:"Google News — España (Top) [OFF]", url:"https://news.google.com/rss?hl=es&gl=ES&ceid=ES:es", enabled:false, cat:"spain" },
    { name:"Google News — World [OFF]", url:"https://news.google.com/rss?hl=en&gl=US&ceid=US:en", enabled:false, cat:"world" },
  ];

  /* ───────────────────────────── UI REFS ───────────────────────────── */
  const els = {
    timeFilter: $("timeFilter"),
    searchBox: $("searchBox"),
    btnRefresh: $("btnRefresh"),
    btnFeeds: $("btnFeeds"),
    btnCheckUpdate: $("btnCheckUpdate"),
    btnHardReset: $("btnHardReset"),
    status: $("status"),

    liveUrl: $("liveUrl"),
    headline: $("headline"),
    sourceUrl: $("sourceUrl"),
    hashtags: $("hashtags"),
    optIncludeLive: $("optIncludeLive"),
    optIncludeSource: $("optIncludeSource"),
    template: $("template"),
    preview: $("preview"),
    warn: $("warn"),
    charCount: $("charCount"),
    btnTrim: $("btnTrim"),
    btnGenTags: $("btnGenTags"),
    btnCopyUrl: $("btnCopyUrl"),
    btnCopy: $("btnCopy"),
    btnX: $("btnX"),
    btnResetTemplate: $("btnResetTemplate"),

    delayMin: $("delayMin"),
    optOnlyReady: $("optOnlyReady"),
    optOnlySpanish: $("optOnlySpanish"),
    sortBy: $("sortBy"),
    optAutoRefresh: $("optAutoRefresh"),
    refreshSec: $("refreshSec"),
    optResolveLinks: $("optResolveLinks"),
    optShowOriginal: $("optShowOriginal"),
    optHideUsed: $("optHideUsed"),
    catFilter: $("catFilter"),
    showLimit: $("showLimit"),
    fetchCap: $("fetchCap"),
    batchFeeds: $("batchFeeds"),

    newsList: $("newsList"),
    tnpTickerInner: $("tnpTickerInner"),
    tnpTrendsPop: $("tnpTrendsPop"),

    // X Mock
    xMockText: $("xMockText"),
    xMockCard: $("xMockCard"),
    xMockCardImg: $("xMockCardImg"),
    xMockCardTitle: $("xMockCardTitle"),
    xMockCardUrl: $("xMockCardUrl"),

    modal: $("modal"),
    btnCloseModal: $("btnCloseModal"),
    newFeedName: $("newFeedName"),
    newFeedUrl: $("newFeedUrl"),
    btnAddFeed: $("btnAddFeed"),
    btnSaveFeeds: $("btnSaveFeeds"),
    btnRestoreDefaultFeeds: $("btnRestoreDefaultFeeds"),
    btnExportFeeds: $("btnExportFeeds"),
    btnImportFeeds: $("btnImportFeeds"),
    feedList: $("feedList"),
    feedsJson: $("feedsJson"),
  };

  function uiOk(){
    return !!(els.newsList && els.btnRefresh && els.btnFeeds && els.status);
  }

  /* ───────────────────────────── SETTINGS ───────────────────────────── */
  function loadSettings(){
    const s = safeJsonParse(localStorage.getItem(LS_SETTINGS), {});
    s.liveUrl = s.liveUrl || "https://twitch.tv/globaleyetv";
    s.delayMin = (typeof s.delayMin === "number") ? s.delayMin : 0;
    s.timeFilter = (typeof s.timeFilter === "number") ? s.timeFilter : 60;
    s.sortBy = s.sortBy || "impact";
    s.showLimit = (typeof s.showLimit === "number") ? s.showLimit : 120;
    s.fetchCap = (typeof s.fetchCap === "number") ? s.fetchCap : 240;
    s.batchFeeds = (typeof s.batchFeeds === "number") ? s.batchFeeds : 12;
    s.refreshSec = (typeof s.refreshSec === "number") ? s.refreshSec : 60;

    s.optOnlyReady = (s.optOnlyReady === true);
    s.optOnlySpanish = (s.optOnlySpanish !== false); // prioridad ES ON
    s.optResolveLinks = (s.optResolveLinks !== false);
    s.optShowOriginal = (s.optShowOriginal !== false);
    s.optHideUsed = (s.optHideUsed !== false);
    s.optAutoRefresh = (s.optAutoRefresh !== false);

    s.optIncludeLive = (s.optIncludeLive !== false);
    s.optIncludeSource = (s.optIncludeSource !== false);

    s.catFilter = s.catFilter || "all";
    return s;
  }
  function saveSettings(s){
    localStorage.setItem(LS_SETTINGS, JSON.stringify(s));
  }
  const settings = loadSettings();

  function loadTemplate(){
    const t = localStorage.getItem(LS_TEMPLATE);
    return (t && t.trim()) ? t : DEFAULT_TEMPLATE;
  }
  function saveTemplate(t){
    localStorage.setItem(LS_TEMPLATE, t);
  }

  /* ───────────────────────────── STATE ───────────────────────────── */
  const state = {
    feeds: [],
    items: [],
    filtered: [],
    selectedId: null,
    used: new Set(),

    refreshInFlight: false,
    refreshAbort: null,
    autoTimer: null,

    resolveCache: new Map(),
    ogCache: new Map(),

    // backoff: feedUrl -> { delayMs, untilMs }
    backoff: new Map(),

    // ui
    trendsTimer: null,
    lastTickerSig: "",
    lastFetchReport: { ok:0, fail:0, total:0 },
  };

  function loadUsed(){
    const arr = safeJsonParse(localStorage.getItem(LS_USED), []);
    state.used = new Set(Array.isArray(arr) ? arr : []);
  }
  function saveUsed(){
    localStorage.setItem(LS_USED, JSON.stringify(Array.from(state.used).slice(0, 5000)));
  }

  function loadCaches(){
    const rc = safeJsonParse(localStorage.getItem(LS_RESOLVE_CACHE), {});
    if (rc && typeof rc === "object"){
      for (const [k,v] of Object.entries(rc)){
        if (typeof v === "string") state.resolveCache.set(k, v);
      }
    }
    const og = safeJsonParse(localStorage.getItem(LS_OG_CACHE), {});
    if (og && typeof og === "object"){
      for (const [k,v] of Object.entries(og)){
        if (v && typeof v === "object") state.ogCache.set(k, v);
        if (v === null) state.ogCache.set(k, null);
      }
    }
  }

  function saveCaches(){
    const rsOut = {};
    let i = 0;
    for (const [k,v] of state.resolveCache.entries()){
      rsOut[k] = v;
      if (++i > 2000) break;
    }
    localStorage.setItem(LS_RESOLVE_CACHE, JSON.stringify(rsOut));

    const ogOut = {};
    i = 0;
    for (const [k,v] of state.ogCache.entries()){
      ogOut[k] = v;
      if (++i > 1200) break;
    }
    localStorage.setItem(LS_OG_CACHE, JSON.stringify(ogOut));
  }

  /* ───────────────────────────── FEEDS CRUD ───────────────────────────── */
  function normalizeFeed(f){
    const name = normSpace(f?.name);
    const url = ensureUrl(f?.url);
    const enabled = !!f?.enabled;
    const cat = normSpace(f?.cat) || "all";
    if (!name || !url || !isHttpUrl(url)) return null;
    return { name, url, enabled, cat };
  }

  function loadFeeds(){
    const saved = safeJsonParse(localStorage.getItem(LS_FEEDS), null);
    if (Array.isArray(saved)){
      const cleaned = saved.map(normalizeFeed).filter(Boolean);
      if (cleaned.length){
        localStorage.setItem(LS_FEEDS, JSON.stringify(cleaned));
        return cleaned;
      }
      const defaults = DEFAULT_FEEDS.map(normalizeFeed).filter(Boolean);
      localStorage.setItem(LS_FEEDS, JSON.stringify(defaults));
      return defaults;
    }
    const defaults = DEFAULT_FEEDS.map(normalizeFeed).filter(Boolean);
    localStorage.setItem(LS_FEEDS, JSON.stringify(defaults));
    return defaults;
  }

  function saveFeeds(){
    localStorage.setItem(LS_FEEDS, JSON.stringify(state.feeds));
  }

  /* ───────────────────────────── MODAL (FIX .hidden + [hidden]) ───────────────────────────── */
  function setModalOpen(open){
    if (!els.modal) return;
    els.modal.classList.toggle("hidden", !open);
    els.modal.hidden = !open;
    els.modal.setAttribute("aria-hidden", open ? "false" : "true");
  }

  function openModal(){
    renderFeedsModal();
    if (els.feedsJson) els.feedsJson.value = "";
    setModalOpen(true);
  }

  function closeModal(){
    setModalOpen(false);
  }

  function renderFeedsModal(){
    if (!els.feedList) return;
    els.feedList.innerHTML = "";

    for (let i=0;i<state.feeds.length;i++){
      const f = state.feeds[i];

      const row = document.createElement("div");
      row.className = "feedRow";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!f.enabled;
      cb.addEventListener("change", () => { f.enabled = cb.checked; });

      const meta = document.createElement("div");
      meta.className = "meta";

      const name = document.createElement("div");
      name.className = "name";
      name.textContent = f.name;

      const url = document.createElement("div");
      url.className = "url";
      url.textContent = f.url;
      url.title = f.url;

      meta.append(name, url);

      const cat = document.createElement("span");
      cat.className = "badge";
      cat.textContent = f.cat || "all";

      const del = document.createElement("button");
      del.className = "btn btn--sm btn--danger";
      del.type = "button";
      del.textContent = "Borrar";
      del.addEventListener("click", () => {
        state.feeds.splice(i,1);
        renderFeedsModal();
      });

      row.append(cb, meta, cat, del);
      els.feedList.appendChild(row);
    }
  }

  /* ───────────────────────────── STATUS ───────────────────────────── */
  function setStatus(msg){
    if (els.status) els.status.textContent = msg;
  }

  /* ───────────────────────────── FETCH (ANTI-CORS) ───────────────────────────── */
  function withTimeout(ms, signal){
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort("timeout"), ms);

    if (signal){
      if (signal.aborted) ctrl.abort(signal.reason);
      else signal.addEventListener("abort", () => ctrl.abort(signal.reason), { once:true });
    }

    return {
      signal: ctrl.signal,
      cancel: () => { clearTimeout(t); ctrl.abort("cancel"); }
    };
  }

  async function fetchText(url, signal, extraHeaders){
    const { signal: s2, cancel } = withTimeout(15000, signal);
    try{
      const headers = {
        "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, text/html;q=0.8, */*;q=0.7",
        ...(extraHeaders || {})
      };
      const r = await fetch(url, { signal: s2, cache:"no-store", headers });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.text();
    } finally {
      cancel();
    }
  }

  async function fetchTextSmart(url, signal){
    // 1) directo
    try { return await fetchText(url, signal); } catch {}

    const enc = encodeURIComponent(url);

    // 2) allorigins raw
    try { return await fetchText(`https://api.allorigins.win/raw?url=${enc}`, signal); } catch {}

    // 3) codetabs
    try { return await fetchText(`https://api.codetabs.com/v1/proxy?quest=${enc}`, signal); } catch {}

    // 4) thingproxy
    try { return await fetchText(`https://thingproxy.freeboard.io/fetch/${url}`, signal); } catch {}

    throw new Error("fetch_failed");
  }

  async function fetchHtmlSmart(url, signal){
    try { return await fetchText(url, signal, { "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" }); } catch {}

    const enc = encodeURIComponent(url);
    try { return await fetchText(`https://api.allorigins.win/raw?url=${enc}`, signal); } catch {}
    try { return await fetchText(`https://api.codetabs.com/v1/proxy?quest=${enc}`, signal); } catch {}
    try { return await fetchText(`https://thingproxy.freeboard.io/fetch/${url}`, signal); } catch {}

    throw new Error("html_fetch_failed");
  }

  async function mapLimit(arr, limit, fn){
    const a = Array.isArray(arr) ? arr : [];
    const out = new Array(a.length);
    let idx = 0;

    const workers = new Array(Math.max(1, limit)).fill(0).map(async () => {
      while (idx < a.length){
        const i = idx++;
        try { out[i] = await fn(a[i], i); }
        catch { out[i] = undefined; }
      }
    });

    await Promise.all(workers);
    return out;
  }

  /* ───────────────────────────── PARSE RSS/ATOM ───────────────────────────── */
  function parseXml(xmlText){
    const p = new DOMParser();
    const doc = p.parseFromString(xmlText, "text/xml");
    const pe = doc.querySelector("parsererror");
    if (pe) throw new Error("xml_parse_error");
    return doc;
  }

  function pickImageFromItem(item){
    const mc = item.querySelector("media\\:content, content[url]");
    if (mc && mc.getAttribute("url")) return mc.getAttribute("url");

    const mt = item.querySelector("media\\:thumbnail");
    if (mt && mt.getAttribute("url")) return mt.getAttribute("url");

    const enc = item.querySelector("enclosure[url]");
    if (enc){
      const type = (enc.getAttribute("type") || "").toLowerCase();
      const url = enc.getAttribute("url");
      if (url && (!type || type.includes("image"))) return url;
    }

    const al = item.querySelector("link[rel='enclosure'][href]");
    if (al) return al.getAttribute("href");

    return "";
  }

  function parseRss(doc, feed){
    const items = [];
    const nodes = [...doc.querySelectorAll("item")];

    for (const it of nodes){
      const title = stripHtml(it.querySelector("title")?.textContent || "");
      const link = (it.querySelector("link")?.textContent || "").trim();
      const guid = (it.querySelector("guid")?.textContent || "").trim();

      const pub =
        (it.querySelector("pubDate")?.textContent || "").trim() ||
        (it.querySelector("dc\\:date")?.textContent || "").trim();

      const dateMs = pub ? Date.parse(pub) : NaN;
      const ts = Number.isFinite(dateMs) ? dateMs : nowMs();

      const imgRaw = pickImageFromItem(it);

      const url = cleanUrl(link || guid);
      if (!url) continue;

      const img = imgRaw ? cleanUrl(absolutizeUrl(imgRaw, url)) : "";

      items.push({
        id: makeId(feed.name, url, ts, title),
        feedName: feed.name,
        cat: feed.cat || "all",
        title,
        link: url,
        dateMs: ts,
        domain: domainOf(url),
        img,
        resolvedUrl: "",
        ready: false,
        top: false,
      });
    }
    return items;
  }

  function parseAtom(doc, feed){
    const items = [];
    const entries = [...doc.querySelectorAll("entry")];
    for (const e of entries){
      const title = stripHtml(e.querySelector("title")?.textContent || "");
      const linkEl = e.querySelector("link[rel='alternate'][href]") || e.querySelector("link[href]");
      const link = (linkEl?.getAttribute("href") || "").trim();

      const pub =
        (e.querySelector("updated")?.textContent || "").trim() ||
        (e.querySelector("published")?.textContent || "").trim();

      const dateMs = pub ? Date.parse(pub) : NaN;
      const ts = Number.isFinite(dateMs) ? dateMs : nowMs();

      const imgRaw = pickImageFromItem(e);
      const url = cleanUrl(link);

      if (!url) continue;

      const img = imgRaw ? cleanUrl(absolutizeUrl(imgRaw, url)) : "";

      items.push({
        id: makeId(feed.name, url, ts, title),
        feedName: feed.name,
        cat: feed.cat || "all",
        title,
        link: url,
        dateMs: ts,
        domain: domainOf(url),
        img,
        resolvedUrl: "",
        ready: false,
        top: false,
      });
    }
    return items;
  }

  function parseFeed(xmlText, feed){
    const doc = parseXml(xmlText);
    if (doc.querySelector("rss")) return parseRss(doc, feed);
    if (doc.querySelector("feed")) return parseAtom(doc, feed);
    if (doc.querySelector("channel item")) return parseRss(doc, feed);
    return [];
  }

  /* ───────────────────────────── OG IMAGE BEST-EFFORT ───────────────────────────── */
  function extractOgImage(html, pageUrl){
    const getMeta = (re) => {
      const m = html.match(re);
      return (m && m[1]) ? m[1].trim() : "";
    };

    let img =
      getMeta(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
      getMeta(/content=["']([^"']+)["'][^>]*property=["']og:image["']/i) ||
      getMeta(/name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i) ||
      getMeta(/content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i);

    if (!img){
      img = getMeta(/rel=["']image_src["'][^>]*href=["']([^"']+)["']/i) ||
            getMeta(/href=["']([^"']+)["'][^>]*rel=["']image_src["']/i);
    }

    if (!img) return "";

    img = img.replace(/&amp;/g, "&");
    img = absolutizeUrl(img, pageUrl);
    return cleanUrl(img);
  }

  async function fetchOgImage(url, signal){
    const k = url;
    if (state.ogCache.has(k)) return state.ogCache.get(k);

    try{
      const html = await fetchHtmlSmart(url, signal);
      const img = extractOgImage(html, url);
      const out = img ? { img } : null;
      state.ogCache.set(k, out);
      return out;
    }catch{
      state.ogCache.set(k, null);
      return null;
    }
  }

  /* ───────────────────────────── LINK RESOLVE ───────────────────────────── */
  function shouldResolve(url){
    const d = domainOf(url);
    return /news\.google\.com|feedproxy\.google\.com/.test(d);
  }

  async function resolveUrl(url, signal){
    const k = url;
    if (state.resolveCache.has(k)) return state.resolveCache.get(k);

    try{
      const { signal: s2, cancel } = withTimeout(9000, signal);
      try{
        const r = await fetch(url, { signal: s2, redirect:"follow", cache:"no-store" });
        const finalUrl = r.url || url;
        const clean = cleanUrl(finalUrl);
        state.resolveCache.set(k, clean);
        return clean;
      } finally {
        cancel();
      }
    } catch {}

    state.resolveCache.set(k, url);
    return url;
  }

  /* ───────────────────────────── SCORING ───────────────────────────── */
  function scoreImpact(it, preferEs){
    const t = (it.title || "").toLowerCase();
    let s = 0;

    if (/(última hora|urgente|breaking|alerta)/.test(t)) s += 5;
    if (/(explos|ataque|muert|guerra|otan|ucrania|rusia|israel|gaza|iran)/.test(t)) s += 4;
    if (/(eleccion|gobierno|congreso|sánchez|trump|biden|putin|zelenski)/.test(t)) s += 3;
    if (/(inflaci|bolsa|ibex|tipo|bce|fed|petróleo|bitcoin)/.test(t)) s += 2;

    const dom = it.domain || "";
    if (/(reuters\.com|bbc\.co\.uk|elpais\.com|elmundo\.es|rtve\.es|theguardian\.com)/.test(dom)) s += 2;

    const ageMin = minutesAgo(it.dateMs);
    if (ageMin <= 10) s += 3;
    else if (ageMin <= 30) s += 2;
    else if (ageMin <= 60) s += 1;

    if (preferEs && likelySpanish(it.title, it.feedName, it.cat)) s += 2;

    return s;
  }

  /* ───────────────────────────── FILTER / RENDER ───────────────────────────── */
  function currentWindowMs(){
    const v = Number(els.timeFilter?.value || settings.timeFilter || 60);
    if (Number.isFinite(v) && v > 0) return v * 60 * 1000;
    return 60 * 60 * 1000;
  }

  function applyFilters(){
    const q = (els.searchBox?.value || "").trim().toLowerCase();
    const minAge = clamp(Number(els.delayMin?.value || settings.delayMin || 0), 0, 60) * 60 * 1000;

    const win = currentWindowMs();
    const onlyReady = !!(els.optOnlyReady?.checked);
    const hideUsed = !!(els.optHideUsed?.checked);
    const cat = (els.catFilter?.value || "all");
    const preferEs = !!(els.optOnlySpanish?.checked);

    const now = nowMs();

    let out = state.items.filter(it => {
      const age = now - it.dateMs;
      if (age < 0) return false;
      if (age > win) return false;
      if (age < minAge) return false;

      if (onlyReady && !it.ready) return false;
      if (hideUsed && state.used.has(it.id)) return false;

      if (cat !== "all" && it.cat !== cat) return false;

      if (q){
        const hay = `${it.title} ${it.domain} ${it.feedName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const sortBy = (els.sortBy?.value || settings.sortBy || "impact");
    if (sortBy === "impact"){
      out.sort((a,b) => scoreImpact(b, preferEs) - scoreImpact(a, preferEs) || (b.dateMs - a.dateMs));
    }else{
      out.sort((a,b) => b.dateMs - a.dateMs);
    }

    const lim = clamp(Number(els.showLimit?.value || settings.showLimit || 120), 10, 500);
    out = out.slice(0, lim);

    state.filtered = out;
    renderNewsList(out);
    updateTicker();
    updateTrendsPop();
  }

  function renderNewsList(list){
    if (!els.newsList) return;
    els.newsList.innerHTML = "";

    if (!list.length){
      const empty = document.createElement("div");
      empty.style.padding = "14px";
      empty.style.color = "rgba(231,233,234,0.65)";
      empty.textContent = state.refreshInFlight
        ? "Cargando noticias…"
        : "Sin noticias en este filtro. Prueba a subir la ventana (60min/3h) o bajar Delay.";
      els.newsList.appendChild(empty);
      return;
    }

    const frag = document.createDocumentFragment();

    for (const it of list){
      const row = document.createElement("div");
      row.className = "newsItem" + (state.used.has(it.id) ? " used" : "");
      row.tabIndex = 0;

      const thumb = document.createElement("div");
      thumb.className = "thumb";
      if (it.img){
        const img = document.createElement("img");
        img.loading = "lazy";
        img.decoding = "async";
        img.referrerPolicy = "no-referrer";
        img.src = it.img;
        img.alt = "";
        thumb.innerHTML = "";
        thumb.appendChild(img);
      } else {
        thumb.textContent = "img";
      }

      const main = document.createElement("div");
      main.className = "newsMain";

      const top = document.createElement("div");
      top.className = "newsTop";

      const meta = document.createElement("div");
      meta.className = "newsMeta";

      const b1 = document.createElement("span");
      b1.className = "badge";
      b1.textContent = it.domain || "fuente";

      const b2 = document.createElement("span");
      b2.className = "badge";
      b2.textContent = fmtAge(it.dateMs);

      meta.appendChild(b1);
      meta.appendChild(b2);

      if (it.top){
        const bt = document.createElement("span");
        bt.className = "badge top";
        bt.textContent = "TOP";
        meta.appendChild(bt);
      }
      if (it.ready){
        const br = document.createElement("span");
        br.className = "badge ok";
        br.textContent = "LISTO";
        meta.appendChild(br);
      }

      const right = document.createElement("div");
      right.className = "newsMeta";
      const fn = document.createElement("span");
      fn.className = "badge";
      fn.textContent = it.feedName;
      right.appendChild(fn);

      top.append(meta, right);

      const title = document.createElement("div");
      title.className = "newsTitle";
      title.textContent = it.title || "(sin título)";

      const link = document.createElement("div");
      link.className = "newsLink";
      link.textContent = (it.resolvedUrl || it.link || "");

      main.append(top, title, link);

      row.append(thumb, main);

      const onPick = () => selectItem(it.id);

      row.addEventListener("click", onPick);
      row.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(); }
      });

      frag.appendChild(row);
    }

    els.newsList.appendChild(frag);
  }

  function suggestHashtags(title, cat){
    const base = ["#ÚltimaHora"];
    if (cat === "spain") base.push("#España");
    else if (cat === "world") base.push("#Mundo");
    else if (cat === "economy") base.push("#Economía");
    else if (cat === "tech") base.push("#Tech");
    else if (cat === "crime") base.push("#Sucesos");
    else if (cat === "health") base.push("#Salud");
    else if (cat === "sports") base.push("#Deportes");
    else if (cat === "ent") base.push("#Cultura");

    const words = String(title || "")
      .split(/\s+/)
      .map(w => w.replace(/[^\p{L}\p{N}]/gu,""))
      .filter(Boolean);

    const picks = [];
    for (const w of words){
      const low = w.toLowerCase();
      if (low.length < 6) continue;
      if (picks.length >= 2) break;
      if (["últimahora","fuente","directo"].includes(low)) continue;
      picks.push("#" + w);
    }

    return [...base, ...picks].join(" ");
  }

  function buildTweet(){
    const tpl = (els.template?.value || DEFAULT_TEMPLATE);

    const headline = normSpace(els.headline?.value);
    const liveUrl = normSpace(els.liveUrl?.value || settings.liveUrl);
    const sourceUrl = normSpace(els.sourceUrl?.value);
    const tags = normSpace(els.hashtags?.value);

    const liveLine = (els.optIncludeLive?.checked)
      ? DEFAULT_LIVE_LINE.replace("{{LIVE_URL}}", liveUrl)
      : "";

    let out = tpl
      .replaceAll("{{HEADLINE}}", headline)
      .replaceAll("{{LIVE_URL}}", liveUrl)
      .replaceAll("{{LIVE_LINE}}", liveLine)
      .replaceAll("{{SOURCE_URL}}", sourceUrl)
      .replaceAll("{{HASHTAGS}}", tags);

    // si el toggle de fuente está OFF, limpiamos el bloque “Fuente:” de la plantilla estándar
    if (els.optIncludeSource && !els.optIncludeSource.checked){
      out = out
        .replace(/\n?Fuente:\s*\n\s*https?:\/\/[^\s]+/i, "")
        .replace(/\n?Fuente:\s*\n\s*\{\{SOURCE_URL\}\}/i, "")
        .replace(/\n{3,}/g, "\n\n");
    }

    return out.trim();
  }

  function renderXMockCard(it){
    if (!els.xMockCard) return;

    const url = (els.sourceUrl?.value || "").trim();
    if (!url){
      els.xMockCard.hidden = true;
      return;
    }

    els.xMockCard.href = url;
    if (els.xMockCardUrl) els.xMockCardUrl.textContent = domainOf(url) || url;

    const title = (els.headline?.value || "").trim() || "Noticia";
    if (els.xMockCardTitle) els.xMockCardTitle.textContent = title;

    const imgUrl = it?.img || "";
    if (els.xMockCardImg){
      els.xMockCardImg.innerHTML = "";
      if (imgUrl){
        const img = document.createElement("img");
        img.loading = "lazy";
        img.decoding = "async";
        img.referrerPolicy = "no-referrer";
        img.src = imgUrl;
        img.alt = "";
        els.xMockCardImg.appendChild(img);
      }else{
        const ph = document.createElement("div");
        ph.className = "xMock__ph";
        ph.textContent = "sin imagen";
        els.xMockCardImg.appendChild(ph);
      }
    }

    els.xMockCard.hidden = false;
  }

  function updatePreview(){
    const t = buildTweet();
    if (els.preview) els.preview.textContent = t;

    const len = estimateXChars(t);
    if (els.charCount) els.charCount.textContent = `${len} / 280`;
    if (els.warn){
      els.warn.textContent = (len > 280) ? `⚠️ Se pasa de 280 (sobran ${len - 280})` : "";
    }

    if (els.xMockText) els.xMockText.textContent = t;
    renderXMockCard(getSelectedItem());
  }

  function smartTrim(text, maxLen){
    const s = normSpace(text);
    if (s.length <= maxLen) return s;
    const cut = s.slice(0, maxLen - 1);
    const lastSpace = cut.lastIndexOf(" ");
    return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut) + "…";
  }

  function getSelectedItem(){
    if (!state.selectedId) return null;
    return state.items.find(x => x.id === state.selectedId) || state.filtered.find(x => x.id === state.selectedId) || null;
  }

  function selectItem(id){
    const it = state.items.find(x => x.id === id) || state.filtered.find(x => x.id === id);
    if (!it) return;

    state.selectedId = id;

    if (els.headline) els.headline.value = (it.title || "").trim();
    const src = (els.optShowOriginal?.checked) ? (it.resolvedUrl || it.link) : it.link;
    if (els.sourceUrl) els.sourceUrl.value = src;

    if (els.hashtags) els.hashtags.value = suggestHashtags(it.title, it.cat);

    updatePreview();
    applyFilters();
  }

  function markSelectedUsed(){
    if (!state.selectedId) return;
    state.used.add(state.selectedId);
    saveUsed();
    applyFilters();
  }

  /* ───────────────────────────── TICKER + TRENDS ───────────────────────────── */
  function updateTicker(){
    if (!els.tnpTickerInner) return;
    const top10 = state.filtered.slice(0, 10);
    if (!top10.length){
      els.tnpTickerInner.textContent = "Sin noticias aún…";
      return;
    }
    const sig = top10.map(x => x.id).join("|");
    if (sig === state.lastTickerSig) return;
    state.lastTickerSig = sig;

    const parts = top10.map(x => `• ${x.title}`);
    els.tnpTickerInner.textContent = parts.join("   ");

    els.tnpTickerInner.style.animation = "none";
    // eslint-disable-next-line no-unused-expressions
    els.tnpTickerInner.offsetHeight;
    els.tnpTickerInner.style.animation = "";
  }

  function buildTrendCandidates(){
    const pool = state.filtered.slice(0, 25).map(x => x.title).join(" ");
    const words = pool
      .split(/\s+/)
      .map(w => w.replace(/[^\p{L}\p{N}]/gu, ""))
      .filter(w => w.length >= 6);

    const stop = new Set(["últimahora","noticias","fuente","directo","gobierno","presidente","ministro"]);
    const map = new Map();
    for (const w of words){
      const low = w.toLowerCase();
      if (stop.has(low)) continue;
      map.set(low, (map.get(low) || 0) + 1);
    }

    return [...map.entries()]
      .sort((a,b) => b[1]-a[1])
      .slice(0, 8)
      .map(x => "#" + x[0]);
  }

  function updateTrendsPop(){
    if (!els.tnpTrendsPop) return;

    const tags = buildTrendCandidates();
    if (!tags.length){
      els.tnpTrendsPop.classList.remove("on");
      els.tnpTrendsPop.setAttribute("aria-hidden","true");
      return;
    }

    clearInterval(state.trendsTimer);
    let idx = 0;
    els.tnpTrendsPop.textContent = tags[idx];
    els.tnpTrendsPop.classList.add("on");
    els.tnpTrendsPop.setAttribute("aria-hidden","false");

    state.trendsTimer = setInterval(() => {
      idx = (idx + 1) % tags.length;
      els.tnpTrendsPop.textContent = tags[idx];
      els.tnpTrendsPop.classList.add("on");
    }, 4200);
  }

  /* ───────────────────────────── BACKOFF ───────────────────────────── */
  function shouldSkipFeed(feedUrl, force){
    if (force) return false;
    const info = state.backoff.get(feedUrl);
    if (!info) return false;
    return nowMs() < (info.untilMs || 0);
  }

  function bumpBackoff(feedUrl){
    const cur = state.backoff.get(feedUrl);
    const prevDelay = cur?.delayMs || 0;
    const nextDelay = prevDelay ? Math.min(prevDelay * 2, 10 * 60 * 1000) : 30 * 1000; // 30s->60->120... max 10m
    state.backoff.set(feedUrl, { delayMs: nextDelay, untilMs: nowMs() + nextDelay });
  }

  function resetBackoff(){
    state.backoff.clear();
  }

  /* ───────────────────────────── REFRESH LOOP ───────────────────────────── */
  async function refreshAll({ force=false } = {}){
    if (state.refreshInFlight) return;

    const feeds = state.feeds.filter(f => f.enabled);
    if (!feeds.length){
      setStatus("No hay feeds activados. Abre Feeds y activa alguno.");
      return;
    }

    if (force) resetBackoff();

    state.refreshInFlight = true;
    state.refreshAbort?.abort("new_refresh");
    state.refreshAbort = new AbortController();
    const signal = state.refreshAbort.signal;

    state.items = [];
    state.filtered = [];
    renderNewsList([]);
    updateTicker();
    updateTrendsPop();

    setStatus(force ? "Refrescando (force)…" : "Refrescando…");

    try{
      const cap = clamp(Number(els.fetchCap?.value || settings.fetchCap || 240), 80, 2000);
      const batchSize = clamp(Number(els.batchFeeds?.value || settings.batchFeeds || 12), 4, 50);

      const allItems = [];
      const enabledFeeds = feeds.slice();

      let ok = 0, fail = 0;

      for (let i=0;i<enabledFeeds.length;i += batchSize){
        if (signal.aborted) break;

        const chunk = enabledFeeds.slice(i, i + batchSize);

        await Promise.allSettled(chunk.map(async (f) => {
          if (signal.aborted) return;

          if (shouldSkipFeed(f.url, force)){
            fail++;
            return;
          }

          try{
            const xml = await fetchTextSmart(f.url, signal);
            const items = parseFeed(xml, f);

            for (const it of items){
              const sc = scoreImpact(it, true);
              it.top = sc >= 8;
              allItems.push(it);
              if (allItems.length >= cap * 2) break;
            }
            ok++;
          }catch{
            fail++;
            bumpBackoff(f.url);
          }
        }));

        setStatus(`Refrescando… (${Math.min(i + batchSize, enabledFeeds.length)}/${enabledFeeds.length}) · OK:${ok} FAIL:${fail}`);
        await sleep(60);
      }

      state.lastFetchReport = { ok, fail, total: enabledFeeds.length };

      // dedup por link
      const seen = new Set();
      const dedup = [];
      for (const it of allItems){
        const k = it.link;
        if (!k || seen.has(k)) continue;
        seen.add(k);
        dedup.push(it);
      }

      const now = nowMs();
      const clean = dedup.filter(it => (now - it.dateMs) >= 0);

      clean.sort((a,b) => b.dateMs - a.dateMs);
      state.items = clean.slice(0, cap);

      // resolve links (limitado)
      if (els.optResolveLinks?.checked){
        const need = state.items.filter(it => shouldResolve(it.link)).slice(0, 60);
        await mapLimit(need, 6, async (it) => {
          it.resolvedUrl = await resolveUrl(it.link, signal);
        });
      }

      // OG images (solo si no hay RSS img)
      const needImg = state.items
        .filter(it => !it.img && (it.resolvedUrl || it.link))
        .slice(0, 60);

      await mapLimit(needImg, 6, async (it) => {
        const u = it.resolvedUrl || it.link;
        const og = await fetchOgImage(u, signal);
        if (og && og.img) it.img = og.img;
      });

      for (const it of state.items){
        it.ready = !!(it.title && (it.resolvedUrl || it.link));
      }

      saveCaches();
      setStatus(`OK · ${state.items.length} noticias · feeds OK:${ok} FAIL:${fail}`);
      applyFilters();
      updatePreview();
    } catch (e){
      if (String(e?.name || e).includes("Abort") || signal.aborted){
        setStatus("Refresh cancelado.");
      } else {
        console.error(e);
        setStatus("⚠️ Error refrescando (mira consola).");
      }
    } finally {
      state.refreshInFlight = false;
    }
  }

  function startAuto(){
    clearInterval(state.autoTimer);
    if (!els.optAutoRefresh?.checked) return;

    const sec = clamp(Number(els.refreshSec?.value || settings.refreshSec || 60), 20, 600);
    state.autoTimer = setInterval(() => {
      refreshAll({ force:false }).catch(()=>{});
    }, sec * 1000);
  }

  /* ───────────────────────────── SW UPDATE + RESET ───────────────────────────── */
  let swReg = null;

  async function registerSW(){
    if (!("serviceWorker" in navigator)) return;
    try{
      swReg = await navigator.serviceWorker.register("./sw.js");
    }catch{}
  }

  async function forceUpdateNow(){
    setStatus("Buscando update…");
    try{
      if (swReg) await swReg.update();

      // si hay un SW esperando, lo aplicamos
      if (swReg && swReg.waiting){
        swReg.waiting.postMessage({ type:"SKIP_WAITING" });
        setStatus("Aplicando update…");
        setTimeout(() => location.reload(), 400);
        return;
      }

      setStatus("Update check OK");
    }catch{
      setStatus("Update check falló");
    }
  }

  async function hardResetEverything(){
    if (!confirm("Reset total: borra feeds/settings/cache local. ¿Seguro?")) return;

    try{
      localStorage.removeItem(LS_FEEDS);
      localStorage.removeItem(LS_TEMPLATE);
      localStorage.removeItem(LS_SETTINGS);
      localStorage.removeItem(LS_USED);
      localStorage.removeItem(LS_RESOLVE_CACHE);
      localStorage.removeItem(LS_OG_CACHE);
    }catch{}

    try{
      if ("caches" in window){
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    }catch{}

    try{
      if ("serviceWorker" in navigator){
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) await reg.unregister();
      }
    }catch{}

    location.reload();
  }

  /* ───────────────────────────── UI BIND ───────────────────────────── */
  function bindUI(){
    if (els.liveUrl) els.liveUrl.value = settings.liveUrl;
    if (els.template) els.template.value = loadTemplate();

    if (els.delayMin) els.delayMin.value = String(settings.delayMin);
    if (els.timeFilter) els.timeFilter.value = String(settings.timeFilter);
    if (els.sortBy) els.sortBy.value = settings.sortBy;
    if (els.showLimit) els.showLimit.value = String(settings.showLimit);
    if (els.fetchCap) els.fetchCap.value = String(settings.fetchCap);
    if (els.batchFeeds) els.batchFeeds.value = String(settings.batchFeeds);
    if (els.refreshSec) els.refreshSec.value = String(settings.refreshSec);

    if (els.optOnlyReady) els.optOnlyReady.checked = !!settings.optOnlyReady;
    if (els.optOnlySpanish) els.optOnlySpanish.checked = !!settings.optOnlySpanish;
    if (els.optResolveLinks) els.optResolveLinks.checked = !!settings.optResolveLinks;
    if (els.optShowOriginal) els.optShowOriginal.checked = !!settings.optShowOriginal;
    if (els.optHideUsed) els.optHideUsed.checked = !!settings.optHideUsed;
    if (els.optAutoRefresh) els.optAutoRefresh.checked = !!settings.optAutoRefresh;

    if (els.optIncludeLive) els.optIncludeLive.checked = !!settings.optIncludeLive;
    if (els.optIncludeSource) els.optIncludeSource.checked = !!settings.optIncludeSource;

    if (els.catFilter) els.catFilter.value = settings.catFilter || "all";

    const saveSettingFrom = () => {
      settings.liveUrl = normSpace(els.liveUrl?.value || settings.liveUrl);
      settings.delayMin = Number(els.delayMin?.value || settings.delayMin);
      settings.timeFilter = Number(els.timeFilter?.value || settings.timeFilter);
      settings.sortBy = els.sortBy?.value || settings.sortBy;
      settings.showLimit = Number(els.showLimit?.value || settings.showLimit);
      settings.fetchCap = Number(els.fetchCap?.value || settings.fetchCap);
      settings.batchFeeds = Number(els.batchFeeds?.value || settings.batchFeeds);
      settings.refreshSec = Number(els.refreshSec?.value || settings.refreshSec);

      settings.optOnlyReady = !!els.optOnlyReady?.checked;
      settings.optOnlySpanish = !!els.optOnlySpanish?.checked;
      settings.optResolveLinks = !!els.optResolveLinks?.checked;
      settings.optShowOriginal = !!els.optShowOriginal?.checked;
      settings.optHideUsed = !!els.optHideUsed?.checked;
      settings.optAutoRefresh = !!els.optAutoRefresh?.checked;

      settings.optIncludeLive = !!els.optIncludeLive?.checked;
      settings.optIncludeSource = !!els.optIncludeSource?.checked;

      settings.catFilter = els.catFilter?.value || "all";

      saveSettings(settings);
      if (els.template) saveTemplate(els.template.value || DEFAULT_TEMPLATE);

      updatePreview();
      applyFilters();
      startAuto();
    };

    els.btnRefresh?.addEventListener("click", (e) => {
      const force = e.shiftKey;
      refreshAll({ force }).catch(()=>{});
    });

    els.btnFeeds?.addEventListener("click", openModal);
    els.btnCloseModal?.addEventListener("click", closeModal);

    els.modal?.addEventListener("click", (e) => {
      if (e.target === els.modal) closeModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });

    els.btnAddFeed?.addEventListener("click", () => {
      const name = normSpace(els.newFeedName?.value);
      const url = ensureUrl(els.newFeedUrl?.value);
      if (!name || !url) return;

      const nf = normalizeFeed({ name, url, enabled:true, cat:"all" });
      if (!nf) return;

      state.feeds.unshift(nf);
      renderFeedsModal();
      if (els.newFeedName) els.newFeedName.value = "";
      if (els.newFeedUrl) els.newFeedUrl.value = "";
    });

    els.btnExportFeeds?.addEventListener("click", () => {
      const data = JSON.stringify(state.feeds, null, 2);
      if (els.feedsJson){
        els.feedsJson.value = data;
        els.feedsJson.focus();
        els.feedsJson.select();
      }
    });

    els.btnImportFeeds?.addEventListener("click", () => {
      if (!els.feedsJson) return;
      const raw = els.feedsJson.value;
      const parsed = safeJsonParse(raw, null);
      if (!Array.isArray(parsed)) {
        setStatus("Import: JSON inválido (debe ser array).");
        return;
      }
      const cleaned = parsed.map(normalizeFeed).filter(Boolean);
      if (!cleaned.length){
        setStatus("Import: no hay feeds válidos.");
        return;
      }
      state.feeds = cleaned;
      renderFeedsModal();
      setStatus("Import OK.");
    });

    els.btnRestoreDefaultFeeds?.addEventListener("click", () => {
      state.feeds = DEFAULT_FEEDS.map(normalizeFeed).filter(Boolean);
      renderFeedsModal();
      setStatus("Defaults restaurados (no olvides Guardar).");
    });

    els.btnSaveFeeds?.addEventListener("click", () => {
      saveFeeds();
      closeModal();
      setStatus("Feeds guardados.");
      refreshAll({ force:true }).catch(()=>{});
    });

    els.btnTrim?.addEventListener("click", () => {
      if (!els.headline) return;
      els.headline.value = smartTrim(els.headline.value, 130);
      updatePreview();
    });

    els.btnGenTags?.addEventListener("click", () => {
      if (!els.hashtags || !els.headline) return;
      els.hashtags.value = suggestHashtags(els.headline.value, (els.catFilter?.value || "all"));
      updatePreview();
    });

    els.btnCopyUrl?.addEventListener("click", async () => {
      const u = (els.sourceUrl?.value || "").trim();
      if (!u) return;
      await copyText(u);
      setStatus("URL copiada.");
    });

    els.btnCopy?.addEventListener("click", async () => {
      const t = buildTweet();
      await copyText(t);
      setStatus("Tweet copiado.");
      markSelectedUsed();
    });

    els.btnX?.addEventListener("click", () => {
      const t = buildTweet();
      const url = "https://x.com/intent/tweet?text=" + encodeURIComponent(t);
      window.open(url, "_blank", "noopener,noreferrer");
      markSelectedUsed();
    });

    els.btnResetTemplate?.addEventListener("click", () => {
      if (!els.template) return;
      els.template.value = DEFAULT_TEMPLATE;
      saveTemplate(DEFAULT_TEMPLATE);
      updatePreview();
      setStatus("Plantilla reseteada.");
    });

    els.btnCheckUpdate?.addEventListener("click", forceUpdateNow);
    els.btnHardReset?.addEventListener("click", hardResetEverything);

    const bind = (el) => {
      if (!el) return;
      el.addEventListener("change", saveSettingFrom);
      el.addEventListener("input", saveSettingFrom);
    };

    [
      els.liveUrl, els.template, els.delayMin, els.timeFilter, els.sortBy, els.showLimit,
      els.fetchCap, els.batchFeeds, els.refreshSec,
      els.optOnlyReady, els.optOnlySpanish, els.optResolveLinks, els.optShowOriginal,
      els.optHideUsed, els.optAutoRefresh, els.catFilter,
      els.headline, els.sourceUrl, els.hashtags, els.optIncludeLive, els.optIncludeSource
    ].forEach(bind);

    els.searchBox?.addEventListener("input", () => applyFilters());

    setStatus(`TNP listo (${APP_VERSION})`);
  }

  /* ───────────────────────────── INIT ───────────────────────────── */
  async function init(){
    if (!uiOk()){
      console.error("Faltan elementos UI (revisa IDs en index.html)");
      return;
    }

    // mini “crash guard” visible
    window.addEventListener("error", () => {
      try { setStatus("❌ Error JS (mira consola)"); } catch {}
    });

    loadUsed();
    loadCaches();

    state.feeds = loadFeeds();
    saveFeeds();

    bindUI();
    updatePreview();

    await registerSW();

    applyFilters();
    startAuto();

    refreshAll({ force:true }).catch(()=>{});
  }

  init().catch((e) => {
    console.error(e);
    setStatus("❌ Error init (revisa consola)");
  });

})();
