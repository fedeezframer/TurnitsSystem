# Perfil y sucursales

Una cuenta, una suscripción y un enlace `/agenda/{slug}`. Las sucursales son sedes del mismo negocio, no cuentas adicionales.

## Uso

- **Perfil** en el menú: nombre público, rubro, descripción, ubicación, teléfono público, redes, web, foto de perfil, banner y galería sin límite de cantidad. Se guarda inicialmente oculto. El titular decide cuándo publicarlo en `/perfil/{slug}`. Esta ficha es la base del futuro Browse; no se implementó todavía el buscador de negocios.
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

Se sigue el concepto aportado por Federico: ancho máximo de 854 px, logo pequeño de Turnits centrado, banner de 306 px, ficha blanca con tres columnas (identidad/Ver Agenda, puntuación/comentario y ubicación) y tarjeta de reseñas aparte. En móvil las dos primeras columnas permanecen juntas y la ubicación pasa a una fila completa. Descripción, contacto y galería se conservan debajo. Por la revisión posterior del 15/10, el banner muestra sólo la imagen y ya no carga la tipografía manuscrita ni superpone nombre o rubro.

El minimapa toma únicamente ubicaciones públicas y activas ya configuradas en Sucursales, prioriza la principal y permite elegir si hay varias con coordenadas. No inventa ubicaciones ni geocodifica las direcciones automáticamente. No hay cambios de API ni SQL adicionales para este diseño.

Por decisión de Federico, reseñas y puntuaciones son sólo una preparación visual: estrellas sin puntuar, cero opiniones y comentario deshabilitado con «Próximamente». No se agregan opiniones ficticias ni endpoints de publicación. La funcionalidad queda para las cuentas de consumidores, con una reseña por cuenta.

Verificación adicional: `work/verify-streets-regression.cjs` conserva las pruebas de sedes/cercanía/edición con el nuevo renderer; `work/verify-profile-concept.cjs` comprueba dimensiones del boceto, portada, enlace, estados vacíos/error/privado y 390 px; `work/verify-map-no-webgl.cjs` comprueba continuación por lista sin WebGL. Sin escrituras ni cobros reales.

## Redes sociales y mapa ampliable — 15/10/2026

Perfil permite cargar Instagram, Facebook, TikTok, YouTube, X, LinkedIn y WhatsApp. Se muestran como tarjetas con íconos en «Sobre el negocio», junto al teléfono y la web. Son enlaces públicos, sin OAuth ni acceso a las cuentas. Instagram, TikTok, YouTube y X admiten `@usuario`; los enlaces se normalizan y validan en cliente y servidor por protocolo HTTPS y dominio de cada red. Quitar el enlace elimina su tarjeta. Instagram conserva su campo anterior y los clientes anteriores conservan los enlaces nuevos al guardar.

El editor muestra el dominio fijo y pide sólo el usuario; WhatsApp pide el número con código de país. Guarda URLs completas para conservar el contrato de la API. Los enlaces anteriores se separan sin perder canales de YouTube, perfiles personales o páginas de LinkedIn y perfiles por ID de Facebook. Si se pega un enlace completo válido, el editor extrae el usuario y conserva el tipo de perfil. Verificación de campos y compatibilidad: `work/verify-social-usernames.cjs`.

Ejecutar `supabase/migrations/20261015_perfil_redes_sociales.sql` agrega `redes_sociales` JSONB sin modificar las políticas de acceso. Federico confirmó la ejecución completa el 15/10/2026. La API detecta su disponibilidad y conserva lectura y edición anterior si falta la columna; los nuevos campos permanecen deshabilitados hasta instalarla.

Tocar el minimapa público abre un diálogo con mapa interactivo grande, zoom y pin de la sede elegida. La X, Escape o el fondo lo cierran; el foco vuelve al disparador y se restaura el scroll. En este diálogo el zoom no deja una transición pendiente que pueda ejecutarse después de desmontar el mapa. Se retiran las marcas opcionales Leaflet y OpenFreeMap, manteniendo visibles los créditos requeridos de OpenMapTiles y OpenStreetMap.

