-- AGE OPS · Projetos recorrentes
-- Rode no SQL Editor do Supabase (recomendado — o app tenta gravar estas colunas).
-- Opções na UI: até o fim do ano (a partir do mês de criação) · 3 · 6 · 12 meses.

ALTER TABLE age_projects
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS recurring_months INTEGER,
  ADD COLUMN IF NOT EXISTS recurring_group_id UUID,
  ADD COLUMN IF NOT EXISTS recurring_index INTEGER,
  ADD COLUMN IF NOT EXISTS recurring_parent_id UUID;

COMMENT ON COLUMN age_projects.is_recurring IS 'Projeto faz parte de uma série mensal recorrente';
COMMENT ON COLUMN age_projects.recurring_months IS 'Duração da série (ex.: meses até dez, ou 3/6/12)';
COMMENT ON COLUMN age_projects.recurring_group_id IS 'UUID compartilhado por todos os meses da série';
COMMENT ON COLUMN age_projects.recurring_index IS 'Índice do mês na série (1..N)';
COMMENT ON COLUMN age_projects.recurring_parent_id IS 'ID do projeto original que gerou a série';

CREATE INDEX IF NOT EXISTS idx_age_projects_recurring_group
  ON age_projects(recurring_group_id)
  WHERE recurring_group_id IS NOT NULL;
