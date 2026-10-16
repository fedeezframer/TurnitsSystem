-- Gastos propios de cada sucursal. Los gastos anteriores conservan su alcance general.
BEGIN;
ALTER TABLE public.finanzas_gastos
  ADD COLUMN IF NOT EXISTS sucursal_id uuid REFERENCES public.sucursales(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS finanzas_gastos_sucursal_fecha_idx
  ON public.finanzas_gastos (slug, sucursal_id, fecha);
-- La sucursal de una notificación de turno sigue su historial, aunque el
-- profesional se cambie de sede posteriormente. No se copian avisos generales.
UPDATE public.notificaciones n
  SET data = COALESCE(n.data, '{}'::jsonb) || jsonb_build_object(
    'sucursal_id', COALESCE(t.sucursal_id::text, 'principal'))
  FROM public.turnos t
  WHERE n.slug = t.slug AND n.data->>'turno_id' = t.id::text
    AND NOT (COALESCE(n.data, '{}'::jsonb) ? 'sucursal_id');
NOTIFY pgrst, 'reload schema';
COMMIT;
