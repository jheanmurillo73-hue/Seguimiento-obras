-- TRACKING LA NUBIA / PhotoVault Pro
-- Añade posiciones relativas (0–100 %) para el plano JPG cargado por el usuario.
-- Ejecutar una sola vez en Supabase: SQL Editor > New query > Run.

BEGIN;

ALTER TABLE public.inspection_photos
  ADD COLUMN IF NOT EXISTS plan_x NUMERIC CHECK (plan_x >= 0 AND plan_x <= 100),
  ADD COLUMN IF NOT EXISTS plan_y NUMERIC CHECK (plan_y >= 0 AND plan_y <= 100),
  ADD COLUMN IF NOT EXISTS plan_end_x NUMERIC CHECK (plan_end_x >= 0 AND plan_end_x <= 100),
  ADD COLUMN IF NOT EXISTS plan_end_y NUMERIC CHECK (plan_end_y >= 0 AND plan_end_y <= 100);

COMMENT ON COLUMN public.inspection_photos.plan_x IS 'Posición horizontal inicial en porcentaje del plano JPG (0 a 100).';
COMMENT ON COLUMN public.inspection_photos.plan_y IS 'Posición vertical inicial en porcentaje del plano JPG (0 a 100).';
COMMENT ON COLUMN public.inspection_photos.plan_end_x IS 'Posición horizontal final de una tubería en porcentaje del plano JPG (0 a 100).';
COMMENT ON COLUMN public.inspection_photos.plan_end_y IS 'Posición vertical final de una tubería en porcentaje del plano JPG (0 a 100).';

NOTIFY pgrst, 'reload schema';
COMMIT;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'inspection_photos'
  AND column_name IN ('plan_x', 'plan_y', 'plan_end_x', 'plan_end_y')
ORDER BY column_name;
