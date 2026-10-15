-- Redes públicas del negocio. Ejecutar completo después de Perfil y Sucursales.
-- Conserva Instagram, fotos, publicación y el resto de los datos existentes.
BEGIN;
ALTER TABLE public.negocio_perfiles ADD COLUMN IF NOT EXISTS redes_sociales jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.negocio_perfiles DROP CONSTRAINT IF EXISTS negocio_perfiles_redes_check;
ALTER TABLE public.negocio_perfiles ADD CONSTRAINT negocio_perfiles_redes_check
CHECK (jsonb_typeof(redes_sociales)='object' AND length(redes_sociales::text)<=4096);
NOTIFY pgrst,'reload schema';
COMMIT;
