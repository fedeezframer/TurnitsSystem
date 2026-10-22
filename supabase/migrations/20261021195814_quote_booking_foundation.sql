ALTER TABLE public.usuarios ADD COLUMN modo_agenda text NOT NULL DEFAULT 'normal' CHECK (modo_agenda IN ('normal','presupuesto'));
ALTER TABLE public.registros_pendientes ADD COLUMN modo_agenda text NOT NULL DEFAULT 'normal' CHECK (modo_agenda IN ('normal','presupuesto'));

CREATE TABLE public.consultas (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 consumidor_id uuid NOT NULL REFERENCES public.consumidores(id) ON DELETE CASCADE,
 slug text NOT NULL REFERENCES public.usuarios(slug) ON DELETE CASCADE,
 servicio_id uuid NOT NULL REFERENCES public.servicios(id),
 titulo text NOT NULL CHECK (length(titulo) BETWEEN 1 AND 120),
 estado text NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta','reservada','cerrada')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (consumidor_id,servicio_id)
);
CREATE INDEX consultas_negocio ON public.consultas(slug,created_at DESC);
CREATE TABLE public.consulta_mensajes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 consulta_id uuid NOT NULL REFERENCES public.consultas(id) ON DELETE CASCADE,
 autor text NOT NULL CHECK (autor IN ('cliente','negocio')),
 texto text NOT NULL DEFAULT '' CHECK (length(texto)<=3000),
 archivo text,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (length(trim(texto))>0 OR archivo IS NOT NULL)
);
CREATE INDEX consulta_mensajes_orden ON public.consulta_mensajes(consulta_id,created_at,id);
CREATE FUNCTION public.consulta_limitar_referencias() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF NEW.archivo IS NULL THEN RETURN NEW; END IF;
 PERFORM 1 FROM consultas WHERE id=NEW.consulta_id FOR UPDATE;
 IF NEW.archivo !~ ('^'||NEW.consulta_id::text||'/[0-9a-f-]{36}\.(jpg|png|webp)$') THEN RAISE EXCEPTION 'Referencia inválida.'; END IF;
 IF (SELECT count(*) FROM consulta_mensajes WHERE consulta_id=NEW.consulta_id AND archivo IS NOT NULL)>=10 THEN RAISE EXCEPTION 'Esta consulta alcanzó el límite de referencias.'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.consulta_limitar_referencias() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consulta_limitar_referencias() TO service_role;
