ALTER TABLE public.consulta_mensajes ADD COLUMN archivo_bytes integer CHECK (archivo_bytes BETWEEN 1 AND 2097152);
UPDATE public.consulta_mensajes SET archivo_bytes=2097152 WHERE archivo IS NOT NULL;
ALTER TABLE public.consultas ADD COLUMN cerrada_at timestamptz;
CREATE TABLE public.consulta_archivos_eliminar(path text PRIMARY KEY,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.consulta_archivos_eliminar ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.consulta_archivos_eliminar FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.consulta_archivos_eliminar TO service_role;

CREATE FUNCTION public.consulta_archivo_cupo() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE negocio text; usados bigint;
BEGIN
 IF NEW.archivo IS NULL THEN RETURN NEW; END IF;
 IF NEW.archivo_bytes IS NULL THEN RAISE EXCEPTION 'Referencia sin tamaño validado.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('consulta-reference-storage',0));
 SELECT slug INTO negocio FROM consultas WHERE id=NEW.consulta_id;
 SELECT coalesce(sum(archivo_bytes),0) INTO usados FROM consulta_mensajes WHERE archivo IS NOT NULL;
 IF usados+NEW.archivo_bytes>209715200 THEN RAISE EXCEPTION 'El almacenamiento de referencias está temporalmente completo.'; END IF;
 SELECT coalesce(sum(m.archivo_bytes),0) INTO usados FROM consulta_mensajes m JOIN consultas c ON c.id=m.consulta_id WHERE c.slug=negocio AND m.archivo IS NOT NULL;
 IF usados+NEW.archivo_bytes>52428800 THEN RAISE EXCEPTION 'Este negocio alcanzó el límite de referencias.'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER consulta_archivo_cupo BEFORE INSERT ON public.consulta_mensajes FOR EACH ROW EXECUTE FUNCTION public.consulta_archivo_cupo();
CREATE FUNCTION public.consulta_archivo_eliminado() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF OLD.archivo IS NOT NULL THEN INSERT INTO consulta_archivos_eliminar(path) VALUES(OLD.archivo) ON CONFLICT DO NOTHING; END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER consulta_archivo_eliminado AFTER DELETE ON public.consulta_mensajes FOR EACH ROW EXECUTE FUNCTION public.consulta_archivo_eliminado();
CREATE FUNCTION public.consulta_retener_referencias() RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path=public AS $$
 DELETE FROM consulta_mensajes m USING consultas c WHERE c.id=m.consulta_id AND m.archivo IS NOT NULL AND c.estado='cerrada' AND c.cerrada_at<now()-interval '90 days';
$$;
REVOKE ALL ON FUNCTION public.consulta_archivo_cupo(),public.consulta_archivo_eliminado(),public.consulta_retener_referencias() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consulta_archivo_cupo(),public.consulta_archivo_eliminado(),public.consulta_retener_referencias() TO service_role;
