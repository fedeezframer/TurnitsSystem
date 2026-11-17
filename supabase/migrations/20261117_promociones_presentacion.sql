ALTER TABLE public.promociones
  ADD COLUMN IF NOT EXISTS descripcion text,
  ADD COLUMN IF NOT EXISTS imagen_url text;
