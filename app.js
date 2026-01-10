/* app.js — News → Tweet Template Panel (TNP v4.1.1) — DIRECT RSS + HARDENED
   ✅ FIX CRÍTICO: tu app no arrancaba por errores de sintaxis (.x / .r.value)
   ✅ Más RSS directos (originales), Google News queda como fallback (apagado)
   ✅ Anti-CORS: directo → AllOrigins → CodeTabs → ThingProxy
   ✅ Imágenes desde RSS (media/enclosure) + OG solo si falta
   ✅ Rendimiento: refresh por lotes, abortable, hidratación limitada
*/

(() => {
  "use strict";

  /* ───────────────────────────── VERSION / STORAGE ───────────────────────────── */
  const APP_VERSION = "tnp-v4.1.1";

  const LS_FEEDS    = "tnp_feeds_v4";
  const LS_TEMPLATE = "tnp_template_v4";
  const LS_SETTINGS = "tnp_settings_v4";
  const LS_TR_CACHE = "tnp_tr_cache_v4";
  const LS_USED     = "tnp_used_v4";

  /* ───────────────────────────── DEFAULT TEMPLATE ───────────────────────────── */
  const DEFAULT_TEMPLATE =
`🚨 ÚLTIMA HORA: {{HEADLINE}}

{{LIVE_LINE}}
{{SOURCE_LINE}}
{{HASHTAGS}}`;

  const DEFAULT_LIVE_LINE   = "🔴#ENVIVO >>> {{LIVE_URL}}";
  const DEFAULT_SOURCE_LINE = "Fuente: {{SOURCE_URL}}";

  /* ───────────────────────────── HELPERS ───────────────────────────── */
  const $ = (id) => document.getElementById(id);
  const nowMs = () => Date.now();

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

  function safeJsonParse(s, fallback){
    try { return JSON.parse(s); } catch { return fallback; }
  }

  function uniqBy(arr, keyFn){
    const seen = new Set();
    const out = [];
    for (const x of arr){
      const k = keyFn(x);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(x);
    }
    return out;
  }

  function stripHtml(s){
    return (s || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }

  function normSpace(s){
    return (s || "").replace(/\s+/g, " ").trim();
  }

  function domainOf(url){
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
  }

  function minutesAgo(ts){
    const d = Math.max(0, nowMs() - ts);
    return Math.floor(d / 60000);
  }

  function fmtAge(ts){
    const m = minutesAgo(ts);
    if (m < 1) return "ahora";
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return mm ? `${h}h ${mm}m` : `${h}h`;
  }

  function isLikelySpanish(text){
    const t = (text || "").toLowerCase();
    if (!t) return false;
    if (/[áéíóúñü¿¡]/i.test(t)) return true;
    // heurística ligera
    const hits = ["última hora","gobierno","policía","muere","acuerdo","ataque","incendio","tribunal","juez","hoy","mañana","según"];
    let c = 0;
    for (const w of hits) if (t.includes(w)) c++;
    return c >= 2;
  }

  function scoreImpact(item){
    // base por frescura
    const ageM = minutesAgo(item.ts || nowMs());
    let s = 0;
    if (ageM <= 5) s += 6;
    else if (ageM <= 10) s += 5;
    else if (ageM <= 30) s += 4;
    else if (ageM <= 60) s += 3;
    else if (ageM <= 180) s += 2;
    else s += 1;

    // keywords
    const t = (item.titleEs || item.title || "").toLowerCase();
    const kw = [
      ["última hora", 5], ["breaking", 4], ["alerta", 4], ["explos", 4], ["ataque", 4],
      ["terrem", 4], ["muerto", 4], ["fallec", 4], ["herido", 3], ["incend", 3],
      ["otan", 3], ["ucrania", 3], ["misil", 3], ["israel", 3], ["gaza", 3],
      ["juicio", 3], ["deten", 3], ["conden", 3], ["dimis", 3], ["crisis", 3],
      ["amenaza", 3], ["sancion", 3], ["evac", 3]
    ];
    for (const [k, w] of kw) if (t.includes(k)) s += w;

    // fuente (ligero)
    const d = (item.domain || "").toLowerCase();
    if (d.includes("reuters")) s += 2;
    if (d.includes("bbc")) s += 2;
    if (d.includes("elpais")) s += 1;
    if (d.includes("rtve")) s += 1;

    return s;
  }

  /* ───────────────────────────── FEEDS DEFAULT ─────────────────────────────
     NOTA: casi todo son RSS DIRECTOS. Google News queda apagado (fallback).
  */
  const DEFAULT_FEEDS = [
    // ESPAÑA — generales
    { name:"RTVE — Noticias", url:"https://www.rtve.es/rss/temas_noticias.xml", enabled:true, cat:"spain" },
    { name:"RTVE — España",  url:"https://www.rtve.es/rss/temas_espana.xml",   enabled:true, cat:"spain" },
    { name:"RTVE — Economía",url:"https://www.rtve.es/rss/temas_economia.xml", enabled:true, cat:"economy" },
    { name:"RTVE — Mundo",   url:"https://www.rtve.es/rss/temas_mundo.xml",    enabled:true, cat:"world" },

    { name:"El País — Portada (MRSS)", url:"https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada", enabled:true, cat:"spain" },
    { name:"El País — Últimas (MRSS)", url:"https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/ultimas-noticias/portada", enabled:true, cat:"spain" },

    { name:"Euronews — ES (MRSS)", url:"https://www.euronews.com/rss?format=mrss", enabled:true, cat:"world" },
    { name:"DW Español (RSS)", url:"https://rss.dw.com/rdf/rss-es-all", enabled:true, cat:"world" },
    { name:"France 24 — ES (RSS)", url:"https://www.france24.com/es/rss", enabled:true, cat:"world" },
    { name:"Al Jazeera (RSS)", url:"https://www.aljazeera.com/xml/rss/all.xml", enabled:true, cat:"world" },
    { name:"BBC — World (RSS)", url:"https://feeds.bbci.co.uk/news/world/rss.xml", enabled:true, cat:"world" },

    // ESPAÑA — prensa (RSS clásicos)
    { name:"El Mundo — Portada (RSS)", url:"https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml", enabled:true, cat:"spain" },
    { name:"ABC — Portada (RSS)", url:"https://www.abc.es/rss/feeds/abcPortada.xml", enabled:true, cat:"spain" },

    { name:"El Confidencial — Portada (RSS)", url:"https://rss.elconfidencial.com/espana/", enabled:true, cat:"spain" },
    { name:"El Confidencial — Mundo (RSS)", url:"https://rss.elconfidencial.com/mundo/", enabled:true, cat:"world" },
    { name:"El Confidencial — Economía (RSS)", url:"https://rss.elconfidencial.com/economia/", enabled:true, cat:"economy" },
    { name:"El Confidencial — Sucesos (RSS)", url:"https://rss.elconfidencial.com/espana/sucesos/", enabled:true, cat:"security" },

    { name:"Europa Press — Portada (RSS)", url:"https://www.europapress.es/rss/rss.aspx?ch=69", enabled:true, cat:"spain" },
    { name:"Europa Press — Nacional (RSS)", url:"https://www.europapress.es/rss/rss.aspx?ch=66", enabled:true, cat:"spain" },
    { name:"Europa Press — Internacional (RSS)", url:"https://www.europapress.es/rss/rss.aspx?ch=67", enabled:true, cat:"world" },
    { name:"Europa Press — Economía (RSS)", url:"https://www.europapress.es/rss/rss.aspx?ch=136", enabled:true, cat:"economy" },

    // TECH / ECONOMÍA / otros (RSS conocidos)
    { name:"Xataka (RSS)", url:"https://feeds.weblogssl.com/xataka2", enabled:true, cat:"tech" },
    { name:"Genbeta (RSS)", url:"https://feeds.weblogssl.com/genbeta", enabled:true, cat:"tech" },
    { name:"El Blog Salmón (RSS)", url:"https://feeds.weblogssl.com/elblogsalmon", enabled:true, cat:"economy" },
    { name:"VidaExtra (RSS)", url:"https://feeds.weblogssl.com/vidaextra", enabled:false, cat:"culture" },

    // Fallback (apagado): Google News RSS
    { name:"Google News — España (Top) [OFF]", url:"https://news.google.com/rss?hl=es&gl=ES&ceid=ES:es", enabled:false, cat:"spain" },
    { name:"Google News — World [OFF]", url:"https://news.google.com/rss?hl=en&gl=US&ceid=US:en", enabled:false, cat:"world" },
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
    autoTimer: null,
    trCache: new Map(),
    ogCache: new Map(),
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
    // defaults
    s.liveUrl = s.liveUrl || "https://twitch.tv/globaleyetv";
    s.delayMin = (typeof s.delayMin === "number") ? s.delayMin : 0;
    s.timeFilter = (typeof s.timeFilter === "number") ? s.timeFilter : 60;
    s.sortBy = s.sortBy || "impact";
    s.showLimit = (typeof s.showLimit === "number") ? s.showLimit : 120;
    s.fetchCap = (typeof s.fetchCap === "number") ? s.fetchCap : 180;
    s.batchFeeds = (typeof s.batchFeeds === "number") ? s.batchFeeds : 6;
    s.refreshSec = (typeof s.refreshSec === "number") ? s.refreshSec : 60;

    s.optOnlyReady = (s.optOnlyReady !== false);
    s.optOnlySpanish = (s.optOnlySpanish !== false);
    s.optResolveLinks = (s.optResolveLinks !== false);
    s.optShowOriginal = (s.optShowOriginal !== false);
    s.optHideUsed = (s.optHideUsed !== false);
    s.optAutoRefresh = (s.optAutoRefresh !== false);

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

  function loadUsed(){
    const arr = safeJsonParse(localStorage.getItem(LS_USED), []);
    state.used = new Set(Array.isArray(arr) ? arr : []);
  }

  function saveUsed(){
    localStorage.setItem(LS_USED, JSON.stringify(Array.from(state.used).slice(0, 5000)));
  }

  function loadTrCache(){
    const obj = safeJsonParse(localStorage.getItem(LS_TR_CACHE), {});
    if (obj && typeof obj === "object"){
      for (const [k,v] of Object.entries(obj)){
        if (typeof v === "string") state.trCache.set(k, v);
      }
    }
  }

  function saveTrCache(){
    const out = {};
    let i = 0;
    for (const [k,v] of state.trCache.entries()){
      out[k] = v;
      i++;
      if (i > 1500) break;
    }
    localStorage.setItem(LS_TR_CACHE, JSON.stringify(out));
  }

  /* ───────────────────────────── FEEDS CRUD ───────────────────────────── */
  function loadFeeds(){
    const saved = safeJsonParse(localStorage.getItem(LS_FEEDS), null);
    if (Array.isArray(saved) && saved.length){
      return saved.map(f => ({
        name: String(f.name || "").trim(),
        url: String(f.url || "").trim(),
        enabled: !!f.enabled,
        cat: String(f.cat || "all"),
      })).filter(f => f.name && f.url);
    }
    // FIX CRÍTICO: antes estaba roto como ({ .x })
    return DEFAULT_FEEDS.map(x => ({ ...x }));
  }

  function saveFeeds(){
    localStorage.setItem(LS_FEEDS, JSON.stringify(state.feeds));
  }

  function normalizeFeedUrl(u){
    return String(u || "").trim();
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
      cat.textContent = (f.cat || "all");

      const del = document.createElement("button");
      del.className = "btn small danger";
      del.textContent = "Borrar";
      del.addEventListener("click", () => {
        state.feeds.splice(i,1);
        renderFeedsModal();
      });

      row.append(cb, meta, cat, del);
      els.feedList.appendChild(row);
    }
  }

  function openModal(){
    renderFeedsModal();
    els.feedsJson.value = "";
    els.modal.hidden = false;
  }
  function closeModal(){
    els.modal.hidden = true;
  }

  /* ───────────────────────────── FETCH (ANTI-CORS) ───────────────────────────── */
  async function fetchTextSmart(url, { timeoutMs=12000, signal } = {}){
    const controllers = [];
    const withTimeout = () => {
      const c = new AbortController();
      controllers.push(c);
      const t = setTimeout(() => c.abort("timeout"), timeoutMs);
      return { c, t };
    };
    const stopAll = () => { for (const c of controllers) c.abort("cascade"); };

    const tryFetch = async (makeUrl, label) => {
      const { c, t } = withTimeout();
      const chained = signal ? anySignal([signal, c.signal]) : c.signal;
      try{
        const u = makeUrl(url);
        const res = await fetch(u, {
          signal: chained,
          cache: "no-store",
          headers: { "Accept": "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5" }
        });
        if (!res.ok) throw new Error(`${label} HTTP ${res.status}`);
        const txt = await res.text();
        if (!txt || txt.length < 20) throw new Error(`${label} empty`);
        return txt;
      } finally {
        clearTimeout(t);
      }
    };

    const tries = [
      [(u)=>u, "direct"],
      [(u)=>`https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`, "allorigins"],
      [(u)=>`https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}`, "codetabs"],
      [(u)=>`https://thingproxy.freeboard.io/fetch/${u}`, "thingproxy"],
    ];

    let lastErr = null;
    for (const [fn,label] of tries){
      try{
        const txt = await tryFetch(fn, label);
        stopAll();
        return txt;
      } catch (e){
        lastErr = e;
      }
    }
    throw lastErr || new Error("fetch failed");
  }

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

  /* ───────────────────────────── PARSE RSS/ATOM ───────────────────────────── */
  function parseXml(txt){
    const p = new DOMParser();
    const doc = p.parseFromString(txt, "text/xml");
    // si hay parsererror
    if (doc.querySelector("parsererror")) return null;
    return doc;
  }

  function pickText(el, sel){
    const n = el.querySelector(sel);
    return n ? normSpace(n.textContent) : "";
  }

  function pickAttr(el, sel, attr){
    const n = el.querySelector(sel);
    return n ? (n.getAttribute(attr) || "") : "";
  }

  function parseDate(s){
    const t = Date.parse(s || "");
    return Number.isFinite(t) ? t : nowMs();
  }

  function extractImageFromItem(itemEl){
    // media:content / media:thumbnail
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
    // enclosure
    const enc = itemEl.querySelector("enclosure");
    if (enc){
      const u = enc.getAttribute("url") || "";
      const type = (enc.getAttribute("type") || "").toLowerCase();
      if (u && (!type || type.startsWith("image/"))) return u;
    }
    // content:encoded img
    const ce = itemEl.querySelector("content\\:encoded, encoded");
    if (ce){
      const html = ce.textContent || "";
      const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (m && m[1]) return m[1];
    }
    return "";
  }

  function parseFeedText(feedText, feed){
    const doc = parseXml(feedText);
    if (!doc) return [];

    // RSS items
    const rssItems = Array.from(doc.querySelectorAll("item"));
    if (rssItems.length){
      return rssItems.map((it) => {
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

        return normalizeItem({
          id: makeId(feed.name, link, ts, title),
          feedName: feed.name,
          feedUrl: feed.url,
          cat: feed.cat || "all",
          title,
          link,
          ts,
          desc,
          rssImage: img,
        });
      });
    }

    // ATOM entries
    const entries = Array.from(doc.querySelectorAll("entry"));
    if (entries.length){
      return entries.map((e) => {
        const title = pickText(e, "title") || "(sin título)";
        let link = "";
        const linkEl = e.querySelector("link[rel='alternate']") || e.querySelector("link");
        if (linkEl) link = linkEl.getAttribute("href") || "";
        const pub = pickText(e, "updated") || pickText(e, "published");
        const ts = parseDate(pub);
        const desc = stripHtml(pickText(e, "summary") || pickText(e, "content"));

        // atom image (no estándar): media:thumbnail/content
        const img = extractImageFromItem(e);

        return normalizeItem({
          id: makeId(feed.name, link, ts, title),
          feedName: feed.name,
          feedUrl: feed.url,
          cat: feed.cat || "all",
          title,
          link,
          ts,
          desc,
          rssImage: img,
        });
      });
    }

    return [];
  }

  function makeId(feedName, link, ts, title){
    const base = `${feedName}||${link}||${ts}||${title}`;
    // hash simple
    let h = 2166136261;
    for (let i=0;i<base.length;i++){
      h ^= base.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return `n_${(h>>>0).toString(16)}`;
  }

  function normalizeItem(x){
    const domain = domainOf(x.link || x.feedUrl || "");
    const item = {
      id: x.id,
      feedName: x.feedName || "",
      feedUrl: x.feedUrl || "",
      cat: x.cat || "all",
      title: normSpace(x.title || ""),
      titleEs: "",
      link: x.link || "",
      resolvedUrl: "",
      ts: x.ts || nowMs(),
      desc: x.desc || "",
      domain,
      rssImage: x.rssImage || "",
      ogImage: "",
      ready: false,
      impact: 0,
    };
    item.impact = scoreImpact(item);
    item.ready = true; // “listo” base (aunque luego resolvamos link/og)
    return item;
  }

  /* ───────────────────────────── RESOLVE / OG ───────────────────────────── */
  async function fetchViaJina(url, { signal, timeoutMs=12000 } = {}){
    // Jina: devuelve HTML como texto (suele saltarse CORS)
    const u = `https://r.jina.ai/http://${url.replace(/^https?:\/\//i, "")}`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort("timeout"), timeoutMs);
    const chained = signal ? anySignal([signal, ctrl.signal]) : ctrl.signal;
    try{
      const res = await fetch(u, { signal: chained, cache:"no-store" });
      if (!res.ok) throw new Error(`jina ${res.status}`);
      return await res.text();
    } finally {
      clearTimeout(t);
    }
  }

  function extractMeta(html, prop){
    const re = new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i");
    const m = html.match(re);
    return m ? m[1] : "";
  }
  function extractMetaName(html, name){
    const re = new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i");
    const m = html.match(re);
    return m ? m[1] : "";
  }

  async function resolveIfGoogleNews(url, signal){
    if (!url) return "";
    if (!/news\.google\.com/i.test(url)) return "";
    // Best-effort: abrir HTML y buscar "url=" o links canonical
    try{
      const html = await fetchViaJina(url, { signal, timeoutMs: 9000 });
      // 1) url=...
      const m = html.match(/url=([^&\s"']+)/i);
      if (m && m[1]){
        const u = decodeURIComponent(m[1]);
        if (/^https?:\/\//i.test(u)) return u;
      }
      // 2) canonical
      const canon = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
      if (canon && canon[1]) return canon[1];
      // 3) og:url
      const ogu = extractMeta(html, "og:url");
      if (ogu) return ogu;
    } catch {}
    return "";
  }

  async function fetchOgImage(url, signal){
    if (!url) return "";
    if (state.ogCache.has(url)) return state.ogCache.get(url);

    let img = "";
    try{
      const html = await fetchViaJina(url, { signal, timeoutMs: 9000 });
      img = extractMeta(html, "og:image") || extractMetaName(html, "twitter:image");
      img = img ? img.trim() : "";
    } catch {
      img = "";
    }
    state.ogCache.set(url, img);
    return img;
  }

  /* ───────────────────────────── TRANSLATE (ES) ───────────────────────────── */
  async function translateToEs(text, signal){
    const t = normSpace(text);
    if (!t) return "";
    const key = `es:${t}`;
    if (state.trCache.has(key)) return state.trCache.get(key);

    // si ya parece ES, no gastes requests
    if (isLikelySpanish(t)){
      state.trCache.set(key, t);
      return t;
    }

    // endpoint público (best-effort)
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=es&dt=t&q=${encodeURIComponent(t)}`;
    try{
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort("timeout"), 8000);
      const chained = signal ? anySignal([signal, ctrl.signal]) : ctrl.signal;

      const res = await fetch(url, { signal: chained, cache:"no-store" });
      clearTimeout(timeout);
      if (!res.ok) throw new Error("translate http " + res.status);
      const data = await res.json();
      const out = (data?.[0] || []).map(x => x?.[0]).join("");
      const es = normSpace(out) || t;
      state.trCache.set(key, es);
      return es;
    } catch {
      state.trCache.set(key, t);
      return t;
    }
  }

  /* ───────────────────────────── FILTER / RENDER ───────────────────────────── */
  function applyFilters(){
    const mins = Number(els.timeFilter.value || settings.timeFilter || 60);
    const q = (els.searchBox.value || "").trim().toLowerCase();
    const delay = Number(els.delayMin.value || 0);
    const onlyReady = !!els.optOnlyReady.checked;
    const onlyEs = !!els.optOnlySpanish.checked;
    const hideUsed = !!els.optHideUsed.checked;
    const cat = els.catFilter.value || "all";

    let list = state.items.slice();

    if (mins > 0){
      const cut = nowMs() - mins * 60000;
      list = list.filter(x => (x.ts || 0) >= cut);
    }
    if (delay > 0){
      const cut = nowMs() - delay * 60000;
      list = list.filter(x => (x.ts || 0) <= cut);
    }
    if (cat !== "all"){
      list = list.filter(x => (x.cat || "all") === cat);
    }
    if (hideUsed){
      list = list.filter(x => !state.used.has(x.id));
    }
    if (q){
      list = list.filter(x => {
        const t = (x.titleEs || x.title || "").toLowerCase();
        const d = (x.desc || "").toLowerCase();
        const dom = (x.domain || "").toLowerCase();
        return t.includes(q) || d.includes(q) || dom.includes(q);
      });
    }
    if (onlyReady){
      list = list.filter(x => x.ready);
    }
    if (onlyEs){
      // prioriza ES: no filtra duro, ordena
      list.sort((a,b) => {
        const ae = isLikelySpanish(a.titleEs || a.title) ? 1 : 0;
        const be = isLikelySpanish(b.titleEs || b.title) ? 1 : 0;
        if (ae !== be) return be - ae;
        return 0;
      });
    }

    const sortBy = els.sortBy.value || "impact";
    if (sortBy === "impact") list.sort((a,b) => (b.impact||0) - (a.impact||0) || (b.ts||0)-(a.ts||0));
    if (sortBy === "new") list.sort((a,b) => (b.ts||0)-(a.ts||0));
    if (sortBy === "old") list.sort((a,b) => (a.ts||0)-(b.ts||0));

    const showLimit = clamp(Number(els.showLimit.value || 120), 20, 1000);
    state.filtered = list.slice(0, showLimit);

    renderNews();
    renderTicker();
  }

  function renderNews(){
    const list = state.filtered;
    els.newsList.innerHTML = "";

    if (!list.length){
      const empty = document.createElement("div");
      empty.className = "pill";
      empty.textContent = "Sin noticias visibles. Pulsa Refrescar o revisa tus feeds.";
      els.newsList.appendChild(empty);
      return;
    }

    for (const it of list){
      const card = document.createElement("div");
      card.className = "card" + (it.id === state.selectedId ? " sel" : "");
      card.tabIndex = 0;

      const thumb = document.createElement("div");
      thumb.className = "thumb";
      const imgUrl = it.ogImage || it.rssImage;
      if (imgUrl){
        const img = document.createElement("img");
        img.loading = "lazy";
        img.alt = "";
        img.src = imgUrl;
        thumb.appendChild(img);
      } else {
        const t = document.createElement("div");
        t.className = "badge";
        t.textContent = it.domain || "news";
        thumb.appendChild(t);
      }

      const main = document.createElement("div");
      main.className = "cardMain";

      const title = document.createElement("div");
      title.className = "title";
      title.textContent = it.titleEs || it.title || "(sin título)";

      const sub = document.createElement("div");
      sub.className = "sub";

      const b1 = document.createElement("span");
      b1.className = "badge";
      b1.textContent = (it.domain || it.feedName || "RSS");

      const b2 = document.createElement("span");
      b2.className = "badge";
      b2.textContent = fmtAge(it.ts);

      const b3 = document.createElement("span");
      b3.className = "badge";
      b3.textContent = it.cat || "all";

      sub.append(b1,b2,b3);

      if ((it.impact || 0) >= 10){
        const top = document.createElement("span");
        top.className = "badge top";
        top.textContent = "🔥 TOP";
        sub.appendChild(top);
      }

      main.append(title, sub);
      card.append(thumb, main);

      const onPick = () => pickItem(it.id);
      card.addEventListener("click", onPick);
      card.addEventListener("keydown", (e) => { if (e.key === "Enter") onPick(); });

      els.newsList.appendChild(card);
    }
  }

  function renderTicker(){
    const top = state.filtered.slice(0, 10);
    const titles = top.map(x => (x.titleEs || x.title || "").trim()).filter(Boolean);
    els.tnpTickerInner.textContent = titles.length ? titles.join(" • ") : "Listo.";

    // trends (hashtags)
    const tags = suggestHashtags(state.filtered.slice(0, 40));
    els.tnpTrendsPop.innerHTML = "";
    for (const t of tags.slice(0, 10)){
      const pill = document.createElement("a");
      pill.className = "pill";
      pill.href = "#";
      pill.textContent = t;
      pill.addEventListener("click", (e) => {
        e.preventDefault();
        // añade al input
        const cur = (els.hashtags.value || "").trim();
        if (!cur.includes(t)){
          els.hashtags.value = (cur ? (cur + " ") : "") + t;
          updatePreview();
        }
      });
      els.tnpTrendsPop.appendChild(pill);
    }
  }

  function suggestHashtags(items){
    const freq = new Map();
    const add = (h) => {
      const k = h.startsWith("#") ? h : ("#" + h);
      freq.set(k, (freq.get(k) || 0) + 1);
    };

    const stop = new Set(["de","la","el","y","en","a","un","una","los","las","por","para","con","del","al","que","se","su"]);
    for (const it of items){
      const t = (it.titleEs || it.title || "").toLowerCase();
      // tags por keywords
      if (t.includes("ucrania")) add("Ucrania");
      if (t.includes("otan")) add("OTAN");
      if (t.includes("gaza")) add("Gaza");
      if (t.includes("israel")) add("Israel");
      if (t.includes("rusia")) add("Rusia");
      if (t.includes("ee.uu") || t.includes("estados unidos") || t.includes("usa")) add("EEUU");
      if (t.includes("españa")) add("España");
      if (t.includes("barcelona")) add("Barcelona");
      if (t.includes("madrid")) add("Madrid");
      if (t.includes("terrem")) add("Terremoto");
      if (t.includes("incend")) add("Incendio");
      if (t.includes("ataque") || t.includes("explos")) add("ÚltimaHora");

      // palabras capitalizables (limitado)
      const words = t.replace(/[^a-záéíóúñü0-9\s]/gi, " ").split(/\s+/).filter(w => w.length >= 5);
      for (const w of words){
        if (stop.has(w)) continue;
        if (/^\d+$/.test(w)) continue;
        if (["última","hora","según","hacia","sobre","donde","tras","entre"].includes(w)) continue;
        freq.set("#" + capitalize(w), (freq.get("#" + capitalize(w)) || 0) + 0.15);
      }
    }

    const arr = Array.from(freq.entries()).sort((a,b) => b[1]-a[1]).map(x => x[0]);
    // siempre algunos base
    const base = ["#ÚltimaHora", "#Breaking"];
    for (const b of base) if (!arr.includes(b)) arr.unshift(b);
    return arr.slice(0, 14);
  }

  function capitalize(w){
    return w ? (w.charAt(0).toUpperCase() + w.slice(1)) : w;
  }

  /* ───────────────────────────── PICK / PREVIEW ───────────────────────────── */
  async function pickItem(id){
    const it = state.items.find(x => x.id === id);
    if (!it) return;

    state.selectedId = id;

    els.headline.value = it.titleEs || it.title || "";
    els.sourceUrl.value = (els.optShowOriginal.checked ? (it.resolvedUrl || it.link) : (it.resolvedUrl || it.link)) || "";
    if (!els.hashtags.value.trim()){
      const tags = suggestHashtags([it]).slice(0, 6).join(" ");
      els.hashtags.value = tags;
    }
    updatePreview();
    renderNews();

    // hidrata (resolve/og/translate) best-effort
    const ctrl = new AbortController();
    const signal = ctrl.signal;

    try{
      if (els.optResolveLinks.checked){
        const r = await resolveIfGoogleNews(it.link, signal);
        if (r && r !== it.link){
          it.resolvedUrl = r;
          els.sourceUrl.value = r;
        }
      }
      if (!it.titleEs){
        it.titleEs = await translateToEs(it.title, signal);
        // refresca headline si sigue seleccionado
        if (state.selectedId === id) els.headline.value = it.titleEs || it.title;
      }
      if (!it.ogImage && !it.rssImage){
        const url = it.resolvedUrl || it.link;
        it.ogImage = await fetchOgImage(url, signal);
      }
      updatePreview();
      renderNews();
    } catch {
      // silencioso
    }
  }

  function buildTweet(){
    const liveUrl = normSpace(els.liveUrl.value || "");
    const headline = normSpace(els.headline.value || "");
    const sourceUrl = normSpace(els.sourceUrl.value || "");
    const tags = normSpace(els.hashtags.value || "");

    let tpl = els.template.value || DEFAULT_TEMPLATE;

    const liveLine = els.optIncludeLive.checked ? DEFAULT_LIVE_LINE : "";
    const sourceLine = els.optIncludeSource.checked ? DEFAULT_SOURCE_LINE : "";

    tpl = tpl.replace("{{LIVE_LINE}}", liveLine);
    tpl = tpl.replace("{{SOURCE_LINE}}", sourceLine);

    tpl = tpl.replaceAll("{{LIVE_URL}}", liveUrl);
    tpl = tpl.replaceAll("{{HEADLINE}}", headline);
    tpl = tpl.replaceAll("{{SOURCE_URL}}", sourceUrl);
    tpl = tpl.replaceAll("{{HASHTAGS}}", tags);

    // limpia líneas vacías extra
    tpl = tpl.replace(/[ \t]+\n/g, "\n");
    tpl = tpl.replace(/\n{3,}/g, "\n\n").trim();

    return tpl;
  }

  function updatePreview(){
    const txt = buildTweet();
    els.preview.value = txt;

    const len = txt.length;
    els.charCount.textContent = String(len);

    const max = 280;
    if (len > max){
      els.warn.hidden = false;
      els.warn.textContent = `⚠️ Se pasa por ${len - max} caracteres. Usa “Ajustar” o acorta titular/hashtags.`;
    } else {
      els.warn.hidden = true;
      els.warn.textContent = "";
    }
  }

  function trimTo280(){
    let txt = buildTweet();
    if (txt.length <= 280){
      updatePreview();
      return;
    }
    // estrategia: recorta hashtags primero, luego titular
    let h = normSpace(els.hashtags.value);
    while (txt.length > 280 && h.includes(" ")){
      h = h.split(" ").slice(0, -1).join(" ");
      els.hashtags.value = h;
      txt = buildTweet();
    }
    if (txt.length > 280){
      let head = normSpace(els.headline.value);
      while (txt.length > 280 && head.length > 60){
        head = head.slice(0, head.length - 8).trim() + "…";
        els.headline.value = head;
        txt = buildTweet();
      }
    }
    updatePreview();
  }

  /* ───────────────────────────── COPY / OPEN X ───────────────────────────── */
  async function copyText(txt){
    try{
      await navigator.clipboard.writeText(txt);
      return true;
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = txt;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try{
        document.execCommand("copy");
        return true;
      } finally {
        document.body.removeChild(ta);
      }
    }
  }

  async function onCopyTweet(){
    const ok = await copyText(els.preview.value || "");
    bumpStatus(ok ? "✅ Copiado" : "⚠️ No se pudo copiar");
    markSelectedAsUsed();
  }

  async function onCopyUrl(){
    const ok = await copyText(els.sourceUrl.value || "");
    bumpStatus(ok ? "✅ URL copiada" : "⚠️ No se pudo copiar URL");
  }

  function openInX(){
    const text = els.preview.value || "";
    const u = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(u, "_blank", "noopener,noreferrer");
    markSelectedAsUsed();
  }

  function markSelectedAsUsed(){
    if (!state.selectedId) return;
    state.used.add(state.selectedId);
    saveUsed();
    applyFilters();
  }

  function bumpStatus(msg){
    const base = els.status.textContent;
    els.status.textContent = msg;
    setTimeout(() => { els.status.textContent = base; }, 1200);
  }

  /* ───────────────────────────── REFRESH PIPELINE ───────────────────────────── */
  async function refreshAll({ force=false } = {}){
    if (state.refreshInFlight){
      if (force && state.refreshAbort){
        state.refreshAbort.abort("force-restart");
      } else {
        return;
      }
    }

    const enabledFeeds = state.feeds.filter(f => f.enabled);
    if (!enabledFeeds.length){
      els.status.textContent = "⚠️ No hay feeds activos.";
      applyFilters();
      return;
    }

    state.refreshInFlight = true;
    const ctrl = new AbortController();
    state.refreshAbort = ctrl;

    const t0 = nowMs();
    let okFeeds = 0;
    let failFeeds = 0;
    let totalItems = 0;

    try{
      els.status.textContent = `Actualizando… (${enabledFeeds.length} feeds)`;

      const cap = clamp(Number(els.fetchCap.value || 180), 10, 1000);
      const batch = clamp(Number(els.batchFeeds.value || 6), 1, 20);

      const allItems = [];
      for (let i=0;i<enabledFeeds.length;i+=batch){
        const slice = enabledFeeds.slice(i, i+batch);

        const jobs = slice.map(async (feed) => {
          try{
            const txt = await fetchTextSmart(feed.url, { timeoutMs: 13000, signal: ctrl.signal });
            const items = parseFeedText(txt, feed);
            okFeeds++;
            return items;
          } catch {
            failFeeds++;
            return [];
          }
        });

        const results = await Promise.allSettled(jobs);
        for (const r of results){
          if (r.status === "fulfilled"){
            // FIX CRÍTICO: antes estaba roto como allItems.push(.r.value)
            allItems.push(...r.value);
          }
        }

        // micro pausa (evita martilleo)
        await sleep(120);
        if (ctrl.signal.aborted) throw new Error("aborted");
      }

      // Dedup por link/ID
      const dedup = uniqBy(allItems, x => x.id || x.link);
      totalItems = dedup.length;

      // cap total
      const sliced = dedup.slice(0, cap);

      // merge con existentes (conserva og/titleEs si ya estaban)
      const byId = new Map(state.items.map(x => [x.id, x]));
      for (const it of sliced){
        const prev = byId.get(it.id);
        if (prev){
          it.titleEs = prev.titleEs || it.titleEs;
          it.resolvedUrl = prev.resolvedUrl || it.resolvedUrl;
          it.ogImage = prev.ogImage || it.ogImage;
          it.rssImage = prev.rssImage || it.rssImage;
        }
      }

      state.items = sliced;
      applyFilters();

      const dt = Math.max(1, Math.round((nowMs() - t0)/1000));
      els.status.textContent = `OK: ${totalItems} items · feeds OK ${okFeeds}/${enabledFeeds.length} · ${dt}s`;

      // hidratación ligera de visibles (translate + resolve + og) sin reventar
      hydrateVisible(ctrl.signal).catch(()=>{});
      saveTrCache();
    } catch {
      els.status.textContent = "⚠️ Refresh cancelado / fallido.";
    } finally {
      state.refreshInFlight = false;
      state.refreshAbort = null;
    }
  }

  async function hydrateVisible(signal){
    // limita para rendimiento
    const visible = state.filtered.slice(0, 24);

    for (const it of visible){
      if (signal.aborted) return;

      // translate
      if (!it.titleEs){
        it.titleEs = await translateToEs(it.title, signal);
        it.impact = scoreImpact(it);
      }

      // resolve GN
      if (els.optResolveLinks.checked && !it.resolvedUrl){
        const r = await resolveIfGoogleNews(it.link, signal);
        if (r) it.resolvedUrl = r;
      }

      // og (solo si no hay rssImage)
      if (!it.ogImage && !it.rssImage){
        const url = it.resolvedUrl || it.link;
        it.ogImage = await fetchOgImage(url, signal);
      }

      // refresca UI suavemente
      renderNews();
      renderTicker();
      await sleep(80);
    }
  }

  /* ───────────────────────────── AUTO REFRESH ───────────────────────────── */
  function startAuto(){
    stopAuto();
    if (!els.optAutoRefresh.checked) return;
    const sec = clamp(Number(els.refreshSec.value || 60), 15, 600);
    state.autoTimer = setInterval(() => {
      refreshAll({ force:false }).catch(()=>{});
    }, sec * 1000);
  }
  function stopAuto(){
    if (state.autoTimer){
      clearInterval(state.autoTimer);
      state.autoTimer = null;
    }
  }

  /* ───────────────────────────── PWA UPDATE / HARD RESET ───────────────────────────── */
  async function checkForUpdates(){
    if (!("serviceWorker" in navigator)) return bumpStatus("SW no disponible");
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return bumpStatus("SW no registrado");
    await reg.update();
    bumpStatus("Update check ✓");
    if (reg.waiting){
      reg.waiting.postMessage({ type:"SKIP_WAITING" });
      bumpStatus("Aplicando update…");
    }
  }

  async function hardReset(){
    // borra storage + caches + recarga
    try{
      localStorage.removeItem(LS_FEEDS);
      localStorage.removeItem(LS_TEMPLATE);
      localStorage.removeItem(LS_SETTINGS);
      localStorage.removeItem(LS_TR_CACHE);
      localStorage.removeItem(LS_USED);

      if ("caches" in window){
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }

      if ("serviceWorker" in navigator){
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) await reg.unregister();
      }
    } catch {}
    location.reload();
  }

  /* ───────────────────────────── INIT ───────────────────────────── */
  function bindUI(){
    // settings -> UI
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

    els.template.value = loadTemplate();
    updatePreview();

    // listeners
    els.btnRefresh.addEventListener("click", (ev) => {
      const force = !!ev.shiftKey;
      refreshAll({ force }).catch(()=>{});
    });
    els.btnFeeds.addEventListener("click", openModal);
    els.btnCloseModal.addEventListener("click", closeModal);
    els.modal.addEventListener("click", (e) => { if (e.target === els.modal) closeModal(); });

    els.btnAddFeed.addEventListener("click", () => {
      const name = normSpace(els.newFeedName.value);
      const url = normalizeFeedUrl(els.newFeedUrl.value);
      if (!name || !url) return bumpStatus("⚠️ Falta nombre/URL");
      state.feeds.unshift({ name, url, enabled:true, cat:"all" });
      els.newFeedName.value = "";
      els.newFeedUrl.value = "";
      renderFeedsModal();
    });

    els.btnSaveFeeds.addEventListener("click", () => {
      saveFeeds();
      bumpStatus("✅ Feeds guardados");
      closeModal();
      refreshAll({ force:true }).catch(()=>{});
    });

    els.btnRestoreDefaultFeeds.addEventListener("click", () => {
      state.feeds = DEFAULT_FEEDS.map(x => ({ ...x }));
      renderFeedsModal();
      bumpStatus("Defaults ✓");
    });

    els.btnExportFeeds.addEventListener("click", () => {
      els.feedsJson.value = JSON.stringify(state.feeds, null, 2);
      bumpStatus("Export ✓");
    });

    els.btnImportFeeds.addEventListener("click", () => {
      const arr = safeJsonParse(els.feedsJson.value, null);
      if (!Array.isArray(arr)) return bumpStatus("⚠️ JSON inválido");
      const cleaned = arr.map(f => ({
        name: String(f.name || "").trim(),
        url: String(f.url || "").trim(),
        enabled: !!f.enabled,
        cat: String(f.cat || "all"),
      })).filter(f => f.name && f.url);
      if (!cleaned.length) return bumpStatus("⚠️ No hay feeds válidos");
      state.feeds = cleaned;
      renderFeedsModal();
      bumpStatus("Import ✓");
    });

    els.btnCheckUpdate.addEventListener("click", () => { checkForUpdates().catch(()=>{}); });
    els.btnHardReset.addEventListener("click", () => { hardReset().catch(()=>{}); });

    // composer interactions
    const onChange = () => updatePreview();
    ["input","change"].forEach(evt => {
      els.liveUrl.addEventListener(evt, () => { settings.liveUrl = els.liveUrl.value; saveSettings(settings); onChange(); });
      els.headline.addEventListener(evt, onChange);
      els.sourceUrl.addEventListener(evt, onChange);
      els.hashtags.addEventListener(evt, onChange);
      els.optIncludeLive.addEventListener(evt, onChange);
      els.optIncludeSource.addEventListener(evt, onChange);
      els.template.addEventListener(evt, () => { saveTemplate(els.template.value); onChange(); });
    });

    els.btnTrim.addEventListener("click", trimTo280);
    els.btnGenTags.addEventListener("click", () => {
      const it = state.items.find(x => x.id === state.selectedId);
      const tags = suggestHashtags(it ? [it] : state.filtered.slice(0, 20)).slice(0, 8).join(" ");
      els.hashtags.value = tags;
      updatePreview();
    });
    els.btnCopy.addEventListener("click", onCopyTweet);
    els.btnCopyUrl.addEventListener("click", onCopyUrl);
    els.btnX.addEventListener("click", openInX);
    els.btnResetTemplate.addEventListener("click", () => {
      els.template.value = DEFAULT_TEMPLATE;
      saveTemplate(DEFAULT_TEMPLATE);
      updatePreview();
    });

    // filters -> apply + persist
    const bindSetting = (el, key, parser = (v)=>v) => {
      const handler = () => {
        settings[key] = parser(el.type === "checkbox" ? el.checked : el.value);
        saveSettings(settings);
        applyFilters();
        startAuto();
      };
      el.addEventListener("change", handler);
      el.addEventListener("input", handler);
    };

    bindSetting(els.timeFilter, "timeFilter", (v)=>Number(v));
    bindSetting(els.delayMin, "delayMin", (v)=>Number(v));
    bindSetting(els.sortBy, "sortBy", (v)=>String(v));
    bindSetting(els.showLimit, "showLimit", (v)=>Number(v));
    bindSetting(els.fetchCap, "fetchCap", (v)=>Number(v));
    bindSetting(els.batchFeeds, "batchFeeds", (v)=>Number(v));
    bindSetting(els.refreshSec, "refreshSec", (v)=>Number(v));
    bindSetting(els.optOnlyReady, "optOnlyReady", (v)=>!!v);
    bindSetting(els.optOnlySpanish, "optOnlySpanish", (v)=>!!v);
    bindSetting(els.optResolveLinks, "optResolveLinks", (v)=>!!v);
    bindSetting(els.optShowOriginal, "optShowOriginal", (v)=>!!v);
    bindSetting(els.optHideUsed, "optHideUsed", (v)=>!!v);
    bindSetting(els.optAutoRefresh, "optAutoRefresh", (v)=>!!v);
    bindSetting(els.catFilter, "catFilter", (v)=>String(v));

    els.searchBox.addEventListener("input", () => applyFilters());

    // initial status
    els.status.textContent = `TNP listo (${APP_VERSION})`;
  }

  async function init(){
    loadUsed();
    loadTrCache();

    state.feeds = loadFeeds();

    bindUI();
    applyFilters();
    startAuto();

    // primer refresh
    refreshAll({ force:true }).catch(()=>{});
  }

  // GO
  init().catch(() => {
    els.status.textContent = "❌ Error init (revisa consola)";
  });
})();
