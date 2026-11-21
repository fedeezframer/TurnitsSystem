ALTER TABLE public.turnits_offers ADD COLUMN franjas jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(franjas) = 'array');

CREATE OR REPLACE FUNCTION public.browse_guardar_config(p_slug text, p_offers jsonb, p_recompensas jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE o jsonb; r jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('browse-config:'||p_slug,0));
 IF EXISTS(SELECT 1 FROM turnits_offers WHERE id IN(SELECT (x->>'id')::uuid FROM jsonb_array_elements(p_offers)x) AND slug<>p_slug)
 OR EXISTS(SELECT 1 FROM turnits_recompensas WHERE id IN(SELECT (x->>'id')::uuid FROM jsonb_array_elements(p_recompensas)x) AND slug<>p_slug) THEN RAISE EXCEPTION 'Configuración de otro negocio.'; END IF;
 DELETE FROM turnits_offers WHERE slug=p_slug AND id NOT IN(SELECT (x->>'id')::uuid FROM jsonb_array_elements(p_offers)x);
 UPDATE turnits_recompensas SET activo=false WHERE slug=p_slug;
 FOR o IN SELECT * FROM jsonb_array_elements(p_offers) LOOP
  IF NOT EXISTS(SELECT 1 FROM servicios WHERE id=(o->>'servicio_id')::uuid AND slug=p_slug) OR NOT EXISTS(SELECT 1 FROM equipo WHERE id=(o->>'equipo_id')::uuid AND slug=p_slug) THEN RAISE EXCEPTION 'Elementos de otro negocio.'; END IF;
  IF (o->>'activo')::boolean THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.servicios s
      JOIN public.equipo e ON e.id=(o->>'equipo_id')::uuid AND e.slug=p_slug AND e.activo=true
      LEFT JOIN public.servicio_equipo v ON v.servicio_id=s.id AND v.equipo_id=e.id
      WHERE s.id=(o->>'servicio_id')::uuid AND s.slug=p_slug
      AND (s.owner_equipo_id IS NULL OR s.owner_equipo_id=e.id)
      AND (o->>'precio_minimo')::numeric > 0
      AND (o->>'precio_minimo')::numeric < coalesce(v.precio_override,s.precio)
    ) THEN RAISE EXCEPTION 'Revisá el profesional y la tarifa mínima de la Offer.'; END IF;
    INSERT INTO public.servicio_equipo(servicio_id,equipo_id)
    VALUES((o->>'servicio_id')::uuid,(o->>'equipo_id')::uuid)
    ON CONFLICT(servicio_id,equipo_id) DO NOTHING;
  END IF;
  INSERT INTO turnits_offers(id,slug,servicio_id,equipo_id,precio_minimo,activo,franjas) VALUES((o->>'id')::uuid,p_slug,(o->>'servicio_id')::uuid,(o->>'equipo_id')::uuid,(o->>'precio_minimo')::numeric,(o->>'activo')::boolean,coalesce(o->'franjas','[]'::jsonb))
  ON CONFLICT(id) DO UPDATE SET servicio_id=excluded.servicio_id,equipo_id=excluded.equipo_id,precio_minimo=excluded.precio_minimo,activo=excluded.activo,franjas=excluded.franjas,updated_at=now();
 END LOOP;
 FOR r IN SELECT * FROM jsonb_array_elements(p_recompensas) LOOP
  IF EXISTS(SELECT 1 FROM turnits_recompensas WHERE id=(r->>'id')::uuid AND updated_at IS DISTINCT FROM (r->>'expected_updated_at')::timestamptz) THEN RAISE EXCEPTION 'El stock o la recompensa cambió. Recargá la configuración antes de guardar.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM servicios WHERE id=(r->>'servicio_id')::uuid AND slug=p_slug) THEN RAISE EXCEPTION 'Servicio de otro negocio.'; END IF;
  INSERT INTO turnits_recompensas(id,slug,nombre,tipo,objeto_id,servicio_id,monedas,copago,stock,activo) VALUES((r->>'id')::uuid,p_slug,r->>'nombre',r->>'tipo',(r->>'objeto_id')::uuid,(r->>'servicio_id')::uuid,(r->>'monedas')::integer,(r->>'copago')::numeric,(r->>'stock')::integer,(r->>'activo')::boolean)
  ON CONFLICT(id) DO UPDATE SET nombre=excluded.nombre,tipo=excluded.tipo,objeto_id=excluded.objeto_id,servicio_id=excluded.servicio_id,monedas=excluded.monedas,copago=excluded.copago,stock=excluded.stock,activo=excluded.activo,updated_at=now();
 END LOOP;
END $function$;
REVOKE ALL ON FUNCTION public.browse_guardar_config(text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.browse_guardar_config(text,jsonb,jsonb) TO service_role;


