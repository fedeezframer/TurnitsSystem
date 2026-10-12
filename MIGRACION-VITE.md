# Aplicación de Turnits con React y Vite

`web/` contiene las pantallas adaptadas del código vigente de Framer. `api/server.js` conserva la versión descargada de TurnitsSystem; esta migración no modifica la API ni la base de datos.

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

- `web/src/config.ts`: URL de API, marca, colores, Client ID e imágenes/íconos que eran props de Framer.
- `web/src/migrated/panel/`: 20 módulos para servicios, clientes, agenda, horarios, pagos, temas, equipo, finanzas, planes, empleado y componentes compartidos.
- `web/src/migrated/`: login, registro, booking y comparador de planes.
- `web/public/assets/`: ilustraciones originales y tipografía Inter. Se conserva la licencia de la fuente.
- `web/src/App.tsx`: rutas y carga de pantallas bajo demanda.
- `web/public/sw.js`: notificaciones push; no almacena ni cachea respuestas de la API.

La sesión se conserva en localStorage con las claves actuales. Una URL de prueba tiene otro origen, por lo que requiere volver a iniciar sesión. El backend sigue siendo responsable de permisos, precios y aprobación de pagos.

## Alcance de esta primera migración

Se adaptaron los componentes que estaban disponibles en esta carpeta. El logo por defecto usa el SVG de respaldo que ya estaba en el checkout; las imágenes e íconos específicos cargados en el editor de Framer deben asignarse en `config.ts` o copiarse a `public/assets`.

La web pública de presentación, los textos legales y el panel interno de superadmin (`/internal`) todavía requieren sus fuentes/configuración de Framer para quedar íntegramente en React. Los enlaces legales siguen apuntando a las páginas publicadas. No se incluyeron los borradores legales locales con datos pendientes en el repositorio público.

Se agregó una pantalla de comprobante que consulta el estado real del turno por la API y una pantalla para los enlaces de cambio de contraseña. No se interpretan parámetros de URL como prueba de pago aprobado.

## Verificación

Build de producción y navegación con API simulada: login a panel con sesión, ocho secciones del panel, registro, planes, booking en desktop/mobile, comprobante y cambio de contraseña. No se realizaron cargos ni cambios en Supabase. La comprobación final de OAuth, push y pagos en el nuevo dominio requiere configurar los orígenes y usar credenciales de prueba.
