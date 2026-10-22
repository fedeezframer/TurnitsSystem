CREATE FUNCTION public.consulta_evento_presupuesto() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  INSERT INTO consulta_mensajes(consulta_id,autor,texto) VALUES(NEW.consulta_id,'negocio','Hay una nueva propuesta de presupuesto. Revisá el detalle antes de aceptarla.');
 ELSIF NEW.estado='aceptado' AND OLD.estado IS DISTINCT FROM NEW.estado THEN
  INSERT INTO consulta_mensajes(consulta_id,autor,texto) VALUES(NEW.consulta_id,'cliente','Presupuesto aceptado. Falta confirmar la reserva o completar el pago.');
 ELSIF NEW.estado='reservado' AND OLD.estado IS DISTINCT FROM NEW.estado THEN
  INSERT INTO consulta_mensajes(consulta_id,autor,texto) VALUES(NEW.consulta_id,'negocio','Reserva confirmada. Consultá el comprobante para ver el estado del pago y el saldo pendiente.');
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.consulta_evento_presupuesto() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consulta_evento_presupuesto() TO service_role;
CREATE TRIGGER consulta_evento_presupuesto AFTER INSERT OR UPDATE OF estado ON public.consulta_presupuestos FOR EACH ROW EXECUTE FUNCTION public.consulta_evento_presupuesto();
