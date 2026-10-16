# Aplicación de Turnits con React y Vite

`web/` contiene las pantallas adaptadas del código vigente de Framer. `api/server.js` conserva la versión descargada de TurnitsSystem; esta migración no modifica la API ni la base de datos.

## Publicación realizada — 12 de octubre de 2026

- Web completa: https://turnits-web.onrender.com/
- Login: https://turnits-web.onrender.com/login
- Booking: https://turnits-web.onrender.com/agenda/turnits
- Servicio: `turnits-web`, Static Site, proyecto Turnits; rama `codex/vite-migration`.
- Render compila `web/` y publica `dist`, con la regla Rewrite `/*` → `/index.html`.
- Configuradas `NODE_VERSION`, `VITE_API_URL` y `VITE_MP_CLIENT_ID` (identificador público).
- Recuperadas las props publicadas del panel, booking, login y registro. Sus imágenes, SVG y fuentes se sirven desde `web/public/assets/framer/`.
- Favicon claro/oscuro, Apple Touch Icon y Social Preview originales instalados. Open Graph y Twitter Cards se incluyen en el HTML inicial para que los lectores de enlaces puedan verlos sin ejecutar React.
- En el servidor API se agregaron `PANEL_ORIGINS` y `GOOGLE_ALLOWED_ORIGINS`, conservando los dos orígenes de turnits.com y sumando `https://turnits-web.onrender.com`.

Federico autorizó `https://turnits-web.onrender.com` en Google Cloud. La API también permite ese origen. La comprobación del inicio de sesión completo se realiza desde el login publicado, seleccionando una cuenta de Google.

El repositorio se conectó mediante su URL pública. Se comprobó un **Auto-Deploy** al subir un cambio en `web/` a `codex/vite-migration`. También se puede usar **Manual Deploy → Deploy latest commit** en Render. Los cambios fuera de `web/`, como esta documentación, no disparan el build del frontend.

turnits.com continúa en Framer y sus DNS se gestionan en Cloudflare. Esta publicación permite revisar la app antes de cambiar el dominio. El booking ya se comprobó con los datos públicos reales; no se realizaron reservas, pagos ni modificaciones en cuentas.

Al mover el dominio, configurar `VITE_SITE_URL=https://turnits.com` en el Static Site y volver a compilar. Esto actualiza las URLs absolutas de la imagen y los metadatos sociales. Durante la prueba usan `https://turnits-web.onrender.com`.

## Ejecutar en tu computadora

Usar Node 22.12 o superior (probado con 24.13).

```powershell
cd web
npm ci
npm run dev
```

Abrir http://127.0.0.1:5173/login. El proxy de desarrollo consulta la API actual en Render. Las modificaciones se ven al guardar.

## Publicar una URL de prueba en Render

Crear **New → Static Site**, seleccionar **fedeezframer/TurnitsSystem** y la rama **codex/vite-migration**.

| Configuración | Valor |
|---|---|
| Root Directory | `web` |
| Build Command | `npm ci && npm run build` |
| Publish Directory | `dist` |
| Node | `24.13.0` |
| Variable `VITE_API_URL` | `https://negosocio.onrender.com` |
| Variable `VITE_MP_CLIENT_ID` | El Client ID público usado antes como prop en Framer |

En **Redirects/Rewrites**, agregar **Rewrite** de `/*` a `/index.html`.

`render-web.yaml` contiene la misma configuración, sin redefinir el servicio API existente.

Cuando Render asigne la URL, añadir ese origen exacto (sin rutas ni barra final) en las variables **PANEL_ORIGINS** y **GOOGLE_ALLOWED_ORIGINS** del servicio API, conservando `https://turnits.com,https://www.turnits.com`. Añadir también ese origen en **Orígenes de JavaScript autorizados** del cliente OAuth de Google. No se necesitan secrets en `web/.env`.

Mantener las variables de retorno de pagos actuales durante la prueba. Los enlaces enviados por el servidor y las preferencias de Mercado Pago seguirán regresando a turnits.com hasta configurar el cambio de dominio. Probar un flujo completo en sandbox antes de hacer ese cambio.

## Código y configuración