CREATE TRIGGER consulta_limitar_referencias BEFORE INSERT ON public.consulta_mensajes FOR EACH ROW EXECUTE FUNCTION public.consulta_limitar_referencias();
CREATE TABLE public.consulta_presupuestos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 consulta_id uuid NOT NULL REFERENCES public.consultas(id) ON DELETE CASCADE,
 detalle text NOT NULL CHECK (length(trim(detalle)) BETWEEN 2 AND 3000),
 total numeric(12,2) NOT NULL CHECK (total>0 AND total<=100000000),
 sena numeric(12,2) NOT NULL CHECK (sena>=0 AND sena<=total),
 equipo_id uuid NOT NULL REFERENCES public.equipo(id),
 fecha date NOT NULL,
 hora time NOT NULL,
 duracion integer NOT NULL CHECK (duracion BETWEEN 5 AND 720),
 vence_at timestamptz NOT NULL,
 estado text NOT NULL DEFAULT 'propuesto' CHECK (estado IN ('propuesto','aceptado','reemplazado','reservado')),
 aceptado_at timestamptz,
 turno_id uuid UNIQUE REFERENCES public.turnos(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX consulta_presupuesto_vigente ON public.consulta_presupuestos(consulta_id) WHERE estado IN ('propuesto','aceptado','reservado');
ALTER TABLE public.turnos ADD COLUMN presupuesto_id uuid UNIQUE REFERENCES public.consulta_presupuestos(id);
ALTER TABLE public.consultas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consulta_mensajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consulta_presupuestos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.consultas,public.consulta_mensajes,public.consulta_presupuestos FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.consultas,public.consulta_mensajes,public.consulta_presupuestos TO service_role;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES ('consulta-referencias','consulta-referencias',false,2097152,ARRAY['image/jpeg','image/png','image/webp'])
 ON CONFLICT (id) DO NOTHING;

CREATE FUNCTION public.consulta_proponer(p_slug text,p_consulta uuid,p_detalle text,p_total numeric,p_sena numeric,p_equipo uuid,p_fecha date,p_hora time,p_duracion integer,p_vence timestamptz)
RETURNS public.consulta_presupuestos LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE consulta consultas%ROWTYPE; presupuesto consulta_presupuestos%ROWTYPE;
BEGIN
 SELECT * INTO consulta FROM consultas WHERE id=p_consulta AND slug=p_slug FOR UPDATE;
 IF NOT FOUND OR consulta.estado<>'abierta' THEN RAISE EXCEPTION 'Consulta no disponible.'; END IF;
 IF p_fecha<current_date OR p_vence<=now() OR p_vence>now()+interval '30 days' THEN RAISE EXCEPTION 'Revisá las fechas del presupuesto.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM equipo e JOIN servicio_equipo se ON se.equipo_id=e.id WHERE e.id=p_equipo AND e.slug=p_slug AND e.activo IS TRUE AND se.servicio_id=consulta.servicio_id) THEN RAISE EXCEPTION 'Profesional no disponible.'; END IF;
 UPDATE consulta_presupuestos SET estado='reemplazado' WHERE consulta_id=p_consulta AND estado IN ('propuesto','aceptado');
 INSERT INTO consulta_presupuestos(consulta_id,detalle,total,sena,equipo_id,fecha,hora,duracion,vence_at)
 VALUES(p_consulta,p_detalle,p_total,p_sena,p_equipo,p_fecha,p_hora,p_duracion,p_vence) RETURNING * INTO presupuesto;
 RETURN presupuesto;
END $$;

CREATE FUNCTION public.consulta_aceptar(p_consumidor uuid,p_presupuesto uuid)
RETURNS public.consulta_presupuestos LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE consulta consultas%ROWTYPE; presupuesto consulta_presupuestos%ROWTYPE;
BEGIN
 SELECT c.* INTO consulta FROM consultas c JOIN consulta_presupuestos p ON p.consulta_id=c.id WHERE p.id=p_presupuesto AND c.consumidor_id=p_consumidor FOR UPDATE OF c;
 IF NOT FOUND OR consulta.estado<>'abierta' THEN RAISE EXCEPTION 'Consulta no disponible.'; END IF;
 SELECT * INTO presupuesto FROM consulta_presupuestos WHERE id=p_presupuesto FOR UPDATE;
 IF presupuesto.estado NOT IN ('propuesto','aceptado') OR presupuesto.vence_at<=now() THEN RAISE EXCEPTION 'El presupuesto cambió o venció.'; END IF;
 UPDATE consulta_presupuestos SET estado='aceptado',aceptado_at=coalesce(aceptado_at,now()) WHERE id=p_presupuesto RETURNING * INTO presupuesto;
 RETURN presupuesto;
END $$;

CREATE FUNCTION public.consulta_reservar_manual(p_slug text,p_presupuesto uuid)
RETURNS public.turnos LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE consulta consultas%ROWTYPE; presupuesto consulta_presupuestos%ROWTYPE; cliente consumidores%ROWTYPE; profesional equipo%ROWTYPE; servicio servicios%ROWTYPE; negocio usuarios%ROWTYPE; turno turnos%ROWTYPE;
BEGIN
 SELECT c.* INTO consulta FROM consultas c JOIN consulta_presupuestos p ON p.consulta_id=c.id WHERE p.id=p_presupuesto AND c.slug=p_slug FOR UPDATE OF c;
 IF NOT FOUND THEN RAISE EXCEPTION 'Consulta no disponible.'; END IF;
 SELECT * INTO presupuesto FROM consulta_presupuestos WHERE id=p_presupuesto FOR UPDATE;
 IF presupuesto.estado='reservado' THEN SELECT * INTO turno FROM turnos WHERE id=presupuesto.turno_id; RETURN turno; END IF;
 IF consulta.estado<>'abierta' OR presupuesto.estado<>'aceptado' OR presupuesto.vence_at<=now() THEN RAISE EXCEPTION 'El cliente debe aceptar un presupuesto vigente.'; END IF;
 IF (presupuesto.fecha+presupuesto.hora) AT TIME ZONE 'America/Argentina/Buenos_Aires'<=now() THEN RAISE EXCEPTION 'El horario ya pasó.'; END IF;
 SELECT * INTO negocio FROM usuarios WHERE slug=p_slug AND activo IS TRUE AND modo_agenda='presupuesto';
 IF NOT FOUND OR negocio.estado_suscripcion='suspendido' OR (negocio.fecha_vencimiento IS NOT NULL AND negocio.fecha_vencimiento<=now()) THEN RAISE EXCEPTION 'Negocio no disponible.'; END IF;
 SELECT * INTO cliente FROM consumidores WHERE id=consulta.consumidor_id AND activo IS TRUE AND email_verificado IS TRUE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cliente no disponible.'; END IF;
 SELECT * INTO servicio FROM servicios WHERE id=consulta.servicio_id AND slug=p_slug AND activo::text='true';
 IF NOT FOUND THEN RAISE EXCEPTION 'Servicio no disponible.'; END IF;
 SELECT * INTO profesional FROM equipo WHERE id=presupuesto.equipo_id AND slug=p_slug AND activo IS TRUE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM servicio_equipo WHERE servicio_id=servicio.id AND equipo_id=profesional.id) OR (servicio.owner_equipo_id IS NOT NULL AND servicio.owner_equipo_id<>profesional.id) THEN RAISE EXCEPTION 'Profesional no disponible.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('browse-cupo:'||p_slug||':'||presupuesto.fecha::text||':'||profesional.id::text,0));
 IF EXISTS(SELECT 1 FROM turnos t LEFT JOIN servicios s ON s.id=t.servicio_id WHERE t.slug=p_slug AND t.fecha=presupuesto.fecha AND t.estado IN ('confirmado','pendiente') AND (t.equipo_id=profesional.id OR (t.equipo_id IS NULL AND profesional."es_dueño" IS TRUE)) AND t.hora::time<presupuesto.hora+make_interval(mins=>presupuesto.duracion) AND t.hora::time+make_interval(mins=>coalesce(t.duracion_reservada,s.duracion,30))>presupuesto.hora) THEN RAISE EXCEPTION 'Ese horario ya fue reservado.'; END IF;
 INSERT INTO turnos(slug,nombre,apellido,email,telefono,fecha,hora,servicio_id,servicio_nombre,equipo_id,equipo_nombre,precio_cobrado,monto_pagado,estado,metodo_pago,pago_estado,duracion_reservada,consumidor_id,extras,monto_extras,tc_elegible,presupuesto_id)
 VALUES(p_slug,cliente.nombre_persona,cliente.apellido,cliente.email,cliente.telefono,presupuesto.fecha,presupuesto.hora,servicio.id,servicio.nombre,profesional.id,profesional.nombre,presupuesto.total,0,'confirmado','none','pendiente',presupuesto.duracion,cliente.id,'[]'::jsonb,0,false,presupuesto.id) RETURNING * INTO turno;
 UPDATE consulta_presupuestos SET estado='reservado',turno_id=turno.id WHERE id=presupuesto.id;
 UPDATE consultas SET estado='reservada' WHERE id=consulta.id;
 RETURN turno;
