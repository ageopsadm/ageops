-- Cronograma de postagens (redes sociais) por empresa e projeto.
-- Kanban editorial (aba Conteúdos · redes sociais): editorial_stage, métricas, URL publicada.
-- Executar no Supabase SQL Editor. Ajuste RLS conforme seu modelo (company_id).

CREATE TABLE IF NOT EXISTS age_social_posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id text NOT NULL,
  post_date date NOT NULL,
  post_time text,
  network text NOT NULL,
  format text,
  project_id uuid,
  client_name text,
  project_name text,
  material text,
  asset_url text,
  caption text,
  status text NOT NULL DEFAULT 'planejado',
  assigned_to text,
  notes text,
  deleted boolean DEFAULT false,
  created_at bigint DEFAULT (extract(epoch from now()) * 1000)::bigint,
  updated_at bigint DEFAULT (extract(epoch from now()) * 1000)::bigint,
  editorial_stage text NOT NULL DEFAULT 'producao',
  approval_status_kind text,
  approval_status_text text,
  public_url text,
  published_at bigint,
  metrics_views text,
  metrics_likes text,
  remind_metrics_at bigint
);

CREATE INDEX IF NOT EXISTS idx_age_social_posts_company_date
  ON age_social_posts (company_id, post_date);

CREATE INDEX IF NOT EXISTS idx_age_social_posts_company_network_date
  ON age_social_posts (company_id, network, post_date);

CREATE INDEX IF NOT EXISTS idx_age_social_posts_company_stage
  ON age_social_posts (company_id, editorial_stage);

COMMENT ON TABLE age_social_posts IS 'Cronograma editorial: data, projeto, material e rede social; estágio do kanban em editorial_stage';

-- Migração para instalações que já criaram a tabela sem as colunas do kanban:
ALTER TABLE age_social_posts ADD COLUMN IF NOT EXISTS editorial_stage text NOT NULL DEFAULT 'producao';
ALTER TABLE age_social_posts ADD COLUMN IF NOT EXISTS approval_status_kind text;
ALTER TABLE age_social_posts ADD COLUMN IF NOT EXISTS approval_status_text text;
ALTER TABLE age_social_posts ADD COLUMN IF NOT EXISTS public_url text;
ALTER TABLE age_social_posts ADD COLUMN IF NOT EXISTS published_at bigint;
ALTER TABLE age_social_posts ADD COLUMN IF NOT EXISTS metrics_views text;
ALTER TABLE age_social_posts ADD COLUMN IF NOT EXISTS metrics_likes text;
ALTER TABLE age_social_posts ADD COLUMN IF NOT EXISTS remind_metrics_at bigint;
