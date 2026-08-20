-- ════════════════════════════════════════════════════════════════════════
-- RLS multi-tenant — o banco passa a separar as empresas por conta própria
--
-- Hoje o isolamento por company_id acontece no JavaScript. Como o navegador
-- é do cliente, qualquer pessoa com a chave anônima (que está no HTML) lê e
-- escreve os dados de todas as empresas por chamada direta à API REST.
-- Este script move essa decisão para o Postgres, onde ela não é contornável.
--
-- DEPENDE DE: Edge Function auth-login emitindo JWT (secret AGE_JWT_SECRET).
-- Sem o token, toda chamada chega como anônima e o app fica sem dados.
--
-- APLIQUE NA ORDEM DOS PASSOS. Rode o passo 0 antes de qualquer outro.
-- ════════════════════════════════════════════════════════════════════════


-- ────────────────────────────────────────────────────────────────────────
-- PASSO 0 — Diagnóstico (não altera nada)
--
-- Linhas com company_id nulo ficam invisíveis depois do RLS. Se aparecer
-- qualquer contagem acima de zero, faça o backfill antes de seguir.
-- ────────────────────────────────────────────────────────────────────────
do $$
declare
  r record;
  n bigint;
  total bigint := 0;
begin
  for r in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'company_id'
      and t.table_type = 'BASE TABLE'
      and c.table_name like 'age\_%'
    order by 1
  loop
    execute format('select count(*) from public.%I where company_id is null', r.table_name) into n;
    if n > 0 then
      raise notice 'ORFAS  %  ->  % linha(s) sem company_id', rpad(r.table_name, 28), n;
      total := total + n;
    end if;
  end loop;
  raise notice '---';
  if total = 0 then
    raise notice 'OK: nenhuma linha orfa. Pode seguir para o passo 1.';
  else
    raise notice 'ATENCAO: % linha(s) ficariam invisiveis. Faca o backfill antes.', total;
  end if;
end $$;


-- ────────────────────────────────────────────────────────────────────────
-- PASSO 1 — Funções que leem a identidade do token
--
-- O PostgREST valida a assinatura do JWT e publica as claims em
-- request.jwt.claims. Como a assinatura é conferida pelo servidor, o
-- usuário não consegue forjar um company_id de outra empresa.
-- ────────────────────────────────────────────────────────────────────────
create or replace function public.age_claims()
returns jsonb
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

-- Devolvem texto de propósito: as políticas comparam com `coluna::text`, e
-- assim funcionam com company_id uuid, text ou bigint sem ajuste.
create or replace function public.age_company_id()
returns text
language sql
stable
as $$
  select nullif(public.age_claims() ->> 'company_id', '')
$$;

create or replace function public.age_user_id()
returns text
language sql
stable
as $$
  select nullif(public.age_claims() ->> 'sub', '')
$$;

create or replace function public.age_username()
returns text
language sql
stable
as $$
  select lower(coalesce(public.age_claims() ->> 'username', ''))
$$;

create or replace function public.age_user_role()
returns text
language sql
stable
as $$
  select lower(coalesce(public.age_claims() ->> 'user_role', ''))
$$;

comment on function public.age_company_id() is
  'Empresa do usuário logado, lida do JWT. Base de todas as políticas de RLS.';


-- ────────────────────────────────────────────────────────────────────────
-- PASSO 2 — RLS em toda tabela age_ que tenha company_id
--
-- Uma política por tabela: você só enxerga e só grava dentro da sua empresa.
-- O with check impede gravar uma linha carimbada com a empresa de outro.
-- ────────────────────────────────────────────────────────────────────────
do $$
declare
  r record;
