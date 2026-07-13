-- Colaboradores atribuídos ao projeto (multi-seleção no modal Projetos)
ALTER TABLE age_projects
  ADD COLUMN IF NOT EXISTS assignees_json TEXT;

COMMENT ON COLUMN age_projects.assignees_json IS 'JSON array de usernames (age_users) atribuídos ao projeto';
