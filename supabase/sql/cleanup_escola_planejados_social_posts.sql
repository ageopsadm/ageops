-- Mantém 1 peça da Escola de Planejados e remove duplicatas (soft delete).
-- Ajuste filtros de company_id se necessário antes de executar.

WITH ranked AS (
  SELECT
    id,
    editorial_stage,
    row_number() OVER (
      ORDER BY
        CASE editorial_stage
          WHEN 'pronto' THEN 0
          WHEN 'aprovacao' THEN 1
          WHEN 'producao' THEN 2
          ELSE 3
        END,
        post_date DESC NULLS LAST,
        created_at DESC NULLS LAST
    ) AS rn
  FROM age_social_posts
  WHERE deleted IS NOT TRUE
    AND (
      lower(coalesce(project_name, '')) LIKE '%escola de planejados%'
      OR lower(coalesce(project_name, '')) LIKE '%escola planejados%'
      OR lower(coalesce(client_name, '')) LIKE '%escola de planejados%'
      OR lower(coalesce(material, '')) LIKE '%escola de planejados%'
    )
)
UPDATE age_social_posts p
SET deleted = true, updated_at = now()
FROM ranked r
WHERE p.id = r.id AND r.rn > 1;

WITH ranked AS (
  SELECT id, editorial_stage,
    row_number() OVER (
      ORDER BY
        CASE editorial_stage WHEN 'pronto' THEN 0 WHEN 'aprovacao' THEN 1 WHEN 'producao' THEN 2 ELSE 3 END,
        post_date DESC NULLS LAST,
        created_at DESC NULLS LAST
    ) AS rn
  FROM age_social_posts
  WHERE deleted IS NOT TRUE
    AND (
      lower(coalesce(project_name, '')) LIKE '%escola de planejados%'
      OR lower(coalesce(project_name, '')) LIKE '%escola planejados%'
      OR lower(coalesce(client_name, '')) LIKE '%escola de planejados%'
      OR lower(coalesce(material, '')) LIKE '%escola de planejados%'
    )
)
UPDATE age_social_posts p
SET editorial_stage = 'pronto', status = 'agendado', updated_at = now()
FROM ranked r
WHERE p.id = r.id AND r.rn = 1
  AND coalesce(r.editorial_stage, '') NOT IN ('pronto', 'postado');
