# Registro y configuración inicial — 01/11/2026

Base: frontend publicado `fc3bd50`. Cambios preparados en la rama local `codex/inicio-sencillo`, en un worktree separado para conservar los cambios pendientes del checkout original.

## Comportamiento

- El registro conserva la composición de Turnits, sin rótulos ni insignias de progreso adicionales.
- Continuar y los términos permanecen visibles. Los campos requeridos mantienen validación nativa y el formulario explica errores de teléfono, enlace y contraseña.
- El usuario del enlace se presenta como «Tu enlace», con vista del enlace y ayuda de contraseña.
- Elegir rubro ya no dispara una petición ni envía email. Un botón explícito confirma el envío del código.
- El tutorial habitual se resuelve primero. Al omitirse o cerrarse, Inicio muestra la próxima acción pendiente en un contenedor ilustrado al principio del contenido. Usa las variables visuales, tipografía liviana y colores de Turnits; el aviso muestra únicamente imagen, texto y una acción, sin flechas ni insignias de progreso.
- La ilustración de calendario metálico y ondas verdes toma la referencia aportada por Federico. Una superficie blanca mantiene el texto legible; en celular la imagen va arriba y el contenido debajo. Procedencia y prompt en `SETUP-ART.md`.
- La guía consulta información guardada y no depende de haber omitido el tutorial. Cada paso abre la sección existente, sin crear otro editor de configuración.
- No hay desplegable de configuración. Al completar los requisitos y tener la cuenta vigente, el bloque desaparece: se conserva la acción de copiar enlace que ya existe en el dashboard, sin duplicarla. No se certifican cupos, integración de pagos ni publicación del perfil.
- Si falla la consulta, retira el estado anterior y ofrece reintentar. No modifica configuración ni servicios para recuperar información.
- Guía solo para el Inicio del titular y modo de agenda normal; no se muestra al encargado de sucursal. El panel reducido de empleado conserva su recorrido.
- La ayuda inicial respeta la diferencia entre Básico y Premium para efectivo, valida orden de jornada/descanso y deja de afirmar que todo está listo al cerrar el asistente.
- Guía y asistente se descargan por separado para conservar el presupuesto del arranque.

## Verificación

- Build TypeScript/Vite y controles de migración, mapa, arranque y CSP.
- `node tests/setup-progress.cjs`: requisitos incompletos, servicios inactivos, horarios inválidos, permisos de pago según plan, datos de transferencia, cuenta pausada/vencida.
- `node tests/setup-onboarding-ui.cjs`: navegador local con API interceptada, 320/390/1280 px, imagen cargada, validación, categoría sin envío implícito, código por confirmación, tutorial original antes del recordatorio, recuperación tras omitir ayuda, navegación, copiar enlace existente y fallo/reintento. Requiere Playwright mediante `PLAYWRIGHT_MODULE_PATH` o módulo instalado y Vite local en `SETUP_TEST_URL` (por defecto puerto 4182).
- Regresiones locales ejecutadas: `consumer-accounts.cjs`, `session-startup.cjs`, `panel-requests.cjs`, `global-save-discard.cjs`.

No se envían emails ni se crean cuentas/reservas reales en esas verificaciones. Las capturas usan datos sintéticos. No se ejecutaron cambios de esquema ni se publicó en Render.

## Límites deliberados

No se quitaron campos obligatorios del contrato de registro, no se cambió autenticación ni la política comercial de planes, y no se incorporaron módulos nuevos. La guía describe configuración básica, no garantiza la disponibilidad operativa actual de Supabase/Mercado Pago.

El frontend usa su contrato existente de `settings` y catálogo. No requiere una migración ni una API nueva. Publicación pendiente de estas modificaciones locales.

