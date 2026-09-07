-- ============================================================
-- PANTONE MANAGER - REPARACIÓN DE TRIGGERS, RLS Y CREACIÓN DE ADMIN
-- Ejecutar en: Supabase Dashboard > SQL Editor > Run
-- ============================================================

-- 1. Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Asegurar que la tabla profiles existe
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Limpiar políticas antiguas que causan bucle infinito (Error 42P17)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin reads all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin updates profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles select policy" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update policy" ON public.profiles;
DROP POLICY IF EXISTS "Profiles insert policy" ON public.profiles;

-- 4. Función helper is_admin (SECURITY DEFINER para evaluar sin bucles)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- 5. Trigger protegido con manejo de excepciones (NUNCA fallará la creación de usuario)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Si ocurre cualquier error, no bloquear la creación del usuario en Supabase
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Nuevas políticas RLS limpias y eficientes
CREATE POLICY "Profiles select policy"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Profiles update policy"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Profiles insert policy"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id OR public.is_admin() OR auth.role() = 'service_role');

-- Actualizar política en audit_logs para no causar bucles
DROP POLICY IF EXISTS "Admin reads logs" ON public.audit_logs;
CREATE POLICY "Admin reads logs"
  ON public.audit_logs FOR SELECT
  USING (public.is_admin());

-- ============================================================
-- 7. CREAR O ACTUALIZAR EL USUARIO ADMIN AUTOMÁTICAMENTE
-- Usuario: admin (admin@taller.local)
-- Contraseña: admin123
-- ============================================================
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'admin@taller.local';

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      role,
      aud,
      confirmation_token
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'admin@taller.local',
      crypt('admin123', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"display_name":"admin"}',
      now(),
      now(),
      'authenticated',
      'authenticated',
      ''
    );
  ELSE
    UPDATE auth.users
    SET encrypted_password = crypt('admin123', gen_salt('bf')),
        email_confirmed_at = now()
    WHERE id = v_user_id;
  END IF;

  -- Insertar o actualizar el perfil como admin
  INSERT INTO public.profiles (id, email, display_name, role)
  VALUES (v_user_id, 'admin@taller.local', 'admin', 'admin')
  ON CONFLICT (id) DO UPDATE
  SET role = 'admin',
      display_name = 'admin',
      email = 'admin@taller.local';
END $$;
