create table public.membresia_periodos (
  id uuid primary key default gen_random_uuid(),
  membresia_id uuid references public.membresias(id) on delete set null,
  slug text not null references public.usuarios(slug) on update cascade on delete cascade,
  consumidor_id uuid not null references public.consumidores(id) on delete cascade,
  importe numeric(12,2) not null check (importe > 0),
  nombre text not null,
  servicios jsonb not null check (jsonb_typeof(servicios) = 'object'),
  productos jsonb not null check (jsonb_typeof(productos) = 'object'),
  profesional_ids uuid[] not null,
  vendedor_id text not null,
  estado text not null default 'pendiente' check (estado in ('pendiente','activo','vencido','revertido')),
  payment_id text unique,
  payment_url text,
  created_at timestamptz not null default now(),
  checkout_vence_at timestamptz not null default (now() + interval '30 minutes'),
  pagado_at timestamptz,
  empieza_at timestamptz,
  vence_at timestamptz,
  check (estado <> 'activo' or (payment_id is not null and pagado_at is not null and empieza_at is not null and vence_at is not null and vence_at > empieza_at))
);
create index membresia_periodos_cliente_idx on public.membresia_periodos(slug, consumidor_id, vence_at);
create unique index membresia_periodos_pendiente_idx
  on public.membresia_periodos(membresia_id, consumidor_id) where estado = 'pendiente';

create table public.membresia_canje (
  pago_pendiente_id uuid primary key,
  periodo_id uuid not null references public.membresia_periodos(id) on delete cascade,
  servicio_id uuid not null,
  usa_servicio boolean not null,
  productos jsonb not null default '{}' check (jsonb_typeof(productos) = 'object'),
  vence_at timestamptz not null,
  turno_id uuid unique,
  devuelto_at timestamptz,
  check (usa_servicio or productos <> '{}'::jsonb)
);
create index membresia_canje_periodo_idx on public.membresia_canje(periodo_id, vence_at) where devuelto_at is null;

alter table public.membresia_periodos enable row level security;
alter table public.membresia_canje enable row level security;
revoke all on public.membresia_periodos, public.membresia_canje from public, anon, authenticated;
grant select, insert, update on public.membresia_periodos, public.membresia_canje to service_role;

create function public.reservar_tickets_membresia(
  p_periodo_id uuid, p_pending_id uuid, p_usa_servicio boolean, p_productos jsonb
) returns void language plpgsql security invoker set search_path = '' as $$
declare
  periodo public.membresia_periodos%rowtype;
  pendiente public.pagos_pendientes%rowtype;
  producto record;
  gastado integer;
begin
  select * into periodo from public.membresia_periodos where id = p_periodo_id for update;
  select * into pendiente from public.pagos_pendientes where id = p_pending_id;
  if periodo.id is null or pendiente.id is null or pendiente.slug <> periodo.slug or
      pendiente.consumidor_id is distinct from periodo.consumidor_id or periodo.estado <> 'activo' or
      periodo.vence_at <= now() or periodo.empieza_at is null or periodo.empieza_at > now() or
      (pendiente.fecha + pendiente.hora::time) at time zone 'America/Argentina/Buenos_Aires' >= periodo.vence_at or
      (cardinality(periodo.profesional_ids) > 0 and not coalesce(pendiente.equipo_id = any(periodo.profesional_ids), false)) then
    raise exception 'El plan no está activo para esta reserva.' using errcode = 'P0001';
  end if;
  if p_usa_servicio then
    select count(*) into gastado from public.membresia_canje
      where periodo_id = periodo.id and servicio_id = pendiente.servicio_id and usa_servicio and
        devuelto_at is null and (turno_id is not null or vence_at > now());
    if gastado >= coalesce((periodo.servicios->>pendiente.servicio_id::text)::integer, 0) then
      raise exception 'Ya no quedan tickets para ese servicio.' using errcode = 'P0001';
    end if;
  end if;
  for producto in select key, value from jsonb_each_text(p_productos) loop
    if producto.value !~ '^[1-9][0-9]?$' then
      raise exception 'Cantidad de tickets de producto inválida.' using errcode = 'P0001';
    end if;
    select coalesce(sum((productos->>producto.key)::integer), 0) into gastado from public.membresia_canje
      where periodo_id = periodo.id and devuelto_at is null and (turno_id is not null or vence_at > now());
    if gastado + producto.value::integer > coalesce((periodo.productos->>producto.key)::integer, 0) then
      raise exception 'Ya no quedan suficientes tickets para ese producto.' using errcode = 'P0001';
    end if;
  end loop;
  insert into public.membresia_canje(pago_pendiente_id, periodo_id, servicio_id, usa_servicio, productos, vence_at)
    values (pendiente.id, periodo.id, pendiente.servicio_id, p_usa_servicio, p_productos, least(now() + interval '30 minutes', periodo.vence_at));
