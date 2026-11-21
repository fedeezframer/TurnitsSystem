ALTER TABLE public.negocio_perfiles
  ADD COLUMN IF NOT EXISTS publicaciones jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.negocio_perfiles
  ADD CONSTRAINT negocio_perfiles_publicaciones_check
  CHECK (jsonb_typeof(publicaciones) = 'object');
