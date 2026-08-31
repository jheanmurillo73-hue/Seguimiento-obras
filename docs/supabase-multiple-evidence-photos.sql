-- Habilita una galería de evidencias por elemento del plano.
-- image_url se conserva como foto de portada para compatibilidad.

ALTER TABLE public.inspection_photos
ADD COLUMN IF NOT EXISTS image_urls TEXT;

UPDATE public.inspection_photos
SET image_urls = json_build_array(image_url)::text
WHERE image_urls IS NULL AND image_url IS NOT NULL;

NOTIFY pgrst, 'reload schema';
