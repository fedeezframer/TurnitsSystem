-- Perfil público y sucursales de una misma agenda. Ejecutar completo.
-- Conserva datos existentes. Las sucursales no crean cuentas ni suscripciones.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('turnits-perfil-sucursales-v1',0));

CREATE TABLE IF NOT EXISTS public.negocio_perfiles (
  slug text PRIMARY KEY REFERENCES public.usuarios(slug) ON DELETE CASCADE,
  nombre text NOT NULL DEFAULT '', descripcion text NOT NULL DEFAULT '',
  categoria text NOT NULL DEFAULT '', direccion text NOT NULL DEFAULT '',
  ciudad text NOT NULL DEFAULT '', provincia text NOT NULL DEFAULT '',
  telefono_publico text NOT NULL DEFAULT '', instagram text NOT NULL DEFAULT '',
  sitio_web text NOT NULL DEFAULT '', fotos jsonb NOT NULL DEFAULT '[]',
  publicado boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (char_length(nombre)<=100 AND char_length(descripcion)<=1500),
  CHECK (jsonb_typeof(fotos)='array' AND jsonb_array_length(fotos)<=8)
);
CREATE TABLE IF NOT EXISTS public.sucursales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL REFERENCES public.usuarios(slug) ON DELETE CASCADE,
  nombre text NOT NULL CHECK (char_length(trim(nombre)) BETWEEN 1 AND 80),
  direccion text NOT NULL DEFAULT '' CHECK (char_length(direccion)<=200),
  activo boolean NOT NULL DEFAULT true,
  admin_equipo_id uuid REFERENCES public.equipo(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sucursales_nombre_por_negocio ON public.sucursales(slug,lower(nombre));
CREATE UNIQUE INDEX IF NOT EXISTS sucursales_un_admin ON public.sucursales(admin_equipo_id) WHERE admin_equipo_id IS NOT NULL;
ALTER TABLE public.equipo ADD COLUMN IF NOT EXISTS sucursal_id uuid REFERENCES public.sucursales(id) ON DELETE RESTRICT;
ALTER TABLE public.turnos ADD COLUMN IF NOT EXISTS sucursal_id uuid REFERENCES public.sucursales(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS equipo_sucursal ON public.equipo(slug,sucursal_id);
CREATE INDEX IF NOT EXISTS turnos_sucursal_fecha ON public.turnos(slug,sucursal_id,fecha);
ALTER TABLE public.negocio_perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sucursales ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.negocio_perfiles, public.sucursales FROM anon, authenticated;
GRANT ALL ON public.negocio_perfiles, public.sucursales TO service_role;

CREATE OR REPLACE FUNCTION public.validar_sucursal_equipo() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.sucursal_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sucursales s WHERE s.id=NEW.sucursal_id AND s.slug=NEW.slug) THEN
    RAISE EXCEPTION 'La sucursal no pertenece al negocio.';
  END IF;
  IF TG_OP='UPDATE' AND (NEW.sucursal_id IS DISTINCT FROM OLD.sucursal_id OR NEW.activo IS DISTINCT FROM OLD.activo) AND
     EXISTS (SELECT 1 FROM sucursales s WHERE s.admin_equipo_id=OLD.id AND (s.id IS DISTINCT FROM NEW.sucursal_id OR NEW.activo IS NOT TRUE)) THEN
    RAISE EXCEPTION 'Cambiá primero el encargado de esa sucursal.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS equipo_validar_sucursal ON public.equipo;
CREATE TRIGGER equipo_validar_sucursal BEFORE INSERT OR UPDATE OF sucursal_id,slug,activo ON public.equipo
FOR EACH ROW EXECUTE FUNCTION public.validar_sucursal_equipo();

CREATE OR REPLACE FUNCTION public.validar_admin_sucursal() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.admin_equipo_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM equipo e WHERE e.id=NEW.admin_equipo_id AND e.slug=NEW.slug AND e.sucursal_id=NEW.id
      AND e.activo IS TRUE AND e.es_dueño IS FALSE AND e.login_email IS NOT NULL
  ) THEN RAISE EXCEPTION 'El encargado debe ser un miembro activo de esta sucursal con email de acceso.'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sucursal_validar_admin ON public.sucursales;
CREATE TRIGGER sucursal_validar_admin BEFORE INSERT OR UPDATE OF admin_equipo_id,slug ON public.sucursales
FOR EACH ROW EXECUTE FUNCTION public.validar_admin_sucursal();

