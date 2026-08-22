-- ============================================================
-- AGE · Multi-tenant — tabelas que ficaram de fora do company_id
--
-- Auditoria encontrou tabelas lidas pelo front sem nenhum vínculo de
-- empresa. Consequência prática: uma conta nova abria a aba Recrutamento
-- e via os candidatos da OWNAGE, e carregava o catálogo de funções/valores
-- de orçamento da OWNAGE.
--
-- Este script:
--   1) adiciona company_id nas tabelas que faltavam;
--   2) faz backfill das linhas existentes para a OWNAGE (todo o dado
--      histórico é dela);
--   3) recria v_age_candidates_admin com security_invoker, senão a view
--      continua furando o RLS da tabela por baixo.
--
-- Rode ANTES de publicar o front novo e antes de rls_multitenant.sql.
-- Idempotente: pode rodar mais de uma vez.
-- ============================================================

-- Empresa dona de todo o histórico atual
DO $$
DECLARE
  ownage_id uuid := 'aa47f125-4b29-4c2d-b367-88b912f1b33e';
  t          text;
  alvo       text[] := ARRAY[
    'age_candidates',
    'age_match_results',
    'age_ai_analysis',
    'age_recruit_links',
    'age_gastos',
    'age_orc_funcoes',
    'age_relatorios'
  ];
BEGIN
  FOREACH t IN ARRAY alvo LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'pulando % (tabela nao existe neste projeto)', t;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS company_id uuid', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_company_id ON public.%I(company_id)', t, t);
    RAISE NOTICE 'company_id garantido em %', t;
  END LOOP;

  -- ---------- Backfill ----------
  -- Candidatos, links e catálogo de orçamento: histórico é todo da OWNAGE.
  IF to_regclass('public.age_candidates') IS NOT NULL THEN
    UPDATE public.age_candidates SET company_id = ownage_id WHERE company_id IS NULL;
  END IF;

  IF to_regclass('public.age_recruit_links') IS NOT NULL THEN
    UPDATE public.age_recruit_links SET company_id = ownage_id WHERE company_id IS NULL;
  END IF;

  IF to_regclass('public.age_orc_funcoes') IS NOT NULL THEN
    UPDATE public.age_orc_funcoes SET company_id = ownage_id WHERE company_id IS NULL;
  END IF;

  -- Match e análise herdam do candidato (relação 1:1 por candidate_id).
  IF to_regclass('public.age_match_results') IS NOT NULL THEN
    UPDATE public.age_match_results m
       SET company_id = c.company_id
      FROM public.age_candidates c
     WHERE m.candidate_id = c.id
       AND m.company_id IS NULL;
  END IF;

  IF to_regclass('public.age_ai_analysis') IS NOT NULL THEN
    UPDATE public.age_ai_analysis a
       SET company_id = c.company_id
      FROM public.age_candidates c
     WHERE a.candidate_id = c.id
       AND a.company_id IS NULL;
  END IF;

  -- Gastos herdam do projeto; o que não tiver projeto válido vai pra OWNAGE.
  -- Cast para text porque projeto_id nem sempre é uuid nesta base.
  IF to_regclass('public.age_gastos') IS NOT NULL
     AND to_regclass('public.age_projects') IS NOT NULL THEN
    BEGIN
      UPDATE public.age_gastos g
         SET company_id = p.company_id
        FROM public.age_projects p
       WHERE g.projeto_id::text = p.id::text
         AND g.company_id IS NULL;
    EXCEPTION WHEN undefined_column THEN
      RAISE NOTICE 'age_gastos sem projeto_id — backfill direto para OWNAGE';
    END;
    UPDATE public.age_gastos SET company_id = ownage_id WHERE company_id IS NULL;
  END IF;

  IF to_regclass('public.age_relatorios') IS NOT NULL THEN
    UPDATE public.age_relatorios SET company_id = ownage_id WHERE company_id IS NULL;
  END IF;
END $$;


-- ============================================================
-- View admin de candidatos
--
-- Duas correções:
--   · security_invoker = true  → a view passa a respeitar o RLS das
--     tabelas de origem. Sem isso ela roda com o dono (postgres) e
--     devolve candidato de todo mundo, mesmo com RLS ativo.
--   · expõe company_id         → o front consegue filtrar por empresa
--     enquanto o RLS não está ligado.
--
-- Colunas opcionais (tech_level etc.) só entram se existirem — o
-- age_candidates_perfil_extra.sql pode não ter sido rodado neste projeto.
-- ============================================================
DROP VIEW IF EXISTS v_age_candidates_admin CASCADE;

