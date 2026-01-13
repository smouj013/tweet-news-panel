# TNP — Tweet News Panel (v4.2.0 · build 2026-01-12d)

Panel web para **leer titulares (RSS/Atom)**, **resolver enlaces**, **extraer imagen OG**, y generar un **tweet listo para X** con tu plantilla fija:
> 🚨 ÚLTIMA HORA … 🔴#ENVIVO >>> … Fuente: …

Este README **explica el funcionamiento** y cómo se usa el panel (no instalación).

---

## 1) Qué hace el panel (en 20s)

- **Agrega feeds RSS/Atom** (tuyos o por defecto).
- **Refresca** y construye una lista de noticias con:
  - título (traducción ES opcional),
  - dominio,
  - “edad” (m / h),
  - imagen (si el feed la trae o si se puede sacar del OG).
- **Ticker** superior con los TOP titulares.
- **Pop de tendencias** (opcional): rota hashtags (de fuentes externas o deducidos del pool de titulares).
- **Composer** para generar el tweet final + preview + contador aproximado de caracteres en X.
- **Membresía + Login Google (GIS)**: limita por tiers (FREE/BÁSICA/PRO/ELITE) y puede exigir login para usar el panel.

---

## 2) Flujo de uso normal

1) Pulsa **Refrescar** para cargar noticias.
   - Tip: **Shift + click** en Refrescar hace “force refresh” (resetea backoff y fuerza intentos).

2) En la lista, haz click en una noticia:
   - Rellena **Headline**
   - Rellena **Fuente** (URL)
   - Sugiere **hashtags**
   - Actualiza preview y la tarjeta “mock” estilo X

3) Ajusta lo que quieras:
   - editar titular
   - pegar tu URL en “🔴#ENVIVO”
   - tocar hashtags
   - activar/desactivar bloques (ENVIVO / Fuente)

4) Pulsa:
   - **Copiar** → copia el tweet al portapapeles y marca la noticia como “usada”
   - **X** → abre el intent de X con el tweet ya montado y marca “usada”

---

## 3) Secciones y controles (qué significan)

### 3.1 Filtros (lista de noticias)
- **Ventana (timeFilter)**: filtra noticias por antigüedad máxima (ej. 60min, 3h, etc).
- **Delay (delayMin)**: descarta noticias “demasiado recientes” (útil para evitar posts duplicados si un feed spamea).
- **Buscar**: filtra por texto (título / dominio / nombre de feed).
- **Categoría (catFilter)**: “spain / world / economy / tech / …” según cada feed.
- **Solo LISTO**:
  - “LISTO” suele significar que el item tiene título y link usable (y si aplica, resuelto).
- **Solo ES**:
  - activa preferencia por ES y dispara traducción best-effort para títulos visibles.
- **Resolver enlaces**:
  - intenta seguir redirects (Google News, t.co, bit.ly…) para obtener el link final.
- **Mostrar original**:
  - al seleccionar, puede priorizar el link resuelto vs el link original.
- **Ocultar usados**:
  - no muestra noticias ya marcadas como usadas (se marca al copiar o abrir en X).

### 3.2 Límites (dependen del tier)
- **Fetch cap**: cuántos items máximos intenta “considerar” por refresh.
- **Show limit**: cuántos items como máximo se renderizan en lista.
- **Batch feeds**: cuántos feeds se refrescan por lote (control de carga/lag).
- **Auto-refresh** + **segundos**: refresco automático cuando la pestaña está visible.

> Importante: el panel aplica clamps a estos valores según tu tier (FREE/BÁSICA/PRO/ELITE).

### 3.3 Composer (tweet)
- **Template**:
  - Debe contener `{{HEADLINE}}` (si no, se auto-restaura para evitar “título pegado”).
- Variables soportadas:
  - `{{HEADLINE}}` → titular
  - `{{LIVE_URL}}` → tu URL de directo
  - `{{LIVE_LINE}}` → línea “🔴#ENVIVO >>> …” (si está activada)
  - `{{SOURCE_URL}}` → enlace de la noticia
  - `{{HASHTAGS}}` → hashtags finales

- Botones:
  - **Trim**: recorta titular de forma inteligente.
  - **Gen Tags**: genera hashtags según categoría + palabras fuertes del titular.
  - **Copiar URL**: copia el enlace fuente.
  - **Copiar**: copia tweet completo y marca “usado”.
  - **X**: abre intent de X con el tweet y marca “usado”.

