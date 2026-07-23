-- AGE SOCIALS · Recrutamento — campos extras do candidato
-- Novas perguntas: nível técnico, valores culturais, aprendizado, estilo ao errar,
-- e faixas de remuneração (diária freela + salário fixo pretendido).
-- Rode no SQL Editor do Supabase.

ALTER TABLE age_candidates
  ADD COLUMN IF NOT EXISTS tech_level         TEXT,          -- iniciante | intermediario | avancado | especialista
  ADD COLUMN IF NOT EXISTS culture_values     TEXT[] NOT NULL DEFAULT '{}',  -- ids de VALUE_OPTIONS ('values' é palavra reservada)
  ADD COLUMN IF NOT EXISTS learning_speed     TEXT,          -- id de LEARNING_OPTIONS
  ADD COLUMN IF NOT EXISTS mistake_style      TEXT,          -- id de MISTAKE_STYLE_OPTIONS
  ADD COLUMN IF NOT EXISTS day_rate_range     TEXT,          -- id de PAY_DAYRATE_OPTIONS
  ADD COLUMN IF NOT EXISTS fixed_salary_range TEXT;          -- id de PAY_FIXED_OPTIONS

COMMENT ON COLUMN age_candidates.tech_level         IS 'Autoavaliação de capacidade técnica';
COMMENT ON COLUMN age_candidates.culture_values     IS 'Valores culturais marcados (multi-seleção)';
COMMENT ON COLUMN age_candidates.learning_speed     IS 'Facilidade/estilo de aprendizagem';
COMMENT ON COLUMN age_candidates.mistake_style      IS 'Como assume/lida com os próprios erros';
COMMENT ON COLUMN age_candidates.day_rate_range     IS 'Faixa cobrada por diária (freela)';
COMMENT ON COLUMN age_candidates.fixed_salary_range IS 'Faixa de salário mensal pretendido em trabalho fixo';

-- Expor faixas de remuneração e nível técnico também na lista admin
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
  c.tech_level,
  c.day_rate_range,
  c.fixed_salary_range,

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
