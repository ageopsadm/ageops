-- ════════════════════════════════════════════════════════════════
-- age_user_secrets — tira as senhas de dentro de age_users
--
-- Problema: age_users é legível com a chave anônima (que fica exposta
-- no HTML). Enquanto password_hash morar nessa tabela, qualquer pessoa
-- consegue ler a senha de todas as contas.
--
-- Solução: guardar a senha numa tabela separada com RLS e sem nenhuma
-- policy — assim apenas a service_role (usada só pela Edge Function
-- auth-login, no servidor) consegue ler ou escrever.
--
-- ORDEM DE EXECUÇÃO:
--   1) Rode o PASSO 1 e o PASSO 2 agora.
--   2) Publique a função:  supabase functions deploy auth-login
--   3) Teste o login de todas as contas.
--   4) Só depois rode o PASSO 3 (apaga as senhas em texto puro).
-- ════════════════════════════════════════════════════════════════

-- ── PASSO 1: tabela protegida ───────────────────────────────────
create table if not exists public.age_user_secrets (
  user_id       uuid primary key references public.age_users(id) on delete cascade,
  username      text unique,
  password_hash text not null,
  updated_at    timestamptz not null default now()
);

alter table public.age_user_secrets enable row level security;

-- Sem policies = ninguém com chave anon/authenticated entra.
-- A service_role ignora RLS, então a Edge Function continua funcionando.
revoke all on public.age_user_secrets from anon;
revoke all on public.age_user_secrets from authenticated;


-- ── PASSO 2: copiar as senhas que já existem ────────────────────
insert into public.age_user_secrets (user_id, username, password_hash)
select u.id, lower(u.username), u.password_hash
  from public.age_users u
 where coalesce(u.password_hash, '') <> ''
on conflict (user_id) do nothing;

-- Conferência: os dois números devem bater.
-- select
--   (select count(*) from public.age_users where coalesce(password_hash,'') <> '') as em_age_users,
--   (select count(*) from public.age_user_secrets)                                 as copiadas;


-- ── PASSO 3: só depois de validar o login pela Edge Function ────
-- Remove a senha em texto puro da tabela que o navegador lê.
-- A função auth-login já faz isso conta a conta no primeiro login,
-- mas rode aqui para limpar todas de uma vez.
--
-- update public.age_users set password_hash = null where password_hash is not null;


-- ── OPCIONAL: bloquear escrita anônima em age_users ─────────────
-- Hoje qualquer pessoa com a chave anônima pode alterar age_users.
-- Depois de migrar o login, avalie habilitar RLS aqui também:
--
-- alter table public.age_users enable row level security;
-- create policy age_users_select_anon on public.age_users
--   for select to anon using (true);
-- (sem policy de insert/update/delete para anon)
