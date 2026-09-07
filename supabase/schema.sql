-- ============================================
-- PANTONE MANAGER — Schema SQL para Supabase
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================

-- ============================================
-- 1. TABLA DE PERFILES (vinculada a auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Función auxiliar is_admin (SECURITY DEFINER para evitar recursión infinita en RLS)
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

-- Trigger: crear perfil automáticamente al registrar usuario
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
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 2. TABLA PANTONES (cabecera)
-- ============================================
CREATE TABLE pantones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  notas TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 3. TABLA INGREDIENTES (detalle de fórmula)
-- ============================================
CREATE TABLE formula_ingredientes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pantone_id UUID NOT NULL REFERENCES pantones(id) ON DELETE CASCADE,
  tinta_base TEXT NOT NULL,
  cantidad NUMERIC(10,4) NOT NULL CHECK (cantidad > 0),
  unidad TEXT NOT NULL CHECK (unidad IN ('kg', 'gr'))
);

-- ============================================
-- 4. TABLA AUDIT LOGS
-- ============================================
CREATE TABLE audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  user_email TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'BACKUP')),
  entity_type TEXT NOT NULL,
  entity_id UUID,
  entity_name TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 5. ÍNDICES
-- ============================================
CREATE INDEX idx_formula_pantone ON formula_ingredientes(pantone_id);
CREATE INDEX idx_pantones_nombre ON pantones(nombre);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);

-- ============================================
-- 6. ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pantones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formula_ingredientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Limpieza de políticas previas de profiles
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin reads all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin updates profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles select policy" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update policy" ON public.profiles;
DROP POLICY IF EXISTS "Profiles insert policy" ON public.profiles;

-- Profiles: cada usuario lee su propio perfil o admin lee todos (sin recursión)
CREATE POLICY "Profiles select policy"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

-- Profiles: usuarios editan su perfil o admin edita roles/datos
CREATE POLICY "Profiles update policy"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.is_admin());

-- Profiles: permitir inserción (por usuario o admin)
CREATE POLICY "Profiles insert policy"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id OR public.is_admin() OR auth.role() = 'service_role');

-- Pantones: todos los autenticados pueden leer
DROP POLICY IF EXISTS "Authenticated read pantones" ON public.pantones;
CREATE POLICY "Authenticated read pantones"
  ON public.pantones FOR SELECT
  TO authenticated
  USING (true);

-- Pantones: todos los autenticados pueden crear
DROP POLICY IF EXISTS "Authenticated insert pantones" ON public.pantones;
CREATE POLICY "Authenticated insert pantones"
  ON public.pantones FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Pantones: todos los autenticados pueden editar
DROP POLICY IF EXISTS "Authenticated update pantones" ON public.pantones;
CREATE POLICY "Authenticated update pantones"
  ON public.pantones FOR UPDATE
  TO authenticated
  USING (true);

-- Pantones: todos los autenticados pueden eliminar
DROP POLICY IF EXISTS "Authenticated delete pantones" ON public.pantones;
CREATE POLICY "Authenticated delete pantones"
  ON public.pantones FOR DELETE
  TO authenticated
  USING (true);

-- Ingredientes: misma política que pantones
DROP POLICY IF EXISTS "Authenticated read ingredientes" ON public.formula_ingredientes;
CREATE POLICY "Authenticated read ingredientes"
  ON public.formula_ingredientes FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated insert ingredientes" ON public.formula_ingredientes;
CREATE POLICY "Authenticated insert ingredientes"
  ON public.formula_ingredientes FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated update ingredientes" ON public.formula_ingredientes;
CREATE POLICY "Authenticated update ingredientes"
  ON public.formula_ingredientes FOR UPDATE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated delete ingredientes" ON public.formula_ingredientes;
CREATE POLICY "Authenticated delete ingredientes"
  ON public.formula_ingredientes FOR DELETE
  TO authenticated
  USING (true);

-- Audit logs: todos autenticados insertan
DROP POLICY IF EXISTS "Authenticated insert logs" ON public.audit_logs;
CREATE POLICY "Authenticated insert logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Audit logs: solo admin lee (usando is_admin para evitar recursión)
DROP POLICY IF EXISTS "Admin reads logs" ON public.audit_logs;
CREATE POLICY "Admin reads logs"
  ON public.audit_logs FOR SELECT
  USING (public.is_admin());

-- ============================================
-- 7. CREAR USUARIOS DEL TALLER (solo admin)
-- Email interno: usuario@taller.local
-- Login en la app: solo nombre de usuario + contraseña
-- ============================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.create_workshop_user(
  p_email text,
  p_password text,
  p_display_name text DEFAULT NULL,
  p_role text DEFAULT 'user'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_user_id uuid;
  v_display_name text;
  v_has_provider_id boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede crear usuarios';
  END IF;

  IF p_role IS NULL OR p_role NOT IN ('admin', 'user') THEN
    RAISE EXCEPTION 'Rol no válido';
  END IF;

  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres';
  END IF;

  v_email := lower(trim(p_email));
  IF v_email IS NULL OR v_email = '' OR v_email NOT LIKE '%@%' THEN
    RAISE EXCEPTION 'Email interno no válido';
  END IF;

  v_display_name := NULLIF(trim(COALESCE(p_display_name, '')), '');
  IF v_display_name IS NULL THEN
    v_display_name := split_part(v_email, '@', 1);
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    RAISE EXCEPTION 'Ya existe un usuario con ese nombre';
  END IF;

  v_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    v_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('display_name', v_display_name),
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'auth'
      AND table_name = 'identities'
      AND column_name = 'provider_id'
  ) INTO v_has_provider_id;

  IF v_has_provider_id THEN
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email),
      'email',
      v_user_id::text,
      now(),
      now(),
      now()
    );
  ELSE
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      v_user_id::text,
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email),
      'email',
      now(),
      now(),
      now()
    );
  END IF;

  INSERT INTO public.profiles (id, email, display_name, role)
  VALUES (v_user_id, v_email, v_display_name, p_role)
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name),
      role = EXCLUDED.role;

  RETURN json_build_object(
    'id', v_user_id,
    'email', v_email,
    'display_name', v_display_name,
    'role', p_role
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_workshop_user(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_workshop_user(text, text, text, text) TO authenticated;