DO $$
DECLARE
  sel text := 'c.id, c.company_id';
  col text;
  sql text;
  cand_cols text[] := ARRAY[
    'created_at','name','email','city','experience_years','status','ref_source',
    'tech_level','day_rate_range','fixed_salary_range'
  ];
  match_cols text[] := ARRAY[
    'top_role_name','top_role_id','top_match_pct',
    'score_overall','score_cultural','score_technical','seniority'
  ];
  anal_cols text[] := ARRAY[
    'parecer_geral','adequacao_cultural','resumo_perfil'
  ];
BEGIN
  IF to_regclass('public.age_candidates') IS NULL THEN
    RAISE NOTICE 'age_candidates ausente — view pulada';
    RETURN;
  END IF;

  FOREACH col IN ARRAY cand_cols LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'age_candidates' AND column_name = col
    ) THEN
      sel := sel || format(', c.%I', col);
    ELSE
      sel := sel || format(', NULL AS %I', col);
    END IF;
  END LOOP;

  FOREACH col IN ARRAY match_cols LOOP
    IF to_regclass('public.age_match_results') IS NOT NULL AND EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'age_match_results' AND column_name = col
    ) THEN
      sel := sel || format(', m.%I', col);
    ELSE
      sel := sel || format(', NULL AS %I', col);
    END IF;
  END LOOP;

  IF to_regclass('public.age_ai_analysis') IS NOT NULL AND EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'age_ai_analysis' AND column_name = 'status'
  ) THEN
    sel := sel || ', a.status AS analysis_status';
  ELSE
    sel := sel || ', NULL AS analysis_status';
  END IF;

  FOREACH col IN ARRAY anal_cols LOOP
    IF to_regclass('public.age_ai_analysis') IS NOT NULL AND EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'age_ai_analysis' AND column_name = col
    ) THEN
      sel := sel || format(', a.%I', col);
    ELSE
      sel := sel || format(', NULL AS %I', col);
    END IF;
  END LOOP;

  sql := 'CREATE VIEW public.v_age_candidates_admin WITH (security_invoker = true) AS SELECT '
      || sel
      || ' FROM public.age_candidates c';

  IF to_regclass('public.age_match_results') IS NOT NULL THEN
    sql := sql || ' LEFT JOIN public.age_match_results m ON m.candidate_id = c.id';
  END IF;
  IF to_regclass('public.age_ai_analysis') IS NOT NULL THEN
    sql := sql || ' LEFT JOIN public.age_ai_analysis a ON a.candidate_id = c.id';
  END IF;

  sql := sql || CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'age_candidates' AND column_name = 'created_at'
    ) THEN ' ORDER BY c.created_at DESC'
    ELSE ' ORDER BY c.id'
  END;
  EXECUTE sql;
  RAISE NOTICE 'v_age_candidates_admin recriada';
END $$;

GRANT SELECT ON v_age_candidates_admin TO anon, authenticated;


-- Relatórios que saíram do HTML: só a OWNAGE deve tê-los no banco.
-- Idempotente — não duplica se já existir o par cliente+projeto.
DO $$
DECLARE
  ownage_id uuid := 'aa47f125-4b29-4c2d-b367-88b912f1b33e';
