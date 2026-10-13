# Migración del proyecto completo de Framer

Código preparado y comprobado el 12 de octubre de 2026. Fuente: proyecto Turnits y sus páginas publicadas. La API y la base de datos no se modifican.

| Ruta | Estado |
|---|---|
| `/` | Portada con diseño publicado, recursos locales, demos animadas y preguntas frecuentes |
| `/login`, `/registro`, `/register` | Autenticación y registro actuales; compatibilidad de rutas |
| `/panel`, `/panel/:slug` | Panel de dueño y empleado con permisos de la API |
| `/agenda`, `/agenda/:slug` | Booking actual |
| `/planes` | Tabla original de Framer; sucursales como próxima etapa |
| `/renovar` | Checkout de planes integrado en el panel |
| `/success`, `/pendiente`, `/error`, `/alert` | Comprobantes que consultan el estado real en la API |
| `/cambiar-contraseña`, `/cambiar-contrasena` | Restablecer contraseña con token |
| `/terminos-y-condiciones`, `/terminos` | Documento completo publicado; no usa borradores locales |
| `/politica-de-privacidad`, `/privacidad` | Documento completo publicado; no usa borradores locales |
| `/store-login` | Presentación de acceso de Framer; enlaces al login y registro |
| `/reprogramar` | Componente original, calendario y solicitud autenticada con token de gestión |
| `/internal` | Panel interno; muestra datos sólo tras autorización del servidor |
| `/app` | Validación de sesión y entrada al panel |
| `/login-test`, `/register-test`, `/panel-test`, `/agenda-test` | Reutilizan las pantallas actuales para evitar versiones divergentes |
| `/test`, `/404` | Demostración de animación y página no encontrada |

## Verificado

Build de producción; navegación y flujos con API simulada; portada y tabla en 1440/800/390 px; siete preguntas frecuentes; documentos legales completos; navegación entre páginas sin filtración de estilos; reprogramación con datos completos; autorización/denegación del panel interno. No se hicieron reservas reales, cobros ni cambios en cuentas.

## Publicación y dominio

La URL del Static Site es https://turnits-web.onrender.com/. Render publica la rama `codex/vite-migration`. turnits.com todavía sigue en Framer, con DNS en Cloudflare. La migración del código está preparada; el cambio del dominio requiere configurar los dominios personalizados, actualizar `VITE_SITE_URL` y comprobar OAuth, pagos y push en el origen final. El sitio original se conserva.
