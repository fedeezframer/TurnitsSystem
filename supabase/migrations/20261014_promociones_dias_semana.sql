-- Días opcionales: NULL conserva la vigencia diaria de todas las promos actuales.
BEGIN;
ALTER TABLE public.promociones ADD COLUMN IF NOT EXISTS dias_semana smallint[];
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.promociones'::regclass AND conname='promociones_dias_semana_check') THEN
    ALTER TABLE public.promociones ADD CONSTRAINT promociones_dias_semana_check
    CHECK (dias_semana IS NULL OR (cardinality(dias_semana) BETWEEN 1 AND 7
      AND array_position(dias_semana, NULL) IS NULL
      AND dias_semana <@ ARRAY[0,1,2,3,4,5,6]::smallint[]));
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';
COMMIT;
