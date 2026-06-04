-- Catálogo de funções personalizável do gerador de orçamentos.
-- 1 linha por empresa (company_id). A coluna `data` (JSONB) guarda:
--   { "overrides": { "<funcaoId>": { "nome": "...", "diaria": 0, "descricao": "..." } },
--     "hidden":    { "<funcaoId>": true },
--     "custom":    [ { "id": "...", "nome": "...", "categoriaId": "...", "diaria": 0, "descricao": "..." } ] }
--
-- Opcional: o app já funciona só com localStorage. Rode este SQL para sincronizar
-- o catálogo personalizado entre os dispositivos/usuários da mesma empresa.

create table if not exists public.age_orc_funcoes (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Uma linha por empresa (company_id null = catálogo padrão/global).
create unique index if not exists age_orc_funcoes_company_uidx
  on public.age_orc_funcoes (company_id)
  where company_id is not null;

alter table public.age_orc_funcoes enable row level security;

-- Ajuste as policies conforme seu modelo de auth. Padrão permissivo (mesmo padrão
-- usado pelas demais tabelas age_* via anon key):
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'age_orc_funcoes' and policyname = 'age_orc_funcoes_all'
  ) then
    create policy age_orc_funcoes_all on public.age_orc_funcoes
      for all using (true) with check (true);
  end if;
end $$;
