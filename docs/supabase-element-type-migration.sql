-- Restauración de clasificación de elementos para Tracking La Nubia.
-- Ejecútalo en Supabase SQL Editor como administrador del proyecto.
-- La actualización identifica como cámara los registros históricos con camera_code.

BEGIN;

ALTER TABLE public.inspection_photos
  ADD COLUMN IF NOT EXISTS element_type TEXT;

-- Respaldo no destructivo de la clasificación y rasgos usados para recuperarla.
-- Se crea una sola vez y permite revisar o revertir la operación posteriormente.
CREATE TABLE IF NOT EXISTS public.inspection_photos_element_type_backup_20260827 AS
SELECT id, element_type AS original_element_type, camera_code, camera_type, tramo,
       metraje, electrical_type, plan_area, updated_at
FROM public.inspection_photos;

UPDATE public.inspection_photos
SET element_type = CASE
  WHEN electrical_type IS NOT NULL THEN 'electrico'
  WHEN tramo IS NOT NULL OR metraje IS NOT NULL THEN 'tuberia'
  WHEN camera_code IS NOT NULL THEN 'camara'
  ELSE 'camara'
END
WHERE element_type IS NULL;

-- Conversión confirmada: todas las cajas existentes pasan a ser cámaras.
UPDATE public.inspection_photos
SET element_type = 'camara',
    camera_code = COALESCE(NULLIF(camera_code, ''), 'SB850'),
    camera_type = COALESCE(NULLIF(camera_type, ''), 'MT')
WHERE element_type = 'caja';

ALTER TABLE public.inspection_photos
  ALTER COLUMN element_type SET DEFAULT 'caja';

ALTER TABLE public.inspection_photos
  ALTER COLUMN element_type SET NOT NULL;

ALTER TABLE public.inspection_photos
  DROP CONSTRAINT IF EXISTS inspection_photos_element_type_check;

ALTER TABLE public.inspection_photos
  ADD CONSTRAINT inspection_photos_element_type_check
  CHECK (element_type IN ('caja', 'camara', 'tuberia', 'electrico'));

CREATE INDEX IF NOT EXISTS idx_inspection_photos_element_type
  ON public.inspection_photos (element_type);

COMMIT;

-- Verificación posterior: deben aparecer las cámaras restauradas.
SELECT element_type, COUNT(*) AS total
FROM public.inspection_photos
GROUP BY element_type
ORDER BY element_type;
