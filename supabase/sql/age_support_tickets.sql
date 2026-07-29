-- AGE OPS · Suporte — relatos de bugs, dúvidas e melhorias
-- Rode no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS age_support_tickets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  company_id    TEXT,
  company_name  TEXT,
  username      TEXT NOT NULL,
  user_name     TEXT,
  user_email    TEXT,

  category      TEXT NOT NULL DEFAULT 'bug'
                CHECK (category IN ('bug','melhoria','duvida','outro')),
  priority      TEXT NOT NULL DEFAULT 'media'
                CHECK (priority IN ('baixa','media','alta','critica')),
  title         TEXT NOT NULL,
  description   TEXT NOT NULL,
  page_context  TEXT,

  status        TEXT NOT NULL DEFAULT 'aberto'
                CHECK (status IN ('aberto','em_andamento','resolvido','fechado')),
  admin_notes   TEXT,
  resolved_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_age_support_company   ON age_support_tickets(company_id);
CREATE INDEX IF NOT EXISTS idx_age_support_status    ON age_support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_age_support_created   ON age_support_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_age_support_username  ON age_support_tickets(username);

COMMENT ON TABLE age_support_tickets IS 'Tickets de suporte do app (bug, melhoria, dúvida)';

CREATE OR REPLACE FUNCTION age_support_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  IF NEW.status IN ('resolvido','fechado') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.resolved_at = COALESCE(NEW.resolved_at, NOW());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_age_support_updated_at ON age_support_tickets;
CREATE TRIGGER trg_age_support_updated_at
BEFORE UPDATE ON age_support_tickets
FOR EACH ROW EXECUTE FUNCTION age_support_update_updated_at();

ALTER TABLE age_support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS age_support_select ON age_support_tickets;
CREATE POLICY age_support_select ON age_support_tickets
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS age_support_insert ON age_support_tickets;
CREATE POLICY age_support_insert ON age_support_tickets
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS age_support_update ON age_support_tickets;
CREATE POLICY age_support_update ON age_support_tickets
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS age_support_delete ON age_support_tickets;
CREATE POLICY age_support_delete ON age_support_tickets
  FOR DELETE TO anon, authenticated USING (true);
