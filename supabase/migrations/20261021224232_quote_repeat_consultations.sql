ALTER TABLE public.consultas DROP CONSTRAINT consultas_consumidor_id_servicio_id_key;
CREATE UNIQUE INDEX consultas_una_abierta_por_servicio ON public.consultas(consumidor_id,servicio_id) WHERE estado='abierta';
