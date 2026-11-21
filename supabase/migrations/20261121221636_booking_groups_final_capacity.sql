-- Revalidate current service duration, capacity and staff at payment time.
create or replace function public.confirmar_reserva_grupo(
  p_pending_id uuid, p_payment_id text, p_paid boolean
) returns uuid[] language plpgsql security invoker set search_path = public as $$
declare
  parent public.pagos_pendientes%rowtype;
  item jsonb;
  existing_ids uuid[];
  inserted_ids uuid[] := '{}';
  new_id uuid;
  position integer := 0;
  start_min integer;
  end_min integer;
  capacity integer;
  occupied integer;
  service_duration integer;
  price numeric;
  total_price numeric := 0;
  paid_so_far numeric := 0;
  paid_item numeric;
  service_row public.servicios%rowtype;
begin
  select * into parent from public.pagos_pendientes where id = p_pending_id for update;
  if not found or parent.reserva_items is null or jsonb_typeof(parent.reserva_items) <> 'array'
     or jsonb_array_length(parent.reserva_items) < 1 or jsonb_array_length(parent.reserva_items) > 8 then
    raise exception 'Grupo de reservas inválido';
  end if;
  select array_agg(id order by grupo_reserva_orden) into existing_ids
    from public.turnos where grupo_reserva_id = p_pending_id;
  if existing_ids is not null then return existing_ids; end if;
  perform pg_advisory_xact_lock(hashtextextended(parent.slug, 0));
  for item in select value from jsonb_array_elements(parent.reserva_items) loop
    if item->>'fecha' !~ '^\d{4}-\d{2}-\d{2}$'
       or item->>'hora' !~ '^\d{2}:\d{2}$' then
      raise exception 'Fecha u hora inválida en el grupo';
    end if;
    if (item->>'fecha')::date < (now() at time zone 'America/Argentina/Buenos_Aires')::date then
      raise exception 'Una fecha del carrito ya pasó';
    end if;
    select * into service_row from public.servicios
      where id = (item->>'servicio_id')::uuid and slug = parent.slug and activo = true;
    if not found then raise exception 'Un servicio ya no está disponible'; end if;
    if nullif(item->>'equipo_id', '') is not null and not exists (
      select 1 from public.equipo e join public.servicio_equipo se on se.equipo_id=e.id
      where e.id=(item->>'equipo_id')::uuid and e.slug=parent.slug and e.activo=true
        and se.servicio_id=service_row.id
    ) then raise exception 'Un profesional ya no ofrece el servicio'; end if;
    service_duration := greatest(coalesce(nullif((item->>'duracion')::integer, 0), 0), service_row.duracion, 30);
    capacity := least(coalesce(nullif((item->>'capacidad')::integer, 0), service_row.capacidad, 1),
      coalesce(service_row.capacidad, 1));
    start_min := split_part(item->>'hora', ':', 1)::integer * 60 + split_part(item->>'hora', ':', 2)::integer;
    end_min := start_min + service_duration;
    if start_min < 0 or end_min > 1440 or service_duration < 1 or capacity < 1 then
      raise exception 'Horario inválido en el grupo';
    end if;
    select count(*) into occupied from public.turnos t
      left join public.servicios s on s.id = t.servicio_id
      where t.slug = parent.slug and t.fecha = (item->>'fecha')::date
        and t.estado in ('confirmado', 'pendiente')
        and (t.equipo_id is not distinct from nullif(item->>'equipo_id', '')::uuid
          or (coalesce((item->>'es_dueno')::boolean,false) and t.equipo_id is null))
        and start_min < (split_part(t.hora, ':', 1)::integer * 60 + split_part(t.hora, ':', 2)::integer
          + coalesce(t.duracion_reservada, s.duracion, 30))
        and end_min > (split_part(t.hora, ':', 1)::integer * 60 + split_part(t.hora, ':', 2)::integer);
    if occupied >= capacity then raise exception 'Un horario del carrito ya no está disponible'; end if;
    price := (item->>'precio')::numeric;
    if price < 0 then raise exception 'Precio inválido'; end if;
    total_price := total_price + price;
    paid_item := case when not p_paid then 0
      when position = jsonb_array_length(parent.reserva_items) - 1 then parent.monto - paid_so_far
      else round(parent.monto * price / nullif(
        (select sum((value->>'precio')::numeric) from jsonb_array_elements(parent.reserva_items)), 0), 2) end;
    paid_so_far := paid_so_far + paid_item;
    insert into public.turnos (
      slug, nombre, apellido, telefono, email, fecha, hora, servicio_id,
      servicio_nombre, equipo_id, equipo_nombre, duracion_reservada,
      precio_cobrado, monto_pagado, estado, metodo_pago, pago_estado,
      tipo_cobro, porcentaje_sena, fecha_pago, promocion, extras, monto_extras,
      payment_id, consumidor_id, tc_elegible, grupo_reserva_id, grupo_reserva_orden
    ) values (
      parent.slug, parent.nombre, parent.apellido, parent.telefono, parent.email,
      (item->>'fecha')::date, item->>'hora', (item->>'servicio_id')::uuid,
      item->>'servicio_nombre', nullif(item->>'equipo_id', '')::uuid,
      item->>'equipo_nombre', service_duration, price, paid_item,
      'confirmado', case when p_paid then 'mercadopago' else 'none' end,
      case when p_paid then 'aprobado' else 'sin_pago' end,
      case when p_paid then parent.metodo_pago else null end,
      case when p_paid and parent.metodo_pago = 'sena' then
        (select coalesce(porcentaje_sena,30) from public.usuarios where slug = parent.slug)
      else null end,
      case when p_paid then now() else null end,
      item->'promocion', coalesce(item->'extras','[]'::jsonb), coalesce((item->>'monto_extras')::numeric,0),
      case when position = 0 then p_payment_id else null end,
      parent.consumidor_id, true, parent.id, position
    ) returning id into new_id;
    inserted_ids := array_append(inserted_ids, new_id);
    position := position + 1;
  end loop;
  return inserted_ids;
end;
$$;

revoke all on function public.confirmar_reserva_grupo(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.confirmar_reserva_grupo(uuid, text, boolean) to service_role;
