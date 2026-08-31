-- PhotoVault Pro / Tracking La Nubia
-- Migración: ítem contractual de acta por elemento de inspección.
-- Ejecutar una sola vez en Supabase: SQL Editor > New query > Run.

BEGIN;

ALTER TABLE public.inspection_photos
  ADD COLUMN IF NOT EXISTS acta_item JSONB;

COMMENT ON COLUMN public.inspection_photos.acta_item IS
  'Ítem de acta seleccionado: código, descripción, unidad, cantidad contractual y capítulo.';

NOTIFY pgrst, 'reload schema';

COMMIT;
