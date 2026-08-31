-- PhotoVault Pro — clasificación de redes para tramos de tubería
-- Este script NO elimina ni altera registros existentes.

ALTER TABLE public.inspection_photos
  ADD COLUMN IF NOT EXISTS pipe_network_type TEXT;

ALTER TABLE public.inspection_photos
  DROP CONSTRAINT IF EXISTS inspection_photos_pipe_network_type_check;

ALTER TABLE public.inspection_photos
  ADD CONSTRAINT inspection_photos_pipe_network_type_check
  CHECK (
    pipe_network_type IS NULL
    OR pipe_network_type IN ('media_tension', 'baja_tension', 'datos')
  );

NOTIFY pgrst, 'reload schema';
