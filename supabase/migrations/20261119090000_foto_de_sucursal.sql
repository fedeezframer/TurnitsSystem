alter table public.sucursales add column if not exists foto_archivo text
  check (foto_archivo is null or foto_archivo ~ '^[0-9a-f-]{36}\.(jpg|png|webp)$');

create or replace function public.guardar_sucursal_con_foto(
  p_slug text, p_id uuid, p_principal boolean, p_nombre text, p_direccion text,
  p_activo boolean, p_admin uuid, p_miembros uuid[], p_latitud double precision,
  p_longitud double precision, p_foto_archivo text
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare sede uuid;
begin
  sede := public.guardar_sucursal_mapa(p_slug, p_id, p_principal, p_nombre,
    p_direccion, p_activo, p_admin, p_miembros, p_latitud, p_longitud);
  update public.sucursales set foto_archivo = p_foto_archivo where slug = p_slug and id = sede;
  return sede;
end;
$$;
revoke all on function public.guardar_sucursal_con_foto(text,uuid,boolean,text,text,boolean,uuid,uuid[],double precision,double precision,text) from public, anon, authenticated;
grant execute on function public.guardar_sucursal_con_foto(text,uuid,boolean,text,text,boolean,uuid,uuid[],double precision,double precision,text) to service_role;
