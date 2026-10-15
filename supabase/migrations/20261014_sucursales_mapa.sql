-- Mapas y edición de la sede principal. Ejecutar completo, una sola vez.
-- Idempotente: no mueve miembros ni cambia reservas existentes.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('turnits-sucursales-mapa-v1',0));
ALTER TABLE public.sucursales ADD COLUMN IF NOT EXISTS es_principal boolean NOT NULL DEFAULT false;
ALTER TABLE public.sucursales ADD COLUMN IF NOT EXISTS latitud double precision;
ALTER TABLE public.sucursales ADD COLUMN IF NOT EXISTS longitud double precision;
ALTER TABLE public.sucursales DROP CONSTRAINT IF EXISTS sucursales_coordenadas_check;
ALTER TABLE public.sucursales ADD CONSTRAINT sucursales_coordenadas_check CHECK (
  (latitud IS NULL AND longitud IS NULL) OR
  (latitud IS NOT NULL AND longitud IS NOT NULL AND latitud BETWEEN -90 AND 90 AND longitud BETWEEN -180 AND 180)
);
CREATE UNIQUE INDEX IF NOT EXISTS sucursales_una_principal ON public.sucursales(slug) WHERE es_principal;

CREATE OR REPLACE FUNCTION public.validar_sucursal_equipo() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.sucursal_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sucursales s WHERE s.id=NEW.sucursal_id AND s.slug=NEW.slug AND NOT s.es_principal) THEN
    RAISE EXCEPTION 'La sucursal no pertenece al negocio o es la sede principal.';
  END IF;
  IF TG_OP='UPDATE' AND (NEW.sucursal_id IS DISTINCT FROM OLD.sucursal_id OR NEW.activo IS DISTINCT FROM OLD.activo) AND
     EXISTS (SELECT 1 FROM sucursales s WHERE s.admin_equipo_id=OLD.id AND
       (NEW.activo IS NOT TRUE OR (s.es_principal AND NEW.sucursal_id IS NOT NULL) OR (NOT s.es_principal AND s.id IS DISTINCT FROM NEW.sucursal_id))) THEN
    RAISE EXCEPTION 'Cambiá primero el encargado de esa sucursal.';
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.validar_admin_sucursal() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.admin_equipo_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM equipo e WHERE e.id=NEW.admin_equipo_id AND e.slug=NEW.slug
      AND ((NEW.es_principal AND e.sucursal_id IS NULL) OR (NOT NEW.es_principal AND e.sucursal_id=NEW.id))
      AND e.activo IS TRUE AND e.es_dueño IS FALSE AND e.login_email IS NOT NULL
  ) THEN RAISE EXCEPTION 'El encargado debe ser un miembro activo de esta sucursal con email de acceso.'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guardar_sucursal_mapa(
 p_slug text,p_id uuid,p_principal boolean,p_nombre text,p_direccion text,p_activo boolean,
 p_admin uuid,p_miembros uuid[],p_latitud double precision,p_longitud double precision
) RETURNS uuid LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_id uuid; v_plan usuarios%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('sucursales:'||p_slug,0));
  SELECT * INTO v_plan FROM usuarios WHERE slug=p_slug FOR UPDATE;
  IF v_plan.plan IS DISTINCT FROM 'premium' OR v_plan.activo IS NOT TRUE OR v_plan.estado_suscripcion='suspendido' OR
    (v_plan.fecha_vencimiento IS NOT NULL AND v_plan.fecha_vencimiento<=now()) THEN RAISE EXCEPTION 'Sucursales requiere Premium vigente.'; END IF;
  IF p_principal IS NULL OR p_activo IS NULL OR p_nombre IS NULL OR length(trim(p_nombre)) NOT BETWEEN 1 AND 80 OR p_direccion IS NULL OR length(p_direccion)>200 OR
    p_miembros IS NULL OR cardinality(p_miembros)>500 OR array_position(p_miembros,NULL) IS NOT NULL THEN RAISE EXCEPTION 'Revisá los datos de la sucursal.'; END IF;
  IF NOT ((p_latitud IS NULL AND p_longitud IS NULL) OR (p_latitud IS NOT NULL AND p_longitud IS NOT NULL AND p_latitud BETWEEN -90 AND 90 AND p_longitud BETWEEN -180 AND 180)) THEN
    RAISE EXCEPTION 'Marcá una ubicación válida en el mapa.';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_miembros) x WHERE NOT EXISTS (SELECT 1 FROM equipo e WHERE e.id=x AND e.slug=p_slug AND (p_principal OR NOT e.es_dueño))) THEN
    RAISE EXCEPTION 'Todos los miembros deben pertenecer a tu equipo.';
  END IF;
  IF p_admin IS NOT NULL AND NOT(p_admin=ANY(p_miembros)) THEN RAISE EXCEPTION 'Asigná el encargado a esta sucursal.'; END IF;
  IF p_principal THEN
    SELECT id INTO v_id FROM sucursales WHERE slug=p_slug AND es_principal FOR UPDATE;
    IF v_id IS NULL THEN
      INSERT INTO sucursales(slug,nombre,direccion,activo,es_principal) VALUES(p_slug,trim(p_nombre),p_direccion,p_activo,true) RETURNING id INTO v_id;
    END IF;
  ELSIF p_id IS NOT NULL THEN
    SELECT id INTO v_id FROM sucursales WHERE slug=p_slug AND id=p_id AND NOT es_principal FOR UPDATE;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Sucursal no encontrada.'; END IF;
  ELSE
    INSERT INTO sucursales(slug,nombre,direccion,activo) VALUES(p_slug,trim(p_nombre),p_direccion,p_activo) RETURNING id INTO v_id;
  END IF;
  UPDATE sucursales SET admin_equipo_id=NULL WHERE id=v_id AND slug=p_slug;
  IF EXISTS (SELECT 1 FROM sucursales s WHERE s.slug=p_slug AND s.id<>v_id AND s.admin_equipo_id=ANY(p_miembros)) THEN
    RAISE EXCEPTION 'Quitá primero el rol de encargado antes de moverlo de sucursal.';
  END IF;
  IF p_principal THEN
    IF EXISTS (SELECT 1 FROM equipo e WHERE e.slug=p_slug AND e.sucursal_id IS NULL AND NOT(e.id=ANY(p_miembros))) THEN
      RAISE EXCEPTION 'Para quitar un miembro de la principal, asignalo desde otra sucursal.';
    END IF;
    UPDATE equipo SET sucursal_id=NULL WHERE slug=p_slug AND id=ANY(p_miembros);
  ELSE
    UPDATE equipo SET sucursal_id=NULL WHERE slug=p_slug AND sucursal_id=v_id AND NOT(id=ANY(p_miembros));
    UPDATE equipo SET sucursal_id=v_id WHERE slug=p_slug AND id=ANY(p_miembros) AND NOT es_dueño;
  END IF;
  UPDATE sucursales SET nombre=trim(p_nombre),direccion=p_direccion,activo=p_activo,admin_equipo_id=p_admin,
    latitud=p_latitud,longitud=p_longitud,updated_at=now() WHERE id=v_id AND slug=p_slug;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.guardar_sucursal_mapa(text,uuid,boolean,text,text,boolean,uuid,uuid[],double precision,double precision) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guardar_sucursal_mapa(text,uuid,boolean,text,text,boolean,uuid,uuid[],double precision,double precision) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
