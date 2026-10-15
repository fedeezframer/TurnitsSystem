-- Complemento de Perfil y Sucursales: ejecutar completo.
-- Al bajar de Premium, los profesionales que conserva el plan vuelven a
-- la sede principal. No modifica turnos ni elimina las sedes guardadas.
BEGIN;
CREATE OR REPLACE FUNCTION public.sucursales_al_cambiar_plan() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF OLD.plan='premium' AND NEW.plan IS DISTINCT FROM 'premium' THEN
    UPDATE public.sucursales SET admin_equipo_id=NULL,updated_at=now() WHERE slug=NEW.slug;
    UPDATE public.equipo SET sucursal_id=NULL WHERE slug=NEW.slug AND sucursal_id IS NOT NULL;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS usuarios_sucursales_cambio_plan ON public.usuarios;
CREATE TRIGGER usuarios_sucursales_cambio_plan AFTER UPDATE OF plan ON public.usuarios
FOR EACH ROW EXECUTE FUNCTION public.sucursales_al_cambiar_plan();
NOTIFY pgrst,'reload schema';
COMMIT;
