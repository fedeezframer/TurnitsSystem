CREATE OR REPLACE FUNCTION public.consulta_conciliar_pago(p_checkout uuid,p_pago text,p_importe numeric,p_disponible boolean)
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
  UPDATE turnos SET monto_pagado=p_importe,payment_id=p_pago,metodo_pago='mercadopago',tipo_cobro=CASE WHEN p_importe<presupuesto.total THEN 'sena' ELSE 'total' END,pago_estado='aprobado',presupuesto_detalle=presupuesto.detalle WHERE id=turno.id;
  UPDATE consulta_pagos SET estado='reservado',turno_id=turno.id WHERE payment_id=p_pago RETURNING * INTO pago;
 EXCEPTION WHEN raise_exception OR unique_violation THEN
  NULL;
 END;
 RETURN pago;
END $$;
