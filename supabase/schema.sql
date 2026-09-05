-- ============================================
-- PANTONE MANAGER — Schema SQL para Supabase
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================

-- ============================================
-- 1. TABLA DE PERFILES (vinculada a auth.users)
-- ============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger: crear perfil automáticamente al registrar usuario
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

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
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pantones ENABLE ROW LEVEL SECURITY;
ALTER TABLE formula_ingredientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: usuarios leen su propio perfil
CREATE POLICY "Users read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Profiles: admin lee todos los perfiles
CREATE POLICY "Admin reads all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Profiles: admin actualiza roles
CREATE POLICY "Admin updates profiles"
  ON profiles FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Pantones: todos los autenticados pueden leer
CREATE POLICY "Authenticated read pantones"
  ON pantones FOR SELECT
  TO authenticated
  USING (true);

-- Pantones: todos los autenticados pueden crear
CREATE POLICY "Authenticated insert pantones"
  ON pantones FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Pantones: todos los autenticados pueden editar
CREATE POLICY "Authenticated update pantones"
  ON pantones FOR UPDATE
  TO authenticated
  USING (true);

-- Pantones: todos los autenticados pueden eliminar
CREATE POLICY "Authenticated delete pantones"
  ON pantones FOR DELETE
  TO authenticated
  USING (true);

-- Ingredientes: misma política que pantones
CREATE POLICY "Authenticated read ingredientes"
  ON formula_ingredientes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated insert ingredientes"
  ON formula_ingredientes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated update ingredientes"
  ON formula_ingredientes FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated delete ingredientes"
  ON formula_ingredientes FOR DELETE
  TO authenticated
  USING (true);

-- Audit logs: todos autenticados insertan
CREATE POLICY "Authenticated insert logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Audit logs: solo admin lee
CREATE POLICY "Admin reads logs"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- NOTA: Tras registrar tu primer usuario,
-- ejecuta esto para hacerlo admin:
--
-- UPDATE profiles SET role = 'admin'
-- WHERE email = 'tu@email.com';
-- ============================================