-- Reasignación atómica: no deja una sucursal guardada a medias.
CREATE OR REPLACE FUNCTION public.guardar_sucursal(p_slug text,p_id uuid,p_nombre text,p_direccion text,p_activo boolean,p_admin uuid,p_miembros uuid[])
RETURNS uuid LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_id uuid; v_plan usuarios%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('sucursales:'||p_slug,0));
  SELECT * INTO v_plan FROM usuarios WHERE slug=p_slug FOR UPDATE;
  IF v_plan.plan IS DISTINCT FROM 'premium' OR v_plan.activo IS NOT TRUE OR v_plan.estado_suscripcion='suspendido' OR
     (v_plan.fecha_vencimiento IS NOT NULL AND v_plan.fecha_vencimiento<=now()) THEN RAISE EXCEPTION 'Sucursales requiere Premium vigente.'; END IF;
  IF p_miembros IS NULL OR array_length(p_miembros,1)>500 OR length(trim(p_nombre)) NOT BETWEEN 1 AND 80 OR length(p_direccion)>200 THEN RAISE EXCEPTION 'Revisá los datos de la sucursal.'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_miembros) x WHERE NOT EXISTS (SELECT 1 FROM equipo e WHERE e.id=x AND e.slug=p_slug AND e.es_dueño IS FALSE)) THEN
    RAISE EXCEPTION 'Todos los miembros deben pertenecer a tu equipo.';
  END IF;
  IF p_admin IS NOT NULL AND NOT(p_admin=ANY(p_miembros)) THEN RAISE EXCEPTION 'Asigná el encargado a esta sucursal.'; END IF;
  IF p_id IS NOT NULL THEN
    UPDATE sucursales SET admin_equipo_id=NULL WHERE id=p_id AND slug=p_slug RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Sucursal no encontrada.'; END IF;
  ELSE
    INSERT INTO sucursales(slug,nombre,direccion,activo) VALUES(p_slug,trim(p_nombre),p_direccion,p_activo) RETURNING id INTO v_id;
  END IF;
  IF EXISTS (SELECT 1 FROM sucursales s WHERE s.slug=p_slug AND s.id<>v_id AND s.admin_equipo_id=ANY(p_miembros)) THEN
    RAISE EXCEPTION 'Quitá primero el rol de encargado antes de moverlo de sucursal.';
  END IF;
  UPDATE equipo SET sucursal_id=NULL WHERE slug=p_slug AND sucursal_id=v_id AND NOT(id=ANY(p_miembros));
  UPDATE equipo SET sucursal_id=v_id WHERE slug=p_slug AND id=ANY(p_miembros) AND es_dueño IS FALSE;
  UPDATE sucursales SET nombre=trim(p_nombre),direccion=p_direccion,activo=p_activo,admin_equipo_id=p_admin,updated_at=now() WHERE id=v_id AND slug=p_slug;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.guardar_sucursal(text,uuid,text,text,boolean,uuid,uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guardar_sucursal(text,uuid,text,text,boolean,uuid,uuid[]) TO service_role;

-- La sede se guarda en el turno: mover un profesional no mueve sus reservas anteriores.
CREATE OR REPLACE FUNCTION public.turno_guardar_sucursal() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_sucursal uuid;
BEGIN
  IF NEW.equipo_id IS NOT NULL THEN
    SELECT sucursal_id INTO v_sucursal FROM equipo WHERE id=NEW.equipo_id AND slug=NEW.slug;
    IF NOT FOUND THEN RAISE EXCEPTION 'El profesional no pertenece al negocio.'; END IF;
    -- La API valida disponibilidad antes de iniciar el cobro. No se impide
    -- finalizar un pago ya iniciado si la sede se pausa mientras se procesa.
  END IF;
  -- Si se borra un profesional y la FK deja equipo_id en null, se conserva el historial.
  IF TG_OP='INSERT' OR NEW.equipo_id IS NOT NULL THEN NEW.sucursal_id=v_sucursal; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS turno_sucursal_snapshot ON public.turnos;
CREATE TRIGGER turno_sucursal_snapshot BEFORE INSERT OR UPDATE OF equipo_id ON public.turnos
FOR EACH ROW EXECUTE FUNCTION public.turno_guardar_sucursal();
NOTIFY pgrst,'reload schema';
COMMIT;
