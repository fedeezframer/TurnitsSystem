-- Browse, Offers y T-Coins. Ejecutar completo después de las migraciones de registro.
BEGIN;
ALTER TABLE public.consumidores ADD COLUMN IF NOT EXISTS foto_url text NOT NULL DEFAULT '';
ALTER TABLE public.turnos ADD COLUMN IF NOT EXISTS consumidor_id uuid REFERENCES public.consumidores(id) ON DELETE SET NULL;
ALTER TABLE public.pagos_pendientes ADD COLUMN IF NOT EXISTS consumidor_id uuid REFERENCES public.consumidores(id) ON DELETE SET NULL;
ALTER TABLE public.pagos_pendientes ADD COLUMN IF NOT EXISTS browse_turno_id uuid REFERENCES public.turnos(id) ON DELETE SET NULL;
ALTER TABLE public.pagos_pendientes ADD COLUMN IF NOT EXISTS browse_payment_url text;
CREATE UNIQUE INDEX IF NOT EXISTS pagos_browse_reserva ON public.pagos_pendientes(browse_turno_id) WHERE browse_turno_id IS NOT NULL;
ALTER TABLE public.turnos ADD COLUMN IF NOT EXISTS browse_tipo text CHECK (browse_tipo IN ('offer','canje'));
ALTER TABLE public.turnos ADD COLUMN IF NOT EXISTS browse_referencia uuid;
ALTER TABLE public.turnos ADD COLUMN IF NOT EXISTS browse_cierre timestamptz;
ALTER TABLE public.turnos ADD COLUMN IF NOT EXISTS tc_gastados integer NOT NULL DEFAULT 0 CHECK (tc_gastados>=0);
ALTER TABLE public.turnos ADD COLUMN IF NOT EXISTS tc_elegible boolean NOT NULL DEFAULT false;
ALTER TABLE public.turnos ADD COLUMN IF NOT EXISTS tc_acreditado_centavos bigint NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS turnos_consumidor_fecha ON public.turnos(consumidor_id,fecha);

CREATE TABLE IF NOT EXISTS public.turnits_offers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text NOT NULL REFERENCES public.usuarios(slug) ON DELETE CASCADE,
 servicio_id uuid NOT NULL REFERENCES public.servicios(id) ON DELETE CASCADE,
 equipo_id uuid NOT NULL REFERENCES public.equipo(id) ON DELETE CASCADE,
 precio_minimo numeric(14,2) NOT NULL CHECK (precio_minimo>0), activo boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(servicio_id,equipo_id)
);
CREATE TABLE IF NOT EXISTS public.turnits_recompensas (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text NOT NULL REFERENCES public.usuarios(slug) ON DELETE CASCADE,
 nombre text NOT NULL CHECK(length(btrim(nombre)) BETWEEN 1 AND 100),
 tipo text NOT NULL CHECK(tipo IN ('servicio','producto')), objeto_id uuid NOT NULL,
 servicio_id uuid NOT NULL REFERENCES public.servicios(id) ON DELETE CASCADE,
 monedas integer NOT NULL CHECK(monedas BETWEEN 1 AND 100000),
 copago numeric(14,2) NOT NULL DEFAULT 0 CHECK(copago>=0),
 stock integer CHECK(stock>=0), activo boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.tc_billeteras (
 consumidor_id uuid PRIMARY KEY REFERENCES public.consumidores(id) ON DELETE CASCADE,
 saldo integer NOT NULL DEFAULT 0, gasto_centavos bigint NOT NULL DEFAULT 0 CHECK(gasto_centavos>=0)
);
CREATE TABLE IF NOT EXISTS public.tc_movimientos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), consumidor_id uuid NOT NULL REFERENCES public.consumidores(id) ON DELETE CASCADE,
 turno_id uuid REFERENCES public.turnos(id) ON DELETE SET NULL, monedas integer NOT NULL,
 centavos bigint NOT NULL DEFAULT 0, motivo text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tc_movimientos_consumidor ON public.tc_movimientos(consumidor_id,created_at DESC);
