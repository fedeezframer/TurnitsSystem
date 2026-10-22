ALTER TABLE public.turnos ADD COLUMN presupuesto_detalle text;

CREATE TABLE public.consulta_checkouts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 presupuesto_id uuid NOT NULL UNIQUE REFERENCES public.consulta_presupuestos(id),
 importe numeric(12,2) NOT NULL CHECK (importe>0),
 vendedor_id text NOT NULL,
 preference_id text,
 payment_url text,
 revisar_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.consulta_pagos (
 payment_id text PRIMARY KEY,
 checkout_id uuid NOT NULL REFERENCES public.consulta_checkouts(id),
 importe numeric(12,2) NOT NULL CHECK (importe>0),
 estado text NOT NULL CHECK (estado IN ('reservado','reintegro_pendiente','reintegrado')),
 turno_id uuid REFERENCES public.turnos(id),
 refund_id text,
 intentos integer NOT NULL DEFAULT 0,
 reintentar_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX consulta_pagos_reintentos ON public.consulta_pagos(reintentar_at) WHERE estado='reintegro_pendiente';
CREATE INDEX consulta_checkouts_revisar ON public.consulta_checkouts(revisar_at);
ALTER TABLE public.consulta_checkouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consulta_pagos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.consulta_checkouts,public.consulta_pagos FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.consulta_checkouts,public.consulta_pagos TO service_role;

CREATE FUNCTION public.consulta_conciliar_pago(p_checkout uuid,p_pago text,p_importe numeric,p_disponible boolean)
RETURNS public.consulta_pagos LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE checkout consulta_checkouts%ROWTYPE; presupuesto consulta_presupuestos%ROWTYPE; consulta consultas%ROWTYPE; pago consulta_pagos%ROWTYPE; turno turnos%ROWTYPE;
BEGIN
 SELECT c.* INTO consulta FROM consultas c JOIN consulta_presupuestos p ON p.consulta_id=c.id JOIN consulta_checkouts ch ON ch.presupuesto_id=p.id WHERE ch.id=p_checkout FOR UPDATE OF c;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pago no disponible.'; END IF;
 SELECT p.* INTO presupuesto FROM consulta_presupuestos p JOIN consulta_checkouts ch ON ch.presupuesto_id=p.id WHERE ch.id=p_checkout FOR UPDATE OF p;
 SELECT * INTO checkout FROM consulta_checkouts WHERE id=p_checkout FOR UPDATE;
 SELECT * INTO pago FROM consulta_pagos WHERE payment_id=p_pago;
 IF FOUND THEN
  IF pago.checkout_id<>p_checkout THEN RAISE EXCEPTION 'Pago no disponible.'; END IF;
  RETURN pago;
 END IF;
 INSERT INTO consulta_pagos(payment_id,checkout_id,importe,estado) VALUES(p_pago,p_checkout,p_importe,'reintegro_pendiente') RETURNING * INTO pago;
 IF NOT p_disponible OR p_importe<>checkout.importe OR presupuesto.vence_at<=now() OR presupuesto.estado NOT IN ('aceptado','reservado') OR EXISTS(SELECT 1 FROM consulta_pagos WHERE checkout_id=p_checkout AND estado='reservado') THEN RETURN pago; END IF;
 BEGIN
  SELECT * INTO turno FROM consulta_reservar_manual(consulta.slug,presupuesto.id);
  IF turno.estado<>'confirmado' OR coalesce(turno.monto_pagado,0)<>0 OR turno.payment_id IS NOT NULL THEN RETURN pago; END IF;
  UPDATE turnos SET monto_pagado=p_importe,payment_id=p_pago,metodo_pago='mercadopago',tipo_cobro=CASE WHEN presupuesto.sena>0 THEN 'sena' ELSE 'total' END,pago_estado='aprobado',presupuesto_detalle=presupuesto.detalle WHERE id=turno.id;
  UPDATE consulta_pagos SET estado='reservado',turno_id=turno.id WHERE payment_id=p_pago RETURNING * INTO pago;
 EXCEPTION WHEN raise_exception OR unique_violation THEN
  NULL;
 END;
 RETURN pago;
END $$;
REVOKE ALL ON FUNCTION public.consulta_conciliar_pago(uuid,text,numeric,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consulta_conciliar_pago(uuid,text,numeric,boolean) TO service_role;

CREATE FUNCTION public.consulta_comprobante_snapshot() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF NEW.presupuesto_id IS NOT NULL THEN SELECT detalle INTO NEW.presupuesto_detalle FROM consulta_presupuestos WHERE id=NEW.presupuesto_id; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.consulta_comprobante_snapshot() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consulta_comprobante_snapshot() TO service_role;
CREATE TRIGGER consulta_comprobante_snapshot BEFORE INSERT ON public.turnos FOR EACH ROW EXECUTE FUNCTION public.consulta_comprobante_snapshot();
