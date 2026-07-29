-- AGE OPS · Projetos recorrentes (3 / 6 / 12 meses)
-- Rode no SQL Editor do Supabase (opcional — o app gera as cópias mesmo sem estas colunas).

ALTER TABLE age_projects
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS recurring_months INTEGER,
  ADD COLUMN IF NOT EXISTS recurring_group_id UUID,
  ADD COLUMN IF NOT EXISTS recurring_index INTEGER,
  ADD COLUMN IF NOT EXISTS recurring_parent_id UUID;

COMMENT ON COLUMN age_projects.is_recurring IS 'Projeto faz parte de uma série mensal recorrente';
COMMENT ON COLUMN age_projects.recurring_months IS 'Duração da série: 3, 6 ou 12';
COMMENT ON COLUMN age_projects.recurring_group_id IS 'UUID compartilhado por todos os meses da série';
COMMENT ON COLUMN age_projects.recurring_index IS 'Índice do mês na série (1..N)';
COMMENT ON COLUMN age_projects.recurring_parent_id IS 'ID do projeto original que gerou a série';

CREATE INDEX IF NOT EXISTS idx_age_projects_recurring_group
  ON age_projects(recurring_group_id)
  WHERE recurring_group_id IS NOT NULL;