begin
  for r in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'company_id'
      and t.table_type = 'BASE TABLE'
      and c.table_name like 'age\_%'
      -- tratadas no passo 3, com regras próprias
      and c.table_name not in ('age_users', 'age_companies', 'age_user_secrets')
    order by 1
  loop
    execute format('alter table public.%I enable row level security', r.table_name);

    execute format('drop policy if exists age_tenant_rw on public.%I', r.table_name);
    execute format($f$
      create policy age_tenant_rw on public.%I
        for all
        to authenticated
        using (company_id::text = public.age_company_id())
        with check (company_id::text = public.age_company_id())
    $f$, r.table_name);

    -- A chave anônima deixa de alcançar dados de cliente.
    execute format('revoke all on public.%I from anon', r.table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', r.table_name);

    raise notice 'RLS ligado: %', r.table_name;
  end loop;
end $$;


-- ────────────────────────────────────────────────────────────────────────
-- PASSO 3 — age_users e age_companies
--
-- Não seguem a regra genérica: o usuário precisa ler os colegas da própria
-- empresa, mas só pode alterar o próprio cadastro. Criação de conta e troca
-- de senha passam pela Edge Function (service_role), que ignora RLS.
-- ────────────────────────────────────────────────────────────────────────
alter table public.age_users enable row level security;

drop policy if exists age_users_read on public.age_users;
create policy age_users_read on public.age_users
  for select
  to authenticated
  using (
    id::text = public.age_user_id()
    or (company_id is not null and company_id::text = public.age_company_id())
  );

drop policy if exists age_users_self_update on public.age_users;
create policy age_users_self_update on public.age_users
  for update
  to authenticated
  using (id::text = public.age_user_id())
  with check (id::text = public.age_user_id());

-- Admin da empresa administra a própria equipe (sem alcançar outras empresas).
drop policy if exists age_users_admin_manage on public.age_users;
create policy age_users_admin_manage on public.age_users
  for update
  to authenticated
  using (
    company_id is not null
    and company_id::text = public.age_company_id()
    and public.age_user_role() in ('admin', 'gestor')
  )
  with check (company_id::text = public.age_company_id());

-- Admin cadastra gente na própria equipe; a empresa vem do token.
drop policy if exists age_users_admin_insert on public.age_users;
create policy age_users_admin_insert on public.age_users
  for insert
  to authenticated
  with check (
    company_id::text = public.age_company_id()
    and public.age_user_role() in ('admin', 'gestor')
  );

revoke all on public.age_users from anon;
grant select, insert, update on public.age_users to authenticated;

alter table public.age_companies enable row level security;

drop policy if exists age_companies_own on public.age_companies;
create policy age_companies_own on public.age_companies
  for select
  to authenticated
  using (id::text = public.age_company_id());

drop policy if exists age_companies_admin_update on public.age_companies;
create policy age_companies_admin_update on public.age_companies
  for update
  to authenticated
  using (
    id::text = public.age_company_id()
    and public.age_user_role() in ('admin', 'gestor')
  )
  with check (id::text = public.age_company_id());

revoke all on public.age_companies from anon;
grant select, update on public.age_companies to authenticated;


-- ────────────────────────────────────────────────────────────────────────
-- PASSO 4 — Tabelas age_ sem company_id
--
-- Ficam fechadas por padrão. Só o service_role (Edge Functions) alcança.
-- Se algo do app parar depois deste passo, a tabela precisa de company_id
-- ou de uma política própria — não reabra para anon.
-- ────────────────────────────────────────────────────────────────────────
do $$
declare
  r record;
begin
  for r in
    select t.table_name
    from information_schema.tables t
    where t.table_schema = 'public'
      and t.table_type = 'BASE TABLE'
      and t.table_name like 'age\_%'
      and t.table_name not in ('age_users', 'age_companies', 'age_user_secrets', 'age_nps_respostas')
      and not exists (
        select 1 from information_schema.columns c
        where c.table_schema = 'public'
          and c.table_name = t.table_name
          and c.column_name = 'company_id'
      )
    order by 1
  loop
    execute format('alter table public.%I enable row level security', r.table_name);
    execute format('revoke all on public.%I from anon', r.table_name);
    raise notice 'SEM company_id (fechada): %', r.table_name;
  end loop;
end $$;


-- ────────────────────────────────────────────────────────────────────────
-- PASSO 5 — Fluxos públicos por token
--
-- Convite e pesquisa NPS são abertos por link, sem login. Em vez de liberar
-- a tabela para anon (o que permitiria listar todos os convites e todos os
-- emails), exponha só funções que exigem o token exato.
--
-- Requer o passo correspondente no front, que passa a chamar /rest/v1/rpc/.
-- ────────────────────────────────────────────────────────────────────────
-- O token exato é a chave: sem ele a função não devolve nada, e a tabela
-- continua fechada para anon.
create or replace function public.age_invite_by_token(p_token text)
returns setof public.age_invites
language sql
security definer
set search_path = public
as $$
  select *
  from public.age_invites
  where token = p_token
    and coalesce(used, false) = false
  limit 1
$$;

revoke all on function public.age_invite_by_token(text) from public;
grant execute on function public.age_invite_by_token(text) to anon, authenticated;

create or replace function public.age_nps_campaign_by_token(p_token text)
returns setof public.age_nps_campanhas
language sql
security definer
set search_path = public
as $$
  select * from public.age_nps_campanhas where token = p_token limit 1
$$;

revoke all on function public.age_nps_campaign_by_token(text) from public;
grant execute on function public.age_nps_campaign_by_token(text) to anon, authenticated;

-- age_nps_respostas não tem company_id: o vínculo com a empresa vem da
-- campanha. Quem responde só escreve; só a dona da campanha lê.
alter table public.age_nps_respostas enable row level security;

drop policy if exists age_nps_resp_owner_read on public.age_nps_respostas;
create policy age_nps_resp_owner_read on public.age_nps_respostas
  for select
  to authenticated
  using (
    exists (
      select 1 from public.age_nps_campanhas c
      where c.token = age_nps_respostas.token
        and c.company_id::text = public.age_company_id()
    )
  );

-- A checagem precisa ser security definer: dentro da política, um anon não
-- enxergaria age_nps_campanhas e todo insert seria recusado.
create or replace function public.age_nps_token_exists(p_token text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.age_nps_campanhas where token = p_token)
$$;

revoke all on function public.age_nps_token_exists(text) from public;
grant execute on function public.age_nps_token_exists(text) to anon, authenticated;

-- Evita resposta duplicada no mesmo link sem expor a tabela.
create or replace function public.age_nps_answered(p_token text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.age_nps_respostas where token = p_token)
$$;

revoke all on function public.age_nps_answered(text) from public;
grant execute on function public.age_nps_answered(text) to anon, authenticated;

drop policy if exists age_nps_resp_public_insert on public.age_nps_respostas;
create policy age_nps_resp_public_insert on public.age_nps_respostas
  for insert
  to anon, authenticated
  with check (token is not null and public.age_nps_token_exists(token));

revoke all on public.age_nps_respostas from anon;
grant insert on public.age_nps_respostas to anon;
grant select, insert, update, delete on public.age_nps_respostas to authenticated;


-- ────────────────────────────────────────────────────────────────────────
-- PASSO 6 — Conferência
--
-- Espera-se: rls = true em tudo, e nenhuma tabela age_ com grant para anon.
-- ────────────────────────────────────────────────────────────────────────
select
  c.relname                                   as tabela,
  c.relrowsecurity                            as rls,
  c.relforcerowsecurity                       as forcado,
  (select count(*) from pg_policies p
    where p.schemaname = 'public' and p.tablename = c.relname) as politicas
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname like 'age\_%'
order by c.relrowsecurity, c.relname;

select
  table_name  as tabela,
  grantee,
  string_agg(privilege_type, ', ' order by privilege_type) as privilegios
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name like 'age\_%'
  and grantee in ('anon', 'authenticated')
group by table_name, grantee
having grantee = 'anon'
order by table_name;
