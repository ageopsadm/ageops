-- AGE OPS · Notas — ideias, roteiros, compromissos, checklists e mapas mentais
-- Rode no SQL Editor do Supabase. Enquanto a tabela não existir, a aba Notas
-- guarda tudo no navegador e sobe para o banco no primeiro carregamento
-- depois de a tabela ser criada.

CREATE TABLE IF NOT EXISTS age_notes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  company_id   TEXT,                 -- empresa dona da nota (isolamento por conta)
  created_by   TEXT NOT NULL,        -- username de quem criou
  author_name  TEXT,

  kind         TEXT NOT NULL DEFAULT 'nota'
               CHECK (kind IN ('nota','ideia','roteiro','compromisso','checklist','mapa')),
  title        TEXT NOT NULL DEFAULT '',
  content      TEXT NOT NULL DEFAULT '',   -- HTML do editor (nota, ideia, roteiro, compromisso)
  data         JSONB NOT NULL DEFAULT '{}'::jsonb,
               -- checklist: {items:[{id,text,done}]}
               -- mapa:      {mindmap:{nodes:[{id,text,parent,x,y,color}]}}
               -- compromisso: {local, participantes, lembrete (min), notified_at}
  tags         JSONB NOT NULL DEFAULT '[]'::jsonb,
  color        TEXT DEFAULT '',
  pinned       BOOLEAN NOT NULL DEFAULT FALSE,
  archived     BOOLEAN NOT NULL DEFAULT FALSE,
  deleted      BOOLEAN NOT NULL DEFAULT FALSE,
  visibility   TEXT NOT NULL DEFAULT 'private'
               CHECK (visibility IN ('private','team')),
  due_at       TIMESTAMPTZ,          -- compromissos
  project_id   TEXT                  -- vínculo opcional com age_projects
);

CREATE INDEX IF NOT EXISTS idx_age_notes_company   ON age_notes(company_id);
CREATE INDEX IF NOT EXISTS idx_age_notes_owner     ON age_notes(created_by);
CREATE INDEX IF NOT EXISTS idx_age_notes_updated   ON age_notes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_age_notes_due       ON age_notes(due_at);

COMMENT ON TABLE age_notes IS 'Notas do app: ideias, roteiros, compromissos, checklists e mapas mentais';

CREATE OR REPLACE FUNCTION age_notes_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.updated_at IS NULL OR NEW.updated_at = OLD.updated_at THEN
    NEW.updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_age_notes_updated_at ON age_notes;
CREATE TRIGGER trg_age_notes_updated_at
BEFORE UPDATE ON age_notes
FOR EACH ROW EXECUTE FUNCTION age_notes_touch_updated_at();

-- Mesmo modelo das outras tabelas do app: RLS ligado com políticas abertas para
-- a chave anônima; o filtro por company_id acontece no app. Quando o
-- rls_multitenant.sql for aplicado, troque estas políticas pelas de tenant.
ALTER TABLE age_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS age_notes_select ON age_notes;
CREATE POLICY age_notes_select ON age_notes
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS age_notes_insert ON age_notes;
CREATE POLICY age_notes_insert ON age_notes
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS age_notes_update ON age_notes;
CREATE POLICY age_notes_update ON age_notes
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS age_notes_delete ON age_notes;
CREATE POLICY age_notes_delete ON age_notes
  FOR DELETE TO anon, authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON age_notes TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
