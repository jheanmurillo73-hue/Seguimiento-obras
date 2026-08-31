-- PhotoVault Pro — separación de Obras Civiles y Obras Eléctricas
-- No borra ni modifica los elementos civiles existentes.

ALTER TABLE public.inspection_photos
  ADD COLUMN IF NOT EXISTS plan_area TEXT NOT NULL DEFAULT 'civil';
ALTER TABLE public.inspection_photos
  ADD COLUMN IF NOT EXISTS electrical_type TEXT;
ALTER TABLE public.inspection_photos
  ADD COLUMN IF NOT EXISTS electrical_color TEXT;

ALTER TABLE public.inspection_photos
  DROP CONSTRAINT IF EXISTS inspection_photos_plan_area_check;
ALTER TABLE public.inspection_photos
  ADD CONSTRAINT inspection_photos_plan_area_check
  CHECK (plan_area IN ('civil', 'electrical'));

NOTIFY pgrst, 'reload schema';
