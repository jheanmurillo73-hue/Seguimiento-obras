-- PhotoVault Pro — reparación del restablecimiento administrativo
-- Este script NO elimina datos al instalarse.
-- Solo actualiza la función que se ejecuta después de confirmar RESTABLECER.
-- Perfiles, auth.users, roles, módulos permitidos y permisos no se modifican.

CREATE OR REPLACE FUNCTION public.reset_inspection_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.photovault_is_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede restablecer los datos de inspección.';
  END IF;

  -- WHERE explícito: requerido por la protección de Supabase de este proyecto.
  -- id es la clave primaria de cada tabla y no excluye registros operativos.
  DELETE FROM public.inspection_collections WHERE id IS NOT NULL;
  DELETE FROM public.inspection_activities WHERE id IS NOT NULL;
  DELETE FROM public.inspection_photos WHERE id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_inspection_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_inspection_data() TO authenticated;
NOTIFY pgrst, 'reload schema';
