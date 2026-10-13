# Revisión de la migración — 13 de octubre de 2026

## Correcciones y controles

- Se corrigieron los errores que detectó TypeScript en las propiedades de registro, estilos del login, gráficos, notificaciones y tienda, además de una propiedad `width` duplicada. La revisión completa de tipos pasa.
- Las pantallas y sus valores por defecto usan `appConfig.apiUrl`, para que la configuración de la API no cambie según la sección.
- `/register` conserva los parámetros de referido y plan al redirigir a `/registro`. La comparación de características del registro abre la página local `/planes`.
- Cada build ejecuta `npm run check` antes de Vite. El control comprueba tipos, 61 archivos de fuentes, 111 recursos locales, ausencia de APIs/imports del editor Framer y ausencia de recursos de su hosting en las pantallas.
- `framer-motion` es una biblioteca independiente de animación. No requiere el editor, una cuenta ni hosting de Framer.

## Comprobaciones realizadas

Build de producción; login → panel y ocho secciones con API simulada; registro; agenda en escritorio y móvil; comprobante consultado por API; cambio de contraseña; portada y planes en tres anchos; siete preguntas frecuentes; legales; tienda; navegación y aislamiento de estilos; reprogramación completa simulada; guard del panel interno; panel de empleado y conservación del referido.

La API publicada respondió JSON válido en salud, planes, tarjetas, negocio, equipo, servicios, promociones, información de renovación y versión del panel. Se verificó CORS desde el origen de Render y el preflight del login. Las rutas privadas responden 401 sin token, como corresponde. Los recursos del negocio público comprobado utilizan Supabase, sin imágenes alojadas en Framer. Federico confirmó que puede iniciar sesión en el sitio nuevo.

No se crearon reservas reales, no se efectuaron cobros y no se modificaron cuentas ni datos en Supabase. La validación de escrituras y pagos de punta a punta debe realizarse con una cuenta y datos de prueba, respetando la autorización de la persona que realiza el pago.

## Pendientes para cerrar el traslado

- `turnits.com` todavía sirve Framer. Configurar el dominio personalizado en Render y sus DNS en Cloudflare; ajustar `VITE_SITE_URL` al dominio final y verificar HTTPS, rutas y origen OAuth.
- Comprobar un pago completo de reserva y de plan, incluyendo retorno y confirmación por el servidor, en el dominio final.
- Render muestra el aviso de cuenta **Payment failed**. Los servicios responden actualmente; el titular debe resolver la facturación desde su cuenta.
- Conservar la publicación anterior de Framer hasta completar estas comprobaciones, para permitir volver a la configuración anterior del dominio.

Esta revisión identifica lo probado y sus límites. No constituye una garantía de ausencia de errores en cualquier dato, navegador o transacción futura.
