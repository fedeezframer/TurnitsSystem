ALTER TABLE public.consumidores DROP CONSTRAINT consumidores_intereses_check;
ALTER TABLE public.consumidores ADD CONSTRAINT consumidores_intereses_check CHECK (cardinality(intereses) BETWEEN 1 AND 7 AND intereses <@ ARRAY['barberia','manicura','vehiculos','peluqueria','consultoria','tatuajes','otro']::text[]);
ALTER TABLE public.registros_consumidores DROP CONSTRAINT registros_consumidores_intereses_check;
ALTER TABLE public.registros_consumidores ADD CONSTRAINT registros_consumidores_intereses_check CHECK (cardinality(intereses) BETWEEN 1 AND 7 AND intereses <@ ARRAY['barberia','manicura','vehiculos','peluqueria','consultoria','tatuajes','otro']::text[]);
