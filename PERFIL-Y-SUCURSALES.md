# Perfil y sucursales

Una cuenta, una suscripción y un enlace `/agenda/{slug}`. Las sucursales son sedes del mismo negocio, no cuentas adicionales.

## Uso

- **Perfil** en el menú: nombre público, rubro, descripción, ubicación, teléfono público, Instagram, web y hasta ocho fotos (primera como portada). Se guarda inicialmente oculto. El titular decide cuándo publicarlo en `/perfil/{slug}`. Esta ficha es la base del futuro Browse; no se implementó todavía el buscador de negocios.
- **Equipo → Miembros / Sucursales**. Sólo Premium vigente, incluida la prueba Premium, puede crear o modificar sucursales. Los otros planes muestran el bloqueo con opacidad y corona.
- La **sede principal** contiene al dueño y a quienes no tienen sucursal asignada. En una sucursal se configura nombre, dirección, miembros y encargado opcional. Un profesional pertenece a una sede a la vez. Al quitarlo de una sucursal vuelve a la principal.
- El dueño general conserva la administración de todo. Puede delegar una sucursal a un integrante activo con email de acceso. El integrante termina de activar su acceso mediante el flujo habitual del equipo.
- El encargado entra con su sesión de empleado y ve **Mi sucursal**: próximos turnos de esa sede, aprobación/rechazo de pagos manuales pendientes, alta y edición de miembros, pausa de miembros y asignación de los servicios existentes. No modifica permisos generales, planes, otras sedes ni datos del dueño. Los permisos individuales de servicios, horarios y pagos siguen siendo decisión del titular. Revocar el encargado, pausar la sede o perder Premium revoca ese acceso en el servidor.
- En el booking se elige la sede antes del profesional, dentro del mismo paso. No se ofrece «Cualquiera» entre diferentes sucursales. El panel del dueño tiene un filtro de sucursal en Agenda.
- Pausar una sede oculta sus profesionales del booking e impide iniciar nuevas reservas para ellos. Las reservas previas se conservan. Un pago ya iniciado puede terminar aunque se pause la sede durante su procesamiento.

## Instalación

Ejecutar **completo** `supabase/migrations/20261014_perfil_sucursales.sql` como administrador en Supabase. Federico confirmó su ejecución el 14/10/2026. El agente no ejecutó cambios en la base real.

Después publicar API (`main`) y web (`codex/vite-migration`). Las rutas nuevas usan autenticación existente y control de acceso propio. La migración habilita RLS sin políticas públicas para las tablas nuevas; el servidor usa la clave de servicio existente. El SQL es transaccional e idempotente.

No se copian datos privados del registro al perfil público. La carga de fotos verifica firma de archivo, tamaño de 3 MB y ruta del negocio. No se eliminan fotos históricas del almacenamiento al quitarlas de la ficha.

La asignación de sucursales y encargados usa una función SQL atómica, valida negocio y membresía y evita mover un encargado a otra sede sin revocarlo primero. Cada turno guarda `sucursal_id` mediante un trigger: cambiar de sede a un profesional no cambia la sede de sus turnos existentes.

## Validación

- Compilación TypeScript/Vite y comprobación de migración.
- PostgreSQL embebido PGlite: ejecución repetida del SQL, RLS/grants, asignación atómica, rollback por miembro ajeno, aislamiento de negocios, revocación inmediata, pausa, Premium/trial, downgrade sin borrar sedes, historial de turnos y publicación de perfil.
- Navegador con API simulada: Perfil guarda/publica y conserva cambios ante error; edición/asignación/pausa de sucursal; bloqueo de Básico; filtro de agenda; booking por sede; perfil público; encargado con vista de su sede y asignación de servicios; escritorio y 390 px sin desbordamiento ni excepciones JavaScript.
- Scripts de verificación del workspace: `work/verify-perfil-sucursales.cjs` y `work/verify-perfil-sucursales-ui.cjs`. Sin reservas, cobros, invitaciones ni escrituras reales de prueba.
