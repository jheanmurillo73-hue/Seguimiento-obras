-- Añade el acta asignada y la preferencia de visibilidad de su rótulo en el plano.
-- Ejecutar una sola vez en Supabase SQL Editor.
ALTER TABLE public.inspection_photos
ADD COLUMN IF NOT EXISTS acta TEXT;

ALTER TABLE public.inspection_photos
ADD COLUMN IF NOT EXISTS show_acta_label BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.inspection_photos
ADD COLUMN IF NOT EXISTS acta_label_position TEXT NOT NULL DEFAULT 'derecha'
CHECK (acta_label_position IN ('arriba', 'abajo', 'izquierda', 'derecha'));

CREATE INDEX IF NOT EXISTS idx_inspection_photos_acta
ON public.inspection_photos (acta)
WHERE acta IS NOT NULL;
