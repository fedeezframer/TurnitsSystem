alter table public.membresias
  add column imagen_url text,
  add column cantidades_servicios jsonb not null default '{}'::jsonb
    check (jsonb_typeof(cantidades_servicios) = 'object');
