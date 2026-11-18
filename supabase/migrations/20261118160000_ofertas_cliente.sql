create table public.ofertas_cliente (
  id uuid primary key default gen_random_uuid(), slug text not null, token_hash text unique not null,
  code_hash text not null, telefono text not null, items jsonb not null, fuentes jsonb not null,
  contacto jsonb not null, staff_ids jsonb, precio numeric not null check(precio>0), original numeric not null check(original>precio),
  fecha text, hora text, vence date not null, canje uuid, reserva_confirmada boolean not null default false
);
alter table public.ofertas_cliente enable row level security;
revoke all on public.ofertas_cliente from public,anon,authenticated;
grant select,insert,update on public.ofertas_cliente to service_role;

create function public.registrar_canje_cliente() returns trigger language plpgsql set search_path = '' as $$
declare oferta uuid := (new.promocion->>'personal_id')::uuid;
declare intento uuid := (new.promocion->>'intento')::uuid;
begin
  if oferta is null then return new; end if;
  update public.ofertas_cliente set canje=intento, reserva_confirmada=(tg_table_name='turnos')
  where id=oferta and slug=new.slug and intento is not null and not reserva_confirmada
    and (canje is null or (tg_table_name='turnos' and canje=intento));
  if not found then raise exception 'La oferta ya fue utilizada'; end if;
  return new;
end $$;
create trigger canje_cliente_turno before insert on public.turnos for each row when (new.promocion ? 'personal_id') execute function public.registrar_canje_cliente();
create trigger canje_cliente_pago before insert on public.pagos_pendientes for each row when (new.promocion ? 'personal_id') execute function public.registrar_canje_cliente();
