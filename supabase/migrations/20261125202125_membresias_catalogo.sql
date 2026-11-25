create table public.membresias (
  id uuid primary key default gen_random_uuid(),
  slug text not null references public.usuarios(slug) on update cascade on delete cascade,
  nombre text not null check (char_length(btrim(nombre)) between 1 and 100),
  descripcion text not null default '' check (char_length(descripcion) <= 600),
  precio_mensual numeric(12, 2) not null check (precio_mensual > 0),
  servicio_ids uuid[] not null default '{}',
  producto_ids uuid[] not null default '{}',
  publicado boolean not null default false,
  created_at timestamptz not null default now(),
  check (cardinality(servicio_ids) + cardinality(producto_ids) between 1 and 100)
);

create index membresias_slug_fecha_idx on public.membresias (slug, created_at desc);

alter table public.membresias enable row level security;
revoke all on public.membresias from public, anon, authenticated;
grant select, insert, update on public.membresias to service_role;
