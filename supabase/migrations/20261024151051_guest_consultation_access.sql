ALTER TABLE public.consultas ALTER COLUMN consumidor_id DROP NOT NULL;
ALTER TABLE public.consultas
  ADD COLUMN guest_nombre text,
  ADD COLUMN guest_apellido text,
  ADD COLUMN guest_email text,
  ADD COLUMN guest_telefono text,
  ADD COLUMN guest_token_hash text,
  ADD COLUMN guest_expires_at timestamptz,
  ADD CONSTRAINT consultas_guest_access_consistent CHECK (
    (consumidor_id IS NOT NULL AND guest_nombre IS NULL AND guest_apellido IS NULL AND guest_email IS NULL AND guest_telefono IS NULL AND guest_token_hash IS NULL AND guest_expires_at IS NULL)
    OR
    (consumidor_id IS NULL AND guest_nombre IS NOT NULL AND guest_apellido IS NOT NULL AND guest_email IS NOT NULL AND guest_telefono IS NOT NULL AND guest_token_hash ~ '^[0-9a-f]{64}$' AND guest_expires_at IS NOT NULL)
  );
CREATE UNIQUE INDEX consultas_guest_token_hash ON public.consultas(guest_token_hash) WHERE guest_token_hash IS NOT NULL;

CREATE OR REPLACE FUNCTION public.consulta_bandeja(p_consumidor uuid DEFAULT NULL,p_slug text DEFAULT NULL)
RETURNS TABLE(id uuid,titulo text,estado text,slug text,created_at timestamptz,interlocutor_nombre text,foto_url text,ultimo_texto text,ultimo_autor text,ultima_foto boolean,ultima_actividad timestamptz,no_leidos bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 SELECT c.id,c.titulo,c.estado,c.slug,c.created_at,
 CASE WHEN p_consumidor IS NOT NULL THEN coalesce(nullif(p.nombre,''),u.business_name,c.slug) ELSE trim(concat_ws(' ',coalesce(nullif(cliente.nombre_persona,''),c.guest_nombre),coalesce(nullif(cliente.apellido,''),c.guest_apellido))) END,
 CASE WHEN p_consumidor IS NOT NULL THEN p.foto_perfil_url ELSE cliente.foto_url END,
 ultimo.texto,ultimo.autor,coalesce(ultimo.archivo IS NOT NULL,false),coalesce(ultimo.created_at,c.created_at),
 (SELECT count(*) FROM consulta_mensajes m WHERE m.consulta_id=c.id AND m.autor=CASE WHEN p_consumidor IS NOT NULL THEN 'negocio' ELSE 'cliente' END AND m.created_at>coalesce(CASE WHEN p_consumidor IS NOT NULL THEN c.cliente_leido_at ELSE c.negocio_leido_at END,'-infinity'::timestamptz))
 FROM consultas c LEFT JOIN consumidores cliente ON cliente.id=c.consumidor_id JOIN usuarios u ON u.slug=c.slug LEFT JOIN negocio_perfiles p ON p.slug=c.slug
 LEFT JOIN LATERAL (SELECT m.texto,m.autor,m.archivo,m.created_at FROM consulta_mensajes m WHERE m.consulta_id=c.id ORDER BY m.created_at DESC,m.id DESC LIMIT 1) ultimo ON true
 WHERE (p_consumidor IS NOT NULL AND p_slug IS NULL AND c.consumidor_id=p_consumidor) OR (p_slug IS NOT NULL AND p_consumidor IS NULL AND c.slug=p_slug)
 ORDER BY coalesce(ultimo.created_at,c.created_at) DESC,c.id DESC LIMIT 100;
$$;
