\set ON_ERROR_STOP off
\pset pager off

\echo '════════ RETESTE: escalada de privilégio em age_users ════════'
set role authenticated;
set request.jwt.claims = '{"role":"authenticated","sub":"aaaaaaaa-0000-0000-0000-000000000001","company_id":"11111111-1111-1111-1111-111111111111","username":"admin_a","user_role":"admin"}';

\echo '-- admin_a mudando a própria empresa para B (esperado: RECUSADO):'
update public.age_users set company_id = '22222222-2222-2222-2222-222222222222'
where username = 'admin_a';

\echo '-- admin_a se promovendo (mesmo papel de admin, esperado: RECUSADO):'
update public.age_users set role = 'admin' , email = 'x@x.com'
where username = 'admin_a';

\echo '-- admin_a mudando o próprio nome (esperado: FUNCIONA):'
update public.age_users set email = 'novo@a.com' where username = 'admin_a';

\echo '-- admin_a promovendo colab_a a gestor (esperado: FUNCIONA):'
update public.age_users set role = 'gestor' where username = 'colab_a';

\echo '-- admin_a movendo colab_a para a empresa B (esperado: RECUSADO):'
update public.age_users set company_id = '22222222-2222-2222-2222-222222222222'
where username = 'colab_a';

\echo '-- admin_a mexendo em usuário da empresa B (esperado: 0 linhas):'
update public.age_users set email = 'hack@x.com' where username = 'admin_b';

reset role;

\echo ''
\echo '-- colaborador tentando virar admin (esperado: RECUSADO):'
set role authenticated;
set request.jwt.claims = '{"role":"authenticated","sub":"aaaaaaaa-0000-0000-0000-000000000002","company_id":"11111111-1111-1111-1111-111111111111","username":"colab_a","user_role":"colaborador"}';
update public.age_users set role = 'admin' where username = 'colab_a';
reset role;

\echo ''
\echo '-- o servidor (service_role) continua podendo tudo (esperado: FUNCIONA):'
set role service_role;
update public.age_users set company_id = '11111111-1111-1111-1111-111111111111'
where username = 'colab_a';
reset role;

\echo ''
\echo '════════ Estado final de age_users ════════'
select username, email, role, company_name from public.age_users order by username;

\echo ''
\echo '════════ age_user_secrets fechada para anon ════════'
set role anon;
select count(*) from public.age_user_secrets;
reset role;
