alter table public.membresia_periodos
  add column metodo_pago text not null default 'mercadopago' check (metodo_pago in ('mercadopago','transferencia','efectivo')),
  add column comprobante_path text;

create index membresia_pagos_manuales_idx on public.membresia_periodos(slug, created_at desc)
  where estado = 'pendiente' and metodo_pago <> 'mercadopago';

create function public.revisar_pago_membresia(p_id uuid, p_slug text, p_aprobar boolean)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  orden public.membresia_periodos%rowtype;
begin
  select * into orden from public.membresia_periodos
    where id = p_id and slug = p_slug and estado = 'pendiente' and metodo_pago in ('transferencia','efectivo')
    for update;
  if not found then return false; end if;
  if orden.metodo_pago = 'transferencia' and orden.comprobante_path is null then return false; end if;
  if p_aprobar then
    perform public.confirmar_periodo_membresia(orden.id, 'manual:' || orden.id::text, now());
  else
    update public.membresia_periodos set estado = 'revertido' where id = orden.id;
  end if;
  return true;
end;
$$;
revoke execute on function public.revisar_pago_membresia(uuid,text,boolean) from public, anon, authenticated;
grant execute on function public.revisar_pago_membresia(uuid,text,boolean) to service_role;