end;
$$;

create function public.asociar_tickets_membresia() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if TG_OP = 'INSERT' then
    if new.grupo_reserva_id is not null and exists (
      select 1 from public.membresia_canje where pago_pendiente_id = new.grupo_reserva_id
    ) then
      perform 1 from public.membresia_periodos p
        join public.membresia_canje c on p.id = c.periodo_id
        where c.pago_pendiente_id = new.grupo_reserva_id and p.estado = 'activo'
          and p.empieza_at <= now() and p.vence_at > now() for update of p;
      if not found then raise exception 'El plan ya no está activo.' using errcode = 'P0001'; end if;
      update public.membresia_canje set turno_id = new.id
        where pago_pendiente_id = new.grupo_reserva_id and servicio_id = new.servicio_id
          and turno_id is null and devuelto_at is null and vence_at > now();
      if not found then raise exception 'El canje ya no está disponible.' using errcode = 'P0001'; end if;
    end if;
    return new;
  end if;
  if new.estado = 'cancelado' and old.estado is distinct from new.estado then
    update public.membresia_canje set devuelto_at = now() where turno_id = new.id and devuelto_at is null;
  elsif old.estado = 'cancelado' and new.estado is distinct from old.estado and exists (
    select 1 from public.membresia_canje where turno_id = new.id and devuelto_at is not null
  ) then
    raise exception 'El ticket ya fue devuelto. Creá una nueva reserva.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger turnos_asociar_tickets_membresia
  after insert or update of estado on public.turnos for each row execute function public.asociar_tickets_membresia();

revoke execute on function public.reservar_tickets_membresia(uuid, uuid, boolean, jsonb) from public, anon, authenticated;
revoke execute on function public.asociar_tickets_membresia() from public, anon, authenticated;
grant execute on function public.reservar_tickets_membresia(uuid, uuid, boolean, jsonb) to service_role;
grant execute on function public.asociar_tickets_membresia() to service_role;

create function public.confirmar_periodo_membresia(
  p_order_id uuid, p_payment_id text, p_paid_at timestamptz
) returns text language plpgsql security invoker set search_path = '' as $$
declare
  orden public.membresia_periodos%rowtype;
  inicio timestamptz;
begin
  select * into orden from public.membresia_periodos where id = p_order_id;
  if orden.id is null then raise exception 'Compra no encontrada.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(orden.slug || ':' || orden.consumidor_id::text, 2511));
  select * into orden from public.membresia_periodos where id = p_order_id for update;
  if orden.payment_id = p_payment_id then return orden.estado; end if;
  if orden.payment_id is not null then raise exception 'La compra ya tiene un pago distinto.'; end if;
  select greatest(p_paid_at, max(vence_at)) into inicio from public.membresia_periodos
    where slug = orden.slug and consumidor_id = orden.consumidor_id and estado = 'activo' and
      membresia_id is not distinct from orden.membresia_id;
  update public.membresia_periodos set estado = 'activo', payment_id = p_payment_id, pagado_at = p_paid_at,
    empieza_at = inicio, vence_at = ((inicio at time zone 'America/Argentina/Buenos_Aires') + interval '1 month') at time zone 'America/Argentina/Buenos_Aires'
    where id = orden.id;
  return 'activo';
end;
$$;

revoke execute on function public.confirmar_periodo_membresia(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.confirmar_periodo_membresia(uuid, text, timestamptz) to service_role;
