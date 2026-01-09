```md
# tweet-news-panel

App PWA para obtener noticias en tiempo real (última hora) desde **RSS/Atom/JSON**, con **imágenes**, **resolución de link original** (evita URLs largas tipo Google News), filtros pro y generador de plantilla lista para publicar en **X (Twitter)**.

---

## ✨ Características

- **PWA (instalable)**: funciona como app en escritorio/móvil.
- **Noticias en tiempo real**:
  - Auto-refresh configurable (por defecto 30s).
  - Ventana temporal (1h → 72h) para “última hora”.
  - **Batch refresh**: refresca feeds por lotes para no colapsar (ideal con muchos feeds).
- **Fuentes**: soporta **RSS**, **Atom** y **JSON** (y proxies cuando hay CORS).
- **Resolver links**:
  - Resuelve enlaces tipo Google News / redirects para obtener el **link real del medio**.
  - Limpieza de tracking (utm, fbclid, gclid, etc.).
- **Imágenes**:
  - Usa imagen del feed (media/enclosure) cuando existe.
  - Fallback a **OG image** (og:image / twitter:image) si falta thumbnail.
  - Fallback a **favicon** del dominio.
- **Traducción auto (ES)**:
  - Traduce titulares automáticamente al español cuando detecta que no lo están.
  - Caché de traducciones para rendimiento.
- **Composer de tweet**:
  - Plantilla editable (tu formato de “🚨 ÚLTIMA HORA…”).
  - Botones: **Ajustar** (recorta titular para 280), **Generar hashtags**, **Copiar**, **Abrir X**.
  - Toggle para incluir/quitar **LIVE_URL** y **Fuente**.
- **Organización y productividad**:
  - Marcar como “usado” (y ocultarlos si quieres).
  - Búsqueda instantánea.
  - Orden por recientes / impacto / fuente.
  - Categorías: España, Mundo, Guerra, Política, Economía, Tech, Sucesos, Salud, Deportes, Entretenimiento.
- **Service Worker endurecido**:
  - Offline-first para shell.
  - Network-first para feeds.
  - SWR para imágenes/favicons.
  - Limpieza de cachés antiguas y actualización rápida.

---

## 🧩 Estructura del proyecto

```

tweet-news-panel/
├─ index.html
├─ styles.css
├─ app.js
├─ sw.js
├─ manifest.webmanifest
└─ assets/
└─ icons/
├─ icon-192.png
├─ icon-512.png
├─ icon-192-maskable.png
└─ icon-512-maskable.png

````

---

## 🚀 Cómo usar

### 1) Abrir en local
Puedes abrir `index.html` directamente, pero para PWA + Service Worker lo ideal es un servidor local.

**Opción rápida (VS Code):**
- Instala extensión “Live Server”
- Click derecho `index.html` → “Open with Live Server”

**Opción Node:**
```bash
npx serve .
````

---

## 📰 Cómo añadir feeds

1. Pulsa **⚙ Feeds**
2. Añade:

   * **Nombre**
   * **URL RSS/Atom/JSON**
3. Guarda.

También puedes:

* **Exportar** feeds a JSON.
* **Importar** feeds desde JSON.
* Restaurar **Defaults**.

> Consejo: si usas muchos feeds, sube **Batch** a 16–20 o sube el intervalo del auto-refresh.

---

## ⚙️ Configuración recomendada

* **Ventana**: 3h / 6h para “última hora”.
* **Mostrar**: 10–20 para rendimiento y lectura.
* **Tope (fetch cap)**: 240–600 si tienes 50+ feeds.
* **Auto-refresh**: 30–60s con Batch 12–20.

---

## 🧠 Notas técnicas

* Algunos feeds bloquean CORS desde navegador:

  * La app intenta primero `fetch()` directo.
  * Si falla, usa **AllOrigins** y después `r.jina.ai` como fallback.
* Los links tipo Google News se intentan resolver con varios métodos:

  * Parámetros `url=`, `u=`, `q=`, etc.
  * Canonical, meta refresh, JSON-LD, follow redirect.
* Las imágenes se cargan con prioridad:

  1. Imagen del feed (media/enclosure/thumbnail)
  2. OG/Twitter image del HTML del artículo (visible-only)
  3. Favicon del dominio

---

## 🧷 Plantilla por defecto

Ejemplo (editable dentro de la app):

```text
🚨 ÚLTIMA HORA: {{HEADLINE}}

🔴#ENVIVO >>> {{LIVE_URL}}

Fuente:
{{SOURCE_URL}}

{{HASHTAGS}}
```

---

## 🔒 Privacidad

* La app guarda en `localStorage`:

  * feeds configurados
  * ajustes
  * cachés de traducción, resolución de links e imágenes
  * lista de “usados”

No hay backend propio: todo corre en el navegador.

---

## ✅ Deploy (GitHub Pages)

1. Sube este repo a GitHub
2. Ve a **Settings → Pages**
3. Selecciona:

   * Branch: `main`
   * Folder: `/root`
4. Abre la URL de Pages.

---

## 🛠️ Troubleshooting

**No aparecen noticias**

* Revisa que haya feeds habilitados en **⚙ Feeds**
* Sube la ventana a 24h para comprobar
* Algunos feeds pueden fallar por CORS o caídas temporales

**Imágenes no salen**

* No todos los RSS incluyen thumbnails
* La app busca OG image al hacer scroll (visible-only)
* Si un medio bloquea el HTML del artículo, se quedará con favicon

**No se actualiza**

* Cierra pestañas antiguas y recarga
* En PWA instalada, a veces ayuda “Cerrar app” y abrir de nuevo
* El SW está configurado para activarse rápido y limpiar cachés antiguas

---

## 📄 Licencia

MIT (si quieres, cámbiala por la que prefieras).

```
::contentReference[oaicite:0]{index=0}
```
