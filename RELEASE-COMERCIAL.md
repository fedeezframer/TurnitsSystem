# Turnits · Base comercial 2026.11.03

Esta es la base acordada para empezar a ofrecer Turnits a barberías. El objetivo es que el negocio muestre su trabajo y atienda consultas por Instagram o WhatsApp, y use Turnits para cerrar la reserva con sus servicios, horarios y forma de cobro.

## Identificación reproducible

- Web: rama `codex/vite-migration`, etiqueta `turnits-comercial-2026.11.03-web`.
- API: rama `main`, etiqueta `turnits-comercial-2026.11.03-api`.
- Producción: https://turnits.com, API https://negosocio.onrender.com.

Las etiquetas identifican los commits exactos aprobados para esta base; las ramas pueden seguir evolucionando. No se cambian los números internos de los paquetes, que tienen su propio historial.

## Qué incluye esta base

- Registro de negocio y cliente con verificación por email, contraseña de al menos 8 caracteres, control para verla y teléfonos limitados según país y formato de área.
- Tutorial inicial para crear un servicio, guardar horarios y configurar cobros. Su diseño y el recordatorio de Inicio usan imágenes distintas para servicios, horarios y Mercado Pago. Si se abandona la configuración, Inicio propone la siguiente tarea pendiente con una sola acción.
- Agenda y enlace público de reserva; las redes siguen siendo el canal para mostrar el trabajo y responder consultas.
- Panel para administrar los servicios, disponibilidad y cobros que corresponden al plan del negocio. La conexión a Mercado Pago conserva el método ya elegido, vuelve a Pagos o al paso correspondiente del tutorial y confirma el estado con el servidor.
- Conservación de borradores del panel durante la salida a la autorización en el mismo navegador. La autorización inicial pertenece a Mercado Pago; no se promete reutilizar la sesión de su app móvil.
- Renovación de credenciales de Mercado Pago cuando se acerca su vencimiento, si existe autorización de renovación vigente. Si Mercado Pago revoca esa autorización, puede hacer falta reconectar.
- Eliminación de cuenta atómica: no borra datos por etapas si una relación impide completar la operación. Las restricciones de cobros vinculados siguen protegidas.

## Verificación de la entrega

- Compilación, TypeScript, recursos, presupuesto de carga inicial y política CSP.
- Pruebas de autenticación, registro, teléfonos, configuración inicial, sesión y cambios pendientes del panel.
- Pruebas del retorno OAuth: firma y origen del retorno, autorización exitosa, cancelación, errores de red/guardado, conservación del método de cobro y renovación. Las pruebas automatizadas usan cuentas, proveedor y base simulados; no autorizan cuentas de Mercado Pago reales ni cobran dinero.
- Recorrido de navegador en tamaños móvil y escritorio, con API interceptada, incluyendo el retorno a Pagos/tutorial y la conservación del borrador.
- Verificación del despliegue activo de web y API. Para un primer negocio real, completar una vinculación con su propia cuenta y una reserva de prueba acompañada: las pruebas simuladas no acreditan una autorización real ni la liquidación de un cobro.

## Cómo ofrecerlo

“Mostrá tu trabajo y respondé consultas como siempre. Con Turnits, tus clientes eligen el servicio, ven tus horarios y confirman su reserva desde un enlace.”

En la primera incorporación, acompañar al dueño hasta que tenga un servicio con precio y duración, disponibilidad real, el medio de cobro que corresponda a su plan y el enlace de agenda listo para compartir. El criterio de activación es que pueda recibir una reserva, no solamente que se haya registrado.

La app nativa y la autorización directa usando la sesión de la app de Mercado Pago no forman parte de esta entrega. Las demás funciones existentes siguen disponibles según su configuración y plan; no se agregan promesas comerciales sobre ellas en esta base.

## Cambios posteriores

Usar esta entrega como punto de partida para las primeras barberías. Priorizar errores reales y dificultades observadas al incorporarlas; no ampliar el tutorial ni agregar funciones antes de comprobar esas necesidades. Un despliegue anterior de Render no revierte migraciones ni datos: cualquier recuperación debe considerar también la compatibilidad de la base.