BEGIN
  IF to_regclass('public.age_relatorios') IS NULL THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'age_relatorios' AND column_name = 'cliente'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.age_relatorios (company_id, cliente, projeto, mes, fat, cost, nps, status, resp, positivo, problemas, licoes, obs)
  SELECT ownage_id, v.cliente, v.projeto, v.mes, v.fat, v.cost, v.nps, v.status, v.resp, v.positivo, v.problemas, v.licoes, v.obs
  FROM (VALUES
    ('Yuri Guillen', 'Muito Longe', 1, 10000::numeric, 2879::numeric, 10::numeric, 'concluido', 'Gustavo',
     'Projeto fluiu muito bem. Primeiro projeto do cliente na casa.',
     'Problema de alinhamento de budget no início.',
     'Alinhamento de budget deve acontecer ANTES do início das gravações.',
     'Cliente fidelizado — retornou para Content Day.'),
    ('Yuri Guillen', 'Content Day', 4, 1500, 1000, 7, 'concluido', 'Gustavo',
     'Gravações fluíram bem. Cliente ficou satisfeito com o resultado final.',
     'Cliente ficou ansioso com prazo de entrega.',
     'Implementar editor real-time nos próximos Content Days.',
     'Mesmo com ansiedade, cliente saiu satisfeito.'),
    ('Marcella', 'Miss Brasil', 2, 3600, 1000, 0, 'problema', 'Gustavo',
     'Projeto entregue. Gerou giro de caixa no período.',
     'Alta demanda de diárias que comprometeu o budget.',
     'Aprender a dizer NÃO quando o budget não cobre a operação.',
     'Projetos com margem abaixo de 30% devem ser recusados ou reestruturados.'),
    ('Viezes', 'Leilão', 2, 2600, 700, 0, 'concluido', 'Gustavo',
     'Projeto entregue. Material bom captado. Margem saudável.',
     'Edição real-time não foi viável dentro do budget.',
     'Não prometer edição real-time se o budget não cobre.',
     'Avaliar se cliente tem potencial de recorrência.'),
    ('Thadeu Meneghini', 'Ao Vivo', 3, 5000, 2500, 10, 'problema', 'Gustavo',
     'Cliente deu NPS 10. Relação com o cliente excelente.',
     'Operadores de câmera não entregaram material adequado para aftermovie.',
     'Briefing técnico obrigatório com operadores ANTES de qualquer ao vivo.',
     'O risco foi absorvido internamente — isso não pode se repetir.'),
    ('Talita Perosa Nutri', 'Ao Vivo', 3, 5200, 4100, 0, 'concluido', 'Gustavo',
     'Testamos edição real-time com sucesso.',
     'Logística para o Rio cara em relação ao volume (1 diária).',
     'Para clientes no Rio: contratar equipe local e editar em SP.',
     'A edição real-time provou ser viável.'),
    ('Cobertec e Solutec', 'Publicidade', 3, 3000, 500, 0, 'em_andamento', 'Gustavo',
     'Margem excelente. Cliente satisfeito e com recorrência.',
     'Cliente em Cuiabá — baixa consciência de investimento em conteúdo.',
     'Checklist de pré-produção para o cliente preparar o espaço.',
     'Serviço de recorrência — priorizar manter o cliente.'),
    ('Escola de Planejados', 'Master Family e Revolução', 3, 9400, 4000, 7, 'concluido', 'Gustavo',
     'Primeira experiência com eventos de imersão. Cliente conquistado.',
     'Colaborador não entregou o máximo. Equipe sobrecarregada no dia.',
     'Avaliar colaboradores com projeto-piloto de baixo risco.',
     'Apesar dos erros, conquistamos o cliente.'),
    ('Thiago Sub', 'Content Day', 4, 1500, 1000, 10, 'concluido', 'Gustavo',
     'Gravações fluíram bem. Cliente saiu satisfeito. NPS 10.',
     'Prazo de entrega — problema sistêmico dos Content Days.',
     'Editor real-time para Content Days.',
     'Cliente satisfeito. Avaliar recorrência.'),
    ('Irmãs Lira', 'Content Day', 4, 2250, 1000, 10, 'concluido', 'Gustavo',
     'Segundo dia de gravações fluiu muito bem.',
     'Demora nas entregas por acúmulo de Content Days simultâneos.',
     'Espaçar Content Days. Máximo de 2 por semana.',
     'NPS 10 — alto potencial de indicação.'),
    ('MC Bill', 'Content Day', 4, 1500, 1000, 8, 'concluido', 'Gustavo',
     'Gravações concluídas. Cliente satisfeito.',
     'Prazo de entrega — mesmo problema sistêmico.',
     'Resolver o gargalo de edição para escalar Content Days.',
     'Equipe comprometida com qualidade.'),
    ('Ecologyk', 'Clipe', 4, 1000, 1000, 7, 'em_andamento', 'Equipe',
     'Projeto em andamento.',
     'Baixa prioridade de entrega — risco de insatisfação.',
     'Todo projeto com contrato deve ter data de entrega definida.',
     'Margem zero — não repetir esse modelo de precificação.'),
    ('Casa 46', 'Visita Benjamin Back', 4, 6300, 1000, 0, 'concluido', 'Gustavo',
     'Gravação fluiu muito bem. Margem excelente.',
     'Termos de uso de imagem não foram assinados no dia. Faltou pré-produção de locação.',
     'Checklist obrigatório: termos de imagem, visita técnica, lentes por ambiente.',
     'Erros documentados para nunca repetir.')
  ) AS v(cliente, projeto, mes, fat, cost, nps, status, resp, positivo, problemas, licoes, obs)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.age_relatorios r
     WHERE lower(r.cliente) = lower(v.cliente)
       AND lower(r.projeto) = lower(v.projeto)
  );
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'age_relatorios: seed pulado (schema diferente)';
END $$;


-- ============================================================
-- Verificação
-- ============================================================
SELECT
  t.tabela,
  to_regclass('public.' || t.tabela) IS NOT NULL AS existe,
  EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = t.tabela AND column_name = 'company_id'
  ) AS tem_company_id
FROM (VALUES
  ('age_candidates'), ('age_match_results'), ('age_ai_analysis'),
  ('age_recruit_links'), ('age_gastos'), ('age_orc_funcoes'), ('age_relatorios')
) AS t(tabela);

-- Deve mostrar {security_invoker=true} em opcoes
SELECT c.relname AS view_name,
       c.reloptions AS opcoes
  FROM pg_class c
 WHERE c.relname = 'v_age_candidates_admin';

-- Deve devolver 0 em sem_empresa
SELECT 'age_candidates' AS tabela, count(*) FILTER (WHERE company_id IS NULL) AS sem_empresa
  FROM age_candidates;
