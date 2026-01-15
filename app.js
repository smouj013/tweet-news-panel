/* app.js — TNP v4.2.0 — BUILD 2026-01-12d — MEMBERSHIP + GOOGLE LOGIN (GIS) + 3 TIERS + HARDENED + TRENDS (OPTIONAL)
   ✅ 100% compatible con tu index.html (IDs + modal + ticker + X mock + botones)
   ✅ Lee config NUEVO (auth/membership/ui/network/features) + compat con config antiguo
   ✅ Login Google (GIS) SIN cuentas propias
   ✅ Membresía: endpoint o allowlist (hash o email allowlist)
   ✅ Gating suave + hardGate opcional (si requireLogin/hardGate en config)
   ✅ Tendencias opcionales (Google Trends RSS) + fallback a “trend candidates” desde titulares
*/

(() => {
  "use strict";

  const APP_VERSION = "tnp-v4.2.0";
  const BUILD_ID = "2026-01-12d";

  // Guard anti-doble-carga (SW / recargas parciales / inline scripts duplicados)
  try{
    const tag = `${APP_VERSION}:${BUILD_ID}`;
    if (window.__TNP_APP_LOADED__?.tag === tag) return;
    window.__TNP_APP_LOADED__ = { tag, at: Date.now() };
  
  // ✅ Motion boot: evita que la UI aparezca “de golpe” al cargar.
  //    (No cambia versiones / solo UX)
  try{ document.documentElement.classList.add("tnp-preload"); }catch{}

  function ensureMotionCss(){
    try{
      if (document.getElementById("tnpMotionCss")) return;
      const css = `
        /* ── TNP Motion Boot (auto-inyectado por app.js) ───────────────────────── */
        .topbar, .ticker, .layout{ transition: opacity .45s ease, transform .45s ease; }
        html.tnp-preload .topbar,
        html.tnp-preload .ticker,
        html.tnp-preload .layout{ opacity:0; transform: translateY(10px); }

        /* Boot splash */
        .tnpBootSplash{
          position:fixed; inset:0; z-index:9999;
          display:flex; align-items:center; justify-content:center;
          background: rgba(7,10,18,0.92);
          backdrop-filter: blur(10px);
        }
        .tnpBootSplash__card{
          width:min(520px, calc(100vw - 40px));
          padding: 18px 18px 16px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(255,255,255,0.06);
          box-shadow: 0 14px 40px rgba(0,0,0,0.55);
        }
        .tnpBootSplash__row{ display:flex; align-items:center; justify-content:space-between; gap:12px; }
        .tnpBootSplash__title{ font-weight: 800; letter-spacing: .2px; }
        .tnpBootSplash__mini{ opacity:.72; font-size: 12px; }
        .tnpBootSplash__msg{ margin-top: 10px; opacity:.88; font-size: 13px; }
        .tnpBootSplash__bar{
          margin-top: 12px; height: 10px; border-radius: 999px;
          background: rgba(255,255,255,0.10); overflow:hidden;
          border: 1px solid rgba(255,255,255,0.12);
        }
        .tnpBootSplash__bar > i{
          display:block; height:100%; width: 18%;
          background: rgba(29,155,240,0.55);
          border-right: 1px solid rgba(255,255,255,0.18);
          transform: translateX(-30%);
          animation: tnpBootBar 1.15s ease-in-out infinite;
        }
        @keyframes tnpBootBar{
          0%{ transform: translateX(-35%); }
          50%{ transform: translateX(420%); }
          100%{ transform: translateX(420%); }
        }
        .tnpBootSplash--out{ opacity:0; transform: translateY(-6px); transition: opacity .35s ease, transform .35s ease; }

        /* Entrada suave de rows solo en el primer render */
        .newsItem.tnp-enter{ opacity:0; transform: translateY(8px); animation: tnpEnter .44s ease forwards; }
        @keyframes tnpEnter{ to{ opacity:1; transform:none; } }

        /* Ad dock (FREE) */
        .tnpAdDock{
          position: fixed; right: 14px; bottom: 14px; z-index: 1200;
          width: min(360px, calc(100vw - 28px));
          opacity: 0; transform: translateY(10px);
          pointer-events: none;
          transition: opacity .25s ease, transform .25s ease;
        }
        .tnpAdDock.is-on{ opacity:1; transform:none; pointer-events: auto; }
        .tnpAdDock__card{
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(255,255,255,0.06);
          box-shadow: 0 14px 40px rgba(0,0,0,0.55);
          overflow:hidden;
        }
        .tnpAdDock__head{
          display:flex; align-items:center; justify-content:space-between; gap:10px;
          padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.10);
          background: rgba(255,255,255,0.03);
        }
        .tnpAdDock__title{ font-weight: 800; font-size: 13px; opacity: .92; }
        .tnpAdDock__btns{ display:flex; gap:8px; }
        .tnpAdDock__btn{
          width: 28px; height: 28px; border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.16);
          background: rgba(255,255,255,0.06);
          color: rgba(231,233,234,0.92);
          cursor: pointer;
        }
        .tnpAdDock__body{ padding: 12px; }
        .tnpAdDock__meta{ font-size: 12px; opacity: .74; margin-bottom: 8px; }
        .tnpAdDock__ctaRow{ display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
        .tnpAdDock__ctaRow a{ text-decoration:none; }

        @media (prefers-reduced-motion: reduce){
          .topbar, .ticker, .layout, .tnpAdDock{ transition:none !important; }
          html.tnp-preload .topbar,
          html.tnp-preload .ticker,
          html.tnp-preload .layout{ opacity:1 !important; transform:none !important; }
          .tnpBootSplash__bar > i{ animation:none !important; }
          .newsItem.tnp-enter{ animation:none !important; opacity:1 !important; transform:none !important; }
        }
      `;
      const st = document.createElement("style");
      st.id = "tnpMotionCss";
      st.textContent = css;
      (document.head || document.documentElement).appendChild(st);
    }catch{}
  }

  ensureMotionCss();

  function createBootSplash(){
    try{
      if (!document.body) return { step:()=>{}, finish:()=>{} };
      let el = document.getElementById("tnpBootSplash");
      if (!el){
        el = document.createElement("div");
        el.id = "tnpBootSplash";
        el.className = "tnpBootSplash";
        el.innerHTML = `
          <div class="tnpBootSplash__card" role="status" aria-live="polite">
            <div class="tnpBootSplash__row">
              <div class="tnpBootSplash__title">TNP</div>
              <div class="tnpBootSplash__mini">Cargando…</div>
            </div>
            <div class="tnpBootSplash__msg" id="tnpBootMsg">Preparando panel…</div>
            <div class="tnpBootSplash__bar" aria-hidden="true"><i></i></div>
          </div>
        `;
        document.body.appendChild(el);
      }
      const mini = el.querySelector(".tnpBootSplash__mini");
      const msgEl = el.querySelector("#tnpBootMsg");

      let done = false;
      const t0 = Date.now();
      const minVisibleMs = 650;

      const api = {
        step(text, pct){
          try{
            if (done) return;
            if (mini) mini.textContent = (typeof pct === "number" && isFinite(pct)) ? `Cargando… ${Math.max(0, Math.min(99, Math.round(pct)))}%` : "Cargando…";
            if (msgEl && text) msgEl.textContent = String(text);
          }catch{}
        },
        finish(){
          try{
            if (done) return;
            done = true;
            const dt = Date.now() - t0;
            const wait = Math.max(0, minVisibleMs - dt);
            setTimeout(() => {
              try{
                el.classList.add("tnpBootSplash--out");
                // Activa entrada de UI
                try{ document.documentElement.classList.remove("tnp-preload"); }catch{}
                setTimeout(() => { try{ el.remove(); }catch{} }, 420);
              }catch{}
            }, wait);
          }catch{}
        }
      };
      return api;
    }catch{
      return { step:()=>{}, finish:()=>{} };
    }
  }

  // Monetización / Ads / Support (config via monetization.json)
  async function loadMonetizationJson(){
    try{
      if (!state || !state.monetization) return null;
      if (state.monetization.loaded) return state.monetization.cfg;
      let cfg = null;
      try{
        const r = await fetch("./monetization.json", { cache:"no-store" });
        if (r && r.ok) cfg = await r.json();
      }catch{}
      state.monetization.cfg = cfg;
      state.monetization.loaded = true;

      // Web Monetization meta (opcional)
      try{
        const wm = cfg && cfg.webMonetization ? cfg.webMonetization : null;
        if (wm && wm.enabled && wm.autoInjectMeta && wm.paymentPointer){
          const name = wm.metaTagName || "monetization";
          let meta = document.querySelector(`meta[name="${name}"]`);
          if (!meta){
            meta = document.createElement("meta");
            meta.setAttribute("name", name);
            document.head.appendChild(meta);
          }
          meta.setAttribute("content", String(wm.paymentPointer));
        }
      }catch{}

      return cfg;
    }catch{
      try{ if (state && state.monetization){ state.monetization.loaded = true; } }catch{}
      return null;
    }
  }

  function readAdsDismissUntil(){
    try{
      const v = Number(localStorage.getItem("tnp_ads_dismiss_until_ms") || 0);
      return Number.isFinite(v) ? v : 0;
    }catch{ return 0; }
  }
  function writeAdsDismissUntil(ms){
    try{ localStorage.setItem("tnp_ads_dismiss_until_ms", String(ms)); }catch{}
  }

  function injectMonetizationUi(){
    try{
      if (!state || !state.monetization) return;
      if (state.monetization.ui && state.monetization.ui.dock) return;

      const topRight =
        document.querySelector(".topbar__right") ||
        document.querySelector(".topbar") ||
        (document.getElementById("status")?.parentElement || null);

      // Support badge (siempre que esté habilitado)
      let btnSupport = document.getElementById("btnSupport");
      if (!btnSupport){
        btnSupport = document.createElement("a");
        btnSupport.id = "btnSupport";
        btnSupport.className = "btn btn--sm btn--x";
        btnSupport.target = "_blank";
        btnSupport.rel = "noopener noreferrer";
        btnSupport.href = "https://ko-fi.com/global_eye";
        btnSupport.textContent = "Apoya ☕";
        btnSupport.style.marginLeft = "8px";
        if (topRight) topRight.appendChild(btnSupport);
      }

      // Ad dock (solo FREE)
      let dock = document.getElementById("tnpAdDock");
      if (!dock){
        dock = document.createElement("div");
        dock.id = "tnpAdDock";
        dock.className = "tnpAdDock";
        dock.innerHTML = `
          <div class="tnpAdDock__card" role="complementary" aria-label="Anuncio / Apoyo">
            <div class="tnpAdDock__head">
              <div class="tnpAdDock__title">Apoya / Sin anuncios</div>
              <div class="tnpAdDock__btns">
                <button class="tnpAdDock__btn" type="button" data-act="min" title="Minimizar" aria-label="Minimizar">–</button>
                <button class="tnpAdDock__btn" type="button" data-act="close" title="Cerrar" aria-label="Cerrar">×</button>
              </div>
            </div>
            <div class="tnpAdDock__body">
              <div class="tnpAdDock__meta" id="tnpAdDockMeta">Cargando…</div>
              <div id="tnpAdDockSlot"></div>
              <div style="height:10px"></div>
              <div class="tnpAdDock__ctaRow" id="tnpAdDockCtas"></div>
            </div>
          </div>
        `;
        document.body.appendChild(dock);

        const onClose = () => {
          try{
            const until = Date.now() + 6*60*60*1000; // 6h
            state.monetization.dismissUntilMs = until;
            writeAdsDismissUntil(until);
            dock.classList.remove("is-on");
          }catch{}
        };
        const onMin = () => {
          try{
            dock.classList.remove("is-on");
            const until = Date.now() + 30*60*1000; // 30m
            state.monetization.dismissUntilMs = until;
            writeAdsDismissUntil(until);
          }catch{}
        };

        dock.querySelector('[data-act="close"]')?.addEventListener("click", onClose);
        dock.querySelector('[data-act="min"]')?.addEventListener("click", onMin);
      }

      state.monetization.ui = { dock, btnSupport };
    }catch{}
  }

  function updateMonetizationUi(){
    try{
      if (!state || !state.monetization) return;
      const ui = state.monetization.ui;
      if (!ui || !ui.dock) return;

      const cfg = state.monetization.cfg || {};
      const uiCfg = cfg.ui || {};
      const donations = cfg.donations || {};
      const ads = cfg.ads || {};

      // support badge
      if (ui.btnSupport){
        const show = !!(uiCfg && uiCfg.showSupportBadge);
        ui.btnSupport.style.display = show ? "" : "none";
        ui.btnSupport.textContent = uiCfg.supportBadgeText ? String(uiCfg.supportBadgeText) : "Apoya ☕";
        ui.btnSupport.href = uiCfg.supportUrl ? String(uiCfg.supportUrl) : (donations?.links?.kofi || "https://ko-fi.com/global_eye");
      }

      const tier = (state.member && state.member.tier) ? String(state.member.tier) : "free";
      const showFor = asArray(ads.showForTiers, ["free"]).map(x => String(x||"").toLowerCase());
      const enabled = !!ads.enabled;

      const dismissUntil = state.monetization.dismissUntilMs || readAdsDismissUntil() || 0;
      state.monetization.dismissUntilMs = dismissUntil;

      const canShow = enabled && showFor.includes(String(tier).toLowerCase()) && (Date.now() > dismissUntil);

      // No enseñes anuncios en tiers superiores
      if (!canShow){
        ui.dock.classList.remove("is-on");
        return;
      }

      // Relleno contenido
      const meta = ui.dock.querySelector("#tnpAdDockMeta");
      const slot = ui.dock.querySelector("#tnpAdDockSlot");
      const ctas = ui.dock.querySelector("#tnpAdDockCtas");

      if (meta){
        meta.textContent = (ads.labelText ? String(ads.labelText) : "Anuncio/Apoyo (solo FREE). Pásate a PRO/ELITE para ocultarlo.");
      }
      if (ctas){
        ctas.innerHTML = "";
        const supportUrl = (uiCfg.supportUrl || donations?.links?.kofi || "https://ko-fi.com/global_eye");
        const a1 = document.createElement("a");
        a1.className = "btn btn--sm btn--x";
        a1.href = supportUrl;
        a1.target = "_blank";
        a1.rel = "noopener noreferrer";
        a1.textContent = "Apoyar ☕";
        ctas.appendChild(a1);

        const a2 = document.createElement("button");
        a2.className = "btn btn--sm";
        a2.type = "button";
        a2.textContent = "Quitar anuncios (Membresía)";
        a2.addEventListener("click", () => { try{ setMemberModalOpen(true); }catch{} });
        ctas.appendChild(a2);
      }

      // Provider: adsense o house
      if (slot){
        slot.innerHTML = "";
        const provider = String(ads.provider || "house").toLowerCase();
        if (provider === "adsense" && ads.adsense && ads.adsense.client && ads.adsense.slot){
          const client = String(ads.adsense.client);
          const adSlot = String(ads.adsense.slot);
          // Script adsense (solo 1 vez)
          if (!document.querySelector('script[data-tnp-adsense="1"]')){
            const sc = document.createElement("script");
            sc.async = true;
            sc.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(client);
            sc.crossOrigin = "anonymous";
            sc.setAttribute("data-tnp-adsense","1");
            document.head.appendChild(sc);
          }
          const ins = document.createElement("ins");
          ins.className = "adsbygoogle";
          ins.style.display = "block";
          ins.setAttribute("data-ad-client", client);
          ins.setAttribute("data-ad-slot", adSlot);
          ins.setAttribute("data-ad-format", String(ads.adsense.format || "auto"));
          ins.setAttribute("data-full-width-responsive", String(ads.adsense.fullWidthResponsive !== false));
          slot.appendChild(ins);
          try{ (window.adsbygoogle = window.adsbygoogle || []).push({}); }catch{}
        }else{
          // House ad simple
          const h = (Array.isArray(cfg.houseAds) && cfg.houseAds.length) ? cfg.houseAds[0] : null;
          const box = document.createElement("div");
          box.className = "panel";
          box.style.margin = "0";
          box.innerHTML = `
            <div class="panel__head" style="padding:10px 10px 8px;">
              <div class="panel__title panel__title--sm">${h?.title ? String(h.title) : "Apoya el proyecto"}</div>
              <div class="mini muted">${h?.tag ? String(h.tag) : "Sponsor"}</div>
            </div>
            <div style="padding:10px;">
              <div class="mini" style="opacity:.86; line-height:1.35;">${h?.text ? String(h.text) : "Si te sirve el panel, apóyalo con un café o pásate a membresía para quitar anuncios."}</div>
            </div>
          `;
          slot.appendChild(box);
        }
      }

      // Mostrar con pequeño delay para que no aparezca “de golpe”
      if (!state.monetization.shownOnce){
        state.monetization.shownOnce = true;
        setTimeout(() => { try{ ui.dock.classList.add("is-on"); }catch{} }, 1100);
      }else{
        ui.dock.classList.add("is-on");
      }
    }catch{}
  }

  async function initMonetization(){
    try{
      if (!state || !state.monetization) return;
      await loadMonetizationJson();
      injectMonetizationUi();
      updateMonetizationUi();
    }catch{}
  }

}catch{}

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

  function debounce(fn, ms){
    let t = null;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  function numOr(v, fallback){
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function safeParseJSON(raw) {
    if (raw == null) return undefined;
    try { return JSON.parse(raw); } catch { return undefined; }
  }

  function asObject(v, fallback = {}) {
    return (v && typeof v === "object" && !Array.isArray(v)) ? v : fallback;
  }

  function asArray(v, fallback = []) {
    return Array.isArray(v) ? v : fallback;
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
      const kill = ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","fbclid","gclid","mc_cid","mc_eid","ref","ocid"];
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
    if (/español|españa|méxico|argentina|colombia|chile|perú|venezuela/i.test(feedName || "")) return true;
    if (/[áéíóúñü¿¡]/i.test(t)) return true;
    const low = t.toLowerCase();
    const hasEs = /\b(el|la|los|las|un|una|de|del|y|en|para|por|que|con|según|hoy|ahora)\b/.test(low);
    const hasEn = /\b(the|and|to|from|in|breaking|world|news)\b/.test(low);
    return hasEs && !hasEn;
  }

  function hideBootDiag(){
    const bd = $("bootDiag");
    if (bd) bd.hidden = true;
  }

  /* ───────────────────────────── BOOT CONFIG (/config/boot-config.js) ───────────────────────────── */
  const BOOT = (() => {
    const c = (window.TNP_CONFIG || window.TNP_BOOT_CONFIG || window.__TNP_CONFIG__ || null);
    const cfg = (c && typeof c === "object" && !Array.isArray(c)) ? c : {};

    const auth = asObject(cfg.auth, {});
    const membership = asObject(cfg.membership, {});
    const ui = asObject(cfg.ui, {});
    const network = asObject(cfg.network, {});
    const ticker = asObject(cfg.ticker, {});
    const features = asObject(cfg.features, {});
    const donations = asObject(cfg.donations, {});
    const donationLinks = asObject(donations.links, {});

    const buildTag = String(cfg.buildTag || `${APP_VERSION}_${BUILD_ID}`).trim();

    // Compat: a veces googleClientId está en raíz
    const googleClientId =
      String(cfg.googleClientId || auth.googleClientId || "").trim();

    const requireLogin = (auth.requireLogin === true) || (cfg.requireLogin === true);
    const hardGate = (ui.hardGate === true);
    const autoPrompt = (auth.autoPrompt !== false);
    const rememberSession = (auth.rememberSession !== false);
    const hd = String(auth.hd || "").trim();

    // Tiers visibles (para cards). Si config trae free/pro/elite, mostramos 3 (pro/elite + “basic” fallback si falta).
    const tiersDefault = [
      { id: "basic", name: "Básica", price: "3€/mes", perks: ["Más límites", "Más feeds activos", "Más items por refresh"] },
      { id: "pro",   name: "Pro",   price: "7€/mes", perks: ["Auto-refresh más rápido", "Más OG imágenes", "Más cap de items"] },
      { id: "elite", name: "Elite", price: "15€/mes", perks: ["Máximos límites", "Mejor rendimiento", "Prioridad / features pro"] },
    ];

    // membership.tiers (nuevo) suele traer: free/pro/elite
    let tiersFromCfg = asArray(membership.tiers, []);
    if (tiersFromCfg.length){
      // convertir a formato simple para UI cards
      const map = new Map(tiersFromCfg.map(t => [String(t?.id||"").toLowerCase().trim(), t]));
      const pick = (id, fb) => {
        const t = map.get(id);
        if (!t) return fb;
        return {
          id,
          name: String(t.name || fb.name),
          price: String(t.priceLabel || fb.price),
          perks: asArray(t.perks, fb.perks)
        };
      };
      const basic = pick("basic", tiersDefault[0]);
      const pro   = pick("pro", tiersDefault[1]);
      const elite = pick("elite", tiersDefault[2]);

      // Si no existe basic pero sí free, usamos free como basic “visual”
      if (!map.get("basic") && map.get("free")){
        const freeT = map.get("free");
        tiersFromCfg = [
          { id:"basic", name:String(freeT.name||"Básica"), price:String(freeT.priceLabel||"0€"), perks:asArray(freeT.perks, tiersDefault[0].perks) },
          pro, elite
        ];
      } else {
        tiersFromCfg = [basic, pro, elite];
      }
    }

    const tiers = (tiersFromCfg && tiersFromCfg.length === 3) ? tiersFromCfg : tiersDefault;

    // Monetización: Ko-fi
    const kofiTiersUrl =
      String(cfg.kofiTiersUrl || donationLinks.kofi || "").trim();

    // Membership verify: endpoint o allowlist
    const apiBase = String(membership.apiBase || "").trim();
    const verifyEndpoint =
      String(cfg.membershipEndpoint || membership.verifyEndpoint || (apiBase ? (apiBase.replace(/\/+$/,"") + "/membership") : "") || "").trim();

    const allowlistUrl =
      String(cfg.membershipAllowlistUrl || membership.allowlistUrl || "").trim();

    const salt =
      String(cfg.membershipSalt || membership.salt || "tnp").trim();

    // Trends
    const trendsSourcesUrl =
      String(cfg.trendsSourcesUrl || cfg.trendsSources || membership.trendsSourcesUrl || "./config/tnp.trends.sources.json").trim();

    return {
      buildTag,

      // Proxies
      customProxyTemplate: String(cfg.customProxyTemplate || "").trim(),
      proxyFirst: (cfg.proxyFirst !== false),

      // Defaults composer
      defaultLiveUrl: String(cfg.defaultLiveUrl || cfg.liveUrlDefault || "https://twitch.tv/globaleyetv").trim(),
      defaultHashtags: String(cfg.defaultHashtags || cfg.hashtagsDefault || "").trim(),
      defaultTemplate: String(cfg.defaultTemplate || DEFAULT_TEMPLATE),
      defaultLiveLine: String(cfg.defaultLiveLine || DEFAULT_LIVE_LINE),

      // Traducción
      trEnabledDefault: (cfg.trEnabledDefault !== false),

      // Feeds defaults (si inyectas defaultFeeds)
      defaultFeeds: Array.isArray(cfg.defaultFeeds) ? cfg.defaultFeeds : null,

      // Límites generales
      maxItemsKeep: Math.max(200, Math.min(5000, numOr(cfg.maxItemsKeep, 900))),
      visibleTranslateLimit: Math.max(20, Math.min(200, numOr(cfg.visibleTranslateLimit, 80))),

      // Auth
      googleClientId,
      requireLogin,
      hardGate,
      autoPrompt,
      rememberSession,
      hd,

      // Membership
      membershipEnabled: (membership.enabled !== false),
      allowLocalOverride: (membership.allowLocalOverride === true),
      checkoutUrlTemplate: String(membership.checkoutUrlTemplate || "").trim(),
      manageUrl: String(membership.manageUrl || "").trim(),

      membershipEndpoint: verifyEndpoint,
      membershipAllowlistUrl: allowlistUrl,
      membershipSalt: salt,
      tiers,
      kofiTiersUrl,

      // Network knobs (opcionales)
      fetchTimeoutMs: clamp(numOr(network.fetchTimeoutMs, 20000), 6000, 45000),
      maxConcurrentFeeds: clamp(numOr(network.maxConcurrentFeeds, 6), 2, 20),
      maxConcurrentResolve: clamp(numOr(network.maxConcurrentResolve, 4), 2, 12),
      maxConcurrentOg: clamp(numOr(network.maxConcurrentOg, 4), 2, 12),

      // Ticker knobs
      tickerMaxItems: clamp(numOr(ticker.maxItems, 10), 5, 30),
      tickerSeparator: String(ticker.separator || "   ").slice(0, 12) || "   ",
      popTrends: (ticker.popTrends !== false),
      popDurationMs: clamp(numOr(ticker.popDurationMs, 4200), 2000, 12000),

      // Features
      enableTrends: (features.enableTrends !== false),
      enableOgImages: (features.enableOgImages !== false),
      enableFavicons: (features.enableFavicons !== false),

      trendsSourcesUrl,
    };
  })();

  /* ───────────────────────────── TIERS / LIMITS ───────────────────────────── */
  function normTier(t){
    t = String(t || "").toLowerCase().trim();
    if (t === "basic" || t === "pro" || t === "elite" || t === "free") return t;
    // compat
    if (t === "premium") return "pro";
    if (t === "vip") return "elite";
    return "free";
  }

  // Defaults (si config membership.tiers trae limits, se mezclan)
  const DEFAULT_LIMITS = {
    free:  { maxEnabledFeeds: 10, fetchCapMax: 240, showLimitMax: 120, batchMax: 12, autoMinSec: 60, resolveLimit: 60, ogLimit: 60 },
    basic: { maxEnabledFeeds: 25, fetchCapMax: 600, showLimitMax: 200, batchMax: 20, autoMinSec: 45, resolveLimit: 90, ogLimit: 110 },
    pro:   { maxEnabledFeeds: 60, fetchCapMax: 1400, showLimitMax: 350, batchMax: 35, autoMinSec: 30, resolveLimit: 140, ogLimit: 170 },
    elite: { maxEnabledFeeds: 140, fetchCapMax: 2000, showLimitMax: 500, batchMax: 50, autoMinSec: 20, resolveLimit: 220, ogLimit: 260 },
  };

  // Si TNP_CONFIG.membership.tiers[*].limits existe, úsalo
  function buildLimitsFromConfig(){
    const cfg = asObject(window.TNP_CONFIG, {});
    const mem = asObject(cfg.membership, {});
    const tiers = asArray(mem.tiers, []);
    if (!tiers.length) return null;

    const out = JSON.parse(JSON.stringify(DEFAULT_LIMITS));
    for (const t of tiers){
      const id = normTier(t?.id);
      const lim = asObject(t?.limits, {});
      if (!out[id]) out[id] = JSON.parse(JSON.stringify(DEFAULT_LIMITS.free));

      // Map keys
      if (Number.isFinite(Number(lim.maxFeedsEnabled))) out[id].maxEnabledFeeds = clamp(Number(lim.maxFeedsEnabled), 5, 300);
      if (Number.isFinite(Number(lim.fetchCapMax))) out[id].fetchCapMax = clamp(Number(lim.fetchCapMax), 80, 5000);
      if (Number.isFinite(Number(lim.showLimitMax))) out[id].showLimitMax = clamp(Number(lim.showLimitMax), 10, 1000);
      if (Number.isFinite(Number(lim.minAutoRefreshSec))) out[id].autoMinSec = clamp(Number(lim.minAutoRefreshSec), 10, 600);
      if (Number.isFinite(Number(lim.ogLookupsMax))) out[id].ogLimit = clamp(Number(lim.ogLookupsMax), 0, 1200);
      if (Number.isFinite(Number(lim.resolveMax))) out[id].resolveLimit = clamp(Number(lim.resolveMax), 0, 1200);

      // batchMax (si no viene, deriva un poco)
      const derivedBatch = clamp(Math.round(out[id].maxEnabledFeeds / 4), 6, 60);
      out[id].batchMax = clamp(numOr(out[id].batchMax, derivedBatch), 4, 80);
    }
    return out;
  }

  const TIER_LIMITS = buildLimitsFromConfig() || DEFAULT_LIMITS;

  function tierTitle(t){
    t = normTier(t);
    if (t === "basic") return "BÁSICA";
    if (t === "pro") return "PRO";
    if (t === "elite") return "ELITE";
    return "FREE";
  }

  /* ───────────────────────────── STORAGE ───────────────────────────── */
  const LS_FEEDS    = "tnp_feeds_v4";
  const LS_TEMPLATE = "tnp_template_v4";
  const LS_SETTINGS = "tnp_settings_v4";
  const LS_USED     = "tnp_used_v4";

  const LS_RESOLVE_CACHE = "tnp_resolve_cache_v4";
  const LS_OG_CACHE      = "tnp_og_cache_v4";
  const LS_TR_CACHE      = "tnp_tr_cache_v4";

  const LS_BUILD_ID = "tnp_build_id_v4";

  // Auth session + Membership session
  const LS_AUTH   = "tnp_auth_v1";   // {email,name,picture,sub,expMs}
  const LS_MEMBER = "tnp_member_v1"; // {tier,expMs}

  // Dev override
  const LS_MEM_OVERRIDE = "tnp_membership_override"; // "pro" | "elite" | "basic" | "free"

  // ✅ NUEVO (sin romper nada): persistimos hints/backoff para estabilidad
  const LS_PROXY_HINT = "tnp_proxy_hint_v4";  // { [feedUrl]: idx }
  const LS_BACKOFF    = "tnp_backoff_v4";     // { [feedUrl]: {delayMs, untilMs} }

  /* ───────────────────────────── TRANSLATE (ES) ───────────────────────────── */
  const TR_ENABLED_DEFAULT = true;
  const TR_CONCURRENCY = 2;
  const TR_VISIBLE_LIMIT = BOOT.visibleTranslateLimit;
  const TR_CACHE_LIMIT = 2000;

  const TR_ENDPOINT = (text) =>
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=es&dt=t&q=${encodeURIComponent(text)}`;

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

    tickerSpeed: $("tickerSpeed"),
    tickerSpeedVal: $("tickerSpeedVal"),

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
    return !!(els.newsList && els.btnRefresh && els.btnFeeds && els.status && els.btnX && els.template);
  }

  /* ───────────────────────────── SETTINGS ───────────────────────────── */
  function loadSettings(){
    const raw = safeParseJSON(localStorage.getItem(LS_SETTINGS));
    const s = asObject(raw, {});

    s.liveUrl = s.liveUrl || BOOT.defaultLiveUrl || "https://twitch.tv/globaleyetv";

    s.delayMin   = numOr(s.delayMin, 0);
    s.timeFilter = numOr(s.timeFilter, 60);
    s.showLimit  = numOr(s.showLimit, 120);
    s.fetchCap   = numOr(s.fetchCap, 240);
    s.batchFeeds = numOr(s.batchFeeds, 12);
    s.refreshSec = numOr(s.refreshSec, 60);

    s.sortBy = s.sortBy || "impact";

    s.optOnlyReady    = (s.optOnlyReady === true);
    s.optOnlySpanish  = (s.optOnlySpanish !== false);
    s.optResolveLinks = (s.optResolveLinks !== false);
    s.optShowOriginal = (s.optShowOriginal !== false);
    s.optHideUsed     = (s.optHideUsed !== false);
    s.optAutoRefresh  = (s.optAutoRefresh !== false);

    s.tickerPps = numOr(s.tickerPps, 30);

    s.optIncludeLive   = (s.optIncludeLive !== false);
    s.optIncludeSource = (s.optIncludeSource !== false);

    s.catFilter = s.catFilter || "all";

    s.trEnabled = (s.trEnabled !== false) && TR_ENABLED_DEFAULT && (BOOT.trEnabledDefault !== false);

    if (!s.defaultHashtags && BOOT.defaultHashtags) s.defaultHashtags = BOOT.defaultHashtags;

    return s;
  }

  function saveSettings(s){
    localStorage.setItem(LS_SETTINGS, JSON.stringify(asObject(s, {})));
  }

  const settings = loadSettings();

  try{
    const qs = new URLSearchParams(location.search);
    const v = Number(qs.get("tickerPps"));
    if (Number.isFinite(v)) settings.tickerPps = clamp(v, 10, 220);
  }catch{}

  function loadTemplate(){
    const t = localStorage.getItem(LS_TEMPLATE);
    if (t && t.trim()) return t;
    return (BOOT.defaultTemplate && String(BOOT.defaultTemplate).trim())
      ? String(BOOT.defaultTemplate)
      : DEFAULT_TEMPLATE;
  }

  function saveTemplate(t){
    localStorage.setItem(LS_TEMPLATE, String(t || DEFAULT_TEMPLATE));
  }

  /* ───────────────────────────── AUTH + MEMBERSHIP SESSION ───────────────────────────── */
  function getAuthStore(){
    // rememberSession=false => sessionStorage
    try { return BOOT.rememberSession ? localStorage : sessionStorage; }
    catch { return localStorage; }
  }

  function loadAuth(){
    const store = getAuthStore();

    // Migración: si alguien guardó email dentro de LS_MEMBER viejo, intentamos recuperar
    const legacyMember = safeParseJSON(localStorage.getItem(LS_MEMBER));
    const legacyObj = asObject(legacyMember, {});

    const raw = safeParseJSON(store.getItem(LS_AUTH));
    const a = asObject(raw, {});

    const expMs = Number(a.expMs || 0);
    const email = String(a.email || legacyObj.email || "").toLowerCase().trim();
    const sub = String(a.sub || legacyObj.sub || "").trim();

    if (!email || !expMs || expMs < nowMs()){
      return { email:"", name:"", picture:"", sub:"", expMs:0 };
    }

    return {
      email,
      name: String(a.name || legacyObj.name || ""),
      picture: String(a.picture || legacyObj.picture || ""),
      sub,
      expMs,
    };
  }

  function saveAuth(a){
    const store = getAuthStore();
    store.setItem(LS_AUTH, JSON.stringify(asObject(a, {})));
  }

  function clearAuth(){
    const store = getAuthStore();
    try{ store.removeItem(LS_AUTH); }catch{}
  }

  function loadMember(){
    const raw = safeParseJSON(localStorage.getItem(LS_MEMBER));
    const m = asObject(raw, {});
    const expMs = Number(m.expMs || 0);
    const tier = normTier(m.tier);
    if (!expMs || expMs < nowMs()){
      return { tier:"free", expMs:0 };
    }
    return { tier, expMs };
  }

  function saveMember(m){
    localStorage.setItem(LS_MEMBER, JSON.stringify(asObject(m, {})));
  }

  function clearMember(){
    try{ localStorage.removeItem(LS_MEMBER); }catch{}
  }

  function isAuthed(){
    return !!(state.auth.email && state.auth.expMs && state.auth.expMs > nowMs());
  }

  function canUseApp(){
    if (!BOOT.requireLogin) return true;
    return isAuthed();
  }

  function base64UrlToUtf8(s){
    try{
      s = String(s || "").replace(/-/g, "+").replace(/_/g, "/");
      const pad = s.length % 4;
      if (pad) s += "=".repeat(4 - pad);
      const bin = atob(s);
      const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
      const dec = new TextDecoder("utf-8");
      return dec.decode(bytes);
    }catch{ return ""; }
  }

  function decodeJwtPayload(jwt){
    try{
      const parts = String(jwt || "").split(".");
      if (parts.length < 2) return null;
      const json = base64UrlToUtf8(parts[1]);
      const obj = JSON.parse(json);
      return obj && typeof obj === "object" ? obj : null;
    }catch{ return null; }
  }

  async function sha256Hex(str){
    const data = new TextEncoder().encode(String(str || ""));
    const buf = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,"0")).join("");
  }

  function getOverrideTier(){
    if (!BOOT.allowLocalOverride) return "";
    try{
      const t = String(localStorage.getItem(LS_MEM_OVERRIDE) || "").trim();
      return normTier(t);
    }catch{
      return "";
    }
  }

  // ✅ NUEVO: fetch con timeout (para membership, sin depender del resto del pipeline)
  async function fetchWithTimeout(url, opts, ms){
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort("timeout"), ms);
    try{
      const o = Object.assign({}, opts || {});
      o.signal = ctrl.signal;
      return await fetch(url, o);
    } finally {
      clearTimeout(t);
    }
  }

  async function verifyMembership({ email, credential }){
    email = String(email || "").toLowerCase().trim();
    if (!email) return { tier:"free", expMs:0 };

    // Dev override (si config lo permite)
    const overrideTier = getOverrideTier();
    if (overrideTier && overrideTier !== "free"){
      return { tier: overrideTier, expMs: nowMs() + 30*24*60*60*1000, raw:{ override:true } };
    }

    if (!BOOT.membershipEnabled){
      return { tier:"free", expMs: 0 };
    }

    const MEM_TIMEOUT = clamp(Math.round(BOOT.fetchTimeoutMs * 0.75), 6000, 18000);

    // A) Endpoint
    if (BOOT.membershipEndpoint){
      try{
        const r = await fetchWithTimeout(BOOT.membershipEndpoint, {
          method: "POST",
          headers: { "Content-Type":"application/json" },
          cache: "no-store",
          credentials: "omit",
          body: JSON.stringify({
            email,
            credential: String(credential || ""),
            app: APP_VERSION,
            build: BUILD_ID
          })
        }, MEM_TIMEOUT);

        if (!r.ok) throw new Error("HTTP " + r.status);
        const j = await r.json();
        const tier = normTier(j.tier);
        const expMs = Number(j.expMs || 0);
        return { tier, expMs: Number.isFinite(expMs) ? expMs : 0, raw: j };
      }catch{
        // cae a allowlist si existe
      }
    }

    // B) Allowlist (dos modos)
    if (BOOT.membershipAllowlistUrl){
      try{
        const r = await fetchWithTimeout(BOOT.membershipAllowlistUrl, { cache:"no-store", credentials:"omit" }, MEM_TIMEOUT);
        if (!r.ok) throw new Error("HTTP " + r.status);
        const j = await r.json();

        // B1) Hash mode: { salt, members:[{h,tier,expMs}] }
        if (Array.isArray(j.members)){
          const salt = String(j.salt || BOOT.membershipSalt || "tnp");
          const members = j.members;
          const h = await sha256Hex(`${salt}:${email}`);
          const hit = members.find(x => String(x?.h || "").toLowerCase() === h);
          const tier = normTier(hit?.tier);
          const expMs = Number(hit?.expMs || 0);
          return { tier, expMs: Number.isFinite(expMs) ? expMs : 0, raw: hit || null };
        }

        // B2) Email allowlist mode (tipo member.json): { allow:[...], roles:{email:"admin|pro|elite|basic"}, expMs? }
        const allow = asArray(j.allow, []);
        if (allow.length){
          const ok = allow.map(x => String(x||"").toLowerCase().trim()).includes(email);
          if (!ok) return { tier:"free", expMs:0, raw:null };

          const roles = asObject(j.roles, {});
          const role = String(roles[email] || "").toLowerCase().trim();

          // Mapeo roles -> tier
          let tier = "pro";
          if (role === "elite" || role === "vip") tier = "elite";
          else if (role === "basic" || role === "free") tier = "basic";
          else if (role === "admin") tier = "elite";
          else if (role === "pro") tier = "pro";

          const expMs = Number(j.expMs || 0) || (nowMs() + 30*24*60*60*1000);
          return { tier: normTier(tier), expMs, raw:{ allowlist:true, role } };
        }

      }catch{
        return { tier:"free", expMs:0 };
      }
    }

    return { tier:"free", expMs:0 };
  }

  /* ───────────────────────────── STATE ───────────────────────────── */
  const state = {
    feeds: [],
    items: [],
    filtered: [],
    selectedId: null,

    // UX
    hasRenderedOnce: false,
    bootSplashShown: false,

    monetization: {
      loaded: false,
      cfg: null,
      ui: null,
      dismissUntilMs: 0,
      shownOnce: false,
    },

    used: new Set(),

    refreshInFlight: false,
    refreshAbort: null,
    refreshSeq: 0,

    autoTimer: null,
    uiTickTimer: null,

    resolveCache: new Map(),
    ogCache: new Map(),
    trCache: new Map(),

    backoff: new Map(),

    lastTickerSig: "",
    lastTickerPps: null,

    swReg: null,
    proxyHint: new Map(),

    trQueueRunning: false,
    trInFlight: new Set(),
    trDebounceTimer: null,

    lastBuiltTweet: "",
    lastRenderSig: "",

    // ✅ NUEVO: referencias directas para ages (evita querySelector masivo)
    ageElMap: new Map(),

    // Sessions
    auth: loadAuth(),
    member: loadMember(),

    // Membership UI
    memberUi: { btn:null, pill:null, modal:null },

    // Trends external
    trends: {
      sourcesLoaded: false,
      sources: null,
      tags: [],
      lastSig: "",
      timer: null,
      lastFetchMs: 0,
    },

    // auth gate overlay
    gateEl: null,
  };

  function tierLimits(){
    const t = normTier(state.member.tier);
    return TIER_LIMITS[t] || TIER_LIMITS.free;
  }

  function applyTierLimitsToUi(){
    const lim = tierLimits();

    const clampInput = (el, min, max) => {
      if (!el) return;
      const raw = (el.value != null) ? el.value : el.getAttribute("value");
      const v = clamp(numOr(raw, min), min, max);
      el.value = String(v);
    };

    clampInput(els.fetchCap, 80, lim.fetchCapMax);
    clampInput(els.showLimit, 10, lim.showLimitMax);
    clampInput(els.batchFeeds, 2, lim.batchMax);

    if (els.refreshSec){
      const v = clamp(numOr(els.refreshSec.value, settings.refreshSec || 60), lim.autoMinSec, 600);
      els.refreshSec.value = String(v);
    }

    settings.fetchCap = clamp(numOr(els.fetchCap?.value, settings.fetchCap), 80, lim.fetchCapMax);
    settings.showLimit = clamp(numOr(els.showLimit?.value, settings.showLimit), 10, lim.showLimitMax);
    settings.batchFeeds = clamp(numOr(els.batchFeeds?.value, settings.batchFeeds), 2, lim.batchMax);
    settings.refreshSec = clamp(numOr(els.refreshSec?.value, settings.refreshSec), lim.autoMinSec, 600);
    saveSettings(settings);

    enforceEnabledFeedsLimit();
  }

  function enforceEnabledFeedsLimit(){
    const lim = tierLimits();
    const enabled = state.feeds.filter(f => f.enabled);
    if (enabled.length <= lim.maxEnabledFeeds) return;

    let toDisable = enabled.length - lim.maxEnabledFeeds;
    for (let i = state.feeds.length - 1; i >= 0 && toDisable > 0; i--){
      if (state.feeds[i].enabled){
        state.feeds[i].enabled = false;
        toDisable--;
      }
    }
    try{ localStorage.setItem(LS_FEEDS, JSON.stringify(state.feeds)); }catch{}
  }

  function loadUsed(){
    const raw = safeParseJSON(localStorage.getItem(LS_USED));
    const arr = asArray(raw, []);
    state.used = new Set(arr.filter(x => typeof x === "string").slice(0, 5000));
  }

  function saveUsed(){
    localStorage.setItem(LS_USED, JSON.stringify(Array.from(state.used).slice(0, 5000)));
  }

  function loadCaches(){
    const rcRaw = safeParseJSON(localStorage.getItem(LS_RESOLVE_CACHE));
    const rc = asObject(rcRaw, {});
    for (const [k,v] of Object.entries(rc)){
      if (typeof v === "string") state.resolveCache.set(k, v);
    }

    const ogRaw = safeParseJSON(localStorage.getItem(LS_OG_CACHE));
    const og = asObject(ogRaw, {});
    for (const [k,v] of Object.entries(og)){
      if (v && typeof v === "object") state.ogCache.set(k, v);
      if (v === null) state.ogCache.set(k, null);
    }

    const trRaw = safeParseJSON(localStorage.getItem(LS_TR_CACHE));
    const tr = asObject(trRaw, {});
    for (const [k,v] of Object.entries(tr)){
      if (typeof v === "string") state.trCache.set(k, v);
      if (v === null) state.trCache.set(k, null);
    }
  }

  // ✅ NUEVO: carga hints/backoff persistidos (best-effort)
  function loadProxyHints(){
    try{
      const raw = safeParseJSON(localStorage.getItem(LS_PROXY_HINT));
      const o = asObject(raw, {});
      for (const [k,v] of Object.entries(o)){
        const n = Number(v);
        if (k && Number.isFinite(n)) state.proxyHint.set(k, n);
      }
    }catch{}
  }

  function loadBackoff(){
    try{
      const raw = safeParseJSON(localStorage.getItem(LS_BACKOFF));
      const o = asObject(raw, {});
      for (const [k,v] of Object.entries(o)){
        const vv = asObject(v, null);
        if (!vv) continue;
        const delayMs = Number(vv.delayMs || 0);
        const untilMs = Number(vv.untilMs || 0);
        if (k && Number.isFinite(delayMs) && Number.isFinite(untilMs)){
          state.backoff.set(k, { delayMs, untilMs });
        }
      }
    }catch{}
  }

  const saveProxyHintsThrottled = debounce(() => {
    try{
      const out = {};
      let i = 0;
      for (const [k,v] of state.proxyHint.entries()){
        out[k] = v;
        if (++i > 1200) break;
      }
      localStorage.setItem(LS_PROXY_HINT, JSON.stringify(out));
    }catch{}
  }, 700);

  const saveBackoffThrottled = debounce(() => {
    try{
      const out = {};
      let i = 0;
      for (const [k,v] of state.backoff.entries()){
        out[k] = { delayMs: Number(v?.delayMs || 0), untilMs: Number(v?.untilMs || 0) };
        if (++i > 2000) break;
      }
      localStorage.setItem(LS_BACKOFF, JSON.stringify(out));
    }catch{}
  }, 700);

  const saveCachesThrottled = debounce(() => {
    try{
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

      const trOut = {};
      i = 0;
      for (const [k,v] of state.trCache.entries()){
        trOut[k] = v;
        if (++i > TR_CACHE_LIMIT) break;
      }
      localStorage.setItem(LS_TR_CACHE, JSON.stringify(trOut));
    }catch{}
  }, 600);

  /* ───────────────────────────── DEFAULT FEEDS ───────────────────────────── */
  const DIRECT_FEEDS = [
    { name:"RTVE — Portada (RSS)", url:"https://www.rtve.es/api/noticias.rss", enabled:true, cat:"spain" },
    { name:"El País — Portada (MRSS)", url:"https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada", enabled:true, cat:"spain" },
    { name:"El Mundo — Portada (RSS)", url:"https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml", enabled:true, cat:"spain" },
    { name:"La Vanguardia — Portada (RSS)", url:"https://www.lavanguardia.com/mvc/feed/rss/home.xml", enabled:true, cat:"spain" },
    { name:"ABC — Portada (RSS)", url:"https://www.abc.es/rss/feeds/abcPortada.xml", enabled:true, cat:"spain" },
    { name:"20minutos — Portada (RSS)", url:"https://www.20minutos.es/rss/", enabled:true, cat:"spain" },
    { name:"El Confidencial — España (RSS)", url:"https://rss.elconfidencial.com/espana/", enabled:true, cat:"spain" },
    { name:"Europa Press — Portada (RSS)", url:"https://www.europapress.es/rss/rss.aspx?ch=69", enabled:true, cat:"spain" },

    { name:"BBC — World (RSS)", url:"https://feeds.bbci.co.uk/news/world/rss.xml", enabled:true, cat:"world" },
    { name:"The Guardian — World (RSS)", url:"https://www.theguardian.com/world/rss", enabled:true, cat:"world" },
    { name:"Al Jazeera — All (RSS)", url:"https://www.aljazeera.com/xml/rss/all.xml", enabled:true, cat:"world" },
    { name:"DW Español — Portada (RSS)", url:"https://rss.dw.com/rdf/rss-es-all", enabled:true, cat:"world" },
    { name:"Euronews — Español (MRSS)", url:"https://www.euronews.com/rss?format=mrss", enabled:true, cat:"world" },

    { name:"Expansión — Portada (RSS)", url:"https://e00-expansion.uecdn.es/rss/portada.xml", enabled:true, cat:"economy" },
    { name:"Cinco Días — Portada (MRSS)", url:"https://feeds.elpais.com/mrss-s/pages/ep/site/cincodias.com/portada", enabled:true, cat:"economy" },
    { name:"El Blog Salmón (RSS)", url:"https://feeds.weblogssl.com/elblogsalmon", enabled:true, cat:"economy" },

    { name:"Xataka (RSS)", url:"https://feeds.weblogssl.com/xataka2", enabled:true, cat:"tech" },
    { name:"Genbeta (RSS)", url:"https://feeds.weblogssl.com/genbeta", enabled:true, cat:"tech" },

    { name:"El Confidencial — Sucesos (RSS)", url:"https://rss.elconfidencial.com/espana/sucesos/", enabled:true, cat:"crime" },
  ];

  const DEFAULT_FEEDS = Array.isArray(BOOT.defaultFeeds) && BOOT.defaultFeeds.length
    ? BOOT.defaultFeeds
    : [...DIRECT_FEEDS];

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
    const raw = safeParseJSON(localStorage.getItem(LS_FEEDS));
    const saved = asArray(raw, null);

    if (Array.isArray(saved)){
      const cleaned = saved.map(normalizeFeed).filter(Boolean);
      if (cleaned.length){
        localStorage.setItem(LS_FEEDS, JSON.stringify(cleaned));
        return cleaned;
      }
    }
    const defaults = DEFAULT_FEEDS.map(normalizeFeed).filter(Boolean);
    localStorage.setItem(LS_FEEDS, JSON.stringify(defaults));
    return defaults;
  }

  function saveFeeds(){
    enforceEnabledFeedsLimit();
    localStorage.setItem(LS_FEEDS, JSON.stringify(state.feeds));
  }

  /* ───────────────────────────── MODAL FEEDS ───────────────────────────── */
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

    const lim = tierLimits();
    let enabledCount = state.feeds.filter(f => f.enabled).length;

    for (let i=0;i<state.feeds.length;i++){
      const f = state.feeds[i];

      const row = document.createElement("div");
      row.className = "feedRow";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!f.enabled;

      cb.addEventListener("change", () => {
        if (cb.checked && enabledCount >= lim.maxEnabledFeeds){
          cb.checked = false;
          f.enabled = false;
          setStatus(`🔒 Límite de feeds activos: ${lim.maxEnabledFeeds} (${tierTitle(state.member.tier)}).`);
          return;
        }
        f.enabled = cb.checked;
        enabledCount = state.feeds.filter(x => x.enabled).length;
      });

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
        state.feeds.splice(i, 1);
        renderFeedsModal();
      });

      row.append(cb, meta, cat, del);
      els.feedList.appendChild(row);
    }
  }

  /* ───────────────────────────── STATUS ───────────────────────────── */
  function setStatus(msg){
    try{
      if (els.status) els.status.textContent = msg;
    }catch{}
  }

  /* ───────────────────────────── FETCH (CORS SAFE + ANTI-PREFLIGHT) ───────────────────────────── */
  function withTimeout(ms, signal){
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort("timeout"), ms);

    if (signal){
      if (signal.aborted) ctrl.abort(signal.reason);
      else signal.addEventListener("abort", () => ctrl.abort(signal.reason), { once:true });
    }

    return {
      signal: ctrl.signal,
      cancel: () => { clearTimeout(t); try{ ctrl.abort("cancel"); }catch{} }
    };
  }

  function bustUrl(url){
    try{
      const u = new URL(url);
      u.searchParams.set("__tnp", `${APP_VERSION}_${BUILD_ID}_${nowMs().toString(36)}`);
      return u.toString();
    }catch{
      const sep = url.includes("?") ? "&" : "?";
      return url + sep + "__tnp=" + encodeURIComponent(`${APP_VERSION}_${BUILD_ID}_${nowMs().toString(36)}`);
    }
  }

  function applyProxyTemplate(tpl, rawUrl, encUrl){
    if (!tpl) return "";
    return String(tpl)
      .replaceAll("{{URL}}", rawUrl)
      .replaceAll("{{ENCODED_URL}}", encUrl);
  }

  function makeProxyCandidates(targetUrl){
    const raw = bustUrl(targetUrl);
    const enc = encodeURIComponent(raw);
    const out = [];

    if (BOOT.customProxyTemplate){
      out.push(applyProxyTemplate(BOOT.customProxyTemplate, raw, enc));
    }

    out.push(`https://corsproxy.io/?url=${enc}`);
    out.push(`https://api.allorigins.win/raw?url=${enc}`);
    out.push(`https://api.codetabs.com/v1/proxy?quest=${enc}`);
    out.push(`https://thingproxy.freeboard.io/fetch/${raw}`);
    out.push(`https://r.jina.ai/${raw}`);

    return out;
  }

  async function fetchText(url, signal, accept){
    const { signal: s2, cancel } = withTimeout(BOOT.fetchTimeoutMs, signal);
    try{
      const headers = {};
      if (accept) headers["Accept"] = accept;

      const r = await fetch(url, {
        signal: s2,
        cache: "no-store",
        redirect: "follow",
        credentials: "omit",
        headers
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.text();
    } finally {
      cancel();
    }
  }

  function extractXmlFromText(text){
    let s = String(text || "");
    s = s.replace(/^\uFEFF/, "").trim();

    const needles = ["<?xml", "<rss", "<feed", "<rdf:RDF", "<RDF", "<channel"];
    let best = -1;

    for (const n of needles){
      const i = s.indexOf(n);
      if (i >= 0 && (best < 0 || i < best)) best = i;
    }

    if (best < 0){
      const lt = s.indexOf("<");
      if (lt >= 0) best = lt;
    }

    if (best > 0) s = s.slice(best).trim();
    return s;
  }

  async function fetchTextSmart(targetUrl, signal){
    const accept = "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.7";
    const proxies = makeProxyCandidates(targetUrl);
    const candidates = BOOT.proxyFirst ? [...proxies, targetUrl] : [targetUrl, ...proxies];

    const hint = state.proxyHint.get(targetUrl);
    if (Number.isFinite(hint) && hint >= 0 && hint < candidates.length){
      const hinted = candidates[hint];
      candidates.splice(hint, 1);
      candidates.unshift(hinted);
    }

    let lastErr = null;

    for (let i=0; i<candidates.length; i++){
      const u = candidates[i];
      try{
        const txt = await fetchText(u, signal, accept);
        const xml = extractXmlFromText(txt);
        if (!xml || xml.length < 40) throw new Error("empty");
        state.proxyHint.set(targetUrl, i);
        saveProxyHintsThrottled(); // ✅ persistimos el hint
        return xml;
      }catch(e){
        lastErr = e;
        await sleep(60);
      }
    }

    throw lastErr || new Error("fetch_failed");
  }

  async function fetchHtmlSmart(targetUrl, signal){
    const accept = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
    const proxies = makeProxyCandidates(targetUrl);
    const candidates = BOOT.proxyFirst ? [...proxies, targetUrl] : [targetUrl, ...proxies];

    let lastErr = null;
    for (const u of candidates){
      try{
        return await fetchText(u, signal, accept);
      }catch(e){
        lastErr = e;
        await sleep(60);
      }
    }
    throw lastErr || new Error("html_fetch_failed");
  }

  async function fetchJsonSmart(targetUrl, signal){
    const accept = "application/json, text/plain, */*;q=0.8";
    const proxies = makeProxyCandidates(targetUrl);
    const candidates = BOOT.proxyFirst ? [...proxies, targetUrl] : [targetUrl, ...proxies];

    let lastErr = null;
    for (const u of candidates){
      try{
        const txt = await fetchText(u, signal, accept);
        let raw = String(txt || "").trim();
        raw = raw.replace(/^\)\]\}'\s*\n?/, "").trim();

        const startArr = raw.indexOf("[");
        const startObj = raw.indexOf("{");
        const s = (startArr >= 0 && (startObj < 0 || startArr < startObj))
          ? raw.slice(startArr)
          : (startObj >= 0 ? raw.slice(startObj) : raw);

        return JSON.parse(s);
      }catch(e){
        lastErr = e;
        await sleep(60);
      }
    }
    throw lastErr || new Error("json_fetch_failed");
  }

  async function mapLimit(arr, limit, fn, signal){
    const a = Array.isArray(arr) ? arr : [];
    const out = new Array(a.length);
    let idx = 0;

    const workers = new Array(Math.max(1, limit)).fill(0).map(async () => {
      while (idx < a.length){
        if (signal?.aborted) return;
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

  function pickFirstImgFromHtml(html){
    if (!html) return "";
    const m = String(html).match(/<img[^>]+src=["']([^"']+)["']/i);
    return (m && m[1]) ? m[1].trim() : "";
  }

  function pickImageFromNode(node, baseUrl){
    const mc = node.querySelector("media\\:content, content[url]");
    if (mc && mc.getAttribute("url")) return cleanUrl(absolutizeUrl(mc.getAttribute("url"), baseUrl));

    const mt = node.querySelector("media\\:thumbnail");
    if (mt && mt.getAttribute("url")) return cleanUrl(absolutizeUrl(mt.getAttribute("url"), baseUrl));

    const enc = node.querySelector("enclosure[url]");
    if (enc){
      const type = (enc.getAttribute("type") || "").toLowerCase();
      const url = enc.getAttribute("url");
      if (url && (!type || type.includes("image"))) return cleanUrl(absolutizeUrl(url, baseUrl));
    }

    const al = node.querySelector("link[rel='enclosure'][href]");
    if (al) return cleanUrl(absolutizeUrl(al.getAttribute("href"), baseUrl));

    const desc = node.querySelector("description")?.textContent || "";
    const cont = node.querySelector("content\\:encoded")?.textContent || "";
    const img = pickFirstImgFromHtml(cont || desc);
    if (img) return cleanUrl(absolutizeUrl(img, baseUrl));

    return "";
  }

  function baseItem(feed, url, ts, title){
    const clean = cleanUrl(url);
    return {
      id: makeId(feed.name, clean, ts, title),
      feedName: feed.name,
      cat: feed.cat || "all",
      title: title || "",
      originalTitle: title || "",
      translated: false,

      link: clean,
      dateMs: ts,
      domain: domainOf(clean),
      img: "",
      resolvedUrl: "",
      ready: false,
      top: false,

      // optional UI
      favicon: "",
    };
  }

  function parseRss(doc, feed){
    const items = [];
    const nodes = [...doc.querySelectorAll("item")];

    for (const it of nodes){
      const title = stripHtml(it.querySelector("title")?.textContent || "");
      let link = (it.querySelector("link")?.textContent || "").trim();
      const guid = (it.querySelector("guid")?.textContent || "").trim();

      // Algunas RSS meten link como <link href="...">
      if (!link){
        const linkEl = it.querySelector("link[href]");
        if (linkEl) link = (linkEl.getAttribute("href") || "").trim();
      }

      const pub =
        (it.querySelector("pubDate")?.textContent || "").trim() ||
        (it.querySelector("dc\\:date")?.textContent || "").trim();

      const dateMs = pub ? Date.parse(pub) : NaN;
      const ts = Number.isFinite(dateMs) ? dateMs : nowMs();

      const url = cleanUrl(link || guid);
      if (!url) continue;

      const item = baseItem(feed, url, ts, title);
      item.img = pickImageFromNode(it, url) || "";
      items.push(item);
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

      const url = cleanUrl(link);
      if (!url) continue;

      const item = baseItem(feed, url, ts, title);
      item.img = pickImageFromNode(e, url) || "";
      items.push(item);
    }
    return items;
  }

  function parseFeed(xmlText, feed){
    const xml = extractXmlFromText(xmlText);
    const doc = parseXml(xml);
    if (doc.querySelector("rss")) return parseRss(doc, feed);
    if (doc.querySelector("feed")) return parseAtom(doc, feed);
    if (doc.querySelector("channel item")) return parseRss(doc, feed);
    return [];
  }

  /* ───────────────────────────── OG IMAGE BEST-EFFORT ───────────────────────────── */
  function extractOgImage(html, pageUrl){
    const getMeta = (re) => {
      const m = String(html || "").match(re);
      return (m && m[1]) ? m[1].trim() : "";
    };

    let img =
      getMeta(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
      getMeta(/content=["']([^"']+)["'][^>]*property=["']og:image["']/i) ||
      getMeta(/name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i) ||
      getMeta(/content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i);

    if (!img){
      img =
        getMeta(/rel=["']image_src["'][^>]*href=["']([^"']+)["']/i) ||
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
    } finally {
      saveCachesThrottled();
    }
  }

  /* ───────────────────────────── LINK RESOLVE ───────────────────────────── */
  function shouldResolve(url){
    const d = domainOf(url);
    return /news\.google\.com|feedproxy\.google\.com|t\.co|bit\.ly/.test(d);
  }

  async function resolveUrl(url, signal){
    const k = url;
    if (state.resolveCache.has(k)) return state.resolveCache.get(k);

    try{
      const { signal: s2, cancel } = withTimeout(9000, signal);
      try{
        const r = await fetch(url, { signal: s2, redirect:"follow", cache:"no-store", credentials:"omit" });
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

  /* ───────────────────────────── TRANSLATE ES ───────────────────────────── */
  function trKeyFor(title){
    return "t:" + title;
  }

  function parseGtXResponse(json){
    try{
      const chunks = json?.[0];
      if (!Array.isArray(chunks)) return "";
      let out = "";
      for (const c of chunks){
        if (Array.isArray(c) && typeof c[0] === "string") out += c[0];
      }
      return normSpace(out);
    }catch{
      return "";
    }
  }

  async function translateTitleToEs(title, signal){
    const src = normSpace(title);
    if (!src) return "";
    const k = trKeyFor(src);
    if (state.trCache.has(k)) return state.trCache.get(k) || "";

    try{
      const json = await fetchJsonSmart(TR_ENDPOINT(src), signal);
      const es = parseGtXResponse(json);
      const out = es && es.length >= 2 ? es : "";
      state.trCache.set(k, out || null);
      return out;
    }catch{
      state.trCache.set(k, null);
      return "";
    } finally {
      saveCachesThrottled();
    }
  }

  function patchRenderedTitle(id, newTitle){
    if (!els.newsList) return;
    const row = els.newsList.querySelector(`.newsItem[data-id="${CSS.escape(id)}"]`);
    if (!row) return;
    const titleEl = row.querySelector(".newsTitle");
    if (titleEl) titleEl.textContent = newTitle;
  }

  function kickTranslateVisible(){
    const preferEs = !!els.optOnlySpanish?.checked;
    if (!preferEs) return;
    if (!settings.trEnabled) return;
    if (!state.filtered.length) return;
    if (state.trQueueRunning) return;

    const candidates = [];
    for (const it of state.filtered){
      if (candidates.length >= TR_VISIBLE_LIMIT) break;
      if (!it || !it.title) continue;
      if (it.translated) continue;
      if (likelySpanish(it.title, it.feedName, it.cat)) continue;

      const k = trKeyFor(it.title);
      if (state.trCache.has(k) && !state.trCache.get(k)) continue;

      candidates.push(it);
    }
    if (!candidates.length) return;

    const mySeq = state.refreshSeq;
    const signal = state.refreshAbort?.signal;

    state.trQueueRunning = true;

    mapLimit(candidates, TR_CONCURRENCY, async (it) => {
      if (!it) return;
      if (signal?.aborted) return;
      if (mySeq !== state.refreshSeq) return;

      const id = it.id;
      if (state.trInFlight.has(id)) return;
      state.trInFlight.add(id);

      const srcTitle = it.title;
      const es = await translateTitleToEs(srcTitle, signal);
      if (signal?.aborted) return;
      if (mySeq !== state.refreshSeq) return;

      if (es && es !== srcTitle){
        it.originalTitle = it.originalTitle || srcTitle;
        it.title = es;
        it.translated = true;

        patchRenderedTitle(it.id, it.title);

        if (state.selectedId === it.id && els.headline){
          const cur = normSpace(els.headline.value);
          const orig = normSpace(it.originalTitle);
          if (!cur || cur === orig || cur === srcTitle){
            els.headline.value = it.title;
          }
        }

        if (state.trDebounceTimer) clearTimeout(state.trDebounceTimer);
        state.trDebounceTimer = setTimeout(() => {
          try{
            updateTicker();
            updateTrendsPop();
            updatePreview();
          }catch{}
        }, 350);
      }

      state.trInFlight.delete(id);
    }, signal).finally(() => {
      state.trQueueRunning = false;
    });
  }

  /* ───────────────────────────── SCORING ───────────────────────────── */
  function scoreImpact(it, preferEs){
    const t = (it.title || "").toLowerCase();
    let s = 0;

    if (/(última hora|urgente|breaking|alerta)/.test(t)) s += 5;
    if (/(explos|ataque|muert|guerra|otan|ucrania|rusia|israel|gaza|iran)/.test(t)) s += 4;
    if (/(elecci|gobierno|congreso|tribunal|sánchez|trump|biden|putin|zelensk|netanyahu)/.test(t)) s += 3;
    if (/(inflaci|bolsa|ibex|tipo|bce|fed|petróleo|crudo|bitcoin)/.test(t)) s += 2;

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
    const v = numOr(els.timeFilter?.value, settings.timeFilter || 60);
    if (Number.isFinite(v) && v > 0) return v * 60 * 1000;
    return 60 * 60 * 1000;
  }

  function applyFilters(){
    const q = (els.searchBox?.value || "").trim().toLowerCase();
    const minAge = clamp(numOr(els.delayMin?.value, settings.delayMin || 0), 0, 60) * 60 * 1000;

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

    const lim = tierLimits();
    const showLim = clamp(numOr(els.showLimit?.value, settings.showLimit || 120), 10, lim.showLimitMax);
    out = out.slice(0, showLim);

    state.filtered = out;
    renderNewsList(out);
    updateTicker();
    updateTrendsPop();

    try{
      if ("requestIdleCallback" in window) window.requestIdleCallback(() => kickTranslateVisible(), { timeout: 900 });
      else setTimeout(kickTranslateVisible, 120);
    }catch{
      kickTranslateVisible();
    }
  }

  const applyFiltersDebounced = debounce(applyFilters, 90);

  function faviconForDomain(dom){
    if (!BOOT.enableFavicons) return "";
    if (!dom) return "";
    // s2 favicons funciona bien y es barato
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(dom)}&sz=32`;
  }

  function renderNewsList(list){
    if (!els.newsList) return;

    const sig = list.map(x => x.id).join("|");
    if (sig === state.lastRenderSig){
      patchSelectedRow(state.selectedId);
      return;
    }
    state.lastRenderSig = sig;

    els.newsList.innerHTML = "";

    // ✅ reset map refs (evita leaks)
    state.ageElMap.clear();

    if (!list.length){
      const empty = document.createElement("div");
      empty.style.padding = "14px";
      empty.style.color = "rgba(231,233,234,0.65)";
      empty.textContent = state.refreshInFlight
        ? "Cargando noticias…"
        : (!canUseApp()
            ? "🔒 Login requerido. Abre ‘Membresía’ para iniciar sesión."
            : "Sin noticias en este filtro. Prueba a subir la ventana (60min/3h) o bajar Delay.");
      els.newsList.appendChild(empty);
      return;
    }

    const frag = document.createDocumentFragment();

    let i = 0;
    for (const it of list){
      const row = document.createElement("div");
      row.className = "newsItem" + (state.used.has(it.id) ? " used" : "") + (it.id === state.selectedId ? " sel" : "");
      row.tabIndex = 0;
      row.dataset.id = it.id;

      if (!state.hasRenderedOnce){
        row.classList.add("tnp-enter");
        row.style.animationDelay = `${Math.min(i, 14) * 28}ms`;
      }

      const thumb = document.createElement("div");
      thumb.className = "thumb";

      if (it.img){
        const img = document.createElement("img");
        img.loading = "lazy";
        img.decoding = "async";
        img.referrerPolicy = "no-referrer";
        img.src = it.img;
        img.alt = "";
        img.addEventListener("error", () => {
          try{
            thumb.innerHTML = "";
            thumb.textContent = "img";
          }catch{}
        }, { once:true });
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
      b1.className = "badge domain";
      b1.textContent = it.domain || "fuente";

      // favicon opcional (sin romper CSS existente)
      if (BOOT.enableFavicons && it.domain){
        const fav = document.createElement("img");
        fav.src = faviconForDomain(it.domain);
        fav.alt = "";
        fav.width = 14;
        fav.height = 14;
        fav.decoding = "async";
        fav.loading = "lazy";
        fav.style.marginRight = "6px";
        fav.style.verticalAlign = "text-bottom";
        fav.referrerPolicy = "no-referrer";
        fav.addEventListener("error", () => { try{ fav.remove(); }catch{} }, { once:true });
        b1.prepend(fav);
      }

      const b2 = document.createElement("span");
      b2.className = "badge age";
      b2.textContent = fmtAge(it.dateMs);

      // ✅ guardamos referencia para tick rápido
      state.ageElMap.set(it.id, b2);

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
      i++;
    }

    els.newsList.appendChild(frag);
    state.hasRenderedOnce = true;
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
      if (["últimahora","fuente","directo","noticias"].includes(low)) continue;
      picks.push("#" + w);
    }

    const out = [...base, ...picks].join(" ");
    return out.trim();
  }

  function ensureTemplateValid(){
    if (!els.template) return;

    const t = String(els.template.value || "").trim();
    if (!t.includes("{{HEADLINE}}")){
      const saved = loadTemplate();
      const fallback = (saved && saved.includes("{{HEADLINE}}")) ? saved : (BOOT.defaultTemplate || DEFAULT_TEMPLATE);

      els.template.value = fallback;
      saveTemplate(fallback);

      if (els.warn){
        els.warn.textContent = "⚠️ Tu Template no tenía {{HEADLINE}}. Se ha restaurado la plantilla para evitar que se quede la noticia anterior.";
      }
    }
  }

  function stripSourceBlock(text){
    let out = String(text || "");
    out = out.replace(/\n?Fuente:\s*\n[ \t]*https?:\/\/[^\s]+/i, "");
    out = out.replace(/\n?Fuente:\s*\n?/i, "");
    out = out.replace(/\n{3,}/g, "\n\n");
    return out.trim();
  }

  function buildTweet(){
    ensureTemplateValid();

    const tpl = (els.template?.value || DEFAULT_TEMPLATE);

    const headline = normSpace(els.headline?.value);
    const liveUrl = normSpace(els.liveUrl?.value || settings.liveUrl);
    const sourceUrl = normSpace(els.sourceUrl?.value);
    const tags = normSpace(els.hashtags?.value);

    const liveLine = (els.optIncludeLive?.checked)
      ? (BOOT.defaultLiveLine || DEFAULT_LIVE_LINE).replace("{{LIVE_URL}}", liveUrl)
      : "";

    let out = tpl
      .replaceAll("{{HEADLINE}}", headline)
      .replaceAll("{{LIVE_URL}}", liveUrl)
      .replaceAll("{{LIVE_LINE}}", liveLine)
      .replaceAll("{{SOURCE_URL}}", sourceUrl)
      .replaceAll("{{HASHTAGS}}", tags);

    if (els.optIncludeSource && !els.optIncludeSource.checked){
      out = stripSourceBlock(out);
    }

    out = out.trim();
    state.lastBuiltTweet = out;
    return out;
  }

  function getSelectedItem(){
    if (!state.selectedId) return null;
    return state.items.find(x => x.id === state.selectedId) || state.filtered.find(x => x.id === state.selectedId) || null;
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
        img.addEventListener("error", () => {
          try{
            els.xMockCardImg.innerHTML = "";
            const ph = document.createElement("div");
            ph.className = "xMock__ph";
            ph.textContent = "sin imagen";
            els.xMockCardImg.appendChild(ph);
          }catch{}
        }, { once:true });
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
    ensureTemplateValid();

    const t = buildTweet();
    if (els.preview) els.preview.textContent = t;

    const len = estimateXChars(t);
    if (els.charCount) els.charCount.textContent = `${len} / 280`;

    if (els.warn){
      const existing = String(els.warn.textContent || "");
      const overflowMsg = (len > 280) ? `⚠️ Se pasa de 280 (sobran ${len - 280})` : "";

      if (existing.startsWith("⚠️ Tu Template no tenía") && overflowMsg){
        els.warn.textContent = existing + " · " + overflowMsg;
      } else if (!existing.startsWith("⚠️ Tu Template no tenía")){
        els.warn.textContent = overflowMsg || "";
      }
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

  function patchSelectedRow(newId){
    if (!els.newsList) return;
    const prev = els.newsList.querySelector(".newsItem.sel");
    if (prev) prev.classList.remove("sel");

    if (!newId) return;
    const row = els.newsList.querySelector(`.newsItem[data-id="${CSS.escape(newId)}"]`);
    if (row) row.classList.add("sel");
  }

  function selectItem(id){
    const it = state.items.find(x => x.id === id) || state.filtered.find(x => x.id === id);
    if (!it) return;

    state.selectedId = id;

    if (els.headline) els.headline.value = normSpace(it.title || it.originalTitle || "");
    const src = (els.optShowOriginal?.checked) ? (it.resolvedUrl || it.link) : it.link;
    if (els.sourceUrl) els.sourceUrl.value = normSpace(src || "");

    const sug = suggestHashtags(it.title || it.originalTitle, it.cat);
    const def = normSpace(settings.defaultHashtags || "");
    if (els.hashtags){
      els.hashtags.value = (def && !sug.includes(def)) ? `${sug} ${def}`.trim() : sug;
    }

    updatePreview();
    patchSelectedRow(id);
  }

  function markSelectedUsed(){
    if (!state.selectedId) return;
    state.used.add(state.selectedId);
    saveUsed();

    const row = els.newsList?.querySelector(`.newsItem[data-id="${CSS.escape(state.selectedId)}"]`);
    if (row) row.classList.add("used");

    if (els.optHideUsed?.checked) applyFiltersDebounced();
  }

  /* ───────────────────────────── TICKER SPEED HELPERS ───────────────────────────── */
  function getTickerPps(){
    const v = numOr(els.tickerSpeed?.value, settings.tickerPps || 30);
    return clamp(v, 10, 220);
  }

  function computeTickerDurationSec(){
    const inner = els.tnpTickerInner;
    const wrap = inner?.parentElement;
    if (!inner || !wrap) return 40;

    const pps = getTickerPps();
    const distPx = inner.scrollWidth + wrap.clientWidth;
    const sec = distPx / Math.max(pps, 1);
    return clamp(sec, 18, 240);
  }

  function restartTickerAnim(){
    if (!els.tnpTickerInner) return;
    els.tnpTickerInner.style.animation = "none";
    // eslint-disable-next-line no-unused-expressions
    els.tnpTickerInner.offsetHeight;
    els.tnpTickerInner.style.animation = "";
  }

  function applyTickerSpeed(){
    if (!els.tnpTickerInner) return;

    const pps = getTickerPps();
    const sec = computeTickerDurationSec();

    els.tnpTickerInner.style.animationDuration = `${sec}s`;

    if (els.tickerSpeedVal){
      els.tickerSpeedVal.textContent = `${pps} pps`;
    }
    state.lastTickerPps = pps;
  }

  /* ───────────────────────────── TICKER + “TRENDS” ───────────────────────────── */
  function updateTicker(){
    if (!els.tnpTickerInner) return;

    const pps = getTickerPps();
    const topN = state.filtered.slice(0, BOOT.tickerMaxItems);

    if (!topN.length){
      els.tnpTickerInner.textContent = "Sin noticias aún…";
      requestAnimationFrame(() => {
        applyTickerSpeed();
        if (state.lastTickerPps !== pps) restartTickerAnim();
      });
      return;
    }

    const sig = topN.map(x => x.id).join("|");

    if (sig === state.lastTickerSig){
      if (state.lastTickerPps !== pps){
        requestAnimationFrame(() => {
          applyTickerSpeed();
          restartTickerAnim();
        });
      } else {
        requestAnimationFrame(() => applyTickerSpeed());
      }
      return;
    }

    state.lastTickerSig = sig;

    const parts = topN.map(x => `• ${x.title}`);
    els.tnpTickerInner.textContent = parts.join(BOOT.tickerSeparator);

    requestAnimationFrame(() => {
      applyTickerSpeed();
      restartTickerAnim();
    });
  }

  function toHashtag(s){
    const raw = String(s || "").trim();
    if (!raw) return "";
    const words = raw
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 5);
    if (!words.length) return "";
    const cap = words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join("");
    return "#" + cap;
  }

  function buildTrendCandidates(){
    const pool = state.filtered.slice(0, 25).map(x => x.title).join(" ");
    const words = pool
      .split(/\s+/)
      .map(w => w.replace(/[^\p{L}\p{N}]/gu, ""))
      .filter(w => w.length >= 6);

    const stop = new Set(["últimahora","noticias","fuente","directo","gobierno","presidente","ministro","congreso"]);
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
    if (!BOOT.enableTrends || !BOOT.popTrends) return;

    const tags = (state.trends.tags && state.trends.tags.length)
      ? state.trends.tags
      : buildTrendCandidates();

    const sig = tags.join("|");
    if (!tags.length){
      els.tnpTrendsPop.classList.remove("on");
      els.tnpTrendsPop.setAttribute("aria-hidden","true");
      return;
    }

    if (sig === state.trends.lastSig) return;
    state.trends.lastSig = sig;

    clearInterval(state.trends.timer);

    let idx = 0;
    els.tnpTrendsPop.textContent = tags[idx];
    els.tnpTrendsPop.classList.add("on");
    els.tnpTrendsPop.setAttribute("aria-hidden","false");

    state.trends.timer = setInterval(() => {
      idx = (idx + 1) % tags.length;
      els.tnpTrendsPop.textContent = tags[idx];
      els.tnpTrendsPop.classList.add("on");
    }, BOOT.popDurationMs);
  }

  async function loadTrendsSourcesOnce(signal){
    if (state.trends.sourcesLoaded) return;
    state.trends.sourcesLoaded = true;

    // Best-effort: carga JSON de fuentes (si existe)
    try{
      const j = await fetchJsonSmart(BOOT.trendsSourcesUrl, signal);
      state.trends.sources = j;
    }catch{
      state.trends.sources = null;
    }
  }

  async function refreshExternalTrends(signal){
    if (!BOOT.enableTrends || !BOOT.popTrends) return;
    const now = nowMs();
    if (now - state.trends.lastFetchMs < 3*60*1000) return; // cada 3 min
    state.trends.lastFetchMs = now;

    await loadTrendsSourcesOnce(signal);
    const srcPack = asObject(state.trends.sources, null);
    if (!srcPack) return;

    const rules = asObject(srcPack.rules, {});
    const maxShown = clamp(numOr(rules.maxShown, 6), 3, 10);
    const minLen = clamp(numOr(rules.minLen, 2), 1, 6);
    const hashtagify = (rules.hashtagify !== false);
    const banContains = new Set(asArray(rules.banContains, []).map(x => String(x||"").toLowerCase()));

    const sources = asArray(srcPack.sources, []).filter(s => s && s.enabled && s.url);
    if (!sources.length) return;

    // toma la primera enabled (realtime ES normalmente)
    const src = sources[0];

    try{
      const xml = await fetchTextSmart(String(src.url), signal);
      const feed = { name: "Trends", cat: "trend" };
      const items = parseFeed(xml, feed).slice(0, 20);

      const tags = [];
      for (const it of items){
        const title = normSpace(it.title);
        if (!title) continue;
        if (title.length < minLen) continue;
        const low = title.toLowerCase();
        let banned = false;
        for (const b of banContains){
          if (b && low.includes(b)) { banned = true; break; }
        }
        if (banned) continue;

        const tag = hashtagify ? toHashtag(title) : ("#" + title.replace(/\s+/g,""));
        if (!tag || tag.length < 3) continue;
        if (!tags.includes(tag)) tags.push(tag);
        if (tags.length >= maxShown) break;
      }

      if (tags.length) state.trends.tags = tags;
    }catch{
      // ignore
    }
  }

  /* ───────────────────────────── UI TICK (sin re-render) ───────────────────────────── */
  function startUiTick(){
    clearInterval(state.uiTickTimer);
    state.uiTickTimer = setInterval(() => {
      try{
        if (state.filtered.length){
          const now = nowMs();
          for (const it of state.filtered){
            const ageEl = state.ageElMap.get(it.id);
            if (!ageEl) continue;
            const m = Math.floor(Math.max(0, now - it.dateMs) / 60000);
            ageEl.textContent = (m < 1) ? "ahora" : (m < 60 ? `${m}m` : fmtAge(it.dateMs));
          }
        }
        if (document.activeElement === els.headline || document.activeElement === els.template || document.activeElement === els.hashtags || document.activeElement === els.sourceUrl){
          updatePreview();
        }
      }catch{}
    }, 10000);
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
    const nextDelay = prevDelay ? Math.min(prevDelay * 2, 10 * 60 * 1000) : 30 * 1000;
    state.backoff.set(feedUrl, { delayMs: nextDelay, untilMs: nowMs() + nextDelay });
    saveBackoffThrottled(); // ✅ persistimos backoff
  }

  function resetBackoff(){
    state.backoff.clear();
    saveBackoffThrottled();
  }

  /* ───────────────────────────── SW MAINTENANCE + SELF-HEAL ───────────────────────────── */
  async function attachSwMaintenance(){
    if (!("serviceWorker" in navigator)) return;

    try{
      state.swReg = await navigator.serviceWorker.getRegistration();
    }catch{
      state.swReg = null;
    }

    if (!state.swReg){
      try{
        const swUrl = "./sw.js?v=" + encodeURIComponent(BOOT.buildTag);
        state.swReg = await navigator.serviceWorker.register(swUrl, { updateViaCache:"none" });
      }catch{
        state.swReg = null;
      }
    }

    if (!window.__TNP_SW_GUARD__){
      window.__TNP_SW_GUARD__ = { reloading:false };
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (window.__TNP_SW_GUARD__.reloading) return;
        window.__TNP_SW_GUARD__.reloading = true;
        location.reload();
      });
    }

    setInterval(async () => {
      try{
        if (state.swReg) await state.swReg.update();
        if (state.swReg && state.swReg.waiting){
          try{ state.swReg.waiting.postMessage({ type:"SKIP_WAITING" }); }catch{}
        }
      }catch{}
    }, 60 * 1000);
  }

  async function requestClearTnpCaches(){
    try{
      if (navigator.serviceWorker?.controller){
        navigator.serviceWorker.controller.postMessage({ type:"CLEAR_CACHES" });
      }
    }catch{}

    try{
      if ("caches" in window){
        const keys = await caches.keys();
        await Promise.all(keys.map(k => (String(k).startsWith("tnp-") ? caches.delete(k) : Promise.resolve(false))));
      }
    }catch{}
  }

  async function selfHealIfBuildChanged(){
    const prev = localStorage.getItem(LS_BUILD_ID);
    const cur = `${APP_VERSION}:${BUILD_ID}`;
    if (prev === cur) return;

    localStorage.setItem(LS_BUILD_ID, cur);
    setStatus("Aplicando actualización… (limpiando caché)");
    await requestClearTnpCaches();

    try{
      if (!window.__TNP_SELF_HEAL__){
        window.__TNP_SELF_HEAL__ = true;
        setTimeout(() => location.reload(), 250);
      }
    }catch{}
  }

  async function forceUpdateNow(){
    setStatus("Buscando update…");
    try{
      if (state.swReg) await state.swReg.update();

      if (state.swReg && state.swReg.waiting){
        try{ state.swReg.waiting.postMessage({ type:"SKIP_WAITING" }); }catch{}
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
      localStorage.removeItem(LS_TR_CACHE);
      localStorage.removeItem(LS_BUILD_ID);
      localStorage.removeItem(LS_MEMBER);
      localStorage.removeItem(LS_MEM_OVERRIDE);
      localStorage.removeItem(LS_PROXY_HINT);
      localStorage.removeItem(LS_BACKOFF);
      try{ localStorage.removeItem(LS_AUTH); }catch{}
      try{ sessionStorage.removeItem(LS_AUTH); }catch{}
    }catch{}

    try{
      if ("caches" in window){
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    }catch{}

    try{
      if ("serviceWorker" in navigator){
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
    }catch{}

    location.reload();
  }

  async function emergencyRepairIfAllFailed(totalFeeds, okFeeds){
    if (okFeeds > 0) return;
    if (totalFeeds < 3) return;
    if (window.__TNP_EMERGENCY_REPAIR__) return;
    if (!("serviceWorker" in navigator)) return;

    window.__TNP_EMERGENCY_REPAIR__ = true;
    setStatus("⚠️ Todo falló. Reparando caché/SW automáticamente…");

    try{ await requestClearTnpCaches(); }catch{}
    try{
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }catch{}

    setTimeout(() => location.reload(), 350);
  }

  /* ───────────────────────────── AUTH GATE UI ───────────────────────────── */
  function ensureGateOverlay(){
    if (!BOOT.requireLogin || !BOOT.hardGate) return;

    if (canUseApp()){
      if (state.gateEl){
        try{ state.gateEl.remove(); }catch{}
        state.gateEl = null;
      }
      return;
    }

    if (state.gateEl) return;

    const gate = document.createElement("div");
    gate.id = "tnpAuthGate";
    gate.style.position = "fixed";
    gate.style.inset = "0";
    gate.style.zIndex = "9999";
    gate.style.background = "rgba(0,0,0,0.65)";
    gate.style.backdropFilter = "blur(6px)";
    gate.style.display = "flex";
    gate.style.alignItems = "center";
    gate.style.justifyContent = "center";
    gate.style.padding = "16px";

    gate.innerHTML = `
      <div style="max-width:560px; width:100%; border:1px solid rgba(255,255,255,0.14); border-radius:18px; background:rgba(10,16,32,0.92); padding:16px;">
        <div style="font-weight:900; font-size:18px;">🔒 Login requerido</div>
        <div style="margin-top:8px; color:rgba(231,233,234,0.72); line-height:1.35;">
          Para usar el panel, inicia sesión con Google.
        </div>
        <div style="display:flex; gap:10px; margin-top:14px; flex-wrap:wrap;">
          <button id="tnpGateOpenMember" class="btn btn--primary" type="button">Abrir Membresía</button>
          <button id="tnpGateRetry" class="btn" type="button">Reintentar</button>
        </div>
        <div style="margin-top:10px; color:rgba(231,233,234,0.55); font-size:12px;">
          Tip: si no ves el botón de Google, revisa <code>googleClientId</code> en <code>config/boot-config.js</code>.
        </div>
      </div>
    `;

    document.body.appendChild(gate);
    state.gateEl = gate;

    gate.querySelector("#tnpGateOpenMember")?.addEventListener("click", () => setMemberModalOpen(true));
    gate.querySelector("#tnpGateRetry")?.addEventListener("click", () => {
      if (canUseApp()){
        try{ gate.remove(); }catch{}
        state.gateEl = null;
      } else {
        setMemberModalOpen(true);
      }
    });
  }

  /* ───────────────────────────── REFRESH LOOP ───────────────────────────── */
  async function refreshAll({ force=false, user=false } = {}){
    if (!canUseApp()){
      setStatus("🔒 Login requerido. Abre ‘Membresía’ para iniciar sesión.");
      setMemberModalOpen(true);
      ensureGateOverlay();

    // Monetización (ads/support) — best-effort
    try{ initMonetization(); }catch{}
      return;
    }

    if (state.refreshInFlight){
      if (!user) return;
      try{ state.refreshAbort?.abort("user_refresh"); }catch{}
    }

    const mySeq = ++state.refreshSeq;

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

    if (!state.items.length){
      renderNewsList([]);
      updateTicker();
      updateTrendsPop();
    }

    setStatus(force ? "Refrescando (force)…" : "Refrescando…");

    try{
      const lim = tierLimits();
      const cap = clamp(numOr(els.fetchCap?.value, settings.fetchCap || 240), 80, lim.fetchCapMax);

      // batchSize real = min(UI, tier, network)
      const batchSize = clamp(
        Math.min(
          numOr(els.batchFeeds?.value, settings.batchFeeds || 12),
          lim.batchMax,
          BOOT.maxConcurrentFeeds
        ),
        2,
        40
      );

      const allItems = [];
      const enabledFeeds = feeds.slice();

      let ok = 0, fail = 0;

      for (let i=0;i<enabledFeeds.length;i += batchSize){
        if (signal.aborted || mySeq !== state.refreshSeq) break;

        const chunk = enabledFeeds.slice(i, i + batchSize);

        await Promise.allSettled(chunk.map(async (f) => {
          if (signal.aborted || mySeq !== state.refreshSeq) return;

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
              if (BOOT.enableFavicons) it.favicon = faviconForDomain(it.domain);
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

      await emergencyRepairIfAllFailed(enabledFeeds.length, ok);

      if (signal.aborted || mySeq !== state.refreshSeq) throw new Error("Abort");

      // ✅ Dedup mejorado: 1) por URL limpia 2) por dominio+título en ventana corta
      const seenUrl = new Set();
      const seenTitle = new Map(); // key -> dateMs
      const dedup = [];

      for (const it of allItems){
        const k = it.link;
        if (!k) continue;
        const kk = cleanUrl(k);

        const dom = domainOf(kk);
        const titleKey = normSpace(String(it.title || "").toLowerCase());
        const titleDomKey = (dom && titleKey) ? (dom + "|" + titleKey) : "";

        if (seenUrl.has(kk)) continue;

        if (titleDomKey){
          const prevTs = seenTitle.get(titleDomKey);
          if (Number.isFinite(prevTs)){
            // ventana 20 min para evitar clones con urls distintas
            if (Math.abs(Number(it.dateMs || 0) - prevTs) <= 20 * 60 * 1000){
              continue;
            }
          }
          seenTitle.set(titleDomKey, Number(it.dateMs || nowMs()));
        }

        seenUrl.add(kk);

        it.link = kk;
        it.domain = dom;
        if (BOOT.enableFavicons) it.favicon = faviconForDomain(it.domain);
        dedup.push(it);
      }

      const now = nowMs();
      const clean = dedup.filter(it => (now - it.dateMs) >= 0);
      clean.sort((a,b) => b.dateMs - a.dateMs);

      state.items = clean.slice(0, Math.max(cap, BOOT.maxItemsKeep));

      // Resolve/OG limits dependen de tier
      const lim2 = tierLimits();

      if (els.optResolveLinks?.checked){
        const need = state.items.filter(it => shouldResolve(it.link)).slice(0, lim2.resolveLimit);
        await mapLimit(need, BOOT.maxConcurrentResolve, async (it) => {
          it.resolvedUrl = await resolveUrl(it.link, signal);
        }, signal);
      }

      if (BOOT.enableOgImages){
        const needImg = state.items
          .filter(it => !it.img && (it.resolvedUrl || it.link))
          .slice(0, lim2.ogLimit);

        await mapLimit(needImg, BOOT.maxConcurrentOg, async (it) => {
          const u = it.resolvedUrl || it.link;
          const og = await fetchOgImage(u, signal);
          if (og && og.img) it.img = og.img;
        }, signal);
      }

      for (const it of state.items){
        it.ready = !!(it.title && (it.resolvedUrl || it.link));
      }

      // Trends externos (best-effort)
      try{ await refreshExternalTrends(signal); }catch{}

      setStatus(`OK · ${state.items.length} noticias · feeds OK:${ok} FAIL:${fail}`);

      applyFilters();
      updatePreview();
    } catch (e){
      const aborted = (String(e?.name || e).includes("Abort") || signal.aborted || mySeq !== state.refreshSeq);
      if (aborted){
        setStatus("Refresh cancelado.");
      } else {
        console.error(e);
        setStatus("⚠️ Error refrescando (mira consola).");
      }
    } finally {
      if (mySeq === state.refreshSeq){
        state.refreshInFlight = false;
      }
    }
  }

  function startAuto(){
    clearInterval(state.autoTimer);
    if (!els.optAutoRefresh?.checked) return;

    if (!canUseApp()){
      return;
    }

    const lim = tierLimits();
    const sec = clamp(numOr(els.refreshSec?.value, settings.refreshSec || 60), lim.autoMinSec, 600);

    state.autoTimer = setInterval(() => {
      if (document.hidden) return;
      refreshAll({ force:false, user:false }).catch(()=>{});
    }, sec * 1000);
  }

  /* ───────────────────────────── MEMBERSHIP UI + GOOGLE LOGIN ───────────────────────────── */
  function injectMembershipUi(){
    if (document.getElementById("btnMember") || document.getElementById("memberModal")) {
      const btn = document.getElementById("btnMember");
      const pill = document.getElementById("memberPill");
      const modal = document.getElementById("memberModal");
      state.memberUi = { btn, pill, modal };
      return;
    }

    const topRight =
      document.querySelector(".topbar__right") ||
      document.querySelector(".topbar") ||
      (els.status?.parentElement || null);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn--sm";
    btn.id = "btnMember";
    btn.textContent = "Membresía";

    const pill = document.createElement("span");
    pill.className = "status";
    pill.id = "memberPill";
    pill.style.marginLeft = "8px";
    pill.textContent = pillText();

    if (topRight){
      topRight.prepend(btn);
      topRight.appendChild(pill);
    } else {
      document.body.appendChild(btn);
      document.body.appendChild(pill);
    }

    const modal = document.createElement("div");
    modal.id = "memberModal";
    modal.className = "modal hidden";
    modal.hidden = true;
    modal.setAttribute("aria-hidden","true");
    modal.setAttribute("aria-modal","true");
    modal.setAttribute("role","dialog");
    modal.setAttribute("aria-label","Membresía");

    const kofiUrl = BOOT.kofiTiersUrl || BOOT.checkoutUrlTemplate || "";

    const tierCardsHtml = BOOT.tiers.map(t => {
      const perks = (Array.isArray(t.perks) ? t.perks : []).slice(0, 6).map(p => `<li>${String(p)}</li>`).join("");
      const buy = kofiUrl
        ? `<a class="btn btn--primary btn--sm" href="${kofiUrl}" target="_blank" rel="noopener noreferrer">Unirme</a>`
        : "";
      return `
        <div style="border:1px solid rgba(255,255,255,0.12); border-radius:16px; padding:12px; background:rgba(255,255,255,0.04);">
          <div style="display:flex; align-items:baseline; justify-content:space-between; gap:10px;">
            <div style="font-weight:900;">${String(t.name || "").toUpperCase()}</div>
            <div class="mini muted">${String(t.price || "")}</div>
          </div>
          <ul class="mini muted" style="margin:10px 0 12px; padding-left:18px;">
            ${perks || "<li>Ventajas Pro</li>"}
          </ul>
          ${buy}
        </div>
      `;
    }).join("");

    modal.innerHTML = `
      <div class="modal__panel">
        <div class="modal__head">
          <div>
            <div class="modal__title">Membresía</div>
            <div class="mini muted">Login con Google para activar sesión y tier (sin cuentas propias).</div>
          </div>
          <button id="btnCloseMemberModal" class="btn btn--sm" type="button">Cerrar</button>
        </div>
        <div class="modal__body">
          <div style="display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap:10px;">
            ${tierCardsHtml}
          </div>

          <hr class="hr" />

          <div class="panel__title panel__title--sm">Tu estado</div>
          <div class="row row--wrap">
            <span class="badge ok" id="memberTierBadge">${tierTitle(state.member.tier)}</span>
            <span class="mini muted" id="memberEmail">${state.auth.email ? state.auth.email : "Sin sesión"}</span>
            <span class="mini muted" id="memberExp">${state.member.expMs ? ("tier exp: " + new Date(state.member.expMs).toLocaleString()) : ""}</span>
          </div>

          <div style="height:10px"></div>

          <div class="panel__title panel__title--sm">Login</div>
          <div class="mini muted" style="margin-bottom:10px;">
            ${BOOT.googleClientId ? "Pulsa para iniciar sesión con Google." : "⚠️ Falta googleClientId en config/boot-config.js (login desactivado)."}
          </div>

          <div class="row row--wrap">
            <div id="gsiBtn"></div>
            <button id="btnMemberSignOut" class="btn btn--danger btn--sm" type="button">Cerrar sesión</button>
            ${BOOT.manageUrl ? `<a class="btn btn--x btn--sm" href="${BOOT.manageUrl}" target="_blank" rel="noopener noreferrer">Gestionar</a>` : ""}
          </div>

          <div id="memberMsg" class="warn" style="margin-top:10px;"></div>

          <div class="mini muted" style="margin-top:12px;">
            Tip: si usas allowlist, puedes tener modo “emails” o modo “hash (SHA-256)”.
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    state.memberUi = { btn, pill, modal };

    btn.addEventListener("click", () => setMemberModalOpen(true));
    modal.addEventListener("click", (e) => { if (e.target === modal) setMemberModalOpen(false); });
    modal.querySelector("#btnCloseMemberModal")?.addEventListener("click", () => setMemberModalOpen(false));

    modal.querySelector("#btnMemberSignOut")?.addEventListener("click", () => {
      clearAuth();
      clearMember();
      state.auth = loadAuth();
      state.member = loadMember();
      updateMemberUi("Sesión cerrada.");

      applyTierLimitsToUi();
      startAuto();
      applyFiltersDebounced();
      ensureGateOverlay();

      try{
        if (window.google?.accounts?.id){
          window.google.accounts.id.disableAutoSelect?.();
        }
      }catch{}
    });
  }

  function pillText(){
    const email = state.auth.email ? state.auth.email : "—";
    return `Cuenta: ${email} · Tier: ${tierTitle(state.member.tier)}`;
  }

  function setMemberModalOpen(open){
    const m = state.memberUi.modal;
    if (!m) return;
    m.classList.toggle("hidden", !open);
    m.hidden = !open;
    m.setAttribute("aria-hidden", open ? "false" : "true");
    if (open){
      updateMemberUi();
      try{ maybeInitGoogleSignIn(); }catch{}
    }
  }

  function updateMemberUi(msg){
    const { pill, modal } = state.memberUi;
    if (pill) pill.textContent = pillText();

    if (modal){
      const badge = modal.querySelector("#memberTierBadge");
      const email = modal.querySelector("#memberEmail");
      const exp = modal.querySelector("#memberExp");
      const box = modal.querySelector("#memberMsg");

      if (badge) badge.textContent = tierTitle(state.member.tier);
      if (email) email.textContent = state.auth.email || "Sin sesión";
      if (exp) exp.textContent = state.member.expMs ? ("tier exp: " + new Date(state.member.expMs).toLocaleString()) : "";
      if (box) box.textContent = msg ? String(msg) : "";
    }

    // Actualiza UI de monetización cuando cambia tier/login
    try{ updateMonetizationUi(); }catch{}
  }

  function ensureGsiScript(){
    if (!BOOT.googleClientId) return Promise.resolve(false);
    if (window.google && window.google.accounts && window.google.accounts.id) return Promise.resolve(true);

    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) return Promise.resolve(true);

    return new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.defer = true;
      s.onload = () => resolve(true);
      s.onerror = () => {
        try{ updateMemberUi("❌ No se pudo cargar Google GIS (gsi/client). Revisa red o bloqueadores."); }catch{}
        resolve(false);
      };
      document.head.appendChild(s);
    });
  }

  let gsiInited = false;

  async function maybeInitGoogleSignIn(){
    if (gsiInited) return;
    if (!BOOT.googleClientId) return;

    const ok = await ensureGsiScript();
    if (!ok) return;

    if (!(window.google && window.google.accounts && window.google.accounts.id)) return;

    try{
      window.google.accounts.id.initialize({
        client_id: BOOT.googleClientId,
        callback: async (resp) => {
          const credential = resp && resp.credential ? String(resp.credential) : "";
          if (!credential){
            updateMemberUi("❌ No llegó credential.");
            return;
          }

          const payload = decodeJwtPayload(credential);
          const email = String(payload?.email || "").toLowerCase().trim();
          const name = String(payload?.name || "");
          const picture = String(payload?.picture || "");
          const sub = String(payload?.sub || "");
          const jwtExp = Number(payload?.exp || 0) * 1000;

          if (!email){
            updateMemberUi("❌ No se pudo leer el email del token.");
            return;
          }

          // hd (domain restriction) si se configura
          if (BOOT.hd){
            const dom = email.split("@")[1] || "";
            if (dom.toLowerCase() !== BOOT.hd.toLowerCase()){
              updateMemberUi(`❌ Cuenta no permitida (hd=${BOOT.hd}).`);
              return;
            }
          }

          updateMemberUi("Verificando…");

          // Guardar AUTH
          state.auth = {
            email, name, picture, sub,
            expMs: (jwtExp && jwtExp > nowMs()) ? jwtExp : (nowMs() + 24*60*60*1000)
          };
          saveAuth(state.auth);

          // Verificar membership tier
          const res = await verifyMembership({ email, credential });
          const tier = normTier(res.tier);
          const expMs = Number(res.expMs || 0);

          state.member = {
            tier,
            expMs: (expMs && expMs > nowMs())
              ? expMs
              : (tier !== "free" ? (nowMs() + 7*24*60*60*1000) : 0)
          };
          saveMember(state.member);

          updateMemberUi(tier !== "free"
            ? `✅ Tier activado: ${tierTitle(tier)}`
            : (BOOT.requireLogin ? "✅ Sesión OK (FREE)." : "ℹ️ Sesión OK, sin tier (FREE).")
          );

          applyTierLimitsToUi();
          startAuto();
          applyFiltersDebounced();
          ensureGateOverlay();
        }
      });

      const host = state.memberUi.modal?.querySelector("#gsiBtn");
      if (host){
        host.innerHTML = "";
        window.google.accounts.id.renderButton(host, {
          theme: "outline",
          size: "large",
          shape: "pill",
          text: "signin_with",
          locale: "es"
        });
      }

      // One Tap opcional
      if (BOOT.autoPrompt && !isAuthed()){
        try{ window.google.accounts.id.prompt(); }catch{}
      }

      gsiInited = true;
    }catch{
      // ignore
    }
  }

  // Debug helper: hash para allowlist hash-mode
  window.TNP = window.TNP || {};
  window.TNP.debugHash = async (email) => {
    const e = String(email || "").toLowerCase().trim();
    const h = await sha256Hex(`${BOOT.membershipSalt}:${e}`);
    console.log("hash:", h);
    return h;
  };

  /* ───────────────────────────── UI BIND ───────────────────────────── */
  function bindUI(){
    hideBootDiag();

    injectMembershipUi();
    updateMemberUi();
    applyTierLimitsToUi();
    ensureGateOverlay();

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

    if (els.tickerSpeed){
      els.tickerSpeed.value = String(clamp(numOr(settings.tickerPps, 30), 10, 220));
      if (els.tickerSpeedVal) els.tickerSpeedVal.textContent = `${els.tickerSpeed.value} pps`;
    }

    if (els.hashtags && !els.hashtags.value && settings.defaultHashtags){
      els.hashtags.value = settings.defaultHashtags;
    }

    const saveFilterSettings = () => {
      settings.delayMin   = clamp(numOr(els.delayMin?.value, settings.delayMin), 0, 60);
      settings.timeFilter = clamp(numOr(els.timeFilter?.value, settings.timeFilter), 1, 24*60);

      const lim = tierLimits();
      settings.showLimit  = clamp(numOr(els.showLimit?.value, settings.showLimit), 10, lim.showLimitMax);

      settings.sortBy = els.sortBy?.value || settings.sortBy;

      settings.optOnlyReady    = !!els.optOnlyReady?.checked;
      settings.optOnlySpanish  = !!els.optOnlySpanish?.checked;
      settings.optResolveLinks = !!els.optResolveLinks?.checked;
      settings.optShowOriginal = !!els.optShowOriginal?.checked;
      settings.optHideUsed     = !!els.optHideUsed?.checked;

      settings.catFilter = els.catFilter?.value || "all";

      saveSettings(settings);
      applyFiltersDebounced();
    };

    const saveRefreshSettings = () => {
      const lim = tierLimits();
      settings.fetchCap   = clamp(numOr(els.fetchCap?.value, settings.fetchCap), 80, lim.fetchCapMax);
      settings.batchFeeds = clamp(numOr(els.batchFeeds?.value, settings.batchFeeds), 2, Math.min(lim.batchMax, BOOT.maxConcurrentFeeds));
      saveSettings(settings);
    };

    const saveAutoSettings = () => {
      const lim = tierLimits();
      settings.optAutoRefresh = !!els.optAutoRefresh?.checked;
      settings.refreshSec = clamp(numOr(els.refreshSec?.value, settings.refreshSec), lim.autoMinSec, 600);
      saveSettings(settings);
      startAuto();
    };

    const saveComposerSettings = () => {
      settings.liveUrl = normSpace(els.liveUrl?.value || settings.liveUrl);
      settings.optIncludeLive   = !!els.optIncludeLive?.checked;
      settings.optIncludeSource = !!els.optIncludeSource?.checked;

      if (els.tickerSpeed){
        settings.tickerPps = clamp(numOr(els.tickerSpeed.value, settings.tickerPps || 30), 10, 220);
      }

      saveSettings(settings);
      if (els.template) saveTemplate(els.template.value || DEFAULT_TEMPLATE);

      updatePreview();
      requestAnimationFrame(() => {
        applyTickerSpeed();
        restartTickerAnim();
      });
    };

    els.btnRefresh?.addEventListener("click", (e) => {
      const force = e.shiftKey;
      refreshAll({ force, user:true }).catch(()=>{});
    });

    els.btnFeeds?.addEventListener("click", openModal);
    els.btnCloseModal?.addEventListener("click", closeModal);

    els.modal?.addEventListener("click", (e) => {
      if (e.target === els.modal) closeModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeModal();
        setMemberModalOpen(false);
      }
    });

    els.btnAddFeed?.addEventListener("click", () => {
      const name = normSpace(els.newFeedName?.value);
      const url = ensureUrl(els.newFeedUrl?.value);
      if (!name || !url) return;

      const nf = normalizeFeed({ name, url, enabled:true, cat:"all" });
      if (!nf) return;

      state.feeds.unshift(nf);
      enforceEnabledFeedsLimit();
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
      const parsed = safeParseJSON(raw);
      const arr = asArray(parsed, null);
      if (!Array.isArray(arr)) {
        setStatus("Import: JSON inválido (debe ser array).");
        return;
      }
      const cleaned = arr.map(normalizeFeed).filter(Boolean);
      if (!cleaned.length){
        setStatus("Import: no hay feeds válidos.");
        return;
      }
      state.feeds = cleaned;
      enforceEnabledFeedsLimit();
      renderFeedsModal();
      setStatus("Import OK.");
    });

    els.btnRestoreDefaultFeeds?.addEventListener("click", () => {
      state.feeds = DEFAULT_FEEDS.map(normalizeFeed).filter(Boolean);
      enforceEnabledFeedsLimit();
      renderFeedsModal();
      setStatus("Defaults restaurados (no olvides Guardar).");
    });

    els.btnSaveFeeds?.addEventListener("click", () => {
      saveFeeds();
      closeModal();
      setStatus("Feeds guardados.");
      refreshAll({ force:true, user:true }).catch(()=>{});
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
      updatePreview();
      const u = (els.sourceUrl?.value || "").trim();
      if (!u) return;
      await copyText(u);
      setStatus("URL copiada.");
    });

    els.btnCopy?.addEventListener("click", async () => {
      updatePreview();
      const t = buildTweet();
      await copyText(t);
      setStatus("Tweet copiado.");
      markSelectedUsed();
    });

    els.btnX?.addEventListener("click", () => {
      updatePreview();
      const t = buildTweet();
      const url = "https://x.com/intent/tweet?text=" + encodeURIComponent(t);
      window.open(url, "_blank", "noopener,noreferrer");
      markSelectedUsed();
    });

    els.btnResetTemplate?.addEventListener("click", () => {
      if (!els.template) return;
      els.template.value = (BOOT.defaultTemplate || DEFAULT_TEMPLATE);
      saveTemplate(els.template.value);
      updatePreview();
      setStatus("Plantilla reseteada.");
    });

    els.btnCheckUpdate?.addEventListener("click", forceUpdateNow);
    els.btnHardReset?.addEventListener("click", hardResetEverything);

    const bind = (el, onChange, onInput = onChange) => {
      if (!el) return;
      el.addEventListener("change", onChange);
      el.addEventListener("input", onInput);
    };

    [els.delayMin, els.timeFilter, els.sortBy, els.showLimit, els.optOnlyReady, els.optOnlySpanish,
     els.optResolveLinks, els.optShowOriginal, els.optHideUsed, els.catFilter
    ].forEach(el => bind(el, saveFilterSettings));

    els.searchBox?.addEventListener("input", () => applyFiltersDebounced());

    [els.fetchCap, els.batchFeeds].forEach(el => bind(el, saveRefreshSettings));

    [els.optAutoRefresh, els.refreshSec].forEach(el => bind(el, saveAutoSettings));

    [els.liveUrl, els.template, els.headline, els.sourceUrl, els.hashtags, els.optIncludeLive, els.optIncludeSource, els.tickerSpeed]
      .forEach(el => bind(el, saveComposerSettings, debounce(saveComposerSettings, 60)));

    document.addEventListener("visibilitychange", () => {
      if (!els.optAutoRefresh?.checked) return;
      if (!document.hidden){
        startAuto();
        refreshAll({ force:false, user:false }).catch(()=>{});
      }
    });

    setStatus(`TNP listo (${APP_VERSION})`);

    requestAnimationFrame(() => {
      applyTickerSpeed();
      restartTickerAnim();
    });

    startUiTick();
  }

  /* ───────────────────────────── INIT ───────────────────────────── */
  async function init(){
    if (!uiOk()){
      console.error("Faltan elementos UI (revisa IDs en index.html)");
      return;
    }

    // Boot splash (entrada suave)
    const boot = createBootSplash();
    try{ boot.step("Cargando configuración…", 10); }catch{}
    const bootFailSafe = setTimeout(() => { try{ boot.finish(); }catch{} }, 4500);

    window.addEventListener("error", (e) => {
      try{
        const m = (e && (e.message || (e.error && e.error.message))) ? (e.message || e.error.message) : "Error JS";
        setStatus("❌ " + m);
      }catch{}
    });
    window.addEventListener("unhandledrejection", (e) => {
      try{
        const m = (e && e.reason) ? String(e.reason) : "Promise reject";
        setStatus("❌ " + m);
      }catch{}
    });

    loadUsed();
    loadCaches();
    loadProxyHints(); // ✅
    loadBackoff();    // ✅

    try{ boot.step("Cargando fuentes…", 35); }catch{}

    state.feeds = loadFeeds();
    enforceEnabledFeedsLimit();
    saveFeeds();

    bindUI();
    updatePreview();

    try{ boot.step("Preparando UI…", 55); }catch{}

    await attachSwMaintenance();
    await selfHealIfBuildChanged();

    try{ boot.step("Sincronizando caché…", 72); }catch{}

    applyFilters();
    startAuto();

    // GIS: init best-effort
    try{ setTimeout(() => maybeInitGoogleSignIn(), 400); }catch{}

    // Si hardGate y requireLogin => abre modal directamente (para guiar)
    if (BOOT.requireLogin && BOOT.hardGate && !canUseApp()){
      try{ setTimeout(() => setMemberModalOpen(true), 250); }catch{}
    }

    try{ boot.step("Actualizando titulares…", 88); }catch{}

    refreshAll({ force:true, user:false })
      .finally(() => {
        try{ clearTimeout(bootFailSafe); boot.finish(); }catch{}
      })
      .catch(()=>{});
  }

  init().catch((e) => {
    console.error(e);
    setStatus("❌ Error init (revisa consola)");
  });

})();
