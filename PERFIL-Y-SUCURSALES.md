# Perfil y sucursales

Una cuenta, una suscripción y un enlace `/agenda/{slug}`. Las sucursales son sedes del mismo negocio, no cuentas adicionales.

## Uso

- **Perfil** en el menú: nombre público, rubro, descripción, ubicación, teléfono público, Instagram, web y hasta ocho fotos (primera como portada). Se guarda inicialmente oculto. El titular decide cuándo publicarlo en `/perfil/{slug}`. Esta ficha es la base del futuro Browse; no se implementó todavía el buscador de negocios.
- **Equipo → Miembros / Sucursales**. Sólo Premium vigente, incluida la prueba Premium, puede crear o modificar sucursales. Los otros planes muestran el bloqueo con opacidad y corona.
- La **sede principal** contiene al dueño y a quienes no tienen sucursal asignada. También tiene un editor de nombre, dirección, mapa, estado, miembros y encargado. El dueño conserva el control general. Para quitar un miembro de la principal, se lo asigna desde otra sucursal. En cada sede se configura un encargado opcional y cada profesional pertenece a una sola sede. Al quitarlo de una secundaria vuelve a la principal.
- El dueño general conserva la administración de todo. Puede delegar una sucursal a un integrante activo con email de acceso. El integrante termina de activar su acceso mediante el flujo habitual del equipo.
- El encargado entra con su sesión de empleado y ve **Mi sucursal**: próximos turnos de esa sede, aprobación/rechazo de pagos manuales pendientes, alta y edición de miembros, pausa de miembros y asignación de los servicios existentes. No modifica permisos generales, planes, otras sedes ni datos del dueño. Los permisos individuales de servicios, horarios y pagos siguen siendo decisión del titular. Revocar el encargado, pausar la sede o perder Premium revoca ese acceso en el servidor.
- En el booking, si hay varias sedes habilitadas se elige la sede en un **paso propio con mapa y lista**, antes del profesional. Si hay una sola, se selecciona automáticamente y se omite ese paso, conservando su filtro de profesionales y la navegación hacia atrás. No se ofrece «Cualquiera» entre diferentes sucursales. El panel del dueño tiene un filtro de sucursal en Agenda que usa el nombre editado de la principal.
- **Usar mi ubicación** pide permiso sólo al tocar el botón, ordena las sedes por distancia en línea recta y selecciona la más cercana con profesionales. El cliente puede cambiarla y debe continuar explícitamente. Las coordenadas del visitante se procesan en el navegador, sin guardarlas ni enviarlas a la API. Sin permiso, o sin puntos cargados, se puede elegir desde la lista.
- Para ubicar una sede, tocar el mapa o arrastrar su pin. También se puede usar la ubicación del dispositivo o ingresar ambas coordenadas. Es necesario guardar la sucursal para aplicar los cambios. Escribir una dirección no la geocodifica automáticamente. No se inventan puntos a partir de las direcciones existentes.
- Pausar una sede oculta sus profesionales del booking e impide iniciar nuevas reservas para ellos. Las reservas previas se conservan. Un pago ya iniciado puede terminar aunque se pause la sede durante su procesamiento.

## Instalación

Ejecutar **completos**, en este orden, `supabase/migrations/20261014_perfil_sucursales.sql` y `supabase/migrations/20261014_sucursales_cambio_plan.sql` como administrador en Supabase. Federico confirmó la ejecución de ambos el 14/10/2026. El agente no ejecutó cambios en la base real.

El complemento devuelve a la sede principal los miembros conservados al bajar de Premium y revoca a los encargados. No cambia la sucursal de las reservas históricas ni elimina las sedes.

Para mapas y edición de principal, ejecutar completo **`supabase/migrations/20261014_sucursales_mapa.sql`**, después de los dos anteriores. Agrega coordenadas validadas y el indicador de principal, con índice único por negocio. La principal se registra al editarla por primera vez; el equipo y los turnos históricos de la principal conservan `sucursal_id = NULL`. El nuevo RPC mantiene la edición y asignación atómicas. La API sigue atendiendo clientes anteriores; sin este SQL deshabilita sólo la edición de mapas/principal y conserva la gestión anterior de secundarias. No volver a ejecutar las migraciones anteriores por separado después de la de mapas: reemplazan validadores que la última actualiza.

Después publicar API (`main`) y web (`codex/vite-migration`). Las rutas nuevas usan autenticación existente y control de acceso propio. La migración habilita RLS sin políticas públicas para las tablas nuevas; el servidor usa la clave de servicio existente. El SQL es transaccional e idempotente.

No se copian datos privados del registro al perfil público. La carga de fotos verifica firma de archivo, tamaño de 3 MB y ruta del negocio. No se eliminan fotos históricas del almacenamiento al quitarlas de la ficha.

La asignación de sucursales y encargados usa una función SQL atómica, valida negocio y membresía y evita mover un encargado a otra sede sin revocarlo primero. Cada turno guarda `sucursal_id` mediante un trigger: cambiar de sede a un profesional no cambia la sede de sus turnos existentes.

## Validación

