# News → Tweet Template Panel (TNP)

Panel PRO para:
- Leer noticias desde RSS/Atom (preferiblemente feeds directos, no Google)
- Mostrar lista con imágenes (media/enclosure + OG best-effort)
- Generar tweet en tu plantilla y copiar/abrir en X
- Auto-refresh configurable, filtros por ventana temporal y categorías
- Gestor de feeds (import/export JSON) + defaults

## Archivos
- index.html
- styles.css
- app.js
- sw.js
- manifest.webmanifest

## Uso
1) Sube estos archivos a GitHub Pages (o abre en local con un server)
2) Abre la web
3) Botón **Feeds** para activar/desactivar fuentes
4) Botón **Refrescar** (Shift+click = force + reset backoff)
5) Click en una noticia → se rellena la plantilla

## Notas
- Algunos RSS pueden fallar por CORS. La app intenta proxies automáticamente.
- “Reset” borra localStorage y caches del navegador.
