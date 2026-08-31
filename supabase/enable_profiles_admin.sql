-- TRACKING LA NUBIA / PhotoVault Pro
-- Ejecutar UNA VEZ en Supabase: SQL Editor > New query > Run.
-- Este script no elimina perfiles ni usuarios de Auth.
-- Administrador principal fijo: jheanmurillo73@gmail.com

BEGIN;

-- 1) Estructura requerida por el panel de administración.
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'inspector' CHECK (role IN ('admin', 'inspector')),
  allowed_modules JSONB NOT NULL DEFAULT '["dashboard", "map", "upload", "history"]'::jsonb,
  terminal TEXT DEFAULT 'Terminal A-12',
  department TEXT DEFAULT 'Garantía Estructural y Calidad',
  phone TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  email_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS allowed_modules JSONB;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS terminal TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_confirmed_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'inspector';
ALTER TABLE public.profiles ALTER COLUMN allowed_modules
  SET DEFAULT '["dashboard", "map", "upload", "history"]'::jsonb;

UPDATE public.profiles
SET
  name = COALESCE(NULLIF(name, ''), split_part(email, '@', 1)),
  role = CASE WHEN role IN ('admin', 'inspector') THEN role ELSE 'inspector' END,
  allowed_modules = COALESCE(allowed_modules, '["dashboard", "map", "upload", "history"]'::jsonb),
  updated_at = timezone('utc'::text, now())
WHERE name IS NULL OR name = '' OR role IS NULL OR role NOT IN ('admin', 'inspector') OR allowed_modules IS NULL;

-- 2) Crear perfiles para las cuentas de Auth que aún no lo tengan.
INSERT INTO public.profiles (
  id, name, email, role, allowed_modules, email_confirmed_at, created_at, updated_at
)
SELECT
  u.id::text,
  COALESCE(NULLIF(u.raw_user_meta_data ->> 'full_name', ''), split_part(u.email, '@', 1)),
  u.email,
  CASE WHEN lower(u.email) = 'jheanmurillo73@gmail.com' THEN 'admin' ELSE 'inspector' END,
  CASE
    WHEN lower(u.email) = 'jheanmurillo73@gmail.com'
      THEN '["dashboard", "map", "database", "upload", "history", "activity", "settings"]'::jsonb
    ELSE '["dashboard", "map", "upload", "history"]'::jsonb
  END,
  u.email_confirmed_at,
  timezone('utc'::text, now()),
  timezone('utc'::text, now())
FROM auth.users AS u
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  name = COALESCE(NULLIF(public.profiles.name, ''), EXCLUDED.name),
  email_confirmed_at = EXCLUDED.email_confirmed_at,
  updated_at = timezone('utc'::text, now());

-- 3) Garantizar el rol y módulos completos del administrador principal.
UPDATE public.profiles
SET
  role = 'admin',
  allowed_modules = '["dashboard", "map", "database", "upload", "history", "activity", "settings"]'::jsonb,
  updated_at = timezone('utc'::text, now())
WHERE lower(email) = 'jheanmurillo73@gmail.com';

-- 4) Funciones seguras para evaluar permisos sin recursión de RLS.
CREATE OR REPLACE FUNCTION public.photovault_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT lower(email) = 'jheanmurillo73@gmail.com' OR role = 'admin'
    FROM public.profiles
    WHERE id::text = auth.uid()::text
  ), false);
$$;

CREATE OR REPLACE FUNCTION public.enforce_photovault_profile_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(COALESCE(NEW.email, '')) = 'jheanmurillo73@gmail.com' THEN
    NEW.role := 'admin';
    NEW.allowed_modules := '["dashboard", "map", "database", "upload", "history", "activity", "settings"]'::jsonb;
  ELSIF TG_OP = 'INSERT' THEN
    NEW.role := 'inspector';
    NEW.allowed_modules := COALESCE(NEW.allowed_modules, '["dashboard", "map", "upload", "history"]'::jsonb);
  ELSIF NOT public.photovault_is_admin() THEN
    NEW.role := OLD.role;
    NEW.allowed_modules := OLD.allowed_modules;
  END IF;

  -- Solo el proceso de Auth puede actualizar esta marca en un perfil existente.
  IF TG_OP = 'UPDATE' AND auth.uid() IS NOT NULL THEN
    NEW.email_confirmed_at := OLD.email_confirmed_at;
  END IF;
  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_photovault_auth_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, email_confirmed_at, role, allowed_modules)
  VALUES (
    NEW.id::text,
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''), split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.email_confirmed_at,
    CASE WHEN lower(NEW.email) = 'jheanmurillo73@gmail.com' THEN 'admin' ELSE 'inspector' END,
    CASE
      WHEN lower(NEW.email) = 'jheanmurillo73@gmail.com'
        THEN '["dashboard", "map", "database", "upload", "history", "activity", "settings"]'::jsonb
      ELSE '["dashboard", "map", "upload", "history"]'::jsonb
    END
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    email_confirmed_at = EXCLUDED.email_confirmed_at,
    updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_photovault_profile_access ON public.profiles;
CREATE TRIGGER protect_photovault_profile_access
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_photovault_profile_access();

DROP TRIGGER IF EXISTS sync_photovault_auth_profile ON auth.users;
CREATE TRIGGER sync_photovault_auth_profile
AFTER INSERT OR UPDATE OF email, email_confirmed_at ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.sync_photovault_auth_profile();

-- 5) RLS: cada usuario ve su perfil y los administradores ven y administran todos.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso total a perfiles" ON public.profiles;
DROP POLICY IF EXISTS "Perfil propio o administracion" ON public.profiles;
DROP POLICY IF EXISTS "Crear perfil propio" ON public.profiles;
DROP POLICY IF EXISTS "Actualizar perfil propio o administracion" ON public.profiles;

CREATE POLICY "Perfil propio o administracion"
ON public.profiles FOR SELECT
USING (id::text = auth.uid()::text OR public.photovault_is_admin());

CREATE POLICY "Crear perfil propio"
ON public.profiles FOR INSERT
WITH CHECK (id::text = auth.uid()::text);

CREATE POLICY "Actualizar perfil propio o administracion"
ON public.profiles FOR UPDATE
USING (id::text = auth.uid()::text OR public.photovault_is_admin())
WITH CHECK (id::text = auth.uid()::text OR public.photovault_is_admin());

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
REVOKE ALL ON FUNCTION public.photovault_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.photovault_is_admin() TO authenticated;

-- Refresca el esquema que utiliza la API REST de Supabase.
NOTIFY pgrst, 'reload schema';

COMMIT;

-- Verificación: el correo administrador debe aparecer con role = admin.
SELECT id, email, role, allowed_modules, email_confirmed_at
FROM public.profiles
ORDER BY lower(email);
