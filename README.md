# News → Tweet Template Panel (TNP)

Panel web (PWA) para:
- Leer noticias desde RSS (prioriza RSS directos/originales)
- Mostrar titulares con imagen (media/enclosure del RSS + OG si falta)
- Generar tweets usando plantilla (GlobalEyeTV)

## Controles rápidos
- **Refrescar**: descarga feeds activos (Shift = forzar / reiniciar refresh si estaba en curso)
- **Feeds**: activar/desactivar, añadir, export/import JSON
- **Update**: fuerza búsqueda de actualización del Service Worker
- **Reset**: borra storage + cache + SW y reinicia limpio

## Notas técnicas
- Anti-CORS: intenta fetch directo y luego proxies públicos (AllOrigins / CodeTabs / ThingProxy).
- Rendimiento: refresh por lotes + hidratación limitada de visibles.
