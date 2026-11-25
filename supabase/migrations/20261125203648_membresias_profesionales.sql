alter table public.membresias
  add column profesional_ids uuid[] not null default '{}'
  check (cardinality(profesional_ids) <= 100);
