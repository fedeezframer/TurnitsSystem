ALTER TABLE public.promociones
  ADD COLUMN hora_desde time without time zone,
  ADD COLUMN hora_hasta time without time zone,
  ADD CONSTRAINT promociones_horas_check CHECK (
    (hora_desde IS NULL AND hora_hasta IS NULL)
    OR (hora_desde IS NOT NULL AND hora_hasta IS NOT NULL AND hora_desde < hora_hasta)
  );
