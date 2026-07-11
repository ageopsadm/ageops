-- AGE SOCIALS · Recrutamento — Schema (adaptado do handoff com prefixo age_)
-- Rode em ordem no SQL Editor do Supabase.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1) AGE_CANDIDATES — 1 linha por candidatura
-- ============================================================
CREATE TABLE IF NOT EXISTS age_candidates (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Identificação
  name              TEXT NOT NULL,
  email             TEXT NOT NULL,
  city              TEXT,
  linkedin_url      TEXT,
  portfolio_url     TEXT,

  -- Experiência
  experience_years  NUMERIC(4,1),
  experience_text   TEXT,

  -- Interesses e ferramentas (arrays de strings)
  interests         TEXT[] NOT NULL DEFAULT '{}',   -- ids das funções: ['designer','motion']
  tools             TEXT[] NOT NULL DEFAULT '{}',   -- ['Figma','Photoshop']

  -- Estilo de trabalho (JSON: {pace:55,autonomy:75,...})
  style_profile     JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Respostas abertas
  culture_answer    TEXT,
  proud_project     TEXT,
  mistake           TEXT,

  -- Escolhas únicas
  routine           TEXT,  -- id: 'deep_focus', 'reactive', etc
  delivery          TEXT,  -- id: 'campaign', 'piece', etc

  -- Metadados / rastreio
  ref_source        TEXT,                -- ?ref=xxx (canal de origem)
  ip_address        INET,
  user_agent        TEXT,
  consent_lgpd      BOOLEAN NOT NULL DEFAULT FALSE,

  -- Fluxo admin
  status            TEXT NOT NULL DEFAULT 'novo'
                    CHECK (status IN ('novo','em_analise','entrevista','aprovado','arquivado')),
  admin_notes       TEXT
);

CREATE INDEX IF NOT EXISTS idx_age_candidates_status     ON age_candidates(status);
CREATE INDEX IF NOT EXISTS idx_age_candidates_created_at ON age_candidates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_age_candidates_email      ON age_candidates(email);
CREATE INDEX IF NOT EXISTS idx_age_candidates_ref_source ON age_candidates(ref_source);


