# Turnits Test

URL: https://turnits-test-api.onrender.com

## Aislamiento

- Rama `staging`. No desplegar esta rama en los servicios productivos.
- Servicio Render `srv-dbcjs08473hc7399lum0`, plan Free. Sirve la web compilada y la API desde el mismo dominio. Las navegaciones HTML reciben la SPA; las llamadas fetch mantienen las rutas API existentes.
- Proyecto Supabase `glqflwmrxnavkdegjcdm` (`turnits-test`), organización `fedeezframer`, plan gratuito.
- Base inicial copiada solo como estructura. No se copiaron cuentas, reservas, pagos, contraseñas, tokens ni archivos de producción.
- Clave de servidor y secreto de sesiones exclusivos. El backend se niega a arrancar como staging si apunta al Supabase productivo o tiene URLs de retorno productivas.
- 39 tablas de aplicación con RLS. Las operaciones privadas pasan por el backend, no se concede acceso directo a `anon` o `authenticated`.
- Bucket de referencias privado con URLs firmadas. Otros buckets vacíos recreados por nombre para probar cargas sin tocar archivos reales.
- Cabecera X-Robots-Tag, robots.txt y metadatos noindex. Esto evita indexación, NO reemplaza autenticación.

## Acceso

Las credenciales ficticias están en el archivo local `../.env.turnits-test-access.local`, fuera del repositorio y restringido al usuario de Windows. No subirlo a Git ni pegarlo en tickets.

- Cliente demo: `cliente-test@turnits.example`, seleccionar Usuario al iniciar sesión.
- Negocio por presupuesto: `negocio-test@turnits.example`, seleccionar Negocio.
- Negocio normal: `barberia-test@turnits.example`, misma contraseña demo del negocio.

Son cuentas de prueba, no cuentas reales. Usar datos ficticios exclusivamente.

## Qué está habilitado

Web y panel existentes, catálogo de dos negocios ficticios, favoritos y la primera versión de chat/presupuestos. Se habilitaron `QUOTE_BOOKING_ENABLED` y `VITE_QUOTE_BOOKING_ENABLED` solamente aquí.

La agenda de cuentas por presupuesto presenta disponibilidad orientativa y consulta por chat, sin checkout ni reserva directa. Las migraciones `quote_payment_reconciliation`, `quote_reference_lifecycle` y `quote_chat_events` agregan snapshots, conciliación, cuota de referencias, limpieza y avisos en el chat. El motor de cobros permanece apagado y las operaciones de reintegro se prueban con dobles de Mercado Pago; no se conectaron cuentas reales.

`node scripts/verify-staging.mjs ../.env.turnits-test-access.local` verifica ingreso de ambos roles, catálogo, consulta privada, mensajes, referencia en storage separado, presupuesto, aceptación, reserva manual e idempotencia. Escribe únicamente en staging.

## Limitaciones explícitas

La bandeja y el chat reproducen los bocetos móviles: una sola pantalla por estado, presupuesto separado del historial, referencias privadas y mensajes propios verdes. Los nombres, fotos, últimos mensajes y no leídos provienen de datos reales. Aplicar también `20261021235830_consultation_inbox_read_receipts.sql`; su función de bandeja solo es ejecutable por el servidor y cada ruta valida al participante. Las lecturas son monotónicas y se marcan hasta el mensaje recibido por el cliente, no hasta la hora del servidor. El refresco es cada 15 segundos con la pestaña visible.

- Cobros reales, OAuth de Mercado Pago y webhooks de pagos bloqueados. No conectar cuentas ni tarjetas reales. El pago online por presupuesto sigue pendiente; se puede probar confirmación manual, sin registrar un pago.
- Google, WhatsApp, push y correo real no están conectados. El registro con verificación por correo no completa su flujo hasta configurar un proveedor de correo de pruebas; usar las cuentas demo mientras tanto.
- La agenda por presupuesto sigue en desarrollo. El editor sin precio obligatorio y los demás pendientes están en AGENDA-PRESUPUESTOS.md. No confundir una demo accesible con una funcionalidad terminada.
- El plan Free puede suspender el servicio por inactividad y tardar en responder al primer acceso. Está sujeto a cuotas de Render y Supabase; no se contrataron planes pagos ni escalado automático.

## Recreación y promoción

En un proyecto vacío de pruebas, `scripts/staging-baseline.sql` reconstruye la estructura conocida; NO ejecutarlo sobre producción. Después aplicar las migraciones de presupuesto, categorías y consultas repetidas.

Las cuentas demo se generaron por separado, con contraseñas aleatorias; no forman parte del script SQL versionado. Las claves viven en Render, no en la web ni en Git.

Promover cambios requiere revisión y una publicación explícita a las ramas productivas; nunca sincronizar toda la rama staging de forma automática.
