-- Foto de perfil y banner independientes, galería sin límite de cantidad.
-- Ejecutar completo después de las migraciones anteriores de Perfil.
-- Las fotos existentes se conservan en la galería; no se asignan como banner.
BEGIN;
ALTER TABLE public.negocio_perfiles
  ADD COLUMN IF NOT EXISTS foto_perfil_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS banner_url text NOT NULL DEFAULT '';

-- El nombre del CHECK original puede variar entre instalaciones.
DO $$
DECLARE restriccion record;
BEGIN
  FOR restriccion IN
    SELECT conname FROM pg_constraint
    WHERE conrelid='public.negocio_perfiles'::regclass AND contype='c'
      AND pg_get_constraintdef(oid) ILIKE '%jsonb_array_length(fotos)%'
  LOOP
    EXECUTE format('ALTER TABLE public.negocio_perfiles DROP CONSTRAINT %I',restriccion.conname);
  END LOOP;
END $$;

ALTER TABLE public.negocio_perfiles DROP CONSTRAINT IF EXISTS negocio_perfiles_galeria_check;
ALTER TABLE public.negocio_perfiles ADD CONSTRAINT negocio_perfiles_galeria_check
  CHECK (jsonb_typeof(fotos)='array');
ALTER TABLE public.negocio_perfiles DROP CONSTRAINT IF EXISTS negocio_perfiles_imagenes_check;
ALTER TABLE public.negocio_perfiles ADD CONSTRAINT negocio_perfiles_imagenes_check
  CHECK (length(foto_perfil_url)<=1200 AND length(banner_url)<=1200);
NOTIFY pgrst,'reload schema';
COMMIT;
