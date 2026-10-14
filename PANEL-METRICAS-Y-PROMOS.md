# Panel, métricas y promociones por días — 14/10/2026

## Cambios

- La pestaña del panel se titula `Turnits | Panel`. Se eliminan las frases visibles de disponibilidad por plan y sus tooltips repetidos; se mantienen opacidad, íconos y etiquetas accesibles. Los permisos del servidor permanecen activos.
- Finanzas conserva sus cuatro tarjetas principales. El gráfico distribuye el valor completo de los turnos entre gastos/comisiones y balance estimado; las proporciones no se calculan sobre el cobro parcial ni sólo sobre los gastos. Un turno de $2.500 con seña de $500 y comisión Turnits de $300 muestra 12% de Turnits, independientemente de la seña. Los meses sin ingresos no muestran porcentajes ficticios; si los gastos superan ingresos se explicita el déficit.
- Se reemplazan las proyecciones de equilibrio, seguridad, contribución y turnos mínimos por ticket, costo y resultado promedio por turno, costos fijos, costos variables y comisiones sobre ingresos. El resultado es una estimación sobre reservas del mes, no un registro de caja ni una afirmación de haber cobrado el saldo en el local.
- Inicio muestra los días con más turnos confirmados/completados del mes en orden y con posición y porcentaje. Cuenta primeras visitas, recurrentes y reservas sin datos de contacto, excluyendo pendientes y cancelados. El cálculo consulta el mes paginado para no depender del límite inicial de filas.
- Combos y descuentos pueden limitarse opcionalmente a días de semana dentro de la vigencia inclusive. Todos los días sigue siendo el valor predeterminado. Panel, booking y API comparten el cálculo de fechas y días. Un descuento de servicio permite reservar otros días al precio normal; el combo sólo ofrece fechas válidas. Se filtran los días antes del límite de fechas visibles para alcanzar semanas posteriores.

## Base de datos y publicación

Federico pidió ejecutar personalmente `supabase/migrations/20261014_promociones_dias_semana.sql` en Supabase. Agrega una columna nullable con restricción; no modifica ni elimina promociones existentes. NULL significa todos los días.

Publicar el servidor con `web/src/shared/promotions.js`, seguido de la web. Es un módulo puro sin dependencias de React, dentro de la raíz `web` para que esté disponible en su build de Render. El selector de días sólo se habilita cuando la API anuncia soporte. Si la migración falta, las promos diarias siguen funcionando y el servidor rechaza explícitamente restricciones que aún no puede guardar. Los clientes antiguos conservan los días guardados al editar sin enviar el nuevo campo.

## Validación

Build TypeScript/Vite y sintaxis del servidor; pruebas aisladas de cálculos mensuales, proporción sobre el precio completo, métricas, primeras visitas, fechas y días, precio autorizado, rechazo de reservas en días incorrectos, preservación de días en editores antiguos y compatibilidad mientras se instala el SQL. Pruebas de navegador con API simulada en escritorio/celular para ranking, Finanzas, creación/edición, días vacíos y OFF en el calendario. No se realizaron cobros, reservas ni escrituras reales en Supabase.

La publicación debe verificarse en Render. La incidencia de builds del proveedor y la ejecución manual del SQL se informan por separado; no se consideran completadas por un build local aprobado.