- `web/src/config.ts`: URL de API, marca, colores y Client ID; aplica las props recuperadas de Framer.
- `web/src/framer-props.json`: valores originales de imágenes, íconos, fondos y opciones publicados en Framer, con rutas a los recursos locales.
- `web/src/framer-fonts.css`: archivos originales de Inter e Inter Display; cada familia utiliza sus propios archivos.
- `web/src/migrated/panel/`: 20 módulos para servicios, clientes, agenda, horarios, pagos, temas, equipo, finanzas, planes, empleado y componentes compartidos.
- `web/src/migrated/`: login, registro, booking, panel interno, reprogramación y demostraciones animadas.
- `web/src/pages/` y `web/src/published/`: portada, tabla de planes original, tienda, páginas legales y rutas de compatibilidad. Los estilos recuperados están aislados de las pantallas del panel.
- `web/public/assets/site/`: recursos de las páginas públicas y fuentes Noto Serif y DM Sans, con sus licencias.
- `web/public/assets/`: ilustraciones originales y tipografía Inter. Se conserva la licencia de la fuente.
- `web/src/App.tsx`: rutas y carga de pantallas bajo demanda.
- `web/public/sw.js`: notificaciones push; no almacena ni cachea respuestas de la API.

La sesión se conserva en localStorage con las claves actuales. Una URL de prueba tiene otro origen, por lo que requiere volver a iniciar sesión. El backend sigue siendo responsable de permisos, precios y aprobación de pagos.

## Alcance de la migración completa

Se adaptaron los componentes que estaban disponibles en esta carpeta y se recuperaron las props de sus instancias publicadas en Framer. El panel, login y registro conservan sus respectivos logos originales. Los SVG, fondos, ilustraciones y fuentes se copiaron a la app; el manifiesto de recursos conserva sus URLs de origen. Los datos de cada negocio siguen viniendo de la API.

Se incorporaron la portada con sus demostraciones animadas y preguntas frecuentes, la tabla original de `/planes`, los documentos legales completos publicados, `/store-login`, `/reprogramar`, `/internal` y `/app`. Se recuperaron los componentes originales desde el editor de Framer sin modificar el proyecto. No se incluyeron los borradores legales locales con datos pendientes en el repositorio público.

Las rutas de prueba de login, registro, panel y agenda reutilizan los componentes actuales. `/test` conserva la prueba de animación y `/404` muestra la pantalla de página no encontrada. Se conserva el query string al redirigir las rutas antiguas de autenticación. Sucursales figura como «Próximamente», conforme a la etapa acordada, y no habilita una función que todavía no existe.

Las páginas públicas conservan la estructura publicada y sus recursos, sin cargar el runtime de Framer ni su editor. React controla los enlaces, preguntas frecuentes, animaciones y formularios; Vite genera archivos independientes por pantalla. La portada usa las comisiones vigentes y el panel interno distingue correctamente Básico y Premium utilizando el contrato existente de la API.

Se agregó una pantalla de comprobante que consulta el estado real del turno por la API y una pantalla para los enlaces de cambio de contraseña. No se interpretan parámetros de URL como prueba de pago aprobado.

## Verificación

Build de producción y navegación con API simulada: login a panel con sesión, ocho secciones del panel, registro, planes, booking en desktop/mobile, comprobante y cambio de contraseña. Se comprobaron también la portada y planes en 1440, 800 y 390 px, las siete preguntas frecuentes, documentos legales completos, navegación portada → planes → login, reprogramación con petición completa simulada y guard de superadmin autorizado/denegado por el servidor. No se realizaron cargos ni cambios en Supabase. La comprobación final de OAuth, push y pagos en el nuevo dominio requiere configurar los orígenes y usar credenciales de prueba.

## Centrado inicial y registro — 16/10/2026

El registro ocupa al menos el alto del viewport y centra su contenido con márgenes automáticos. Si el paso de planes supera ese alto, el documento crece y permite llegar a todas las opciones con scroll normal, sin recortar la parte superior. Se respetan las áreas seguras del dispositivo.

La carga previa a React incluye un estado centrado en el HTML. El fallback de rutas, el arranque del panel y su verificación de sesión, el skeleton inicial de booking y la espera de datos del perfil mantienen el centrado vertical y horizontal. La espera del panel de empleado se centra dentro de su área disponible. No se fuerza una altura fija al contenido final.

Validación: `work/verify-centered-layout.cjs` simula API lenta, comprueba el HTML sin JavaScript, los pasos personal/negocio/planes del registro y tamaños de escritorio, mobile y pantalla baja. Sin altas de cuentas ni escrituras en producción. No requiere cambios del servidor ni SQL.
