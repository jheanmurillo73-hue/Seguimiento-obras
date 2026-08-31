-- PhotoVault Pro / Tracking La Nubia
-- Supabase Storage para el plano JPG activo y las fotos de evidencia.
-- Ejecutar una sola vez en Supabase: SQL Editor > New query > Run.

BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('photovault-media', 'photovault-media', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "photovault media lectura autenticada" ON storage.objects;
DROP POLICY IF EXISTS "photovault media carga autenticada" ON storage.objects;
DROP POLICY IF EXISTS "photovault media actualización autenticada" ON storage.objects;
DROP POLICY IF EXISTS "photovault media eliminación autenticada" ON storage.objects;

CREATE POLICY "photovault media lectura autenticada"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'photovault-media');

CREATE POLICY "photovault media carga autenticada"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'photovault-media');

CREATE POLICY "photovault media actualización autenticada"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'photovault-media')
WITH CHECK (bucket_id = 'photovault-media');

CREATE POLICY "photovault media eliminación autenticada"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'photovault-media');

COMMIT;
