-- PhotoVault Pro / Tracking La Nubia
-- Migración: varias conducciones (MT, BT y Datos) dentro de un mismo tramo.
-- Ejecutar una sola vez en Supabase: SQL Editor > New query > Run.

BEGIN;

ALTER TABLE public.inspection_photos
  ADD COLUMN IF NOT EXISTS pipe_conduits JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Conserva los datos de los tramos históricos como una conducción inicial.
-- Los campos tramo, metraje y pipe_network_type se mantienen por compatibilidad.
UPDATE public.inspection_photos
SET pipe_conduits = jsonb_build_array(
  jsonb_build_object(
    'id', 'legacy-' || id,
    'networkType', CASE
      WHEN pipe_network_type IN ('media_tension', 'baja_tension', 'datos') THEN pipe_network_type
      ELSE 'baja_tension'
    END,
    'configuration', COALESCE(NULLIF(tramo, ''), CASE
      WHEN pipe_network_type = 'baja_tension' THEN '2x6"'
      ELSE '3x4"'
    END),
    'meters', COALESCE(NULLIF(metraje, ''), '0')
  )
)
WHERE COALESCE(pipe_conduits, '[]'::jsonb) = '[]'::jsonb
  AND (tramo IS NOT NULL OR metraje IS NOT NULL OR pipe_network_type IS NOT NULL OR pipe_color IS NOT NULL);

NOTIFY pgrst, 'reload schema';

COMMIT;
