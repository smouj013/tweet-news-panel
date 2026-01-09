# tweet-news-panel

App (PWA) para obtener **noticias en tiempo real** (RSS/Atom/JSON), **resolver enlace original**, **extraer imagen/favicons** y generar un **tweet listo para X** con tu plantilla (incluye LIVE_URL y Fuente).

## ✨ Características

- ✅ Panel “PRO” con lista de noticias a la derecha y compositor a la izquierda.
- ✅ **Feeds por defecto (50+)**: mezcla España/Mundo/Política/Guerra/Economía/Tech usando RSS estables (Google News RSS con `site:` + algunos RSS directos).
- ✅ **Auto-refresh** configurable + **batch refresh** (evita colapsar con muchos feeds).
- ✅ **Traducción automática al español (ES)** prioritaria para titulares (usa Google Translate público) con caché.
- ✅ **Resolver enlaces** (especialmente Google News / redirects) con caché.
- ✅ **Imágenes**: usa imagen RSS si existe, si no intenta OG/Twitter card, y si no favicon.
- ✅ **PWA offline-first**: cachea shell (HTML/CSS/JS/manifest/icons) y runtime.
- ✅ **Auto-update de la app**: si subes cambios al repo, el Service Worker se actualiza y la app recarga una vez.

## 🚀 Uso rápido

1. Abre la app en tu GitHub Pages.
2. Pulsa **⟳ Refrescar** (o deja **Auto-refresh**).
3. En la lista de noticias:
   - **Usar** → carga titular + enlace en la plantilla y marca como usado.
   - **Abrir** → abre la noticia en nueva pestaña.
   - **Marcar/Desmarcar** → para ocultar usados si quieres.
4. En “Plantilla”:
   - Ajusta `LIVE_URL`, `HASHTAGS` y el `TEMPLATE`.
   - **📋 Copiar** o **𝕏 Abrir X**.

### Tips PRO
- Si activas muchos feeds, sube **Batch** (16–20) o sube el intervalo.
- Si quieres forzar refresco total, usa **Shift + click** en Refrescar (resetea backoff).

## ⚙️ Feeds

- Abre **⚙ Feeds** para activar/desactivar o añadir los tuyos.
- Puedes exportar/importar JSON desde el modal.

## 🧠 Traducción ES

- Por defecto, el modo **ES (auto)** está activado.
- Traduce titulares visibles y los cachea en localStorage para ser muy rápido en siguientes refrescos.

> Nota: si el endpoint público de translate se satura, la app reintenta y mantiene el original hasta tener ES.

## ♻️ Auto-update (PWA)

Cuando subes cambios a GitHub Pages:
- el navegador detecta nuevo `sw.js`,
- el Service Worker nuevo se instala,
- la app envía `SKIP_WAITING`,
- al activarse, se produce un `controllerchange` y la app recarga **una sola vez** (guard).

## 🧱 Estructura

- `index.html`
- `styles.css`
- `app.js`
- `sw.js`
- `manifest.webmanifest`
- `assets/icons/*`

## Licencia

Uso personal / proyecto propio.