ALTER TABLE public.turnits_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turnits_recompensas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tc_billeteras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tc_movimientos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.turnits_offers,public.turnits_recompensas,public.tc_billeteras,public.tc_movimientos FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.turnits_offers,public.turnits_recompensas,public.tc_billeteras,public.tc_movimientos TO service_role;

-- Bloqueo compartido con las reservas normales: un Offer o canje nunca sobrevende un horario.
CREATE OR REPLACE FUNCTION public.browse_guardar_cupo() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE profesional uuid; minutos integer; inicio integer; fin integer; ocupados integer; especial boolean;
BEGIN
 IF TG_OP='UPDATE' AND OLD.browse_tipo='canje' AND OLD.estado='cancelado' AND NEW.estado IS DISTINCT FROM 'cancelado' THEN RAISE EXCEPTION 'Un canje cancelado debe reservarse de nuevo.'; END IF;
 IF NEW.estado NOT IN ('confirmado','pendiente') THEN RETURN NEW; END IF;
 SELECT id INTO profesional FROM equipo WHERE slug=NEW.slug AND "es_dueño" IS TRUE LIMIT 1;
 profesional:=coalesce(NEW.equipo_id,profesional);
 PERFORM pg_advisory_xact_lock(hashtextextended('browse-cupo:'||NEW.slug||':'||NEW.fecha::text||':'||coalesce(profesional::text,''),0));
 SELECT coalesce(NEW.duracion_reservada,duracion,30) INTO minutos FROM servicios WHERE id=NEW.servicio_id AND slug=NEW.slug;
 minutos:=coalesce(minutos,30); inicio:=extract(hour FROM NEW.hora::time)*60+extract(minute FROM NEW.hora::time); fin:=inicio+minutos;
 SELECT count(*),coalesce(bool_or(t.browse_tipo IS NOT NULL),false) INTO ocupados,especial FROM turnos t LEFT JOIN servicios s ON s.id=t.servicio_id
 WHERE t.id IS DISTINCT FROM NEW.id AND t.slug=NEW.slug AND t.fecha=NEW.fecha AND t.estado IN ('confirmado','pendiente')
 AND (t.equipo_id=profesional OR (t.equipo_id IS NULL AND profesional=(SELECT id FROM equipo WHERE slug=NEW.slug AND "es_dueño" IS TRUE LIMIT 1)))
 AND inicio < extract(hour FROM t.hora::time)*60+extract(minute FROM t.hora::time)+coalesce(t.duracion_reservada,s.duracion,30)
 AND fin > extract(hour FROM t.hora::time)*60+extract(minute FROM t.hora::time);
 IF ocupados>0 AND (NEW.browse_tipo IS NOT NULL OR especial) THEN RAISE EXCEPTION 'Ese horario ya fue reservado. Elegí otro.' USING ERRCODE='P0001'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS browse_cupo ON public.turnos;
CREATE TRIGGER browse_cupo BEFORE INSERT OR UPDATE OF fecha,hora,equipo_id,estado ON public.turnos FOR EACH ROW EXECUTE FUNCTION public.browse_guardar_cupo();

-- Sólo dinero efectivamente abonado online: las señas suman su importe real, no el total del servicio.
CREATE OR REPLACE FUNCTION public.tc_base_turno() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 NEW.tc_acreditado_centavos:=CASE WHEN NEW.consumidor_id IS NOT NULL AND NEW.tc_elegible AND NEW.browse_tipo IS DISTINCT FROM 'canje'
 AND NEW.metodo_pago='mercadopago' AND NEW.pago_estado='aprobado' AND NEW.estado='confirmado'
 THEN greatest(0,round(coalesce(NEW.monto_pagado,0)*100))::bigint ELSE 0 END;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.tc_actualizar_billetera() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE anterior bigint:=0; delta bigint; gasto bigint; monedas integer; reembolso integer:=0;
