# Agenda mediante presupuesto — desarrollo protegido

## Estado

Primera etapa implementada y probada de forma aislada. No publicada ni habilitada en producción. La migración de esta funcionalidad NO se aplicó a Supabase de producción. No activar las banderas hasta resolver la lista de salida de este documento.

El rubro sigue describiendo la actividad (se agregó Tatuajes y piercing). El modo de agenda es independiente: `normal` o `presupuesto`. Todas las cuentas existentes conservan `normal`.

## Implementado

- Migración con modalidad de negocio, consultas privadas, mensajes, propuestas versionadas y vínculo al turno.
- Chat de texto con referencias JPG/PNG/WebP de hasta 2 MB, bucket privado y enlaces firmados de cinco minutos. Máximo de diez referencias por consulta, con validación de cabecera y límite transaccional en base de datos.
- APIs separadas para consumidor y titular. Identidad y autoría vienen de la sesión. No se habilitó acceso a empleados o administradores de sucursal.
- Presupuesto con detalle, total, seña, profesional, duración, fecha, hora y vencimiento. Modificarlo crea una propuesta nueva y anula la aceptación anterior.
- El cliente acepta explícitamente. La consulta, propuesta y aceptación no crean turnos ni bloquean cupos.
- Confirmación manual por el titular: relee disponibilidad, crea un turno de manera transaccional y evita duplicados. Comparte bloqueo con la agenda normal y protege los solapamientos en ambos sentidos.
- Una reserva manual guarda `monto_pagado=0`; no acredita TCoins ni inventa un pago.
- Pantalla inicial `/consultas` con bandeja, conversación, referencias, presupuesto y aceptación; entrada inicial desde tarjetas de Browse y navegación del panel cuando la función esté habilitada.
- Selector independiente de modalidad en registro, protegido por bandera.
- RLS activada, privilegios revocados a `PUBLIC`, `anon` y `authenticated`; las operaciones pasan por el backend autenticado con `service_role`. Funciones SQL `SECURITY INVOKER`, sin ejecución pública.

## Configuración de desarrollo

Servidor: `QUOTE_BOOKING_ENABLED=true`. Web: `VITE_QUOTE_BOOKING_ENABLED=true`. Ambas desactivadas por defecto.

Antes de encenderlas, aplicar la migración en un proyecto de pruebas, nunca activar la web contra una base sin migrar. No convertir cuentas existentes automáticamente.

## Pruebas

`node tests/quote-booking.cjs` prueba validación de presupuesto, firma de imágenes, aislamiento por participante, autoría del servidor, restricción al titular y bandera apagada.

`tests/quote-booking-db.cjs` ejecuta la migración y los procedimientos en PostgreSQL WASM aislado con PGlite, sin escrituras externas. Requiere instalar `@electric-sql/pglite` fuera del repositorio y establecer `PGLITE_MODULE_PATH` a ese módulo. Usa fixtures mínimos; no reemplaza las pruebas con el esquema real de staging, todos los triggers existentes y conexiones concurrentes.

## Bloqueadores antes de habilitar

1. Ocultar precio obligatorio y precios cero en TODO el panel/catálogo del modo presupuesto, incluidos servicios de equipo, guardado global, perfil y sucursales. La columna actual de precio no debe convertirse en una reserva gratuita.
2. Impedir reservas/cobros normales que eludan la consulta: agenda pública, reserva manual pública, preferencias, pagos con tarjeta, promociones, Offers y canjes. El panel del titular conserva la gestión habitual de sus turnos.
3. Conectar pago online del presupuesto aceptado a las preferencias y notificaciones verificadas existentes. Definir expiración, idempotencia, reintentos, reintegros y conciliación. Nunca confiar en una redirección del navegador ni un botón del cliente para marcar pagado.
4. Resolver el caso de pago aprobado cuando el horario dejó de estar disponible. Sin un bloqueo previo al pago no se puede prometer exclusividad; no tomar dinero sin una estrategia explícita de conciliación/reintegro. El requerimiento actual es ocupar únicamente al pagar o al confirmar manualmente.
5. Mostrar el presupuesto aceptado y su estado de pago en el comprobante común, calendario del cliente y detalle del negocio; agregar avisos de mensajes y de cambios de propuesta.
6. Verificar contra Supabase de staging tipos, constraints y todos los triggers reales; probar dos clientes intentando reservar simultáneamente, anulaciones y reprogramaciones.
7. Auditar políticas de `storage.objects` existentes: ninguna política amplia debe permitir leer/escribir el bucket nuevo. Agregar eliminación y retención de archivos al cerrar/eliminar consultas o cuentas, cupo global y reencodificación de imágenes/EXIF antes de habilitar referencias reales.
8. Terminar UX: errores de profesionales, lectura/no leídos, historial de versiones, persistencia de mensajes anteriores al refrescar, accesibilidad y revisión visual mobile. Prueba de punta a punta con dos cuentas en staging.
9. Publicar solo después de estas validaciones. La presencia del código o una aceptación de presupuesto NO significa que el flujo de cobro esté terminado.

## Secuencia de producto

Consulta abierta → conversación/referencias → propuesta → aceptación del cliente → confirmación manual o pago verificado → turno confirmado. Un presupuesto vencido o reemplazado requiere nueva propuesta y aceptación.

Las fotos se guardan en almacenamiento de objetos, no dentro de Postgres. No se aceptan SVG, videos, PDFs ni archivos arbitrarios en esta etapa.
