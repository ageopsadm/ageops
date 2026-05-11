-- Cronograma de postagens (redes sociais) por empresa e projeto.
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
  updated_at bigint DEFAULT (extract(epoch from now()) * 1000)::bigint
);

CREATE INDEX IF NOT EXISTS idx_age_social_posts_company_date
  ON age_social_posts (company_id, post_date);

CREATE INDEX IF NOT EXISTS idx_age_social_posts_company_network_date
  ON age_social_posts (company_id, network, post_date);

COMMENT ON TABLE age_social_posts IS 'Cronograma editorial: data, projeto, material e rede social';
