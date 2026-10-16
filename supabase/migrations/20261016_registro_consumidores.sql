-- Registro de consumidores e intereses. Ejecutar completo antes de publicar.
-- Conserva las cuentas, agendas, planes y registros de negocios existentes.
BEGIN;

ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS rubro text;
ALTER TABLE public.registros_pendientes ADD COLUMN IF NOT EXISTS rubro text;
ALTER TABLE public.registros_pendientes ADD COLUMN IF NOT EXISTS slug_solicitado text;

CREATE TABLE IF NOT EXISTS public.consumidores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_persona text NOT NULL CHECK (char_length(btrim(nombre_persona)) BETWEEN 1 AND 80),
  apellido text NOT NULL CHECK (char_length(btrim(apellido)) BETWEEN 1 AND 80),
  email text NOT NULL UNIQUE CHECK (email = lower(btrim(email))),
  telefono text NOT NULL CHECK (telefono ~ '^[0-9]{7,15}$'),
  password text NOT NULL,
  intereses text[] NOT NULL CHECK (cardinality(intereses) BETWEEN 1 AND 6 AND intereses <@ ARRAY['barberia','manicura','vehiculos','peluqueria','consultoria','otro']::text[]),
  activo boolean NOT NULL DEFAULT true,
  email_verificado boolean NOT NULL DEFAULT true,
  reset_token text UNIQUE,
  reset_token_expiry timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.registros_consumidores (
  email text PRIMARY KEY,
  registro_id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre_persona text NOT NULL,
  apellido text NOT NULL,
  telefono text NOT NULL,
  password_hash text NOT NULL,
  intereses text[] NOT NULL CHECK (cardinality(intereses) BETWEEN 1 AND 6 AND intereses <@ ARRAY['barberia','manicura','vehiculos','peluqueria','consultoria','otro']::text[]),
  codigo_hash text NOT NULL,
  codigo_expiry timestamptz NOT NULL,
  intentos integer NOT NULL DEFAULT 0 CHECK (intentos BETWEEN 0 AND 5),
  enviado_at timestamptz NOT NULL DEFAULT now()
);

-- Un correo identifica una cuenta: evita accesos ambiguos entre tipos.
CREATE OR REPLACE FUNCTION public.validar_email_consumidor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE correo text;
BEGIN
  IF TG_TABLE_NAME = 'equipo' THEN correo := lower(btrim(NEW.login_email));
  ELSE correo := lower(btrim(NEW.email)); END IF;
  IF correo IS NULL OR correo = '' THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(correo, 20261016));
  IF TG_TABLE_NAME = 'consumidores' THEN
    IF EXISTS(SELECT 1 FROM public.usuarios WHERE lower(email) = correo)
      OR EXISTS(SELECT 1 FROM public.equipo WHERE lower(login_email) = correo)
      OR EXISTS(SELECT 1 FROM public.admins WHERE lower(email) = correo) THEN
      RAISE EXCEPTION 'Ya existe una cuenta con ese email.' USING ERRCODE = '23505';
    END IF;
  ELSIF EXISTS(SELECT 1 FROM public.consumidores WHERE email = correo) THEN
    RAISE EXCEPTION 'Ya existe una cuenta con ese email.' USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS consumidores_email_identidad ON public.consumidores;
CREATE TRIGGER consumidores_email_identidad BEFORE INSERT OR UPDATE OF email ON public.consumidores FOR EACH ROW EXECUTE FUNCTION public.validar_email_consumidor();
DROP TRIGGER IF EXISTS usuarios_email_consumidor ON public.usuarios;
CREATE TRIGGER usuarios_email_consumidor BEFORE INSERT OR UPDATE OF email ON public.usuarios FOR EACH ROW EXECUTE FUNCTION public.validar_email_consumidor();
DROP TRIGGER IF EXISTS equipo_email_consumidor ON public.equipo;
CREATE TRIGGER equipo_email_consumidor BEFORE INSERT OR UPDATE OF login_email ON public.equipo FOR EACH ROW EXECUTE FUNCTION public.validar_email_consumidor();
DROP TRIGGER IF EXISTS admins_email_consumidor ON public.admins;
CREATE TRIGGER admins_email_consumidor BEFORE INSERT OR UPDATE OF email ON public.admins FOR EACH ROW EXECUTE FUNCTION public.validar_email_consumidor();

-- Consume el código una vez, con bloqueo de fila e intentos persistentes.
CREATE OR REPLACE FUNCTION public.verificar_registro_consumidor(p_email text, p_registro_id uuid, p_codigo_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pendiente public.registros_consumidores%ROWTYPE; nuevo public.consumidores%ROWTYPE;
BEGIN
  SELECT * INTO pendiente FROM public.registros_consumidores WHERE email = lower(btrim(p_email)) FOR UPDATE;
  IF NOT FOUND OR pendiente.registro_id IS DISTINCT FROM p_registro_id THEN
    RETURN jsonb_build_object('success',false,'code','registro_invalido','error','Iniciá el registro de nuevo.');
  END IF;
  IF pendiente.codigo_expiry <= now() OR pendiente.intentos >= 5 THEN
    RETURN jsonb_build_object('success',false,'code','codigo_expirado','error','El código expiró o agotaste los intentos. Pedí otro código.');
  END IF;
  IF pendiente.codigo_hash IS DISTINCT FROM p_codigo_hash THEN
    UPDATE public.registros_consumidores SET intentos = intentos + 1 WHERE email = pendiente.email;
    RETURN jsonb_build_object('success',false,'code','codigo_incorrecto','error','Código incorrecto.');
  END IF;
  INSERT INTO public.consumidores(nombre_persona,apellido,email,telefono,password,intereses)
    VALUES(pendiente.nombre_persona,pendiente.apellido,pendiente.email,pendiente.telefono,pendiente.password_hash,pendiente.intereses)
    RETURNING * INTO nuevo;
  DELETE FROM public.registros_consumidores WHERE email = pendiente.email;
  RETURN jsonb_build_object('success',true,'id',nuevo.id,'email',nuevo.email,'nombre_persona',nuevo.nombre_persona,'apellido',nuevo.apellido,'intereses',to_jsonb(nuevo.intereses));
END;
$$;

CREATE TABLE IF NOT EXISTS public.google_login_accounts (
  google_sub text PRIMARY KEY,
  usuario_id uuid UNIQUE REFERENCES public.usuarios(id) ON DELETE CASCADE,
  equipo_id uuid UNIQUE REFERENCES public.equipo(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.google_login_accounts ADD COLUMN IF NOT EXISTS consumidor_id uuid UNIQUE REFERENCES public.consumidores(id) ON DELETE CASCADE;
ALTER TABLE public.google_login_accounts DROP CONSTRAINT IF EXISTS google_login_exactly_one_account;
ALTER TABLE public.google_login_accounts ADD CONSTRAINT google_login_exactly_one_account CHECK (num_nonnulls(usuario_id,equipo_id,consumidor_id) = 1);

ALTER TABLE public.consumidores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registros_consumidores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_login_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.consumidores, public.registros_consumidores, public.google_login_accounts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.consumidores, public.registros_consumidores, public.google_login_accounts TO service_role;
REVOKE ALL ON FUNCTION public.verificar_registro_consumidor(text,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verificar_registro_consumidor(text,uuid,text) TO service_role;
REVOKE ALL ON FUNCTION public.validar_email_consumidor() FROM PUBLIC, anon, authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
