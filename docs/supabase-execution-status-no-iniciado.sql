-- Estado operativo "No iniciado"
-- Ejecutar una vez en Supabase SQL Editor. No elimina registros existentes.

ALTER TABLE public.inspection_photos
  DROP CONSTRAINT IF EXISTS inspection_photos_execution_status_check;

ALTER TABLE public.inspection_photos
  ALTER COLUMN execution_status SET DEFAULT 'No iniciado';

ALTER TABLE public.inspection_photos
  ADD CONSTRAINT inspection_photos_execution_status_check
  CHECK (execution_status IN ('No iniciado', 'En proceso', 'Terminado'));

NOTIFY pgrst, 'reload schema';
