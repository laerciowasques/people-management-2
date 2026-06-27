-- People Management 2.0 — Schema Supabase
-- Execute no SQL Editor do Supabase (Dashboard → SQL → New query)

-- Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Empresas ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  logo TEXT,
  primary_color TEXT DEFAULT '#3b82f6',
  manager_name TEXT,
  team_name TEXT,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Perfis de usuário (vinculado ao auth.users) ──────────────
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'company_manager'
    CHECK (role IN ('admin', 'company_manager', 'team_manager', 'hr', 'viewer')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Times ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  manager_id UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Colaboradores ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  manager_id UUID REFERENCES auth.users(id),
  data JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Inputs do gestor ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS manager_inputs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Timeline de desenvolvimento ────────────────────────────────
CREATE TABLE IF NOT EXISTS development_timeline (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Desafios ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  data JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Materiais Bússola ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS compass_materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Sínteses executivas ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS executive_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Auditoria ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity TEXT,
  entity_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Snapshot de dados do app (sync por usuário/empresa) ────────
CREATE TABLE IF NOT EXISTS app_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payload JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, user_id)
);

-- ─── Trigger: criar perfil ao registrar usuário ─────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_email CONSTANT TEXT := 'laercio_wasques@yahoo.com.br';
  is_admin BOOLEAN;
BEGIN
  is_admin := lower(trim(NEW.email)) = admin_email;

  INSERT INTO public.profiles (id, email, full_name, role, status)
  VALUES (
    NEW.id,
    lower(trim(NEW.email)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    CASE WHEN is_admin THEN 'admin' ELSE 'company_manager' END,
    CASE WHEN is_admin THEN 'approved' ELSE 'pending' END
  );

  INSERT INTO public.audit_logs (user_id, action, entity, metadata)
  VALUES (
    NEW.id,
    'user_registered',
    'profiles',
    jsonb_build_object('email', NEW.email, 'auto_approved', is_admin)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── Funções auxiliares ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND status = 'approved'
  );
$$;

CREATE OR REPLACE FUNCTION public.my_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_approved()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND status = 'approved'
  );
$$;

-- ─── RLS: profiles ──────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_admin_update" ON profiles
  FOR UPDATE USING (public.is_admin());

-- ─── RLS: companies ─────────────────────────────────────────────
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "companies_select" ON companies
  FOR SELECT USING (
    public.is_admin() OR id = public.my_company_id()
  );

CREATE POLICY "companies_insert" ON companies
  FOR INSERT WITH CHECK (auth.uid() = created_by AND public.is_approved());

CREATE POLICY "companies_update" ON companies
  FOR UPDATE USING (
    public.is_admin() OR id = public.my_company_id()
  );

-- ─── RLS: app_data ──────────────────────────────────────────────
ALTER TABLE app_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_data_select" ON app_data
  FOR SELECT USING (
    public.is_admin() OR (user_id = auth.uid() AND company_id = public.my_company_id())
  );

CREATE POLICY "app_data_upsert" ON app_data
  FOR ALL USING (user_id = auth.uid() AND public.is_approved())
  WITH CHECK (user_id = auth.uid() AND public.is_approved());

-- ─── RLS: tabelas por company_id ────────────────────────────────
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['teams','employees','manager_inputs','development_timeline','challenges','compass_materials','executive_summaries','audit_logs']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('
      CREATE POLICY %I ON %I FOR SELECT USING (
        public.is_admin() OR company_id = public.my_company_id()
      )', t || '_select', t);

    EXECUTE format('
      CREATE POLICY %I ON %I FOR INSERT WITH CHECK (
        public.is_approved() AND company_id = public.my_company_id()
      )', t || '_insert', t);

    EXECUTE format('
      CREATE POLICY %I ON %I FOR UPDATE USING (
        public.is_approved() AND company_id = public.my_company_id()
      )', t || '_update', t);

    EXECUTE format('
      CREATE POLICY %I ON %I FOR DELETE USING (
        public.is_approved() AND company_id = public.my_company_id()
      )', t || '_delete', t);
  END LOOP;
END $$;

-- Admin pode registrar auditoria global (ex.: aprovação de usuários)
CREATE POLICY "audit_logs_admin_insert" ON audit_logs
  FOR INSERT WITH CHECK (public.is_admin());

-- Índices
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_company ON profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_employees_company ON employees(company_id);
CREATE INDEX IF NOT EXISTS idx_app_data_user ON app_data(user_id, company_id);
