-- AGE OPS · Portal do cliente + entregas/diárias do projeto
-- Rode no SQL Editor do Supabase.

-- ============================================================
-- 1) ENTREGAS do projeto
-- ============================================================
CREATE TABLE IF NOT EXISTS age_project_deliveries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  company_id      TEXT NOT NULL,
  project_id      UUID,
  project_name    TEXT,
  client_name     TEXT,
  title           TEXT NOT NULL,
  description     TEXT,
  due_date        DATE,
  delivered_at    DATE,
  status          TEXT NOT NULL DEFAULT 'pendente'
                  CHECK (status IN ('pendente','em_andamento','enviada','aprovada','ajustes','cancelada')),
  assignee_username TEXT,
  assignee_name   TEXT,
  file_url        TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_age_deliv_company ON age_project_deliveries(company_id);
CREATE INDEX IF NOT EXISTS idx_age_deliv_project ON age_project_deliveries(project_id);
CREATE INDEX IF NOT EXISTS idx_age_deliv_status  ON age_project_deliveries(status);

-- ============================================================
-- 2) DIÁRIAS do projeto (gravações / dias de set)
-- ============================================================
CREATE TABLE IF NOT EXISTS age_project_diarias (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  company_id      TEXT NOT NULL,
  project_id      UUID,
  project_name    TEXT,
  client_name     TEXT,
  title           TEXT NOT NULL DEFAULT 'Diária de gravação',
  diaria_date     DATE NOT NULL,
  location        TEXT,
  status          TEXT NOT NULL DEFAULT 'pendente'
                  CHECK (status IN ('pendente','confirmada','executada','cancelada')),
  assignee_username TEXT,
  assignee_name   TEXT,
  notes           TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_age_diaria_company ON age_project_diarias(company_id);
CREATE INDEX IF NOT EXISTS idx_age_diaria_project ON age_project_diarias(project_id);
CREATE INDEX IF NOT EXISTS idx_age_diaria_date    ON age_project_diarias(diaria_date);

-- ============================================================
-- 3) CONTAS do cliente (portal)
-- ============================================================
CREATE TABLE IF NOT EXISTS age_client_users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  company_id      TEXT NOT NULL,
  company_name    TEXT,
  client_name     TEXT NOT NULL,          -- bate com age_projects.client_name
  name            TEXT NOT NULL,
  email           TEXT NOT NULL,
  password_hash   TEXT NOT NULL,          -- mesmo padrão do app (texto; migrar depois)
  phone           TEXT,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (company_id, email)
);

CREATE INDEX IF NOT EXISTS idx_age_client_users_email ON age_client_users(email);
CREATE INDEX IF NOT EXISTS idx_age_client_users_co    ON age_client_users(company_id, client_name);

-- ============================================================
-- 4) CONVITES do portal
-- ============================================================
CREATE TABLE IF NOT EXISTS age_client_invites (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  company_id      TEXT NOT NULL,
  company_name    TEXT,
  client_name     TEXT NOT NULL,
  project_id      UUID,
  email           TEXT,
  token           TEXT NOT NULL UNIQUE,
  created_by      TEXT,
  used_at         TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  active          BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_age_client_invites_token ON age_client_invites(token);

-- ============================================================
-- Triggers updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION age_portal_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_age_deliv_touch ON age_project_deliveries;
CREATE TRIGGER trg_age_deliv_touch BEFORE UPDATE ON age_project_deliveries
FOR EACH ROW EXECUTE FUNCTION age_portal_touch_updated_at();

DROP TRIGGER IF EXISTS trg_age_diaria_touch ON age_project_diarias;
CREATE TRIGGER trg_age_diaria_touch BEFORE UPDATE ON age_project_diarias
FOR EACH ROW EXECUTE FUNCTION age_portal_touch_updated_at();

DROP TRIGGER IF EXISTS trg_age_client_users_touch ON age_client_users;
CREATE TRIGGER trg_age_client_users_touch BEFORE UPDATE ON age_client_users
FOR EACH ROW EXECUTE FUNCTION age_portal_touch_updated_at();

-- ============================================================
-- RLS (mesmo padrão do restante do app)
-- ============================================================
ALTER TABLE age_project_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE age_project_diarias    ENABLE ROW LEVEL SECURITY;
ALTER TABLE age_client_users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE age_client_invites     ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY age_deliv_all ON age_project_deliveries FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY age_diaria_all ON age_project_diarias FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY age_client_users_all ON age_client_users FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY age_client_invites_all ON age_client_invites FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
