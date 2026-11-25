alter table public.membresias
  add column cantidades_productos jsonb not null default '{}'::jsonb
    check (jsonb_typeof(cantidades_productos) = 'object');
