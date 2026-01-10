/* app.js — TNP v4.1.1 — DIRECT RSS + HARDENED (NO Google por defecto)
   ✅ FIX: defaults RSS se guardan si faltan / están vacíos
   ✅ FIX: modal se puede cerrar SIEMPRE (soporta .hidden y [hidden])
   ✅ RSS directos (100+) + rendimiento (batch/backoff/abort)
   ✅ Imágenes: RSS (media/enclosure) + OG best-effort (jina)
*/

(() => {
  "use strict";

  const APP_VERSION = "tnp-v4.1.1";

  /* ───────────────────────────── STORAGE ───────────────────────────── */
  const LS_FEEDS    = "tnp_feeds_v4";
  const LS_TEMPLATE = "tnp_template_v4";
  const LS_SETTINGS = "tnp_settings_v4";
  const LS_USED     = "tnp_used_v4";

  const LS_TR_CACHE      = "tnp_tr_cache_v4";
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
    // FNV-1a simple
    let h = 2166136261;
    for (let i=0;i<base.length;i++){
      h ^= base.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
  }

  function isLikelySpanish(text){
    const t = (text || "").toLowerCase();
    if (!t) return false;
    if (/[áéíóúñü¿¡]/.test(t)) return true;
    const hits = [" el ", " la ", " de ", " que ", " y ", " en ", " para ", " según ", " hoy ", " gobierno", " policía", " juez", " tribunal"];
    let c = 0;
    for (const w of hits) if (t.includes(w)) c++;
    return c >= 2;
  }

  function scoreImpact(item){
    const ageM = minutesAgo(item.ts || nowMs());
    let s = 0;
    if (ageM <= 5) s += 6;
    else if (ageM <= 10) s += 5;
    else if (ageM <= 30) s += 4;
    else if (ageM <= 60) s += 3;
    else if (ageM <= 180) s += 2;
    else s += 1;

    const t = (item.titleEs || item.title || "").toLowerCase();
    const kw = [
      ["última hora", 5], ["breaking", 4], ["alerta", 4], ["explos", 4], ["ataque", 4],
      ["terrem", 4], ["muerto", 4], ["fallec", 4], ["herido", 3], ["incend", 3],
      ["otan", 3], ["ucrania", 3], ["misil", 3], ["rusia", 3], ["israel", 3], ["gaza", 3],
      ["juicio", 3], ["deten", 3], ["conden", 3], ["dimis", 3], ["crisis", 3],
      ["amenaza", 3], ["sancion", 3], ["evac", 3], ["apagón", 3], ["cierre", 2]
    ];
    for (const [k,w] of kw) if (t.includes(k)) s += w;

    const d = (item.domain || "").toLowerCase();
    if (d.includes("reuters")) s += 2;
    if (d.includes("bbc")) s += 2;
    if (d.includes("elpais")) s += 1;
    if (d.includes("rtve")) s += 1;

    return s;
  }

  function guessCategory(title, feedUrl){
    const t = (title || "").toLowerCase();
    const u = (feedUrl || "").toLowerCase();

    if (/(otan|nato|ucrania|ukraine|rusia|russia|guerra|war|misil|missile)/.test(t) || /(otan|ucrania|nato)/.test(u)) return "war";
    if (/(elecciones|gobierno|congreso|parlamento|ministro|presidente|senado|partido|política)/.test(t)) return "politics";
    if (/(bolsa|ibex|economía|inflación|eur|dólar|deuda|pib|banco|mercados)/.test(t)) return "economy";
    if (/(openai|ia|ai|google|microsoft|apple|ciber|hack|brecha|malware|chip)/.test(t)) return "tech";
    if (/(asesin|tiroteo|polic|crimen|robo|deten|prisión|juez|tribunal|condena|violencia)/.test(t)) return "crime";
    if (/(salud|hospital|virus|covid|gripe|vacuna)/.test(t)) return "health";
    if (/(fútbol|liga|nba|tenis|sport|champions|mundial|copa)/.test(t)) return "sports";
    if (/(cine|serie|netflix|música|famos|festival|televisión|oscar)/.test(t)) return "ent";

    // por feed
    if (/(rtve\.es).*mundo/.test(u) || /bbc|reuters|aljazeera|france24|dw/.test(u)) return "world";
    if (/(rtve\.es).*espana|elpais|elmundo|abc\.es|lavanguardia|eldiario|20minutos/.test(u)) return "spain";

    return "all";
  }

  /* ───────────────────────────── DEFAULT FEEDS (100+ RSS directos) ───────────────────────────── */
  const DEFAULT_FEEDS = [
    // ESPAÑA (enabled)
    { name:"RTVE — Noticias", url:"https://www.rtve.es/rss/temas_noticias.xml", enabled:true,  cat:"spain" },
    { name:"RTVE — España",  url:"https://www.rtve.es/rss/temas_espana.xml",   enabled:true,  cat:"spain" },
    { name:"RTVE — Economía",url:"https://www.rtve.es/rss/temas_economia.xml", enabled:true,  cat:"economy" },
    { name:"RTVE — Mundo",   url:"https://www.rtve.es/rss/temas_mundo.xml",    enabled:true,  cat:"world" },

    { name:"El País — Portada (MRSS)", url:"https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada", enabled:true, cat:"spain" },
    { name:"El País — Últimas (MRSS)", url:"https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/ultimas-noticias/portada", enabled:true, cat:"spain" },

    { name:"El Mundo — Portada (RSS)", url:"https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml", enabled:true, cat:"spain" },
    { name:"ABC — Portada (RSS)", url:"https://www.abc.es/rss/feeds/abcPortada.xml", enabled:true, cat:"spain" },
    { name:"20minutos — Portada (RSS)", url:"https://www.20minutos.es/rss/", enabled:true, cat:"spain" },

    { name:"El Confidencial — España (RSS)", url:"https://rss.elconfidencial.com/espana/", enabled:true, cat:"spain" },
    { name:"El Confidencial — Mundo (RSS)",  url:"https://rss.elconfidencial.com/mundo/",  enabled:true, cat:"world" },
    { name:"El Confidencial — Economía (RSS)", url:"https://rss.elconfidencial.com/economia/", enabled:true, cat:"economy" },
    { name:"El Confidencial — Sucesos (RSS)", url:"https://rss.elconfidencial.com/espana/sucesos/", enabled:true, cat:"crime" },

    { name:"Europa Press — Portada (RSS)", url:"https://www.europapress.es/rss/rss.aspx?ch=69", enabled:true, cat:"spain" },
    { name:"Europa Press — Nacional (RSS)", url:"https://www.europapress.es/rss/rss.aspx?ch=66", enabled:true, cat:"spain" },
    { name:"Europa Press — Internacional (RSS)", url:"https://www.europapress.es/rss/rss.aspx?ch=67", enabled:true, cat:"world" },
    { name:"Europa Press — Economía (RSS)", url:"https://www.europapress.es/rss/rss.aspx?ch=136", enabled:true, cat:"economy" },

    { name:"La Vanguardia — Portada (RSS)", url:"https://www.lavanguardia.com/rss/home.xml", enabled:true, cat:"spain" },
    { name:"eldiario.es — Portada (RSS)", url:"https://www.eldiario.es/rss/", enabled:true, cat:"spain" },

    // INTERNACIONAL (enabled)
    { name:"Reuters — Top News (RSS)", url:"https://feeds.reuters.com/reuters/topNews", enabled:true, cat:"world" },
    { name:"BBC — World (RSS)", url:"https://feeds.bbci.co.uk/news/world/rss.xml", enabled:true, cat:"world" },
    { name:"DW Español (RSS)", url:"https://rss.dw.com/rdf/rss-es-all", enabled:true, cat:"world" },
    { name:"France 24 — ES (RSS)", url:"https://www.france24.com/es/rss", enabled:true, cat:"world" },
    { name:"Euronews — ES (MRSS)", url:"https://www.euronews.com/rss?format=mrss", enabled:true, cat:"world" },
    { name:"Al Jazeera — All (RSS)", url:"https://www.aljazeera.com/xml/rss/all.xml", enabled:true, cat:"world" },

    // TECH (enabled)
    { name:"Xataka (RSS)", url:"https://feeds.weblogssl.com/xataka2", enabled:true, cat:"tech" },
    { name:"Genbeta (RSS)", url:"https://feeds.weblogssl.com/genbeta", enabled:true, cat:"tech" },
    { name:"Ars Technica (RSS)", url:"https://feeds.arstechnica.com/arstechnica/index", enabled:true, cat:"tech" },
    { name:"The Verge (RSS)", url:"https://www.theverge.com/rss/index.xml", enabled:true, cat:"tech" },

    // ECONOMÍA (enabled)
    { name:"El Blog Salmón (RSS)", url:"https://feeds.weblogssl.com/elblogsalmon", enabled:true, cat:"economy" },
    { name:"Expansión — Portada (RSS)", url:"https://e00-expansion.uecdn.es/rss/portada.xml", enabled:true, cat:"economy" },

    // ───── (A partir de aquí: muchísimos más, la mayoría OFF por rendimiento) ─────
    // España OFF / secciones
    { name:"El País — Economía (MRSS) [OFF]", url:"https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/economia/portada", enabled:false, cat:"economy" },
    { name:"El País — Internacional (MRSS) [OFF]", url:"https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/internacional/portada", enabled:false, cat:"world" },
    { name:"El Mundo — Economía (RSS) [OFF]", url:"https://e00-elmundo.uecdn.es/elmundo/rss/economia.xml", enabled:false, cat:"economy" },
    { name:"El Mundo — Internacional (RSS) [OFF]", url:"https://e00-elmundo.uecdn.es/elmundo/rss/internacional.xml", enabled:false, cat:"world" },
    { name:"El Mundo — España (RSS) [OFF]", url:"https://e00-elmundo.uecdn.es/elmundo/rss/espana.xml", enabled:false, cat:"spain" },

    { name:"ABC — España (RSS) [OFF]", url:"https://www.abc.es/rss/feeds/abcEspana.xml", enabled:false, cat:"spain" },
    { name:"ABC — Internacional (RSS) [OFF]", url:"https://www.abc.es/rss/feeds/abcInternacional.xml", enabled:false, cat:"world" },
    { name:"ABC — Economía (RSS) [OFF]", url:"https://www.abc.es/rss/feeds/abcEconomia.xml", enabled:false, cat:"economy" },

    { name:"La Vanguardia — Política (RSS) [OFF]", url:"https://www.lavanguardia.com/rss/politica.xml", enabled:false, cat:"politics" },
    { name:"La Vanguardia — Economía (RSS) [OFF]", url:"https://www.lavanguardia.com/rss/economia.xml", enabled:false, cat:"economy" },
    { name:"La Vanguardia — Internacional (RSS) [OFF]", url:"https://www.lavanguardia.com/rss/internacional.xml", enabled:false, cat:"world" },

    { name:"Público — Portada (RSS) [OFF]", url:"https://www.publico.es/rss", enabled:false, cat:"spain" },
    { name:"ElEconomista — Portada (RSS) [OFF]", url:"https://www.eleconomista.es/rss/rss.xml", enabled:false, cat:"economy" },
    { name:"Cinco Días — Portada (RSS) [OFF]", url:"https://feeds.elpais.com/mrss-s/pages/ep/site/cincodias.elpais.com/portada", enabled:false, cat:"economy" },

    // Internacional OFF
    { name:"NYTimes — World (RSS) [OFF]", url:"https://rss.nytimes.com/services/xml/rss/nyt/World.xml", enabled:false, cat:"world" },
    { name:"NYTimes — Business (RSS) [OFF]", url:"https://rss.nytimes.com/services/xml/rss/nyt/Business.xml", enabled:false, cat:"economy" },
    { name:"The Guardian — World (RSS) [OFF]", url:"https://www.theguardian.com/world/rss", enabled:false, cat:"world" },
    { name:"The Guardian — Politics (RSS) [OFF]", url:"https://www.theguardian.com/politics/rss", enabled:false, cat:"politics" },
    { name:"The Guardian — Technology (RSS) [OFF]", url:"https://www.theguardian.com/uk/technology/rss", enabled:false, cat:"tech" },

    { name:"CNN — World (RSS) [OFF]", url:"https://rss.cnn.com/rss/edition_world.rss", enabled:false, cat:"world" },
    { name:"CNN — Business (RSS) [OFF]", url:"https://rss.cnn.com/rss/money_latest.rss", enabled:false, cat:"economy" },

    { name:"Sky News — UK (RSS) [OFF]", url:"https://feeds.skynews.com/feeds/rss/uk.xml", enabled:false, cat:"world" },
    { name:"Sky News — World (RSS) [OFF]", url:"https://feeds.skynews.com/feeds/rss/world.xml", enabled:false, cat:"world" },

    // Tech OFF
    { name:"TechCrunch (RSS) [OFF]", url:"https://techcrunch.com/feed/", enabled:false, cat:"tech" },
    { name:"Wired (RSS) [OFF]", url:"https://www.wired.com/feed/rss", enabled:false, cat:"tech" },
    { name:"Engadget (RSS) [OFF]", url:"https://www.engadget.com/rss.xml", enabled:false, cat:"tech" },

    // Deportes OFF
    { name:"Marca — Portada (RSS) [OFF]", url:"https://e00-marca.uecdn.es/rss/portada.xml", enabled:false, cat:"sports" },
    { name:"AS — Portada (RSS) [OFF]", url:"https://as.com/rss/tags/ultimas_noticias.xml", enabled:false, cat:"sports" },

    // Salud OFF
    { name:"OMS — Noticias (RSS) [OFF]", url:"https://www.who.int/rss-feeds/news-english.xml", enabled:false, cat:"health" },

    // Extra: para completar 100+ (OFF)
    { name:"Politico — Top (RSS) [OFF]", url:"https://www.politico.com/rss/politicopicks.xml", enabled:false, cat:"politics" },
    { name:"NPR — News (RSS) [OFF]", url:"https://feeds.npr.org/1001/rss.xml", enabled:false, cat:"world" },
    { name:"AP News — Top (RSS) [OFF]", url:"https://apnews.com/rss", enabled:false, cat:"world" },

    // (si alguno no funciona, no rompe: se backoffea)
  ];

  /* ───────────────────────────── STATE ───────────────────────────── */
  const state = {
    feeds: [],
    items: [],
    filtered: [],
    selectedId: null,

    used: new Set(),

    refreshInFlight: false,
    refreshAbort: null,

    // caches
    trCache: new Map(),
    resolveCache: new Map(),
    ogCache: new Map(),

    // backoff por feedUrl
    feedBackoff: new Map(),

    // ui
    tickerTimer: null,
    trendsTimer: null,
  };

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

  /* ───────────────────────────── SETTINGS ───────────────────────────── */
  function loadSettings(){
    const s = safeJsonParse(localStorage.getItem(LS_SETTINGS), {});
    s.liveUrl = s.liveUrl || "https://twitch.tv/globaleyetv";
    s.delayMin = Number.isFinite(s.delayMin) ? s.delayMin : 0;
    s.timeFilter = Number.isFinite(s.timeFilter) ? s.timeFilter : 60;
    s.sortBy = s.sortBy || "impact";
    s.showLimit = Number.isFinite(s.showLimit) ? s.showLimit : 120;
    s.fetchCap = Number.isFinite(s.fetchCap) ? s.fetchCap : 240;
    s.batchFeeds = Number.isFinite(s.batchFeeds) ? s.batchFeeds : 12;
    s.refreshSec = Number.isFinite(s.refreshSec) ? s.refreshSec : 60;

    s.optOnlyReady = (s.optOnlyReady === true);
    s.optOnlySpanish = (s.optOnlySpanish !== false);
    s.optResolveLinks = (s.optResolveLinks !== false);
    s.optShowOriginal = (s.optShowOriginal !== false);
    s.optHideUsed = (s.optHideUsed !== false);
    s.optAutoRefresh = (s.optAutoRefresh !== false);

    s.catFilter = s.catFilter || "all";
    return s;
  }

  const settings = loadSettings();

  function saveSettings(){
    localStorage.setItem(LS_SETTINGS, JSON.stringify(settings));
  }

  function loadTemplate(){
    const t = localStorage.getItem(LS_TEMPLATE);
    return (t && t.trim()) ? t : DEFAULT_TEMPLATE;
  }

  function saveTemplate(t){
    localStorage.setItem(LS_TEMPLATE, t);
  }

  function loadUsed(){
    const arr = safeJsonParse(localStorage.getItem(LS_USED), []);
    state.used = new Set(Array.isArray(arr) ? arr : []);
  }

  function saveUsed(){
    localStorage.setItem(LS_USED, JSON.stringify(Array.from(state.used).slice(0, 5000)));
  }

  function loadCaches(){
    const tr = safeJsonParse(localStorage.getItem(LS_TR_CACHE), {});
    if (tr && typeof tr === "object"){
      for (const [k,v] of Object.entries(tr)){
        if (typeof v === "string") state.trCache.set(k, v);
      }
    }
    const rs = safeJsonParse(localStorage.getItem(LS_RESOLVE_CACHE), {});
    if (rs && typeof rs === "object"){
      for (const [k,v] of Object.entries(rs)){
        if (typeof v === "string") state.resolveCache.set(k, v);
      }
    }
    const og = safeJsonParse(localStorage.getItem(LS_OG_CACHE), {});
    if (og && typeof og === "object"){
      for (const [k,v] of Object.entries(og)){
        if (v && typeof v === "object") state.ogCache.set(k, v);
      }
    }
  }

  function saveCaches(){
    // tr
    const trOut = {};
    let i = 0;
    for (const [k,v] of state.trCache.entries()){
      trOut[k] = v;
      if (++i > 1500) break;
    }
    localStorage.setItem(LS_TR_CACHE, JSON.stringify(trOut));

    // resolve
    const rsOut = {};
    i = 0;
    for (const [k,v] of state.resolveCache.entries()){
      rsOut[k] = v;
      if (++i > 2000) break;
    }
    localStorage.setItem(LS_RESOLVE_CACHE, JSON.stringify(rsOut));

    // og
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

    // si existe y tiene contenido válido
    if (Array.isArray(saved)){
      const cleaned = saved.map(normalizeFeed).filter(Boolean);

      // si te quedaste con [] (vacío/corrupto), restauramos defaults
      if (!cleaned.length){
        const d = DEFAULT_FEEDS.map(x => ({...x, url: ensureUrl(x.url)})).filter(f => isHttpUrl(f.url));
        localStorage.setItem(LS_FEEDS, JSON.stringify(d));
        return d;
      }

      // persistimos “limpio” por si venía raro
      localStorage.setItem(LS_FEEDS, JSON.stringify(cleaned));
      return cleaned;
    }

    // no hay nada: defaults + guardado
    const defaults = DEFAULT_FEEDS.map(x => ({...x, url: ensureUrl(x.url)})).filter(f => isHttpUrl(f.url));
    localStorage.setItem(LS_FEEDS, JSON.stringify(defaults));
    return defaults;
  }

  function saveFeeds(){
    localStorage.setItem(LS_FEEDS, JSON.stringify(state.feeds));
  }

  /* ───────────────────────────── MODAL (FIX .hidden + [hidden]) ───────────────────────────── */
  function setModalOpen(open){
    if (!els.modal) return;
    // class hidden
    els.modal.classList.toggle("hidden", !open);
    // atributo hidden
    els.modal.hidden = !open;
    // aria
    els.modal.setAttribute("aria-hidden", open ? "false" : "true");
  }

  function openModal(){
    renderFeedsModal();
    els.feedsJson.value = "";
    setModalOpen(true);
  }

  function closeModal(){
    setModalOpen(false);
  }

  function renderFeedsModal(){
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

      meta.append(name, url);

      const cat = document.createElement("span");
      cat.className = "badge";
      cat.textContent = f.cat || "all";

      const del = document.createElement("button");
      del.className = "btn btn--sm btn--danger";
      del.textContent = "Borrar";
      del.addEventListener("click", () => {
        state.feeds.splice(i,1);
        renderFeedsModal();
      });

      row.append(cb, meta, cat, del);
      els.feedList.appendChild(row);
    }
  }

  /* ───────────────────────────── FETCH (ANTI-CORS) ───────────────────────────── */
  function anySignal(signals){
    const out = new AbortController();
    const onAbort = () => out.abort("any-abort");
    for (const s of signals){
      if (!s) continue;
      if (s.aborted){ out.abort("any-abort"); break; }
      s.addEventListener("abort", onAbort, { once:true });
    }
    return out.signal;
  }

  async function fetchTextSmart(url, { timeoutMs=12000, signal } = {}){
    const controllers = [];

    const withTimeout = () => {
      const c = new AbortController();
      controllers.push(c);
      const t = setTimeout(() => c.abort("timeout"), timeoutMs);
      return { c, t };
    };

    const stopAll = () => { for (const c of controllers) c.abort("cascade"); };

    const tryFetch = async (makeUrl) => {
      const { c, t } = withTimeout();
      const chained = signal ? anySignal([signal, c.signal]) : c.signal;
      try{
        const u = makeUrl(url);
        const res = await fetch(u, {
          signal: chained,
          cache: "no-store",
          headers: { "Accept": "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5" }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const txt = await res.text();
        if (!txt || txt.length < 20) throw new Error("empty");
        return txt;
      } finally {
        clearTimeout(t);
      }
    };

    const tries = [
      (u)=>u,
      (u)=>`https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
      (u)=>`https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}`,
      (u)=>`https://thingproxy.freeboard.io/fetch/${u}`,
    ];

    let lastErr = null;
    for (const fn of tries){
      try{
        const txt = await tryFetch(fn);
        stopAll();
        return txt;
      }catch(e){
        lastErr = e;
      }
    }
    throw lastErr || new Error("fetch failed");
  }

  /* ───────────────────────────── PARSE RSS/ATOM ───────────────────────────── */
  function parseXml(txt){
    const p = new DOMParser();
    const doc = p.parseFromString(txt, "text/xml");
    if (doc.querySelector("parsererror")) return null;
    return doc;
  }

  function pickText(el, sel){
    const n = el.querySelector(sel);
    return n ? normSpace(n.textContent) : "";
  }

  function parseDate(s){
    const t = Date.parse(s || "");
    return Number.isFinite(t) ? t : nowMs();
  }

  function extractImageFromItem(itemEl){
    const m1 = itemEl.querySelector("media\\:content, content");
    if (m1){
      const u = m1.getAttribute("url") || "";
      const type = (m1.getAttribute("type") || "").toLowerCase();
      if (u && (!type || type.startsWith("image/"))) return u;
    }
    const m2 = itemEl.querySelector("media\\:thumbnail, thumbnail");
    if (m2){
      const u = m2.getAttribute("url") || "";
      if (u) return u;
    }
    const enc = itemEl.querySelector("enclosure");
    if (enc){
      const u = enc.getAttribute("url") || "";
      const type = (enc.getAttribute("type") || "").toLowerCase();
      if (u && (!type || type.startsWith("image/"))) return u;
    }
    const ce = itemEl.querySelector("content\\:encoded, encoded");
    if (ce){
      const html = ce.textContent || "";
      const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (m && m[1]) return m[1];
    }
    const desc = itemEl.querySelector("description");
    if (desc){
      const html = desc.textContent || "";
      const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (m && m[1]) return m[1];
    }
    return "";
  }

  function normalizeItem(x){
    const title = normSpace(x.title);
    const link = normSpace(x.link);
    if (!title || !link) return null;

    return {
      id: x.id,
      feedName: x.feedName,
      feedUrl: x.feedUrl,
      cat: x.cat || "all",

      title,
      titleEs: "",

      link,
      resolvedUrl: "",
      domain: domainOf(link),

      ts: x.ts,
      desc: x.desc || "",
      rssImage: x.rssImage || "",
      ogImage: "",

      impact: 0,
      ready: false,
    };
  }

  function parseFeedText(feedText, feed){
    const doc = parseXml(feedText);
    if (!doc) return [];

    const out = [];

    const rssItems = Array.from(doc.querySelectorAll("item"));
    if (rssItems.length){
      for (const it of rssItems){
        const title = pickText(it, "title") || "(sin título)";
        let link = pickText(it, "link");
        if (!link){
          const a = it.querySelector("link");
          link = a ? (a.getAttribute("href") || "") : "";
        }
        const guid = pickText(it, "guid");
        if ((!link || link.length < 8) && guid && /^https?:\/\//i.test(guid)) link = guid;

        const pub = pickText(it, "pubDate") || pickText(it, "dc\\:date") || pickText(it, "date");
        const ts = parseDate(pub);

        const desc = stripHtml(pickText(it, "description"));
        const img = extractImageFromItem(it);

        const id = makeId(feed.name, link, ts, title);

        const item = normalizeItem({
          id,
          feedName: feed.name,
          feedUrl: feed.url,
          cat: feed.cat || guessCategory(title, feed.url),
          title,
          link,
          ts,
          desc,
          rssImage: img,
        });

        if (item) out.push(item);
      }
      return out;
    }

    const entries = Array.from(doc.querySelectorAll("entry"));
    if (entries.length){
      for (const e of entries){
        const title = pickText(e, "title") || "(sin título)";
        let link = "";
        const linkEl = e.querySelector("link[rel='alternate']") || e.querySelector("link");
        if (linkEl) link = linkEl.getAttribute("href") || "";

        const pub = pickText(e, "updated") || pickText(e, "published");
        const ts = parseDate(pub);
        const desc = stripHtml(pickText(e, "summary") || pickText(e, "content"));
        const img = extractImageFromItem(e);

        const id = makeId(feed.name, link, ts, title);

        const item = normalizeItem({
          id,
          feedName: feed.name,
          feedUrl: feed.url,
          cat: feed.cat || guessCategory(title, feed.url),
          title,
          link,
          ts,
          desc,
          rssImage: img,
        });

        if (item) out.push(item);
      }
      return out;
    }

    return [];
  }

  /* ───────────────────────────── RESOLVE / OG (best effort) ───────────────────────────── */
  function isGoogleNewsUrl(u){
    try{
      const x = new URL(u);
      return x.hostname.includes("news.google.");
    }catch{ return false; }
  }

  async function resolveGoogleNewsLink(u, signal){
    if (!u || !isGoogleNewsUrl(u)) return u;

    const cached = state.resolveCache.get(u);
    if (cached) return cached;

    // 1) url= param
    try{
      const x = new URL(u);
      const urlParam = x.searchParams.get("url");
      if (urlParam && /^https?:\/\//i.test(urlParam)){
        state.resolveCache.set(u, urlParam);
        return urlParam;
      }
    }catch{}

    // 2) fetch HTML via jina y sacar primera URL externa
    try{
      const raw = await fetchTextSmart(`https://r.jina.ai/http://${u.replace(/^https?:\/\//i,"")}`, { timeoutMs: 9000, signal });
      const m = raw.match(/https?:\/\/(?!news\.google\.|accounts\.google\.|www\.google\.)[^\s"'<>]+/i);
      if (m && m[0]){
        state.resolveCache.set(u, m[0]);
        return m[0];
      }
    }catch{}

    // fallback: lo dejamos igual
    return u;
  }

  async function fetchOgMeta(url, signal){
    if (!url) return null;

    const cached = state.ogCache.get(url);
    if (cached) return cached;

    try{
      const raw = await fetchTextSmart(`https://r.jina.ai/http://${url.replace(/^https?:\/\//i,"")}`, { timeoutMs: 9000, signal });
      const pick = (re) => {
        const m = raw.match(re);
        return m && m[1] ? m[1].trim() : "";
      };

      const ogImage =
        pick(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
        pick(/name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i) ||
        pick(/property=["']og:image:url["'][^>]*content=["']([^"']+)["']/i);

      const canon =
        pick(/rel=["']canonical["'][^>]*href=["']([^"']+)["']/i) ||
        pick(/property=["']og:url["'][^>]*content=["']([^"']+)["']/i);

      const meta = { ogImage, canon };
      state.ogCache.set(url, meta);
      return meta;
    }catch{
      return null;
    }
  }

  /* ───────────────────────────── TRANSLATE (best effort) ───────────────────────────── */
  async function translateToEs(text, signal){
    text = normSpace(text);
    if (!text) return "";

    const key = "es|" + text;
    if (state.trCache.has(key)) return state.trCache.get(key);

    // endpoint simple sin key (a veces falla por CORS -> no rompe)
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=es&dt=t&q=${encodeURIComponent(text)}`;

    try{
      const res = await fetch(url, { cache:"no-store", signal });
      if (!res.ok) throw new Error("tr http " + res.status);
      const j = await res.json();
      const out = Array.isArray(j) && Array.isArray(j[0]) ? j[0].map(x => x?.[0] || "").join("") : "";
      const tr = normSpace(out) || text;
      state.trCache.set(key, tr);
      return tr;
    }catch{
      // fallback: original
      state.trCache.set(key, text);
      return text;
    }
  }

  /* ───────────────────────────── FILTER + RENDER ───────────────────────────── */
  function computeReady(item){
    const urlOk = settings.optResolveLinks ? !!(item.resolvedUrl || item.link) : true;
    const langOk = settings.optOnlySpanish ? isLikelySpanish(item.titleEs || item.title) : true;
    return urlOk && langOk;
  }

  function applyFilters(){
    const tf = clamp(Number(els.timeFilter.value || settings.timeFilter), 1, 10080);
    const delay = clamp(Number(els.delayMin.value || settings.delayMin), 0, 180);
    const q = (els.searchBox.value || "").toLowerCase().trim();
    const cat = els.catFilter.value || "all";
    const hideUsed = !!els.optHideUsed.checked;

    const minTs = nowMs() - tf*60000;
    const maxTs = nowMs() - delay*60000;

    let items = state.items.filter(it => it.ts >= minTs && it.ts <= maxTs);

    if (q){
      items = items.filter(it => (it.titleEs || it.title).toLowerCase().includes(q) || (it.domain || "").includes(q));
    }

    if (cat !== "all"){
      items = items.filter(it => (it.cat || "all") === cat);
    }

    if (hideUsed){
      items = items.filter(it => !state.used.has(it.id));
    }

    // compute readiness
    for (const it of items){
      it.ready = computeReady(it);
    }

    if (els.optOnlyReady.checked){
      items = items.filter(it => it.ready);
    }

    // sort
    const sortBy = els.sortBy.value || "impact";
    if (sortBy === "recent"){
      items.sort((a,b) => (b.ts - a.ts) || (b.impact - a.impact));
    }else{
      items.sort((a,b) => (b.impact - a.impact) || (b.ts - a.ts));
    }

    // limit
    const limit = clamp(Number(els.showLimit.value || settings.showLimit), 10, 500);
    state.filtered = items.slice(0, limit);

    renderNewsList();
    renderTickerAndTrends();
  }

  function renderNewsList(){
    const list = els.newsList;
    list.innerHTML = "";

    if (!state.filtered.length){
      const empty = document.createElement("div");
      empty.className = "newsItem";
      empty.style.cursor = "default";
      empty.innerHTML = `<div class="newsMain"><div class="newsTitle">Sin noticias aún</div><div class="newsMeta">Prueba “Refrescar” o activa más feeds.</div></div>`;
      list.appendChild(empty);
      return;
    }

    const frag = document.createDocumentFragment();

    for (const it of state.filtered){
      const row = document.createElement("div");
      row.className = "newsItem" + (it.id === state.selectedId ? " active" : "");
      row.addEventListener("click", () => selectItem(it.id));

      const thumb = document.createElement("div");
      thumb.className = "thumb";

      const imgUrl = it.ogImage || it.rssImage;
      if (imgUrl){
        const img = document.createElement("img");
        img.loading = "lazy";
        img.decoding = "async";
        img.referrerPolicy = "no-referrer";
        img.src = imgUrl;
        img.onerror = () => { thumb.textContent = "IMG"; img.remove(); };
        thumb.appendChild(img);
      } else {
        thumb.textContent = "IMG";
      }

      const main = document.createElement("div");
      main.className = "newsMain";

      const title = document.createElement("div");
      title.className = "newsTitle";
      title.textContent = it.titleEs || it.title;

      const meta = document.createElement("div");
      meta.className = "newsMeta";

      const kp1 = document.createElement("span");
      kp1.className = "kpill";
      kp1.textContent = `${fmtAge(it.ts)} · ${it.domain || "?"}`;

      const kp2 = document.createElement("span");
      kp2.className = "kpill";
      kp2.textContent = it.cat || "all";

      const kp3 = document.createElement("span");
      kp3.className = "kpill" + (it.ready ? " ready" : "");
      kp3.textContent = it.ready ? "LISTO" : "…";

      const kp4 = document.createElement("span");
      kp4.className = "kpill" + (it.impact >= 10 ? " hot" : "");
      kp4.textContent = it.impact >= 10 ? "🔥 TOP" : `IMP ${it.impact}`;

      meta.append(kp1, kp2, kp3, kp4);

      main.append(title, meta);
      row.append(thumb, main);
      frag.appendChild(row);
    }

    list.appendChild(frag);

    // hidrata un poco (no bloquea UI)
    hydrateTopVisible().catch(()=>{});
  }

  function renderTickerAndTrends(){
    const top = state.filtered.slice(0, 18);
    if (!top.length){
      els.tnpTickerInner.textContent = "Sin noticias…";
      return;
    }

    const text = top.map(x => (x.titleEs || x.title)).join("  •  ");
    els.tnpTickerInner.textContent = text;

    // trends: hashtags “best effort” desde titulares
    const tags = computeTrends(top);
    startTrendsPop(tags);
  }

  function computeTrends(items){
    const stop = new Set(["de","la","el","los","las","un","una","y","en","para","con","del","al","por","según","tras","ante","contra","hoy","última","hora"]);
    const map = new Map();

    for (const it of items){
      const t = (it.titleEs || it.title || "")
        .replace(/[^\p{L}\p{N}\s#]/gu, " ")
        .replace(/\s+/g," ")
        .trim();

      const words = t.split(" ").slice(0, 14);
      for (let w of words){
        w = w.trim();
        if (!w) continue;
        if (w.startsWith("#")){
          const k = w.toLowerCase();
          map.set(k, (map.get(k)||0)+3);
          continue;
        }
        const low = w.toLowerCase();
        if (low.length < 4) continue;
        if (stop.has(low)) continue;
        if (/^\d+$/.test(low)) continue;
        map.set(low, (map.get(low)||0)+1);
      }
    }

    const ranked = Array.from(map.entries())
      .sort((a,b)=>b[1]-a[1])
      .slice(0, 10)
      .map(([w]) => w.startsWith("#") ? w : ("#" + w.replace(/\s+/g,"")));

    // añade contexto
    if (!ranked.includes("#ÚltimaHora".toLowerCase())) ranked.unshift("#ÚltimaHora");
    return ranked.slice(0, 10);
  }

  function startTrendsPop(tags){
    if (state.trendsTimer) clearInterval(state.trendsTimer);

    if (!tags || !tags.length){
      els.tnpTrendsPop.classList.remove("on");
      els.tnpTrendsPop.setAttribute("aria-hidden","true");
      return;
    }

    let idx = 0;
    els.tnpTrendsPop.textContent = tags[idx];
    els.tnpTrendsPop.classList.add("on");
    els.tnpTrendsPop.setAttribute("aria-hidden","false");

    state.trendsTimer = setInterval(() => {
      idx = (idx + 1) % tags.length;
      els.tnpTrendsPop.textContent = tags[idx];
      els.tnpTrendsPop.classList.add("on");
    }, 4500);
  }

  function selectItem(id){
    const it = state.items.find(x => x.id === id) || state.filtered.find(x => x.id === id);
    if (!it) return;

    state.selectedId = id;

    const title = (it.titleEs || it.title || "").trim();
    els.headline.value = title;

    const src = settings.optShowOriginal ? (it.resolvedUrl || it.link) : it.link;
    els.sourceUrl.value = src;

    // auto tags ligeros
    els.hashtags.value = suggestHashtags(title, it.cat);

    renderPreview();
    applyFilters();
  }

  function suggestHashtags(title, cat){
    const base = ["#ÚltimaHora"];
    if (cat === "spain") base.push("#España");
    else if (cat === "world") base.push("#Mundo");
    else if (cat === "economy") base.push("#Economía");
    else if (cat === "tech") base.push("#Tech");
    else if (cat === "war") base.push("#Guerra");
    else if (cat === "crime") base.push("#Sucesos");

    // extra por palabras
    const words = title.split(/\s+/).map(w => w.replace(/[^\p{L}\p{N}]/gu,"")).filter(Boolean);
    const picks = [];
    for (const w of words){
      const low = w.toLowerCase();
      if (low.length < 6) continue;
      if (picks.length >= 2) break;
      picks.push("#" + w);
    }
    return [...base, ...picks].join(" ");
  }

  /* ───────────────────────────── PREVIEW / COPY ───────────────────────────── */
  function renderPreview(){
    const tpl = els.template.value || DEFAULT_TEMPLATE;
    const headline = normSpace(els.headline.value);
    const liveUrl = normSpace(els.liveUrl.value || settings.liveUrl);
    const sourceUrl = normSpace(els.sourceUrl.value);
    const tags = normSpace(els.hashtags.value);

    const liveLine = els.optIncludeLive.checked ? DEFAULT_LIVE_LINE.replace("{{LIVE_URL}}", liveUrl) : "";
    const out = tpl
      .replaceAll("{{HEADLINE}}", headline)
      .replaceAll("{{LIVE_URL}}", liveUrl)
      .replaceAll("{{LIVE_LINE}}", liveLine)
      .replaceAll("{{SOURCE_URL}}", sourceUrl)
      .replaceAll("{{HASHTAGS}}", tags);

    els.preview.value = out.replace(/\n{3,}/g,"\n\n").trim() + "\n";

    const len = els.preview.value.length;
    els.charCount.textContent = String(len);

    if (len > 280){
      els.warn.hidden = false;
      els.warn.textContent = `⚠️ Te pasas (${len}/280). Pulsa “Ajustar” o recorta el titular.`;
    } else {
      els.warn.hidden = true;
      els.warn.textContent = "";
    }
  }

  function smartTrim(){
    const maxHeadline = 140;
    let h = normSpace(els.headline.value);
    if (h.length > maxHeadline){
      h = h.slice(0, maxHeadline - 1).trim() + "…";
      els.headline.value = h;
    }
    renderPreview();
  }

  async function copyText(text){
    text = String(text || "");
    try{
      await navigator.clipboard.writeText(text);
      return true;
    }catch{
      // fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try{
        document.execCommand("copy");
        ta.remove();
        return true;
      }catch{
        ta.remove();
        return false;
      }
    }
  }

  function markUsedSelected(){
    if (!state.selectedId) return;
    state.used.add(state.selectedId);
    saveUsed();
  }

  /* ───────────────────────────── AUTO HYDRATE (resolve/og/translate) ───────────────────────────── */
  async function hydrateTopVisible(){
    const limit = 20;
    const batch = 2;

    const picks = state.filtered.slice(0, limit);

    const controller = new AbortController();
    const signal = controller.signal;

    let idx = 0;

    const worker = async () => {
      while (idx < picks.length){
        const i = idx++;
        const it = picks[i];

        // resolve
        if (settings.optResolveLinks && !it.resolvedUrl){
          const r = await resolveGoogleNewsLink(it.link, signal);
          it.resolvedUrl = r;
        }

        // translate
        if (settings.optOnlySpanish && !it.titleEs){
          const tr = await translateToEs(it.title, signal);
          it.titleEs = tr;
        }

        // impact
        it.impact = scoreImpact(it);

        // og if missing image
        if (!it.ogImage && !it.rssImage){
          const src = it.resolvedUrl || it.link;
          const meta = await fetchOgMeta(src, signal);
          if (meta?.ogImage) it.ogImage = meta.ogImage;
          if (meta?.canon && isHttpUrl(meta.canon)) it.resolvedUrl = it.resolvedUrl || meta.canon;
        }

        it.ready = computeReady(it);
      }
    };

    const workers = [];
    for (let k=0;k<batch;k++) workers.push(worker());
    await Promise.allSettled(workers);

    saveCaches();
    // re-render suave
    renderNewsList();
  }

  /* ───────────────────────────── REFRESH ───────────────────────────── */
  function setStatus(msg){
    els.status.textContent = msg;
  }

  function getBackoff(feedUrl){
    return state.feedBackoff.get(feedUrl) || { fails:0, nextTry:0 };
  }

  function setBackoff(feedUrl, fails, nextTry){
    state.feedBackoff.set(feedUrl, { fails, nextTry });
  }

  async function refreshAll({ force=false } = {}){
    if (state.refreshInFlight){
      if (force && state.refreshAbort){
        state.refreshAbort.abort("force");
      } else {
        return;
      }
    }

    const enabled = state.feeds.filter(f => f.enabled);

    // si no hay feeds enabled -> defaults (sin abrir modal)
    if (!enabled.length){
      state.feeds = DEFAULT_FEEDS.map(x => ({...x})).filter(f => isHttpUrl(ensureUrl(f.url))).map(f => ({...f, url: ensureUrl(f.url)}));
      saveFeeds();
      setStatus("⚠️ No había feeds activos → Defaults restaurados.");
    }

    state.refreshInFlight = true;
    const ac = new AbortController();
    state.refreshAbort = ac;

    const signal = ac.signal;

    const cap = clamp(Number(els.fetchCap.value || settings.fetchCap), 80, 3000);
    const batchSize = clamp(Number(els.batchFeeds.value || settings.batchFeeds), 4, 60);

    // reset backoff on force
    if (force){
      state.feedBackoff.clear();
    }

    setStatus(`⏳ Descargando feeds… (${enabled.length})`);
    const started = nowMs();

    const allItems = [];
    let okFeeds = 0;
    let skipped = 0;

    // batch feeds
    for (let i=0;i<enabled.length;i += batchSize){
      const chunk = enabled.slice(i, i+batchSize);

      const tasks = chunk.map(async (feed) => {
        const b = getBackoff(feed.url);
        if (!force && b.nextTry && nowMs() < b.nextTry){
          skipped++;
          return [];
        }

        try{
          const txt = await fetchTextSmart(feed.url, { timeoutMs: 12000, signal });
          const items = parseFeedText(txt, feed).filter(Boolean);

          okFeeds++;

          // backoff reset
          setBackoff(feed.url, 0, 0);

          return items;
        }catch{
          const prev = getBackoff(feed.url);
          const fails = clamp((prev.fails || 0) + 1, 1, 10);
          const waitMs = clamp(8000 * fails, 10000, 6*60*1000); // hasta 6 min
          setBackoff(feed.url, fails, nowMs() + waitMs);
          return [];
        }
      });

      const results = await Promise.allSettled(tasks);
      for (const r of results){
        if (r.status === "fulfilled" && Array.isArray(r.value)){
          allItems.push(...r.value);
        }
      }

      if (signal.aborted) break;

      // corte por cap
      if (allItems.length >= cap) break;

      // micro-respiro para UI
      await sleep(20);
    }

    // dedupe fuerte por link+title
    const map = new Map();
    for (const it of allItems){
      const key = (it.link || "") + "||" + (it.title || "");
      if (!key.trim()) continue;
      if (!map.has(key)) map.set(key, it);
    }

    const merged = Array.from(map.values());

    // impact base
    for (const it of merged){
      it.impact = scoreImpact(it);
    }

    // sort por reciente para base
    merged.sort((a,b) => (b.ts - a.ts));

    state.items = merged;

    const sec = ((nowMs() - started) / 1000).toFixed(1);
    setStatus(`✅ OK ${okFeeds}/${enabled.length} feeds · ${merged.length} items · ${sec}s${skipped?` · backoff ${skipped}`:""} · ${APP_VERSION}`);

    state.refreshInFlight = false;
    state.refreshAbort = null;

    applyFilters();
    saveCaches();
  }

  /* ───────────────────────────── SW UPDATE / HARD RESET ───────────────────────────── */
  async function checkUpdate(){
    if (!("serviceWorker" in navigator)) return;
    try{
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return;
      await reg.update();
      // si hay waiting -> skip + reload
      if (reg.waiting){
        reg.waiting.postMessage({ type:"SKIP_WAITING" });
        setTimeout(() => location.reload(), 350);
      } else {
        setStatus("ℹ️ Update check: OK");
      }
    }catch{
      setStatus("⚠️ Update check falló");
    }
  }

  async function hardReset(){
    try{
      // purge caches via SW (si existe)
      if ("serviceWorker" in navigator){
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg?.active){
          reg.active.postMessage({ type:"PURGE_CACHES" });
        }
        if (reg) await reg.unregister();
      }

      // borrar caches del navegador
      if (window.caches){
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }

      localStorage.clear();
    } finally {
      location.reload();
    }
  }

  /* ───────────────────────────── BIND UI ───────────────────────────── */
  function bindSettingsToUI(){
    els.liveUrl.value = settings.liveUrl;
    els.timeFilter.value = String(settings.timeFilter);
    els.delayMin.value = String(settings.delayMin);
    els.sortBy.value = settings.sortBy;
    els.showLimit.value = String(settings.showLimit);
    els.fetchCap.value = String(settings.fetchCap);
    els.batchFeeds.value = String(settings.batchFeeds);
    els.refreshSec.value = String(settings.refreshSec);

    els.optOnlyReady.checked = !!settings.optOnlyReady;
    els.optOnlySpanish.checked = !!settings.optOnlySpanish;
    els.optResolveLinks.checked = !!settings.optResolveLinks;
    els.optShowOriginal.checked = !!settings.optShowOriginal;
    els.optHideUsed.checked = !!settings.optHideUsed;
    els.optAutoRefresh.checked = !!settings.optAutoRefresh;

    els.catFilter.value = settings.catFilter || "all";
  }

  function bindUI(){
    // buttons
    els.btnRefresh.addEventListener("click", (ev) => {
      const force = ev.shiftKey;
      refreshAll({ force }).catch(()=>{});
    });
    els.btnFeeds.addEventListener("click", openModal);
    els.btnCheckUpdate.addEventListener("click", checkUpdate);
    els.btnHardReset.addEventListener("click", hardReset);

    // modal close
    els.btnCloseModal.addEventListener("click", closeModal);
    els.modal.addEventListener("click", (e) => {
      // click fuera del panel
      if (e.target === els.modal) closeModal();
    });
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });

    // feeds modal actions
    els.btnAddFeed.addEventListener("click", () => {
      const f = normalizeFeed({
        name: els.newFeedName.value,
        url: els.newFeedUrl.value,
        enabled: true,
        cat: "all"
      });
      if (!f){
        setStatus("⚠️ Feed inválido");
        return;
      }
      state.feeds.unshift(f);
      els.newFeedName.value = "";
      els.newFeedUrl.value = "";
      renderFeedsModal();
    });

    els.btnRestoreDefaultFeeds.addEventListener("click", () => {
      state.feeds = DEFAULT_FEEDS.map(x => ({...x, url: ensureUrl(x.url)})).filter(f => isHttpUrl(f.url));
      saveFeeds();
      renderFeedsModal();
      setStatus("✅ Defaults restaurados");
    });

    els.btnSaveFeeds.addEventListener("click", () => {
      // limpia
      state.feeds = state.feeds.map(normalizeFeed).filter(Boolean);
      if (!state.feeds.length){
        state.feeds = DEFAULT_FEEDS.map(x => ({...x, url: ensureUrl(x.url)})).filter(f => isHttpUrl(f.url));
      }
      saveFeeds();
      closeModal();
      setStatus("✅ Feeds guardados");
      refreshAll({ force:true }).catch(()=>{});
    });

    els.btnExportFeeds.addEventListener("click", () => {
      els.feedsJson.value = JSON.stringify(state.feeds, null, 2);
    });

    els.btnImportFeeds.addEventListener("click", () => {
      const arr = safeJsonParse(els.feedsJson.value, null);
      if (!Array.isArray(arr)){
        setStatus("⚠️ JSON inválido");
        return;
      }
      const cleaned = arr.map(normalizeFeed).filter(Boolean);
      if (!cleaned.length){
        setStatus("⚠️ No hay feeds válidos en el JSON");
        return;
      }
      state.feeds = cleaned;
      saveFeeds();
      renderFeedsModal();
      setStatus(`✅ Importados ${cleaned.length} feeds`);
    });

    // composer / template
    els.template.addEventListener("input", () => {
      saveTemplate(els.template.value);
      renderPreview();
    });

    const liveChange = () => {
      settings.liveUrl = normSpace(els.liveUrl.value) || settings.liveUrl;
      saveSettings();
      renderPreview();
    };
    els.liveUrl.addEventListener("change", liveChange);
    els.liveUrl.addEventListener("input", () => renderPreview());

    els.headline.addEventListener("input", renderPreview);
    els.sourceUrl.addEventListener("input", renderPreview);
    els.hashtags.addEventListener("input", renderPreview);
    els.optIncludeLive.addEventListener("change", renderPreview);
    els.optIncludeSource.addEventListener("change", renderPreview);

    els.btnTrim.addEventListener("click", smartTrim);
    els.btnGenTags.addEventListener("click", () => {
      els.hashtags.value = suggestHashtags(normSpace(els.headline.value), "all");
      renderPreview();
    });

    els.btnResetTemplate.addEventListener("click", () => {
      els.template.value = DEFAULT_TEMPLATE;
      saveTemplate(els.template.value);
      renderPreview();
    });

    els.btnCopyUrl.addEventListener("click", async () => {
      const ok = await copyText(normSpace(els.sourceUrl.value));
      setStatus(ok ? "✅ URL copiada" : "⚠️ No pude copiar");
    });

    els.btnCopy.addEventListener("click", async () => {
      const ok = await copyText(els.preview.value);
      if (ok){
        markUsedSelected();
        applyFilters();
      }
      setStatus(ok ? "✅ Tweet copiado" : "⚠️ No pude copiar");
    });

    els.btnX.addEventListener("click", () => {
      const text = encodeURIComponent(els.preview.value);
      const url = `https://twitter.com/intent/tweet?text=${text}`;
      window.open(url, "_blank", "noopener,noreferrer");
      markUsedSelected();
      applyFilters();
      setStatus("↗️ Abierto en X");
    });

    // filters/settings -> apply + save
    const hook = (el, key, parseFn) => {
      const fn = () => {
        settings[key] = parseFn(el.type === "checkbox" ? el.checked : el.value);
        saveSettings();
        applyFilters();
        startAutoRefresh();
      };
      el.addEventListener("change", fn);
      el.addEventListener("input", fn);
    };

    hook(els.timeFilter, "timeFilter", (v)=>Number(v));
    hook(els.delayMin, "delayMin", (v)=>Number(v));
    hook(els.sortBy, "sortBy", (v)=>String(v));
    hook(els.showLimit, "showLimit", (v)=>Number(v));
    hook(els.fetchCap, "fetchCap", (v)=>Number(v));
    hook(els.batchFeeds, "batchFeeds", (v)=>Number(v));
    hook(els.refreshSec, "refreshSec", (v)=>Number(v));
    hook(els.optOnlyReady, "optOnlyReady", (v)=>!!v);
    hook(els.optOnlySpanish, "optOnlySpanish", (v)=>!!v);
    hook(els.optResolveLinks, "optResolveLinks", (v)=>!!v);
    hook(els.optShowOriginal, "optShowOriginal", (v)=>!!v);
    hook(els.optHideUsed, "optHideUsed", (v)=>!!v);
    hook(els.optAutoRefresh, "optAutoRefresh", (v)=>!!v);
    hook(els.catFilter, "catFilter", (v)=>String(v));

    els.searchBox.addEventListener("input", applyFilters);
  }

  function startAutoRefresh(){
    if (state.tickerTimer) clearInterval(state.tickerTimer);

    if (!els.optAutoRefresh.checked) return;

    const sec = clamp(Number(els.refreshSec.value || settings.refreshSec), 20, 3600);
    state.tickerTimer = setInterval(() => {
      // refresh “light”
      refreshAll({ force:false }).catch(()=>{});
    }, sec * 1000);
  }

  /* ───────────────────────────── INIT ───────────────────────────── */
  async function registerSW(){
    if (!("serviceWorker" in navigator)) return;
    try{
      await navigator.serviceWorker.register("./sw.js");
    }catch{}
  }

  async function init(){
    loadUsed();
    loadCaches();

    state.feeds = loadFeeds();

    els.template.value = loadTemplate();
    bindSettingsToUI();
    bindUI();

    renderPreview();

    setStatus(`TNP listo (${APP_VERSION})`);

    startAutoRefresh();
    await registerSW();

    // primer refresh
    refreshAll({ force:true }).catch(()=>{});
  }

  init().catch(() => {
    setStatus("❌ Error init (revisa consola)");
  });
})();
