ALTER TABLE public.consultas ADD COLUMN cliente_leido_at timestamptz;
ALTER TABLE public.consultas ADD COLUMN negocio_leido_at timestamptz;

CREATE FUNCTION public.consulta_bandeja(p_consumidor uuid DEFAULT NULL,p_slug text DEFAULT NULL)
RETURNS TABLE(id uuid,titulo text,estado text,slug text,created_at timestamptz,interlocutor_nombre text,foto_url text,ultimo_texto text,ultimo_autor text,ultima_foto boolean,ultima_actividad timestamptz,no_leidos bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 SELECT c.id,c.titulo,c.estado,c.slug,c.created_at,
 CASE WHEN p_consumidor IS NOT NULL THEN coalesce(nullif(p.nombre,''),u.business_name,c.slug) ELSE trim(concat_ws(' ',cliente.nombre_persona,cliente.apellido)) END,
 CASE WHEN p_consumidor IS NOT NULL THEN p.foto_perfil_url ELSE cliente.foto_url END,
 ultimo.texto,ultimo.autor,coalesce(ultimo.archivo IS NOT NULL,false),coalesce(ultimo.created_at,c.created_at),
 (SELECT count(*) FROM consulta_mensajes m WHERE m.consulta_id=c.id AND m.autor=CASE WHEN p_consumidor IS NOT NULL THEN 'negocio' ELSE 'cliente' END AND m.created_at>coalesce(CASE WHEN p_consumidor IS NOT NULL THEN c.cliente_leido_at ELSE c.negocio_leido_at END,'-infinity'::timestamptz))
 FROM consultas c JOIN consumidores cliente ON cliente.id=c.consumidor_id JOIN usuarios u ON u.slug=c.slug LEFT JOIN negocio_perfiles p ON p.slug=c.slug
 LEFT JOIN LATERAL (SELECT m.texto,m.autor,m.archivo,m.created_at FROM consulta_mensajes m WHERE m.consulta_id=c.id ORDER BY m.created_at DESC,m.id DESC LIMIT 1) ultimo ON true
 WHERE (p_consumidor IS NOT NULL AND p_slug IS NULL AND c.consumidor_id=p_consumidor) OR (p_slug IS NOT NULL AND p_consumidor IS NULL AND c.slug=p_slug)
 ORDER BY coalesce(ultimo.created_at,c.created_at) DESC,c.id DESC LIMIT 100;
$$;
REVOKE ALL ON FUNCTION public.consulta_bandeja(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consulta_bandeja(uuid,text) TO service_role;
