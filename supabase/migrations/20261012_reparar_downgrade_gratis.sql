-- TURNITS: reparar la función RPC para pasar al Plan Gratis.
-- Ejecutar completo en Supabase > SQL Editor.
-- Instala las funciones; la reducción se aplica al confirmar Gratis en el panel.
BEGIN;

CREATE OR REPLACE FUNCTION public.aplicar_limites_plan(p_slug text,p_plan text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE limite integer; eliminados integer := 0;
BEGIN
  IF p_plan NOT IN ('gratis','basico','premium') THEN RAISE EXCEPTION 'Plan inválido'; END IF;
  PERFORM 1 FROM public.usuarios WHERE slug=p_slug FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cuenta no encontrada'; END IF;
  limite := CASE p_plan WHEN 'gratis' THEN 0 WHEN 'basico' THEN 2 ELSE NULL END;
  IF limite IS NOT NULL THEN
    -- Conserva al titular y a los colaboradores más antiguos.
    -- Las FK eliminan catálogo privado/asignaciones y conservan turnos.
    DELETE FROM public.equipo WHERE slug=p_slug AND es_dueño=false AND id IN (
      SELECT id FROM public.equipo WHERE slug=p_slug AND es_dueño=false
      ORDER BY created_at ASC NULLS LAST,id ASC OFFSET limite
    );
    GET DIAGNOSTICS eliminados = ROW_COUNT;
    UPDATE public.usuarios SET acepta_transferencia=false,acepta_efectivo=false,
      agenda_sin_pagos=false,datos_bancarios='{}'::jsonb,
      metodo_pago=CASE WHEN metodo_pago IN ('total','sena') THEN metodo_pago ELSE 'total' END
      WHERE slug=p_slug;
    UPDATE public.equipo SET acepta_transferencia=false,acepta_efectivo=false,
      agenda_sin_pagos=false,datos_bancarios='{}'::jsonb,
      metodo_pago=CASE WHEN metodo_pago IS NULL OR metodo_pago IN ('total','sena') THEN metodo_pago ELSE 'total' END
      WHERE slug=p_slug;
  END IF;
  IF p_plan='gratis' THEN
    UPDATE public.usuarios SET tema='{"primario":"#6366F1","secundario":"#8B5CF6","fondo":"#F9FAFB","texto":"#111827","acento":"#EC4899"}'::jsonb,
      paletas_personalizadas='[]'::jsonb WHERE slug=p_slug;
    UPDATE public.promociones SET activo=false WHERE slug=p_slug AND activo=true;
  END IF;
  RETURN eliminados;
END $$;
REVOKE ALL ON FUNCTION public.aplicar_limites_plan(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.aplicar_limites_plan(text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.reducir_plan_gratis(p_usuario_id uuid,p_slug text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE eliminados integer;
BEGIN
  PERFORM 1 FROM public.usuarios WHERE id=p_usuario_id AND slug=p_slug FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cuenta no encontrada'; END IF;
  eliminados := public.aplicar_limites_plan(p_slug,'gratis');
  UPDATE public.usuarios SET plan='gratis',estado_suscripcion='activo',fecha_vencimiento=NULL,premium_promo=false
    WHERE id=p_usuario_id;
  RETURN jsonb_build_object('success',true,'miembros_eliminados',eliminados);
END $$;
REVOKE ALL ON FUNCTION public.reducir_plan_gratis(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reducir_plan_gratis(uuid,text) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Comprobación de la función y los nombres de parámetros que usa el servidor.
SELECT to_regprocedure('public.reducir_plan_gratis(uuid,text)') AS funcion,
       pg_get_function_arguments(to_regprocedure('public.reducir_plan_gratis(uuid,text)')) AS argumentos,
       has_function_privilege('service_role','public.reducir_plan_gratis(uuid,text)','EXECUTE') AS servidor_puede_ejecutar;
