-- Pending payment cleanup must not block removal of an old receipt record.
alter table public.turnos drop constraint if exists turnos_grupo_reserva_id_fkey;
alter table public.turnos add constraint turnos_grupo_reserva_id_fkey
  foreign key (grupo_reserva_id) references public.pagos_pendientes(id) on delete set null;
