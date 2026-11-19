create or replace function public.ordenar_servicios_equipo(p_slug text, p_equipo uuid, p_ids uuid[])
returns boolean language plpgsql security invoker set search_path = '' as $$
declare actuales uuid[];
begin
  perform 1 from public.equipo where id = p_equipo and slug = p_slug for update;
  if not found then return false; end if;
  select array_agg(servicio_id order by servicio_id) into actuales
    from public.servicio_equipo where equipo_id = p_equipo;
  if actuales is distinct from (select array_agg(id order by id) from unnest(p_ids) as id)
    then return false; end if;
  update public.servicio_equipo as se set orden_override = lista.pos - 1
    from unnest(p_ids) with ordinality as lista(id,pos)
    where se.equipo_id = p_equipo and se.servicio_id = lista.id;
  return true;
end; $$;
revoke all on function public.ordenar_servicios_equipo(text,uuid,uuid[]) from public, anon, authenticated;
grant execute on function public.ordenar_servicios_equipo(text,uuid,uuid[]) to service_role;
