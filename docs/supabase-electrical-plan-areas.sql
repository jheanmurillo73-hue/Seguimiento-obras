-- Amplía las áreas eléctricas del plano sin modificar los elementos civiles.
-- La capa eléctrica existente se convierte en Obras Eléctricas MT.

UPDATE public.inspection_photos
SET plan_area = 'electrical_mt'
WHERE plan_area = 'electrical';

ALTER TABLE public.inspection_photos
DROP CONSTRAINT IF EXISTS inspection_photos_plan_area_check;

ALTER TABLE public.inspection_photos
ADD CONSTRAINT inspection_photos_plan_area_check
CHECK (plan_area IN ('civil', 'electrical_mt', 'electrical_bt', 'electrical_lighting'));