Verificación: `work/verify-perfil-redes.cjs` prueba migración idempotente, RLS, aislamiento, guardar/publicar/quitar enlaces, compatibilidad y validación; `work/verify-profile-social-map-ui.cjs` prueba los campos, tarjetas y diálogo con zoom/cierre/foco en escritorio y 390 px, con API y datos vectoriales simulados.

## Foto de perfil, banner y galería — 15/10/2026

`foto_perfil_url` y `banner_url` se editan de forma independiente de `fotos`. La galería deja de tener un máximo de ocho y permite seleccionar varios archivos; todos se muestran en el perfil con carga diferida. Se conserva el límite de 3 MB por archivo y la validación de contenido JPG/PNG/WebP. Ninguna foto de la galería se convierte automáticamente en banner o avatar. Sin banner se muestra un fondo de color; sin foto de perfil (o si falla) se muestran iniciales con color. El nombre y el rubro quedan en la ficha, fuera del banner.

Federico confirmó la ejecución completa de `supabase/migrations/20261015_perfil_imagenes.sql`. Agrega los campos, conserva la galería existente y reemplaza sólo la restricción de cantidad. No modifica RLS ni permisos. La API devuelve `imagenes_habilitadas`; sin la migración conserva el editor anterior y explica qué actualización falta. Los clientes anteriores que omiten los nuevos campos conservan el banner y la foto ya guardados. Las imágenes nuevas deben pertenecer al directorio público de ese negocio; URLs externas o de otro negocio se rechazan. Se permite conservar exactamente el logo anterior de esa misma cuenta como foto de perfil.

Validación: `work/verify-profile-images-sql.cjs` y `work/verify-profile-images-api.cjs` prueban idempotencia, galería de 100 fotos, RLS/privacidad, compatibilidad y pertenencia de las imágenes. `work/verify-profile-images-ui.cjs` probó subir/cambiar/quitar los tipos separados, más de ocho fotos, carga múltiple con error parcial recuperable, rechazo de archivos grandes y escritorio/390 px sin desbordamiento. Sin escrituras de prueba en producción.

Por pedido posterior se retiró la ficha de vista previa del editor de Perfil, conservando las miniaturas de los archivos como controles de edición y el enlace al perfil público. En Temas se retiraron la pestaña de vista previa, el iframe y la miniatura de agenda. Los scripts antiguos que usaban la ficha duplicada del panel corresponden al diseño anterior.

## Identidad en Perfil y apariencia en Temas — 15/10/2026

La foto de Perfil es el ícono del negocio en la agenda, el perfil público y los usos del ícono del panel (como el QR). Una foto explícitamente vacía usa iniciales, sin restaurar un logo anterior. Si un negocio todavía no tiene fila de Perfil, conserva su logo anterior y puede gestionarlo desde Perfil. No se sincronizan dos copias de la imagen en la base. El tip de subir imagen dirige a Perfil y el panel refresca el ícono al guardar la foto.

Temas permite elegir entre doce paletas claras, forma de tarjetas (Original, Rectas, Suaves, Redondeadas) y forma del ícono (Original, Cuadrado, Redondeado, Circular). Se retiraron los selectores de colores individuales y HEX. Las formas se guardan en `usuarios.tema`, junto a los colores: no requiere otro SQL. «Original» mantiene los radios anteriores de cada componente. Cambiar la paleta conserva las formas elegidas. Básico y Premium pueden personalizar; Gratis mantiene la edición de la foto en Perfil y los controles de apariencia bloqueados con los íconos de plan. Los colores anteriores se conservan hasta elegir una nueva paleta.

La agenda aplica los radios a servicios, profesionales, extras, combos y opciones de sede. El perfil público aplica la forma a sus tarjetas y a la foto. La forma del ícono no cambia las fotos individuales de los profesionales. La API valida colores HEX y las opciones de forma, conserva claves no incluidas por clientes anteriores y publica las formas sólo para planes habilitados. Se conservan las rutas antiguas de logo para clientes anteriores; el editor nuevo no las utiliza.

Verificación: `work/verify-business-icon-api.cjs` usa PostgreSQL local para Perfil y compatibilidad; `work/verify-appearance-server.cjs` ejecuta los handlers reales de Temas y Negocio aislados con dependencias simuladas; `work/verify-appearance-ui.cjs` comprueba guardado/recarga/error, paletas sin perder formas, foto desde Perfil, ícono y radios reales del booking/perfil, «Original», planes y 390 px. Sin escrituras de prueba en producción.

