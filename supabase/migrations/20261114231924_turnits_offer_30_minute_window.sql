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
  IF restante>30 THEN RAISE EXCEPTION 'La oferta todavía no comenzó.'; END IF;
  parcial:=CASE WHEN restante<=15 THEN 1 ELSE .6 END;
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