BEGIN
 IF NEW.consumidor_id IS NULL THEN RETURN NULL; END IF;
 IF TG_OP='UPDATE' THEN
  anterior:=OLD.tc_acreditado_centavos;
  IF NEW.browse_tipo='canje' AND NEW.estado='cancelado' AND OLD.estado IS DISTINCT FROM 'cancelado' THEN reembolso:=NEW.tc_gastados; END IF;
 END IF;
 delta:=NEW.tc_acreditado_centavos-anterior;
 IF delta=0 AND reembolso=0 THEN RETURN NULL; END IF;
 INSERT INTO tc_billeteras(consumidor_id) VALUES(NEW.consumidor_id) ON CONFLICT DO NOTHING;
 SELECT gasto_centavos INTO gasto FROM tc_billeteras WHERE consumidor_id=NEW.consumidor_id FOR UPDATE;
 monedas:=floor(greatest(0,gasto+delta)::numeric/1000000)::integer-floor(gasto::numeric/1000000)::integer;
 UPDATE tc_billeteras SET gasto_centavos=greatest(0,gasto+delta),saldo=saldo+monedas+reembolso WHERE consumidor_id=NEW.consumidor_id;
 INSERT INTO tc_movimientos(consumidor_id,turno_id,monedas,centavos,motivo) VALUES(NEW.consumidor_id,NEW.id,monedas+reembolso,delta,CASE WHEN reembolso>0 THEN 'canje_cancelado' WHEN delta<0 THEN 'pago_revertido' ELSE 'pago_online' END);
 IF reembolso>0 THEN UPDATE turnits_recompensas SET stock=stock+1,updated_at=now() WHERE id=NEW.browse_referencia AND stock IS NOT NULL; END IF;
 RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS tc_base ON public.turnos;
CREATE TRIGGER tc_base BEFORE INSERT OR UPDATE ON public.turnos FOR EACH ROW EXECUTE FUNCTION public.tc_base_turno();
DROP TRIGGER IF EXISTS tc_billetera ON public.turnos;
CREATE TRIGGER tc_billetera AFTER INSERT OR UPDATE ON public.turnos FOR EACH ROW EXECUTE FUNCTION public.tc_actualizar_billetera();