### 3.4 Ticker (noticias arriba)
- Muestra los primeros N titulares del filtro actual (TOP).
- La velocidad se controla con el slider de **ticker pps**.
- Se recalcula duración según ancho real del texto (para que el movimiento sea estable).

### 3.5 Pop de tendencias (opcional)
Si `features.enableTrends` y `ticker.popTrends` están activos:
- Intenta cargar un pack de fuentes (JSON) y leer un feed de trends.
- Si falla, genera “candidatos” desde los titulares (palabras repetidas con heurística).
- Rota un hashtag cada X ms (configurable).

---

## 4) Feeds (modal)
Botón **Feeds** abre el editor.

Dentro puedes:
- **Activar / desactivar** feeds (respetando el máximo permitido por tier).
- **Borrar** feeds.
- **Añadir** feed (nombre + URL).
- **Export**: te vuelca el JSON de feeds para copiar.
- **Import**: pegas un JSON (array) y se limpia/normaliza.
- **Restaurar defaults**: vuelve a los feeds iniciales.
- **Guardar**: guarda y fuerza refresh.

Formato feed:

```
{ "name":"El País — Portada (MRSS)", "url":"https://…", "enabled":true, "cat":"spain" }
```

5) Traducción a español (best-effort)
Cuando está activo “Solo ES” y trEnabled:
Traduce títulos visibles usando endpoint público de Google Translate (gtx).
Guarda caché local para no repetir.
Si un título ya parece español, lo deja como está.
Si la traducción cambia el título y tú tenías esa noticia seleccionada, intenta actualizar el campo “Headline” de forma segura (sin pisarte lo que estabas editando).

6) Imágenes (del feed o OG)
El panel intenta imagen en este orden:
media:content, media:thumbnail, enclosure, content:encoded (img tag) si viene en el feed.
Si no hay, y enableOgImages está activo:
descarga el HTML de la noticia (best-effort, con proxies),
busca og:image / twitter:image / image_src.
Notas:
Algunas webs bloquean CORS o devuelven HTML “vacío” vía proxy: en esos casos puede salir sin imagen.
Hay caché local de OG para no martillear.

7) Resolución de enlaces (Google News, t.co, etc.)
Si “Resolver enlaces” está activo:
Sigue redirects para intentar recuperar el link final real.
Guarda caché local para acelerar siguientes refresh.
También limpia tracking típico (utm_*, fbclid, gclid…).

8) Membresía + Login Google (GIS)
Botón Membresía:

Muestra tiers (cards)
Renderiza el botón de Google (GIS)
Muestra tu email, tier, expiración
Permite cerrar sesión
8.1 Cómo se decide el tier
El panel verifica en este orden:
Override local (si está permitido por config)
Endpoint de verificación (POST con {email, credential, app, build})
Allowlist JSON (dos modos):
Hash mode: lista de hashes SHA-256(salt:email)
Email mode: allow[] + roles{ email: "admin|pro|elite|basic" }
Si auth.requireLogin=true:
Sin sesión, el panel puede bloquear (modo “hardGate” si está activado).

9) Service Worker (PWA) y updates
El SW está pensado para GitHub Pages:
Evita quedarse “pegado” con app.js viejo.
Limpia caches antiguos.
Responde a:
SKIP_WAITING → aplica el nuevo SW
CLEAR_CACHES → limpia caches tnp-*
En la UI suelen existir:
Check update: fuerza reg.update() y aplica si hay waiting.
Hard reset: borra storage + caches + desregistra SW (reset total).

10) Archivos clave (qué hace cada uno)
index.html → UI, IDs y estructura.
styles.css → tema/estilos.
app.js → toda la lógica (feeds, parse, filtros, composer, GIS, membership, trends, caches).
sw.js → caching/auto-update PWA.
manifest.webmanifest → metadatos PWA.
config/boot-config.js → configuración (auth/membership/ui/network/features).
member.json → allowlist público (si lo usas en modo allowlist).
monetization.json → enlaces de soporte/Ko-fi y (opcional) web monetization.

11) “Trucos” rápidos
Shift + Refrescar: fuerza refresh y resetea backoff.
Si ves que “todo falla” (0 feeds OK), el panel puede auto-reparar cache/SW (modo emergencia).
Si el tweet se pasa de 280: usa Trim o baja hashtags.

12) Privacidad y notas
Las caches (feeds/OG/translate/resolve) son locales (localStorage + caches del SW).
member.json en GitHub Pages es público: no metas datos sensibles.
El login GIS es “ID token” (credential) y el panel solo lo usa para leer email y verificar tier.

© TNP — GlobalEyeTV / GlobalEye_TV