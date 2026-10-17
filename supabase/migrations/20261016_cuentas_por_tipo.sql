-- Permite una cuenta de usuario y una de negocio con el mismo correo.
-- Requiere 20261016_registro_consumidores.sql ejecutado previamente.
-- Ejecutar completo antes de desplegar el servidor actualizado. Reejecutable.
BEGIN;

DROP TRIGGER IF EXISTS consumidores_email_identidad ON public.consumidores;
DROP TRIGGER IF EXISTS usuarios_email_consumidor ON public.usuarios;
DROP TRIGGER IF EXISTS equipo_email_consumidor ON public.equipo;
DROP TRIGGER IF EXISTS admins_email_consumidor ON public.admins;
DROP FUNCTION IF EXISTS public.validar_email_consumidor();

-- Conserva las vinculaciones existentes y permite usar el mismo Google en ambos tipos.
-- Las restricciones UNIQUE de cada cuenta y de sus correos se conservan.
ALTER TABLE public.google_login_accounts ADD COLUMN IF NOT EXISTS tipo_cuenta text
  GENERATED ALWAYS AS (CASE WHEN consumidor_id IS NOT NULL THEN 'usuario' ELSE 'negocio' END) STORED;
ALTER TABLE public.google_login_accounts DROP CONSTRAINT IF EXISTS google_login_accounts_pkey;
ALTER TABLE public.google_login_accounts ADD CONSTRAINT google_login_accounts_pkey
  PRIMARY KEY (google_sub, tipo_cuenta);

NOTIFY pgrst, 'reload schema';
COMMIT;
