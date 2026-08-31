-- PhotoVault Pro / Tracking La Nubia
-- Migración: calibres ampliados de cableado para MT y BT.
-- Alumbrado continúa limitado por la interfaz a 12, 10, 8 y 6.

BEGIN;

ALTER TABLE public.inspection_photos
  DROP CONSTRAINT IF EXISTS inspection_photos_cable_gauge_check;

ALTER TABLE public.inspection_photos
  ADD CONSTRAINT inspection_photos_cable_gauge_check
  CHECK (cable_gauge IS NULL OR cable_gauge IN (
    '12', '10', '8', '6', '4', '2', '1/0', '2/0', '3/0', '4/0', '250', '350', '500'
  ));

NOTIFY pgrst, 'reload schema';

COMMIT;