-- La reserva de Offers se inserta antes de cobrar; el mismo cupo sirve luego al confirmar el pago.
CREATE OR REPLACE FUNCTION public.browse_reservar(p_consumidor uuid,p_slug text,p_servicio uuid,p_equipo uuid,p_fecha date,p_hora time,p_recompensa uuid DEFAULT NULL,p_offer uuid DEFAULT NULL,p_precio numeric DEFAULT NULL,p_cierre timestamptz DEFAULT NULL)
RETURNS public.turnos LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c consumidores%ROWTYPE; s servicios%ROWTYPE; e equipo%ROWTYPE; n usuarios%ROWTYPE; r turnits_recompensas%ROWTYPE; o turnits_offers%ROWTYPE; t turnos%ROWTYPE; saldo_actual integer; precio numeric; restante numeric; parcial numeric; inicio timestamptz; extras_canje jsonb:='[]'; producto extras%ROWTYPE;
BEGIN
 SELECT * INTO c FROM consumidores WHERE id=p_consumidor AND activo IS TRUE AND email_verificado IS TRUE FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'La sesión no está habilitada.'; END IF;
 SELECT * INTO n FROM usuarios WHERE slug=p_slug AND activo IS TRUE;
 IF NOT FOUND OR n.estado_suscripcion='suspendido' OR (n.fecha_vencimiento IS NOT NULL AND n.fecha_vencimiento<=now()) THEN RAISE EXCEPTION 'El negocio no está disponible.'; END IF;
 SELECT * INTO s FROM servicios WHERE id=p_servicio AND slug=p_slug AND activo::text='true';
 IF NOT FOUND THEN RAISE EXCEPTION 'Servicio no disponible.'; END IF;
 SELECT * INTO e FROM equipo WHERE id=p_equipo AND slug=p_slug AND activo IS TRUE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM servicio_equipo WHERE servicio_id=s.id AND equipo_id=e.id) OR (s.owner_equipo_id IS NOT NULL AND s.owner_equipo_id<>e.id) THEN RAISE EXCEPTION 'Ese profesional no ofrece este servicio.'; END IF;
 inicio:=(p_fecha+p_hora) AT TIME ZONE 'America/Argentina/Buenos_Aires';
 IF inicio<=now() THEN RAISE EXCEPTION 'El horario ya pasó.'; END IF;
 IF (p_recompensa IS NULL)=(p_offer IS NULL) THEN RAISE EXCEPTION 'Elegí una oferta o recompensa.'; END IF;
 precio:=coalesce((SELECT precio_override FROM servicio_equipo WHERE servicio_id=s.id AND equipo_id=e.id),s.precio);
 IF p_recompensa IS NOT NULL THEN
  SELECT * INTO r FROM turnits_recompensas WHERE id=p_recompensa AND slug=p_slug AND activo FOR UPDATE;
  IF NOT FOUND OR r.servicio_id<>s.id OR (r.stock IS NOT NULL AND r.stock<=0) THEN RAISE EXCEPTION 'Este canje ya no está disponible.'; END IF;
  IF r.tipo='servicio' AND r.objeto_id<>s.id THEN RAISE EXCEPTION 'La recompensa no corresponde al servicio.'; END IF;
  IF r.tipo='producto' THEN
   SELECT * INTO producto FROM extras WHERE id=r.objeto_id AND slug=p_slug AND activo::text='true';
   IF NOT FOUND OR (producto.owner_equipo_id IS NOT NULL AND producto.owner_equipo_id<>e.id) THEN RAISE EXCEPTION 'Producto no disponible para este profesional.'; END IF;
   extras_canje:=jsonb_build_array(jsonb_build_object('id',producto.id,'nombre',producto.nombre,'cantidad',1,'precio',0,'tc_canje',true));
  END IF;
  INSERT INTO tc_billeteras(consumidor_id) VALUES(c.id) ON CONFLICT DO NOTHING;
  SELECT saldo INTO saldo_actual FROM tc_billeteras WHERE consumidor_id=c.id FOR UPDATE;
  IF saldo_actual<r.monedas THEN RAISE EXCEPTION 'No tenés suficientes T-Coins.'; END IF;
  precio:=CASE WHEN r.tipo='producto' THEN precio ELSE r.copago END;
  IF p_precio IS NULL OR abs(p_precio-precio)>.005 THEN RAISE EXCEPTION 'El importe adicional cambió. Actualizá la recompensa.'; END IF;
 ELSE
  SELECT * INTO o FROM turnits_offers WHERE id=p_offer AND slug=p_slug AND servicio_id=s.id AND equipo_id=e.id AND activo FOR SHARE;
  IF NOT FOUND OR o.precio_minimo>=precio THEN RAISE EXCEPTION 'Esta oferta ya no está disponible.'; END IF;
  IF EXISTS(SELECT 1 FROM turnos WHERE consumidor_id=c.id AND browse_tipo='offer' AND estado='pendiente' AND (fecha+hora::time) AT TIME ZONE 'America/Argentina/Buenos_Aires'>now()) THEN RAISE EXCEPTION 'Terminá primero el pago de tu oferta pendiente desde Tu agenda.'; END IF;
  IF p_cierre IS NULL OR p_cierre>inicio OR p_cierre<=now() THEN RAISE EXCEPTION 'La oferta ya finalizó.'; END IF;
  restante:=extract(epoch FROM p_cierre-now())/60;
  IF restante>60 THEN RAISE EXCEPTION 'La oferta todavía no comenzó.'; END IF;
  parcial:=CASE WHEN restante<=15 THEN 1 WHEN restante<=30 THEN .6 ELSE .2 END;
  precio:=round(precio-(precio-o.precio_minimo)*parcial,2);
  IF p_precio IS NULL OR abs(p_precio-precio)>.005 THEN RAISE EXCEPTION 'El precio cambió. Actualizá la oferta.'; END IF;
 END IF;
 INSERT INTO turnos(slug,nombre,apellido,telefono,email,fecha,hora,servicio_id,servicio_nombre,equipo_id,equipo_nombre,precio_cobrado,monto_pagado,extras,monto_extras,estado,metodo_pago,pago_estado,duracion_reservada,consumidor_id,browse_tipo,browse_referencia,browse_cierre,tc_gastados,tc_elegible)
 VALUES(p_slug,c.nombre_persona,c.apellido,c.telefono,c.email,p_fecha,p_hora,s.id,CASE WHEN p_recompensa IS NOT NULL THEN r.nombre ELSE s.nombre END,e.id,e.nombre||coalesce(' '||e.apellido,''),precio,0,extras_canje,0,CASE WHEN p_offer IS NULL THEN 'confirmado' ELSE 'pendiente' END,CASE WHEN p_offer IS NULL THEN 'none' ELSE 'mercadopago' END,CASE WHEN p_offer IS NULL THEN 'sin_pago' ELSE 'pendiente' END,coalesce(s.duracion,30),c.id,CASE WHEN p_offer IS NULL THEN 'canje' ELSE 'offer' END,coalesce(p_recompensa,p_offer),p_cierre,coalesce(r.monedas,0),p_offer IS NOT NULL) RETURNING * INTO t;
 IF p_recompensa IS NOT NULL THEN
  UPDATE tc_billeteras SET saldo=saldo-r.monedas WHERE consumidor_id=c.id;
  INSERT INTO tc_movimientos(consumidor_id,turno_id,monedas,motivo) VALUES(c.id,t.id,-r.monedas,'canje');
  UPDATE turnits_recompensas SET stock=stock-1,updated_at=now() WHERE id=r.id AND stock IS NOT NULL;
 END IF;
 RETURN t;
