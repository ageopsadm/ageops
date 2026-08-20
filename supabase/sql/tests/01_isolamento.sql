\set ON_ERROR_STOP off
\pset pager off

\echo '════════ 1. ANON: a chave pública não pode ver nada ════════'
set role anon;
set request.jwt.claims = '{"role":"anon"}';

\echo '-- projetos visíveis para anon (esperado: erro de permissão ou 0):'
select count(*) as projetos_anon from public.age_projects;
\echo '-- colaboradores (dados bancários) visíveis para anon:'
select count(*) as colabs_anon from public.age_colaboradores;
\echo '-- usuários visíveis para anon:'
select count(*) as users_anon from public.age_users;
\echo '-- hashes de senha visíveis para anon:'
select count(*) as secrets_anon from public.age_user_secrets;

reset role;

\echo ''
\echo '════════ 2. EMPRESA A: enxerga só o que é dela ════════'
set role authenticated;
set request.jwt.claims = '{"role":"authenticated","sub":"aaaaaaaa-0000-0000-0000-000000000001","company_id":"11111111-1111-1111-1111-111111111111","username":"admin_a","user_role":"admin"}';

\echo '-- projetos (esperado: 2, ambos da Empresa A):'
select nome, valor from public.age_projects order by nome;
\echo '-- pagamentos (esperado: 1):'
select count(*) as pagamentos from public.age_payments;
\echo '-- colaboradores (esperado: só Fulano A):'
select nome, pix_chave from public.age_colaboradores;
\echo '-- usuários visíveis (esperado: 2, os da Empresa A):'
select username from public.age_users order by username;
\echo '-- empresas visíveis (esperado: só Empresa A):'
select name from public.age_companies;

reset role;

\echo ''
\echo '════════ 3. EMPRESA B: mesma consulta, outro resultado ════════'
set role authenticated;
set request.jwt.claims = '{"role":"authenticated","sub":"bbbbbbbb-0000-0000-0000-000000000001","company_id":"22222222-2222-2222-2222-222222222222","username":"admin_b","user_role":"admin"}';

\echo '-- projetos (esperado: só Projeto B1):'
select nome, valor from public.age_projects order by nome;
\echo '-- colaboradores (esperado: só Beltrano B):'
select nome, pix_chave from public.age_colaboradores;

reset role;

\echo ''
\echo '════════ 4. TENTATIVA DE INVASÃO: A gravando na empresa B ════════'
set role authenticated;
set request.jwt.claims = '{"role":"authenticated","sub":"aaaaaaaa-0000-0000-0000-000000000001","company_id":"11111111-1111-1111-1111-111111111111","username":"admin_a","user_role":"admin"}';

\echo '-- inserir projeto carimbado com a empresa B (esperado: RECUSADO):'
insert into public.age_projects (nome, valor, company_id)
values ('Invasao', 1, '22222222-2222-2222-2222-222222222222');

\echo '-- alterar projeto da empresa B (esperado: 0 linhas afetadas):'
update public.age_projects set valor = 1 where nome = 'Projeto B1';

\echo '-- apagar projeto da empresa B (esperado: 0 linhas afetadas):'
delete from public.age_projects where nome = 'Projeto B1';

\echo '-- inserir projeto na própria empresa (esperado: FUNCIONA):'
insert into public.age_projects (nome, valor, company_id)
values ('Projeto A3', 500, '11111111-1111-1111-1111-111111111111');

\echo '-- promover a si mesmo mudando de empresa (esperado: RECUSADO):'
update public.age_users set company_id = '22222222-2222-2222-2222-222222222222'
where username = 'admin_a';

reset role;

\echo ''
\echo '════════ 5. TOKEN FORJADO SEM company_id ════════'
set role authenticated;
set request.jwt.claims = '{"role":"authenticated","sub":"aaaaaaaa-0000-0000-0000-000000000001","username":"hacker"}';
\echo '-- projetos sem company_id no token (esperado: 0):'
select count(*) as projetos_sem_claim from public.age_projects;
reset role;

\echo ''
\echo '════════ 6. FLUXOS PÚBLICOS: convite e NPS por token ════════'
set role anon;
set request.jwt.claims = '{"role":"anon"}';

\echo '-- convite pelo token correto (esperado: 1 linha):'
select email, company_name from public.age_invite_by_token('tok-convite-a');
\echo '-- convite com token errado (esperado: 0 linhas):'
select count(*) as convites_token_errado from public.age_invite_by_token('token-inventado');
\echo '-- campanha NPS pelo token (esperado: 1 linha):'
select etapa from public.age_nps_campaign_by_token('tok-nps-a');
\echo '-- responder o NPS com token válido (esperado: FUNCIONA):'
insert into public.age_nps_respostas (token, nota_geral) values ('tok-nps-a', 9);
\echo '-- responder com token inventado (esperado: RECUSADO):'
insert into public.age_nps_respostas (token, nota_geral) values ('token-falso', 10);
\echo '-- anon tentando ler as respostas (esperado: erro ou 0):'
select count(*) as respostas_anon from public.age_nps_respostas;

reset role;

\echo ''
\echo '════════ 7. Dona da campanha lê as respostas ════════'
set role authenticated;
set request.jwt.claims = '{"role":"authenticated","sub":"aaaaaaaa-0000-0000-0000-000000000001","company_id":"11111111-1111-1111-1111-111111111111","username":"admin_a","user_role":"admin"}';
\echo '-- respostas da própria campanha (esperado: 1):'
select token, nota_geral from public.age_nps_respostas;
reset role;

set role authenticated;
set request.jwt.claims = '{"role":"authenticated","sub":"bbbbbbbb-0000-0000-0000-000000000001","company_id":"22222222-2222-2222-2222-222222222222","username":"admin_b","user_role":"admin"}';
\echo '-- empresa B tentando ler as respostas da campanha de A (esperado: 0):'
select count(*) as respostas_de_outro from public.age_nps_respostas;
reset role;

\echo ''
\echo '════════ 8. Estado final dos dados ════════'
select c.name as empresa, count(p.id) as projetos
from public.age_companies c
left join public.age_projects p on p.company_id = c.id
group by c.name order by c.name;