## Guardado global de Perfil y Temas — 15/10/2026

Se retiraron «Guardar perfil» y «Guardar apariencia». Ambos editores usan la barra global que ya guarda Horarios, Excepciones y Pagos. Perfil conserva los campos editables, redes, foto, banner, galería y publicación pendientes en sessionStorage por negocio y sesión, al navegar o recargar. Sólo se publica al pulsar «Guardar cambios». Los archivos se suben antes, pero no se vinculan al perfil hasta el guardado global; mientras hay una subida se bloquea el guardado para evitar publicar un lote incompleto. El borrador recibe las imágenes incluso si el editor se desmonta al cambiar de sección.

La API devuelve la versión normalizada como nueva base. Los fallos parciales mantienen pendiente sólo la sección fallida, muestran el motivo y permiten reintentar. Las ediciones que se hagan durante una solicitud se conservan como cambios pendientes, incluso al volver al valor que tenía antes de esa solicitud. El ícono del panel se refresca después del guardado de Perfil. Las confirmaciones de formularios de creación/edición de servicios, promociones, miembros y sucursales siguen siendo acciones propias de cada registro.

Verificación actual: `work/verify-global-profile-ui.cjs` cubre doce paletas sin inputs libres ni guardados locales, cambios conjuntos Perfil/Temas, navegación/recarga, validación, error parcial/reintento, subida de foto al cambiar de sección, cambios durante el guardado, permisos Gratis y escritorio/390 px. API simulada, sin modificar perfiles reales. No requiere SQL ni cambios en el servidor.

## Mapa alojado por Turnits — 15/10/2026

Se sustituyó el acceso en vivo a OpenFreeMap por una copia local de calles y nombres
de toda Argentina. Los datos vectoriales, glifos, worker y librerías se sirven
desde el mismo alojamiento de la web. Se mantiene la atribución necesaria a
OpenStreetMap y se retira OpenMapTiles porque los datos ahora usan Shortbread.
No se mantiene un fallback externo. Ver [MAPAS-ARGENTINA.md](MAPAS-ARGENTINA.md)
para tamaño, origen, licencias, pruebas y procedimiento de actualización.

## Elección directa de sucursal — 15/10/2026

Tocar una sede disponible en el mapa o su tarjeta avanza al paso siguiente sin
botón Continuar ni checks en las tarjetas. «Usar mi ubicación» sólo ordena y
recomienda; no avanza por su cuenta. Las sedes sin profesionales siguen sin poder
elegirse. Volver y tocar la misma sede permite avanzar otra vez; cambiar de sede
limpia servicio, promo, extras, fecha, hora y profesional previos. Con una sola
sede se sigue omitiendo este paso.

El nombre de la sucursal debajo del nombre del negocio usa el color de texto del
tema a opacidad completa, en lugar del secundario que puede ser demasiado claro.
Verificación: `work/verify-branch-direct-choice.cjs`, con API simulada y datos
cartográficos locales reales, cubre mapa/tarjeta, volver/cambiar de sede,
geolocalización, sedes no disponibles, una única sede, temas claro/oscuro y móvil.

## Perfil y publicaciones — 15/10/2026

El perfil público conserva la ficha con banner, avatar superpuesto, datos,
mapa ampliable y reseñas pendientes de implementación. «Ver Publicaciones»,
ubicado sobre el banner, abre `/perfil/:slug/publicaciones`. Esta vista usa
las fotos existentes de Perfil en una grilla de tres columnas, sin límite de
ocho fotos, y ofrece los accesos «Ver agenda» y «Ver perfil».

El editor llama ahora «Publicaciones» a la galería; las subidas y el guardado
global conservan su funcionamiento. Ambas vistas consultan el mismo perfil
público y respetan su disponibilidad. Se muestran estados vacíos y un marcador
para imágenes que no puedan cargarse. No requiere SQL ni cambios del servidor.

Verificación: `work/verify-profile-publications.cjs`, con API simulada y sin
escrituras reales, cubre doce imágenes, rutas y recarga, navegación, tamaños
1920/390/320 px, imágenes fallidas, textos largos y perfil no publicado.