END $$;
REVOKE ALL ON FUNCTION public.browse_reservar(uuid,text,uuid,uuid,date,time,uuid,uuid,numeric,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.browse_reservar(uuid,text,uuid,uuid,date,time,uuid,uuid,numeric,timestamptz) TO service_role;
REVOKE ALL ON FUNCTION public.browse_guardar_cupo(),public.tc_base_turno(),public.tc_actualizar_billetera() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.browse_guardar_config(p_slug text,p_offers jsonb,p_recompensas jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o jsonb; r jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('browse-config:'||p_slug,0));
 IF EXISTS(SELECT 1 FROM turnits_offers WHERE id IN(SELECT (x->>'id')::uuid FROM jsonb_array_elements(p_offers)x) AND slug<>p_slug)
 OR EXISTS(SELECT 1 FROM turnits_recompensas WHERE id IN(SELECT (x->>'id')::uuid FROM jsonb_array_elements(p_recompensas)x) AND slug<>p_slug) THEN RAISE EXCEPTION 'Configuración de otro negocio.'; END IF;
 DELETE FROM turnits_offers WHERE slug=p_slug AND id NOT IN(SELECT (x->>'id')::uuid FROM jsonb_array_elements(p_offers)x);
 UPDATE turnits_recompensas SET activo=false WHERE slug=p_slug;
 FOR o IN SELECT * FROM jsonb_array_elements(p_offers) LOOP
  IF NOT EXISTS(SELECT 1 FROM servicios WHERE id=(o->>'servicio_id')::uuid AND slug=p_slug) OR NOT EXISTS(SELECT 1 FROM equipo WHERE id=(o->>'equipo_id')::uuid AND slug=p_slug) THEN RAISE EXCEPTION 'Elementos de otro negocio.'; END IF;
  INSERT INTO turnits_offers(id,slug,servicio_id,equipo_id,precio_minimo,activo) VALUES((o->>'id')::uuid,p_slug,(o->>'servicio_id')::uuid,(o->>'equipo_id')::uuid,(o->>'precio_minimo')::numeric,(o->>'activo')::boolean)
  ON CONFLICT(id) DO UPDATE SET servicio_id=excluded.servicio_id,equipo_id=excluded.equipo_id,precio_minimo=excluded.precio_minimo,activo=excluded.activo,updated_at=now();
 END LOOP;
 FOR r IN SELECT * FROM jsonb_array_elements(p_recompensas) LOOP
  IF EXISTS(SELECT 1 FROM turnits_recompensas WHERE id=(r->>'id')::uuid AND updated_at IS DISTINCT FROM (r->>'expected_updated_at')::timestamptz) THEN RAISE EXCEPTION 'El stock o la recompensa cambió. Recargá la configuración antes de guardar.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM servicios WHERE id=(r->>'servicio_id')::uuid AND slug=p_slug) THEN RAISE EXCEPTION 'Servicio de otro negocio.'; END IF;
  INSERT INTO turnits_recompensas(id,slug,nombre,tipo,objeto_id,servicio_id,monedas,copago,stock,activo) VALUES((r->>'id')::uuid,p_slug,r->>'nombre',r->>'tipo',(r->>'objeto_id')::uuid,(r->>'servicio_id')::uuid,(r->>'monedas')::integer,(r->>'copago')::numeric,(r->>'stock')::integer,(r->>'activo')::boolean)
  ON CONFLICT(id) DO UPDATE SET nombre=excluded.nombre,tipo=excluded.tipo,objeto_id=excluded.objeto_id,servicio_id=excluded.servicio_id,monedas=excluded.monedas,copago=excluded.copago,stock=excluded.stock,activo=excluded.activo,updated_at=now();
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.browse_guardar_config(text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.browse_guardar_config(text,jsonb,jsonb) TO service_role;

CREATE TABLE IF NOT EXISTS public.browse_cambios_email (
 consumidor_id uuid PRIMARY KEY REFERENCES public.consumidores(id) ON DELETE CASCADE,
 email text NOT NULL,codigo_hash text NOT NULL,intentos integer NOT NULL DEFAULT 0,
 vence timestamptz NOT NULL,enviado timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.browse_cambios_email ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.browse_cambios_email FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.browse_cambios_email TO service_role;
CREATE OR REPLACE FUNCTION public.browse_cambiar_email(p_consumidor uuid,p_hash text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c browse_cambios_email%ROWTYPE;
BEGIN
 SELECT * INTO c FROM browse_cambios_email WHERE consumidor_id=p_consumidor FOR UPDATE;
 IF NOT FOUND OR c.vence<=now() OR c.intentos>=5 THEN RETURN false; END IF;
 IF c.codigo_hash IS DISTINCT FROM p_hash THEN UPDATE browse_cambios_email SET intentos=intentos+1 WHERE consumidor_id=p_consumidor; RETURN false; END IF;
 UPDATE consumidores SET email=c.email WHERE id=p_consumidor AND activo IS TRUE;
 DELETE FROM browse_cambios_email WHERE consumidor_id=p_consumidor;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.browse_cambiar_email(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.browse_cambiar_email(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.tc_devolver_reserva_eliminada() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF OLD.browse_tipo='canje' AND OLD.estado IS DISTINCT FROM 'cancelado' AND OLD.tc_gastados>0 AND OLD.consumidor_id IS NOT NULL
 AND (OLD.fecha+OLD.hora::time) AT TIME ZONE 'America/Argentina/Buenos_Aires'>now() THEN
  UPDATE tc_billeteras SET saldo=saldo+OLD.tc_gastados WHERE consumidor_id=OLD.consumidor_id;
  INSERT INTO tc_movimientos(consumidor_id,monedas,motivo) VALUES(OLD.consumidor_id,OLD.tc_gastados,'canje_cancelado');
  UPDATE turnits_recompensas SET stock=stock+1,updated_at=now() WHERE id=OLD.browse_referencia AND stock IS NOT NULL;
 END IF;
 RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS tc_turno_eliminado ON public.turnos;
CREATE TRIGGER tc_turno_eliminado BEFORE DELETE ON public.turnos FOR EACH ROW EXECUTE FUNCTION public.tc_devolver_reserva_eliminada();
REVOKE ALL ON FUNCTION public.tc_devolver_reserva_eliminada() FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
