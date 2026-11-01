# Migraciones de Supabase

## Eliminar cuentas con presupuestos

`migrations/20261101194126_account_delete_quote_constraints.sql` permite que las cascadas de una cuenta terminen antes de validar las referencias cruzadas entre consultas, profesionales, servicios y turnos. Mantiene la protección al eliminar un profesional o servicio individual. No borra filas ni cambia las restricciones de cobros.

El servidor debe eliminar solamente la fila de `usuarios` y dejar que las relaciones existentes hagan el resto dentro de una misma transacción. Las eliminaciones manuales sucesivas del helper anterior podían dejar datos borrados antes de fallar. Las cuentas con checkouts o pagos de presupuestos vinculados siguen protegidas; resolver esa conciliación requiere un flujo específico, no eliminar sus registros financieros en cascada.

Verificación aislada: `PGLITE_MODULE_PATH=<ruta a @electric-sql/pglite> node tests/account-delete-db.cjs`. Incluye presupuestos pendientes, reservas con referencias circulares, conservación de otras cuentas y consumidores, cola de limpieza de archivos y rollback cuando un cobro impide el borrado.

Las migraciones se ejecutan completas en el SQL Editor del proyecto de Supabase. Subir código a GitHub o desplegar Render no ejecuta estos archivos en la base de datos.

## Reparar el paso al Plan Gratis

Ejecutar `migrations/20261012_reparar_downgrade_gratis.sql` para instalar o actualizar `aplicar_limites_plan` y `reducir_plan_gratis`, dar permiso de ejecución al servidor y recargar la caché de PostgREST.

El SQL no llama a las funciones de reducción. La reducción se aplica desde el panel, después del aviso y la confirmación de pasar a Gratis: conserva al titular, elimina a los colaboradores, desactiva promociones y ajusta los pagos y la personalización según ese plan. La operación completa se confirma en una misma transacción.

La consulta final debe mostrar `reducir_plan_gratis(uuid,text)`, los argumentos `p_usuario_id uuid, p_slug text`, y `servidor_puede_ejecutar = true`. Después, volver a intentar el cambio desde el panel.
