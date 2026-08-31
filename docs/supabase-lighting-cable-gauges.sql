-- Amplía los calibres válidos de cable y conserva Alumbrado limitado en la interfaz a 12, 10, 8 y 6.
-- La interfaz solo presenta estos cuatro calibres dentro de Obras Eléctricas Alumbrado.

ALTER TABLE public.inspection_photos
DROP CONSTRAINT IF EXISTS inspection_photos_cable_gauge_check;

ALTER TABLE public.inspection_photos
ADD CONSTRAINT inspection_photos_cable_gauge_check
CHECK (cable_gauge IS NULL OR cable_gauge IN ('12', '10', '8', '6', '4', '2', '1/0', '2/0', '3/0', '4/0', '250', '350', '500'));

NOTIFY pgrst, 'reload schema';
