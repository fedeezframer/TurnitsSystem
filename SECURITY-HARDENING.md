# Correcciones de seguridad — 25 de octubre de 2026

## Comprobantes

Las dos rutas de comprobantes requieren una sesión activa autorizada sobre la reserva o una credencial firmada independiente. Las credenciales duran 30 días, se vinculan a una reserva o a un pago pendiente y no permiten iniciar sesión. Los retornos de Mercado Pago, pagos con tarjeta y reservas sin pago o manuales generan el enlace firmado. El frontend envía la credencial en una cabecera y la conserva al cambiar de pantalla.

La respuesta utiliza una lista explícita de campos y omite email, teléfono, identificadores de consumidor y tokens de gestión. Los enlaces antiguos sin credencial requieren la sesión del consumidor vinculado o del propietario del negocio. Los invitados con enlaces antiguos necesitan un enlace nuevo: no existe una excepción anónima basada únicamente en el ID o el payment_id.

## Navegador y contraseñas

- CSP del HTML con hashes calculados en cada compilación: permite los scripts propios y los SDK de Google y Mercado Pago utilizados por la aplicación; no habilita `unsafe-inline` ni `unsafe-eval`.
- Cabeceras contra enmarcado y MIME sniffing, `Referrer-Policy: no-referrer` y HSTS de un día, sin incluir subdominios ni preload. Las cabeceras del frontend estático están en `render-web.yaml`; las de la API se configuran en su middleware.
- CORS usa orígenes explícitos de Turnits y los configurados en `WEB_URL`, `PANEL_URL`, `API_URL` y `PANEL_ORIGINS`. Los widgets externos requieren configurar sus orígenes exactos en `PUBLIC_WIDGET_ORIGINS`, separados por coma. Las llamadas sin Origin siguen sujetas a la autorización de cada ruta.
- Registro y cambios o restablecimientos de contraseña requieren al menos 12 caracteres y un máximo de 72 bytes UTF-8. La política no se aplica al login de contraseñas existentes.

## Verificación y publicación

Ejecutar `npm run test:security` en la raíz y `npm run build` en `web/`. Las pruebas de seguridad usan datos sintéticos y un servidor local. La compilación verifica los hashes de todos los scripts inline del HTML final. La prueba de navegador de esta evaluación usa respuestas de API simuladas; no ejecuta pagos externos.

No hay migraciones de base de datos. Publicar frontend y backend coordinadamente: el frontend nuevo debe conservar `receipt_token` antes de cerrar las rutas anónimas del backend. Aplicar también las cabeceras del Blueprint al sitio estático existente; una compilación de frontend por sí sola no sincroniza el Blueprint. Verificar los orígenes de widgets antes del despliegue.

Después de desplegar, comprobar el rechazo anónimo y los permisos con cuentas de prueba. Staging no sustituye las comprobaciones de producción. Esta corrección cubre los hallazgos revisados, no certifica una auditoría integral.
