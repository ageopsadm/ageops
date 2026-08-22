-- ============================================================
-- AGE · Reisolação — projetos/usuários que caíram na OWNAGE
--
-- Sintoma: conta nova (ex. futdart) cria um projeto e ele aparece no
-- dashboard da gustavowng. Causa típica: a linha ganhou o company_id da
-- OWNAGE, ou nasceu sem dono e a gustavowng via todo órfão.
--
-- 1) Rode o bloco DIAGNÓSTICO. Confira os nomes.
-- 2) Rode o bloco REPARO. É idempotente.
-- ============================================================

-- Empresa dona do histórico real
-- aa47f125-4b29-4c2d-b367-88b912f1b33e

-- ───────── DIAGNÓSTICO (só leitura) ─────────

-- Usuários apontando para a OWNAGE que não são o time dela
SELECT u.username, u.email, u.role, u.company_id, u.company_name,
       c.name AS empresa_que_ele_é_dono
  FROM public.age_users u
  LEFT JOIN public.age_companies c
    ON lower(c.owner_username) = lower(u.username)
 WHERE u.company_id::text = 'aa47f125-4b29-4c2d-b367-88b912f1b33e'
   AND lower(coalesce(u.username, '')) NOT IN (
     'gustavowng','vraulin','paulin','ken','vic','pedrobarreto','paulomunir'
   )
 ORDER BY u.username;

-- Projetos na OWNAGE criados por outra conta
SELECT p.id, p.created_by, p.company_id,
       coalesce(p.client_name, p.client) AS cliente,
       coalesce(p.project_name, p.title, p.name) AS projeto,
       p.created_at
  FROM public.age_projects p
 WHERE p.company_id::text = 'aa47f125-4b29-4c2d-b367-88b912f1b33e'
   AND lower(coalesce(p.created_by, '')) NOT IN (
     'gustavowng','vraulin','paulin','ken','vic','pedrobarreto','paulomunir','system','unknown',''
   )
 ORDER BY p.created_at DESC;

-- Projetos sem empresa (qualquer um)
SELECT p.id, p.created_by, p.company_id,
       coalesce(p.client_name, p.client) AS cliente,
       coalesce(p.project_name, p.title, p.name) AS projeto
  FROM public.age_projects p
 WHERE p.company_id IS NULL
 ORDER BY p.created_at DESC NULLS LAST;


-- ───────── REPARO ─────────
-- 1) Usuário que é dono de uma empresa própria, mas está colado na OWNAGE
--    → volta para a empresa que ele criou no cadastro.
UPDATE public.age_users u
   SET company_id   = c.id,
       company_name = coalesce(c.name, u.company_name)
  FROM public.age_companies c
 WHERE lower(c.owner_username) = lower(u.username)
   AND u.company_id::text = 'aa47f125-4b29-4c2d-b367-88b912f1b33e'
   AND c.id::text <> 'aa47f125-4b29-4c2d-b367-88b912f1b33e'
   AND lower(coalesce(u.username, '')) NOT IN (
     'gustavowng','vraulin','paulin','ken','vic','pedrobarreto','paulomunir'
   );

-- 2) Projetos na OWNAGE cujo created_by é de outra empresa
--    → vão para a empresa atual desse usuário.
UPDATE public.age_projects p
   SET company_id = u.company_id
  FROM public.age_users u
 WHERE lower(coalesce(p.created_by, '')) = lower(u.username)
   AND p.company_id::text = 'aa47f125-4b29-4c2d-b367-88b912f1b33e'
   AND u.company_id IS NOT NULL
   AND u.company_id::text <> 'aa47f125-4b29-4c2d-b367-88b912f1b33e';

-- 3) Projetos órfãos: herdam a empresa de quem criou.
UPDATE public.age_projects p
   SET company_id = u.company_id
  FROM public.age_users u
 WHERE p.company_id IS NULL
   AND lower(coalesce(p.created_by, '')) = lower(u.username)
   AND u.company_id IS NOT NULL;

-- 4) Fechamentos / pagamentos / relatórios que apontam para projeto
--    já movido: acompanham o company_id do projeto.
DO $$
DECLARE
  ownage text := 'aa47f125-4b29-4c2d-b367-88b912f1b33e';
BEGIN
  IF to_regclass('public.age_fechamento') IS NOT NULL THEN
    BEGIN
      UPDATE public.age_fechamento f
         SET company_id = p.company_id
        FROM public.age_projects p
       WHERE f.project_id::text = p.id::text
         AND p.company_id IS NOT NULL
         AND (f.company_id IS DISTINCT FROM p.company_id);
    EXCEPTION WHEN undefined_column THEN
      RAISE NOTICE 'age_fechamento sem company_id ou project_id — pulado';
    END;
  END IF;

  IF to_regclass('public.age_relatorios') IS NOT NULL THEN
    BEGIN
      UPDATE public.age_relatorios r
         SET company_id = p.company_id
        FROM public.age_projects p
       WHERE r.project_id::text = p.id::text
         AND p.company_id IS NOT NULL
         AND (r.company_id IS DISTINCT FROM p.company_id);
    EXCEPTION WHEN undefined_column THEN
      RAISE NOTICE 'age_relatorios sem project_id — pulado';
    END;
  END IF;
END $$;

-- ───────── CONFERÊNCIA ─────────
SELECT 'usuarios_ainda_na_ownage_alheios' AS checagem, count(*) AS n
  FROM public.age_users u
 WHERE u.company_id::text = 'aa47f125-4b29-4c2d-b367-88b912f1b33e'
   AND lower(coalesce(u.username, '')) NOT IN (
     'gustavowng','vraulin','paulin','ken','vic','pedrobarreto','paulomunir'
   )
UNION ALL
SELECT 'projetos_ownage_de_outro_created_by', count(*)
  FROM public.age_projects p
 WHERE p.company_id::text = 'aa47f125-4b29-4c2d-b367-88b912f1b33e'
   AND lower(coalesce(p.created_by, '')) NOT IN (
     'gustavowng','vraulin','paulin','ken','vic','pedrobarreto','paulomunir','system','unknown',''
   )
UNION ALL
SELECT 'projetos_sem_empresa', count(*)
  FROM public.age_projects p
 WHERE p.company_id IS NULL;
