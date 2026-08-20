-- Réplica mínima do ambiente Supabase para exercitar rls_multitenant.sql
-- localmente: mesmos papéis, mesmos grants padrão, duas empresas.

drop database if exists age_test;
create database age_test;
\c age_test

-- Papéis que o Supabase cria. service_role tem bypassrls, como lá.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

create extension if not exists pgcrypto;

create table public.age_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text
);

create table public.age_users (
  id uuid primary key default gen_random_uuid(),
  username text unique,
  email text,
  role text,
  company_id uuid references public.age_companies(id),
  company_name text,
  active boolean default true,
  deleted boolean default false,
  password_hash text
);

create table public.age_user_secrets (
  user_id uuid primary key,
  username text,
  password_hash text
);

create table public.age_projects (
  id uuid primary key default gen_random_uuid(),
  nome text,
  valor numeric,
  company_id uuid references public.age_companies(id)
);

create table public.age_payments (
  id uuid primary key default gen_random_uuid(),
  valor numeric,
  company_id uuid references public.age_companies(id)
);

create table public.age_colaboradores (
  id uuid primary key default gen_random_uuid(),
  nome text,
  pix_chave text,
  company_id uuid references public.age_companies(id)
);

create table public.age_invites (
  id uuid primary key default gen_random_uuid(),
  token text unique,
  email text,
  role text,
  company_id uuid references public.age_companies(id),
  company_name text,
  used boolean default false,
  expires_at timestamptz
);

create table public.age_nps_campanhas (
  id uuid primary key default gen_random_uuid(),
  token text unique,
  etapa text,
  ativo boolean default true,
  company_id uuid references public.age_companies(id)
);

-- Sem company_id de propósito: é o caso que o passo 4 precisa tratar.
create table public.age_nps_respostas (
  id uuid primary key default gen_random_uuid(),
  token text,
  nota_geral int,
  comentario_livre text,
  created_at timestamptz default now()
);

-- Outra sem company_id, para conferir que o passo 4 fecha e avisa.
create table public.age_notes (
  id uuid primary key default gen_random_uuid(),
  texto text
);

-- Grants padrão do Supabase: tudo liberado para anon e authenticated.
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

-- ── Dados: duas empresas ──
insert into public.age_companies (id, name, plan) values
  ('11111111-1111-1111-1111-111111111111', 'Empresa A', 'agencia'),
  ('22222222-2222-2222-2222-222222222222', 'Empresa B', 'agencia');

insert into public.age_users (id, username, email, role, company_id, company_name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin_a', 'admin@a.com', 'admin',        '11111111-1111-1111-1111-111111111111', 'Empresa A'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'colab_a', 'colab@a.com', 'colaborador',  '11111111-1111-1111-1111-111111111111', 'Empresa A'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'admin_b', 'admin@b.com', 'admin',        '22222222-2222-2222-2222-222222222222', 'Empresa B');

insert into public.age_projects (nome, valor, company_id) values
  ('Projeto A1', 10000, '11111111-1111-1111-1111-111111111111'),
  ('Projeto A2', 20000, '11111111-1111-1111-1111-111111111111'),
  ('Projeto B1', 30000, '22222222-2222-2222-2222-222222222222');

insert into public.age_payments (valor, company_id) values
  (5000, '11111111-1111-1111-1111-111111111111'),
  (7000, '22222222-2222-2222-2222-222222222222');

insert into public.age_colaboradores (nome, pix_chave, company_id) values
  ('Fulano A', 'pix-a@a.com', '11111111-1111-1111-1111-111111111111'),
  ('Beltrano B', 'pix-b@b.com', '22222222-2222-2222-2222-222222222222');

insert into public.age_invites (token, email, role, company_id, company_name, used) values
  ('tok-convite-a', 'novo@a.com', 'colaborador', '11111111-1111-1111-1111-111111111111', 'Empresa A', false);

insert into public.age_nps_campanhas (token, etapa, company_id) values
  ('tok-nps-a', 'Entrega final', '11111111-1111-1111-1111-111111111111');

insert into public.age_notes (texto) values ('anotação sem empresa');
