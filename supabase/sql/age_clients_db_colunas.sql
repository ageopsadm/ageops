-- Completa age_clients_db (hoje só tem id/company_id/deleted) para o cadastro da aba Clientes.
-- Idempotente.

ALTER TABLE public.age_clients_db ADD COLUMN IF NOT EXISTS client_name text;
ALTER TABLE public.age_clients_db ADD COLUMN IF NOT EXISTS first_year integer;
ALTER TABLE public.age_clients_db ADD COLUMN IF NOT EXISTS last_year integer;
ALTER TABLE public.age_clients_db ADD COLUMN IF NOT EXISTS total_projects integer NOT NULL DEFAULT 0;
ALTER TABLE public.age_clients_db ADD COLUMN IF NOT EXISTS total_value numeric NOT NULL DEFAULT 0;
ALTER TABLE public.age_clients_db ADD COLUMN IF NOT EXISTS avg_nps numeric;
ALTER TABLE public.age_clients_db ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.age_clients_db ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.age_clients_db ADD COLUMN IF NOT EXISTS years_active text;
ALTER TABLE public.age_clients_db ADD COLUMN IF NOT EXISTS created_by text;

CREATE UNIQUE INDEX IF NOT EXISTS age_clients_db_company_name_uidx
  ON public.age_clients_db (company_id, lower(btrim(client_name)))
  WHERE deleted IS NOT TRUE AND client_name IS NOT NULL;
