-- NPS público (Age Ops) — referência de schema e índices
-- Rodar no SQL Editor do Supabase se quiser otimizar consultas por token.

CREATE INDEX IF NOT EXISTS idx_age_nps_campanhas_token ON age_nps_campanhas (token);
CREATE INDEX IF NOT EXISTS idx_age_nps_respostas_token ON age_nps_respostas (token);

-- Opcional: company_id em respostas (multi-tenant futuro)
-- ALTER TABLE age_nps_respostas ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES age_companies(company_id);

-- RLS sugerida (ajuste conforme políticas do projeto):
-- Campanhas: SELECT público por token ativo; INSERT/UPDATE só autenticado da empresa
-- Respostas: INSERT anônimo (anon); SELECT só usuários da mesma company_id da campanha
