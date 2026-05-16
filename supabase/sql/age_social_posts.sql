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
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  editorial_stage text NOT NULL DEFAULT 'producao',
  approval_status_kind text,
  approval_status_text text,
  public_url text,
  published_at timestamptz,
  metrics_views text,
  metrics_likes text,
  remind_metrics_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_age_social_posts_company_date
  ON age_social_posts (company_id, post_date);

CREATE INDEX IF NOT EXISTS idx_age_social_posts_company_network_date
  ON age_social_posts (company_id, network, post_date);

CREATE INDEX IF NOT EXISTS idx_age_social_posts_company_stage
  ON age_social_posts (company_id, editorial_stage);

COMMENT ON TABLE age_social_posts IS 'Cronograma editorial: data, projeto, material e rede social; estágio do kanban em editorial_stage';

-- Migração para instalações que já criaram a tabela em versões antigas (idempotente):
ALTER TABLE age_social_posts ADD COLUMN IF NOT EXISTS post_time text;
ALTER TABLE age_social_posts ADD COLUMN IF NOT EXISTS format text;
ALTER TABLE age_social_posts ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE age_social_posts ADD COLUMN IF NOT EXISTS client_name text;
ALTER TABLE age_social_posts ADD COLUMN IF NOT EXISTS project_name text;
ALTER TABLE age_social_posts ADD COLUMN IF NOT EXISTS material text;
ALTER TABLE age_social_posts ADD COLUMN IF NOT EXISTS asset_url text;
ALTER TABLE age_social_posts ADD COLUMN IF NOT EXISTS caption text;
ALTER TABLE age_social_posts ADD COLUMN IF NOT EXISTS assigned_to text;
ALTER TABLE age_social_posts ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE age_social_posts ADD COLUMN IF NOT EXISTS deleted boolean DEFAULT false;
ALTER TABLE age_social_posts ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE age_social_posts ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE age_social_posts ADD COLUMN IF NOT EXISTS editorial_stage text DEFAULT 'producao';
ALTER TABLE age_social_posts ADD COLUMN IF NOT EXISTS approval_status_kind text;
ALTER TABLE age_social_posts ADD COLUMN IF NOT EXISTS approval_status_text text;
ALTER TABLE age_social_posts ADD COLUMN IF NOT EXISTS public_url text;
ALTER TABLE age_social_posts ADD COLUMN IF NOT EXISTS published_at timestamptz;
ALTER TABLE age_social_posts ADD COLUMN IF NOT EXISTS metrics_views text;
ALTER TABLE age_social_posts ADD COLUMN IF NOT EXISTS metrics_likes text;
ALTER TABLE age_social_posts ADD COLUMN IF NOT EXISTS remind_metrics_at timestamptz;

-- Garantir default em editorial_stage onde a coluna já existia sem NOT NULL:
UPDATE age_social_posts SET editorial_stage = 'producao' WHERE editorial_stage IS NULL;

-- Se a tabela foi criada com created_at/updated_at/published_at em bigint (epoch ms), converta uma vez:
-- (descomente e rode só se INSERT ainda falhar com milissegundos)
-- ALTER TABLE age_social_posts ALTER COLUMN created_at TYPE timestamptz USING to_timestamp(created_at / 1000.0);
-- ALTER TABLE age_social_posts ALTER COLUMN updated_at TYPE timestamptz USING to_timestamp(updated_at / 1000.0);
-- ALTER TABLE age_social_posts ALTER COLUMN published_at TYPE timestamptz USING CASE WHEN published_at IS NULL THEN NULL ELSE to_timestamp(published_at / 1000.0) END;
-- ALTER TABLE age_social_posts ALTER COLUMN remind_metrics_at TYPE timestamptz USING CASE WHEN remind_metrics_at IS NULL THEN NULL ELSE to_timestamp(remind_metrics_at / 1000.0) END;