END $$;
REVOKE ALL ON FUNCTION public.consulta_proponer(text,uuid,text,numeric,numeric,uuid,date,time,integer,timestamptz),public.consulta_aceptar(uuid,uuid),public.consulta_reservar_manual(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consulta_proponer(text,uuid,text,numeric,numeric,uuid,date,time,integer,timestamptz),public.consulta_aceptar(uuid,uuid),public.consulta_reservar_manual(text,uuid) TO service_role;

CREATE FUNCTION public.consulta_guardar_cupo() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE profesional uuid; minutos integer; inicio time;
BEGIN
 IF NEW.estado NOT IN ('confirmado','pendiente') THEN RETURN NEW; END IF;
 SELECT id INTO profesional FROM equipo WHERE slug=NEW.slug AND "es_dueño" IS TRUE LIMIT 1;
 profesional:=coalesce(NEW.equipo_id,profesional);
 PERFORM pg_advisory_xact_lock(hashtextextended('browse-cupo:'||NEW.slug||':'||NEW.fecha::text||':'||coalesce(profesional::text,''),0));
 SELECT coalesce(NEW.duracion_reservada,duracion,30) INTO minutos FROM servicios WHERE id=NEW.servicio_id AND slug=NEW.slug;
 minutos:=coalesce(minutos,30); inicio:=NEW.hora::time;
 IF EXISTS(SELECT 1 FROM turnos t LEFT JOIN servicios s ON s.id=t.servicio_id WHERE t.id IS DISTINCT FROM NEW.id AND t.slug=NEW.slug AND t.fecha=NEW.fecha AND t.estado IN ('confirmado','pendiente') AND (NEW.presupuesto_id IS NOT NULL OR t.presupuesto_id IS NOT NULL) AND (t.equipo_id=profesional OR (t.equipo_id IS NULL AND profesional=(SELECT id FROM equipo WHERE slug=NEW.slug AND "es_dueño" IS TRUE LIMIT 1))) AND inicio<t.hora::time+make_interval(mins=>coalesce(t.duracion_reservada,s.duracion,30)) AND inicio+make_interval(mins=>minutos)>t.hora::time) THEN RAISE EXCEPTION 'Ese horario ya fue reservado.'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.consulta_guardar_cupo() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consulta_guardar_cupo() TO service_role;
CREATE TRIGGER consulta_cupo BEFORE INSERT OR UPDATE OF fecha,hora,equipo_id,estado,duracion_reservada ON public.turnos FOR EACH ROW EXECUTE FUNCTION public.consulta_guardar_cupo();