- Compilación TypeScript/Vite y comprobación de migración.
- PostgreSQL embebido PGlite: ejecución repetida del SQL, RLS/grants, asignación atómica, rollback por miembro ajeno, aislamiento de negocios, revocación inmediata, pausa, Premium/trial, downgrade sin borrar sedes, historial de turnos y publicación de perfil.
- Navegador con API simulada: Perfil guarda/publica y conserva cambios ante error; edición/asignación/pausa de sucursal; bloqueo de Básico; filtro de agenda; booking por sede; perfil público; encargado con vista de su sede y asignación de servicios; escritorio y 390 px sin desbordamiento ni excepciones JavaScript.
- Scripts de verificación del workspace: `work/verify-perfil-sucursales.cjs` y `work/verify-perfil-sucursales-ui.cjs`. Sin reservas, cobros, invitaciones ni escrituras reales de prueba.
- Ampliación de mapas: `work/verify-sucursales-mapa.cjs` (PostgreSQL y router reales en entorno aislado) y `work/verify-sucursales-mapa-ui.cjs` (Leaflet real, API, geolocalización y teselas simuladas). Cubre coordenadas parciales y cero, clic/arrastre, guardado explícito, permisos de principal, selección mapa/lista, denegación de ubicación, cercanía con cambio manual, reserva sin integrantes persistidos y tema oscuro.

## Proveedor del mapa

Leaflet conserva los pines y la interacción. MapLibre GL dibuja un estilo vectorial propio, cargado en un módulo separado: fondo claro, calles blancas y nombres en gris. Sólo se usan las capas `transportation` y `transportation_name`; se excluyen comercios, lugares, relieve, edificios, parques y etiquetas de ciudades. Los mapas del booking, del editor y del perfil usan el mismo estilo. OpenFreeMap suministra los datos OpenMapTiles basados en OpenStreetMap, con atribución visible. La fuente vectorial puede sustituirse con `VITE_MAP_VECTOR_SOURCE` al compilar la web. Se eliminó la configuración anterior de teselas raster. No se agrega geocodificador, proxy, descarga masiva ni cuota de una cuenta de pago.

El servicio público es de mejor esfuerzo, sin SLA. Si falla el mapa o el navegador carece de WebGL2, la lista y la entrada manual de coordenadas siguen funcionando. El renderer fallido se retira sin dejar eventos de Leaflet que rompan los pasos del booking.

Documentación: [OpenFreeMap e integración con Vite/Leaflet](https://openfreemap.org/quick_start/), [uso comercial y atribución](https://openfreemap.org/), [Leaflet](https://leafletjs.com/reference.html). Las pruebas de interacción interceptan los datos vectoriales; una pasada visual usa la carga normal del mapa y la portada pública del negocio.

## Diseño público del perfil — 15/10/2026

Se sigue el concepto aportado por Federico: ancho máximo de 854 px, logo pequeño de Turnits centrado, portada de 306 px con nombre manuscrito, ficha blanca con tres columnas (identidad/Ver Agenda, puntuación/comentario y ubicación) y tarjeta de reseñas aparte. En móvil las dos primeras columnas permanecen juntas y la ubicación pasa a una fila completa. La primera foto existente sigue siendo la portada. Descripción, contacto y fotos restantes se conservan debajo. La tipografía Kaushan Script se sirve localmente con su licencia OFL.

El minimapa toma únicamente ubicaciones públicas y activas ya configuradas en Sucursales, prioriza la principal y permite elegir si hay varias con coordenadas. No inventa ubicaciones ni geocodifica las direcciones automáticamente. La vista previa del panel usa el mismo componente. No hay cambios de API ni SQL adicionales para este diseño.

Por decisión de Federico, reseñas y puntuaciones son sólo una preparación visual: estrellas sin puntuar, cero opiniones y comentario deshabilitado con «Próximamente». No se agregan opiniones ficticias ni endpoints de publicación. La funcionalidad queda para las cuentas de consumidores, con una reseña por cuenta.

Verificación adicional: `work/verify-streets-regression.cjs` conserva las pruebas de sedes/cercanía/edición con el nuevo renderer; `work/verify-profile-concept.cjs` comprueba dimensiones del boceto, portada, enlace, estados vacíos/error/privado y 390 px; `work/verify-map-no-webgl.cjs` comprueba continuación por lista sin WebGL. Sin escrituras ni cobros reales.

## Redes sociales y mapa ampliable — 15/10/2026

Perfil permite cargar Instagram, Facebook, TikTok, YouTube, X, LinkedIn y WhatsApp. Se muestran como tarjetas con íconos en «Sobre el negocio», junto al teléfono y la web. Son enlaces públicos, sin OAuth ni acceso a las cuentas. Instagram, TikTok, YouTube y X admiten `@usuario`; los enlaces se normalizan y validan en cliente y servidor por protocolo HTTPS y dominio de cada red. Quitar el enlace elimina su tarjeta. Instagram conserva su campo anterior y los clientes anteriores conservan los enlaces nuevos al guardar.

Ejecutar `supabase/migrations/20261015_perfil_redes_sociales.sql` agrega `redes_sociales` JSONB sin modificar las políticas de acceso. Federico confirmó la ejecución completa el 15/10/2026. La API detecta su disponibilidad y conserva lectura y edición anterior si falta la columna; los nuevos campos permanecen deshabilitados hasta instalarla.

Tocar el minimapa abre un diálogo con mapa interactivo grande, zoom y pin de la sede elegida. La X, Escape o el fondo lo cierran; el foco vuelve al disparador y se restaura el scroll. En este diálogo el zoom no deja una transición pendiente que pueda ejecutarse después de desmontar el mapa. Se retiran las marcas opcionales Leaflet y OpenFreeMap, manteniendo visibles los créditos requeridos de OpenMapTiles y OpenStreetMap.

Verificación: `work/verify-perfil-redes.cjs` prueba migración idempotente, RLS, aislamiento, guardar/publicar/quitar enlaces, compatibilidad y validación; `work/verify-profile-social-map-ui.cjs` prueba los campos, tarjetas y diálogo con zoom/cierre/foco en escritorio y 390 px, con API y datos vectoriales simulados.