-- ============================================================
-- 2) AGE_MATCH_RESULTS — output do algoritmo determinístico
-- ============================================================
CREATE TABLE IF NOT EXISTS age_match_results (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id      UUID NOT NULL REFERENCES age_candidates(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Função ideal
  top_role_id       TEXT NOT NULL,        -- 'designer', 'motion'...
  top_role_name     TEXT NOT NULL,
  top_match_pct     INTEGER NOT NULL,

  -- Top 3 (array de objetos: [{role_id, role_name, match_pct}])
  top3              JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Scores
  score_overall     INTEGER NOT NULL,
  score_cultural    INTEGER NOT NULL,
  score_technical   INTEGER NOT NULL,

  -- Senioridade
  seniority         TEXT NOT NULL
                    CHECK (seniority IN ('Promissor em desenvolvimento','Júnior','Pleno','Sênior')),

  -- Versão do algoritmo (permite recálculo se mudar pesos)
  algo_version      TEXT NOT NULL DEFAULT 'v1.0'
);

CREATE INDEX IF NOT EXISTS idx_age_match_candidate     ON age_match_results(candidate_id);
CREATE INDEX IF NOT EXISTS idx_age_match_top_role      ON age_match_results(top_role_id);
CREATE INDEX IF NOT EXISTS idx_age_match_seniority     ON age_match_results(seniority);
CREATE INDEX IF NOT EXISTS idx_age_match_score_overall ON age_match_results(score_overall DESC);


-- ============================================================
-- 3) AGE_AI_ANALYSIS — parecer qualitativo Claude
-- ============================================================
CREATE TABLE IF NOT EXISTS age_ai_analysis (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id      UUID NOT NULL REFERENCES age_candidates(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Status do job
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','processing','completed','failed')),
  error_message     TEXT,

  -- Output estruturado da Claude
  resumo_perfil            TEXT,
  parecer_geral            TEXT
                           CHECK (parecer_geral IN
                             ('recomendado','recomendado_com_ressalvas','nao_recomendado','revisar_manualmente')),
  highlights               TEXT[] DEFAULT '{}',
  red_flags                TEXT[] DEFAULT '{}',
  perguntas_entrevista     TEXT[] DEFAULT '{}',
  adequacao_cultural       INTEGER,     -- 0-100
  confidence               INTEGER,     -- 0-100

  -- Metadados
  model_used               TEXT,
  tokens_input             INTEGER,
  tokens_output            INTEGER,
  raw_response             JSONB
);

CREATE INDEX IF NOT EXISTS idx_age_analysis_candidate ON age_ai_analysis(candidate_id);
CREATE INDEX IF NOT EXISTS idx_age_analysis_status    ON age_ai_analysis(status);
CREATE INDEX IF NOT EXISTS idx_age_analysis_parecer   ON age_ai_analysis(parecer_geral);


-- ============================================================
-- 4) AGE_RECRUIT_LINKS — links rastreáveis (?ref=xxx)
-- ============================================================
CREATE TABLE IF NOT EXISTS age_recruit_links (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        TEXT,                       -- username do admin que gerou

  slug              TEXT NOT NULL UNIQUE,       -- ex: 'instagram_bio_jul26'
  channel           TEXT,                       -- 'Instagram', 'LinkedIn', 'Site'
  campaign          TEXT,                       -- 'Recrutamento Q3 2026'
  notes             TEXT,

  visits_count      INTEGER NOT NULL DEFAULT 0,
  submits_count     INTEGER NOT NULL DEFAULT 0,

  active            BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_age_links_slug   ON age_recruit_links(slug);
CREATE INDEX IF NOT EXISTS idx_age_links_active ON age_recruit_links(active);


-- ============================================================
-- Trigger: atualiza updated_at automaticamente em age_candidates
-- ============================================================
CREATE OR REPLACE FUNCTION age_recruit_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_age_candidates_updated_at ON age_candidates;
CREATE TRIGGER trg_age_candidates_updated_at
BEFORE UPDATE ON age_candidates
FOR EACH ROW EXECUTE FUNCTION age_recruit_update_updated_at();


-- ============================================================
-- Trigger: incrementa submits_count no link quando candidato submete
-- ============================================================
CREATE OR REPLACE FUNCTION age_recruit_increment_link_submits()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ref_source IS NOT NULL THEN
    UPDATE age_recruit_links
    SET submits_count = submits_count + 1
    WHERE slug = NEW.ref_source;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_age_candidates_increment_link ON age_candidates;
CREATE TRIGGER trg_age_candidates_increment_link
AFTER INSERT ON age_candidates
FOR EACH ROW EXECUTE FUNCTION age_recruit_increment_link_submits();


-- ============================================================
-- View: candidatos com dados agregados (lista admin)
-- ============================================================
CREATE OR REPLACE VIEW v_age_candidates_admin AS
SELECT
  c.id,
  c.created_at,
  c.name,
  c.email,
  c.city,
  c.experience_years,
  c.status,
  c.ref_source,

  m.top_role_name,
  m.top_role_id,
  m.top_match_pct,
  m.score_overall,
  m.score_cultural,
  m.score_technical,
  m.seniority,

  a.parecer_geral,
  a.status AS analysis_status,
  a.adequacao_cultural,
  a.resumo_perfil

FROM age_candidates c
LEFT JOIN age_match_results m ON m.candidate_id = c.id
LEFT JOIN age_ai_analysis  a ON a.candidate_id = c.id
ORDER BY c.created_at DESC;


-- ============================================================
-- RLS — políticas de acesso
-- O painel admin (age-ops) acessa com a chave anon, como o resto do app.
-- Submissão de candidato acontece SÓ pela edge function recruit-submit
-- (service role, que bypassa RLS) — por isso não há INSERT anon em candidates.
-- ============================================================
ALTER TABLE age_candidates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE age_match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE age_ai_analysis   ENABLE ROW LEVEL SECURITY;
ALTER TABLE age_recruit_links ENABLE ROW LEVEL SECURITY;

-- Candidatos: admin lê e atualiza (status, notas). Sem insert/delete anon.
DROP POLICY IF EXISTS age_candidates_select ON age_candidates;
CREATE POLICY age_candidates_select ON age_candidates
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS age_candidates_update ON age_candidates;
CREATE POLICY age_candidates_update ON age_candidates
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Matching e análise IA: admin só lê (escrita é da edge function).
DROP POLICY IF EXISTS age_match_results_select ON age_match_results;
CREATE POLICY age_match_results_select ON age_match_results
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS age_ai_analysis_select ON age_ai_analysis;
CREATE POLICY age_ai_analysis_select ON age_ai_analysis
  FOR SELECT TO anon, authenticated USING (true);

-- Links rastreáveis: admin lê, cria e edita (ativar/desativar).
DROP POLICY IF EXISTS age_recruit_links_select ON age_recruit_links;
CREATE POLICY age_recruit_links_select ON age_recruit_links
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS age_recruit_links_insert ON age_recruit_links;
CREATE POLICY age_recruit_links_insert ON age_recruit_links
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS age_recruit_links_update ON age_recruit_links;
CREATE POLICY age_recruit_links_update ON age_recruit_links
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
