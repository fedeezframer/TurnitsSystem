# Migraciones de Supabase

Las migraciones se ejecutan completas en el SQL Editor del proyecto de Supabase. Subir código a GitHub o desplegar Render no ejecuta estos archivos en la base de datos.

## Reparar el paso al Plan Gratis

Ejecutar `migrations/20261012_reparar_downgrade_gratis.sql` para instalar o actualizar `aplicar_limites_plan` y `reducir_plan_gratis`, dar permiso de ejecución al servidor y recargar la caché de PostgREST.

El SQL no llama a las funciones de reducción. La reducción se aplica desde el panel, después del aviso y la confirmación de pasar a Gratis: conserva al titular, elimina a los colaboradores, desactiva promociones y ajusta los pagos y la personalización según ese plan. La operación completa se confirma en una misma transacción.

La consulta final debe mostrar `reducir_plan_gratis(uuid,text)`, los argumentos `p_usuario_id uuid, p_slug text`, y `servidor_puede_ejecutar = true`. Después, volver a intentar el cambio desde el panel.
