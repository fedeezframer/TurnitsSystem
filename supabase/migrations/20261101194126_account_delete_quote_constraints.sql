-- Keep NO ACTION protection for deleting an individual service/member/booking.
-- Account deletion also cascades through consultas and turnos: validate their
-- cross references at commit, once every branch of that cascade has finished.
-- No rows are deleted by this migration, and payment constraints are unchanged.
ALTER TABLE public.consultas
  ALTER CONSTRAINT consultas_servicio_id_fkey DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public.consulta_presupuestos
  ALTER CONSTRAINT consulta_presupuestos_equipo_id_fkey DEFERRABLE INITIALLY DEFERRED,
  ALTER CONSTRAINT consulta_presupuestos_turno_id_fkey DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public.turnos
  ALTER CONSTRAINT turnos_presupuesto_id_fkey DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public.reprogramaciones
  ALTER CONSTRAINT reprogramaciones_turno_id_fkey DEFERRABLE INITIALLY DEFERRED;
