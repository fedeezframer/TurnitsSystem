alter table public.negocio_perfiles
  add column if not exists titulos_fotos jsonb not null default '{}'::jsonb
  check (jsonb_typeof(titulos_fotos) = 'object');
