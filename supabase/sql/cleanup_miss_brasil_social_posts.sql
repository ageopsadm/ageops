-- Remove peças Miss Brasil / Marcella em "Em produção" (soft delete).
-- Ajuste company_id se necessário antes de executar.

UPDATE age_social_posts
SET deleted = true, updated_at = now()
WHERE deleted IS NOT TRUE
  AND editorial_stage = 'producao'
  AND (
    lower(coalesce(project_name, '')) LIKE '%miss brasil%'
    OR lower(coalesce(material, '')) LIKE '%miss brasil%'
    OR (
      lower(coalesce(client_name, '')) LIKE '%marcella%'
      AND (
        lower(coalesce(project_name, '')) LIKE '%miss%'
        OR lower(coalesce(material, '')) LIKE '%miss%'
      )
    )
  );
