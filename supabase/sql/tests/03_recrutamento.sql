-- Regressão do vazamento da aba Recrutamento.
--
-- Sintoma original: conta nova abria Recrutamento e via os candidatos da
-- OWNAGE. Duas causas somadas — a tabela não tinha company_id, e a view
-- v_age_candidates_admin rodava com o privilégio do dono, furando o RLS
-- da tabela mesmo depois de ele ser ligado.
--
-- Rodar depois de multitenant_tabelas_faltantes.sql e rls_multitenant.sql.

\set ON_ERROR_STOP off
\pset pager off

\echo '════════ 0. A migração fez o que prometeu ════════'
\echo '-- company_id nas tabelas de recrutamento (esperado: tudo true):'
select t.tabela,
       exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = t.tabela
                  and column_name = 'company_id') as tem_company_id
  from (values ('age_candidates'), ('age_match_results'), ('age_ai_analysis'),
               ('age_recruit_links'), ('age_gastos'), ('age_orc_funcoes')) as t(tabela)
 order by t.tabela;

\echo '-- view respeita o RLS de quem consulta (esperado: security_invoker=true):'
select relname, reloptions from pg_class where relname = 'v_age_candidates_admin';

-- O backfill jogou tudo na OWNAGE, que não existe neste fixture.
-- Redistribui entre as duas empresas para o teste ter dois donos.
update public.age_candidates set company_id = '11111111-1111-1111-1111-111111111111' where email = 'cand@a.com';
update public.age_candidates set company_id = '22222222-2222-2222-2222-222222222222' where email = 'cand@b.com';
update public.age_match_results m set company_id = c.company_id from public.age_candidates c where m.candidate_id = c.id;
update public.age_ai_analysis  a set company_id = c.company_id from public.age_candidates c where a.candidate_id = c.id;
update public.age_recruit_links set company_id = '11111111-1111-1111-1111-111111111111' where slug = 'link-a';
update public.age_recruit_links set company_id = '22222222-2222-2222-2222-222222222222' where slug = 'link-b';
update public.age_orc_funcoes set company_id = '11111111-1111-1111-1111-111111111111';

\echo ''
\echo '════════ 1. ANON não lista candidato ════════'
set role anon;
set request.jwt.claims = '{"role":"anon"}';
\echo '-- candidatos via view (esperado: erro de permissão ou 0):'
select count(*) as candidatos_anon from public.v_age_candidates_admin;
\echo '-- links de divulgação (esperado: erro de permissão ou 0):'
select count(*) as links_anon from public.age_recruit_links;
reset role;

\echo ''
\echo '════════ 2. EMPRESA A: só o candidato dela ════════'
set role authenticated;
set request.jwt.claims = '{"role":"authenticated","sub":"aaaaaaaa-0000-0000-0000-000000000001","company_id":"11111111-1111-1111-1111-111111111111","username":"admin_a","user_role":"admin"}';

\echo '-- via view, que era por onde vazava (esperado: só "Candidato da A"):'
select name, email, top_role_name from public.v_age_candidates_admin order by name;
\echo '-- direto na tabela (esperado: só "Candidato da A"):'
select name from public.age_candidates order by name;
\echo '-- links (esperado: só link-a):'
select slug from public.age_recruit_links order by slug;
\echo '-- catálogo de orçamento (esperado: só o da empresa A):'
select data from public.age_orc_funcoes;
\echo '-- gastos de projeto (esperado: 1, o do Projeto A1):'
select count(*) as gastos from public.age_gastos;
reset role;

\echo ''
\echo '════════ 3. EMPRESA B: mesma consulta, outro resultado ════════'
set role authenticated;
set request.jwt.claims = '{"role":"authenticated","sub":"bbbbbbbb-0000-0000-0000-000000000001","company_id":"22222222-2222-2222-2222-222222222222","username":"admin_b","user_role":"admin"}';

\echo '-- via view (esperado: só "Candidato da B"):'
select name, email, top_role_name from public.v_age_candidates_admin order by name;
\echo '-- links (esperado: só link-b):'
select slug from public.age_recruit_links order by slug;
\echo '-- catálogo de orçamento (esperado: 0 linhas — conta nova começa vazia):'
select count(*) as catalogos from public.age_orc_funcoes;
\echo '-- gastos (esperado: 0):'
select count(*) as gastos from public.age_gastos;
reset role;

\echo ''
\echo '════════ 4. EMPRESA B tentando alcançar candidato da A ════════'
set role authenticated;
set request.jwt.claims = '{"role":"authenticated","sub":"bbbbbbbb-0000-0000-0000-000000000001","company_id":"22222222-2222-2222-2222-222222222222","username":"admin_b","user_role":"admin"}';

\echo '-- lendo pelo id exato do candidato da A (esperado: 0 linhas):'
select name from public.age_candidates where id = 'cccccccc-0000-0000-0000-00000000000a';
\echo '-- arquivando candidato da A (esperado: UPDATE 0):'
update public.age_candidates set status = 'arquivado' where id = 'cccccccc-0000-0000-0000-00000000000a';
\echo '-- parecer da IA sobre o candidato da A (esperado: 0 linhas):'
select parecer_geral from public.age_ai_analysis where candidate_id = 'cccccccc-0000-0000-0000-00000000000a';
reset role;

\echo ''
\echo '════════ 5. Conferência final ════════'
\echo '-- candidato da A continua "novo" (o update de B não pegou):'
select name, status from public.age_candidates order by name;
