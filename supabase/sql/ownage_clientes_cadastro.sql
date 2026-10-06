-- Completa age_clients_db e cadastra os clientes OWNAGE com faturamento das planilhas 2021–2025.
-- Soma conferida: R$ 659.678,08 · 110 projetos. vic+Victoria = Victoria Brito; Sub = Thiago Sub.
-- 2026 fica nos projetos ao vivo (aba Clientes soma os dois).

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


DELETE FROM public.age_clients_db
 WHERE company_id = 'aa47f125-4b29-4c2d-b367-88b912f1b33e'
   AND COALESCE(notes, '') LIKE '%planilhas 2021–2025%';

INSERT INTO public.age_clients_db (
  company_id, client_name, first_year, last_year, total_projects, total_value,
  avg_nps, status, notes, years_active, created_by, deleted
) VALUES
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'JAY P', 2022, 2025, 16, 121470.00, 10.0, 'recorrente', 'OWNAGE · conferido nas planilhas 2021–2025', '2022,2023,2024,2025', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'LOU GARCIA', 2022, 2023, 3, 104750.00, 10.0, 'inativo', 'OWNAGE · conferido nas planilhas 2021–2025', '2022,2023', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'Giana Mello', 2023, 2025, 5, 56100.00, 10.0, 'recorrente', 'OWNAGE · conferido nas planilhas 2021–2025', '2023,2024,2025', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'UNIVERSAL MUSIC', 2024, 2024, 2, 38100.00, 10.0, 'inativo', 'OWNAGE · conferido nas planilhas 2021–2025', '2024', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'Talita Perosa Nutri', 2025, 2025, 4, 29690.00, 10.0, 'recorrente', 'OWNAGE · conferido nas planilhas 2021–2025', '2025', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'ROOFTIME', 2023, 2023, 1, 28500.00, 10.0, 'inativo', 'OWNAGE · conferido nas planilhas 2021–2025', '2023', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'KVSH', 2022, 2023, 2, 26510.00, 10.0, 'inativo', 'OWNAGE · conferido nas planilhas 2021–2025', '2022,2023', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'LOUD', 2021, 2021, 1, 20000.00, 4.0, 'inativo', 'OWNAGE · conferido nas planilhas 2021–2025', '2021', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'CINQ', 2023, 2024, 4, 18000.00, 10.0, 'inativo', 'OWNAGE · conferido nas planilhas 2021–2025', '2023,2024', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'Alva', 2021, 2022, 2, 17200.00, 9.0, 'inativo', 'OWNAGE · conferido nas planilhas 2021–2025', '2021,2022', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'KG NETWORK', 2022, 2022, 3, 16550.00, 9.3, 'inativo', 'OWNAGE · conferido nas planilhas 2021–2025', '2022', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'Victoria Brito', 2024, 2025, 5, 14300.00, 10.0, 'recorrente', 'OWNAGE · conferido nas planilhas 2021–2025', '2024,2025', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'Sony', 2021, 2021, 2, 13115.08, 10.0, 'inativo', 'OWNAGE · conferido nas planilhas 2021–2025', '2021', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'VERDE ROSA', 2025, 2025, 1, 10380.00, 10.0, 'recorrente', 'OWNAGE · conferido nas planilhas 2021–2025', '2025', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'Digital Music', 2021, 2022, 2, 10000.00, 9.5, 'inativo', 'OWNAGE · conferido nas planilhas 2021–2025', '2021,2022', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'Flashbang', 2022, 2023, 4, 9300.00, 10.0, 'inativo', 'OWNAGE · conferido nas planilhas 2021–2025', '2022,2023', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'Thiago Sub', 2025, 2025, 1, 9000.00, 10.0, 'recorrente', 'OWNAGE · conferido nas planilhas 2021–2025', '2025', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'KZN', 2024, 2024, 2, 8740.00, 10.0, 'inativo', 'OWNAGE · conferido nas planilhas 2021–2025', '2024', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'Tati Zaqui', 2023, 2023, 4, 8700.00, 10.0, 'inativo', 'OWNAGE · conferido nas planilhas 2021–2025', '2023', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'HEINEKEN', 2024, 2024, 1, 7200.00, 10.0, 'inativo', 'OWNAGE · conferido nas planilhas 2021–2025', '2024', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'BC RAFF', 2023, 2023, 1, 6000.00, 10.0, 'inativo', 'OWNAGE · conferido nas planilhas 2021–2025', '2023', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'Tony', 2025, 2025, 2, 6000.00, 10.0, 'recorrente', 'OWNAGE · conferido nas planilhas 2021–2025', '2025', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'Feeling', 2021, 2021, 1, 5650.00, 4.0, 'inativo', 'OWNAGE · conferido nas planilhas 2021–2025', '2021', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'Konai', 2022, 2022, 1, 5270.00, 10.0, 'inativo', 'OWNAGE · conferido nas planilhas 2021–2025', '2022', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'Vinera', 2023, 2025, 4, 4920.00, 10.0, 'recorrente', 'OWNAGE · conferido nas planilhas 2021–2025', '2023,2024,2025', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'Prime Talk', 2021, 2021, 2, 4750.00, 8.0, 'inativo', 'OWNAGE · conferido nas planilhas 2021–2025', '2021', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'Psych', 2023, 2023, 1, 4500.00, 10.0, 'inativo', 'OWNAGE · conferido nas planilhas 2021–2025', '2023', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'Barreto', 2024, 2024, 1, 3800.00, 10.0, 'inativo', 'OWNAGE · conferido nas planilhas 2021–2025', '2024', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'SEO LIMAO', 2025, 2025, 1, 3800.00, 10.0, 'recorrente', 'OWNAGE · conferido nas planilhas 2021–2025', '2025', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'Altamira', 2023, 2023, 2, 3500.00, 10.0, 'inativo', 'OWNAGE · conferido nas planilhas 2021–2025', '2023', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'USBISQUI', 2023, 2023, 1, 3490.00, 10.0, 'inativo', 'OWNAGE · conferido nas planilhas 2021–2025', '2023', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'Reky', 2023, 2023, 1, 3335.00, 10.0, 'inativo', 'OWNAGE · conferido nas planilhas 2021–2025', '2023', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'Zant', 2022, 2022, 2, 3050.00, 10.0, 'inativo', 'OWNAGE · conferido nas planilhas 2021–2025', '2022', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'SadStation', 2021, 2021, 1, 3000.00, 8.0, 'inativo', 'OWNAGE · conferido nas planilhas 2021–2025', '2021', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', '2Strange', 2022, 2022, 1, 2700.00, 10.0, 'inativo', 'OWNAGE · conferido nas planilhas 2021–2025', '2022', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'USINA', 2023, 2023, 1, 2500.00, 10.0, 'inativo', 'OWNAGE · conferido nas planilhas 2021–2025', '2023', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'Sayuri', 2025, 2025, 1, 2500.00, 10.0, 'recorrente', 'OWNAGE · conferido nas planilhas 2021–2025', '2025', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'Dj Caique', 2021, 2021, 1, 2400.00, 8.0, 'inativo', 'OWNAGE · conferido nas planilhas 2021–2025', '2021', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'Chuck', 2022, 2022, 1, 2063.00, 10.0, 'inativo', 'OWNAGE · conferido nas planilhas 2021–2025', '2022', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'Ryan', 2022, 2022, 1, 2000.00, 10.0, 'inativo', 'OWNAGE · conferido nas planilhas 2021–2025', '2022', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'Crosa', 2023, 2023, 1, 1881.00, 10.0, 'inativo', 'OWNAGE · conferido nas planilhas 2021–2025', '2023', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'Garius', 2023, 2023, 1, 1750.00, 10.0, 'inativo', 'OWNAGE · conferido nas planilhas 2021–2025', '2023', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'Blau', 2022, 2022, 2, 1510.00, 8.5, 'inativo', 'OWNAGE · conferido nas planilhas 2021–2025', '2022', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'Theo Kant', 2021, 2021, 1, 1500.00, 7.0, 'inativo', 'OWNAGE · conferido nas planilhas 2021–2025', '2021', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'Bardeo2', 2023, 2023, 1, 1335.00, 10.0, 'inativo', 'OWNAGE · conferido nas planilhas 2021–2025', '2023', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'Dani', 2021, 2021, 1, 1000.00, 9.0, 'inativo', 'OWNAGE · conferido nas planilhas 2021–2025', '2021', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'Amarante', 2023, 2023, 1, 1000.00, 10.0, 'inativo', 'OWNAGE · conferido nas planilhas 2021–2025', '2023', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'Guilherme Kim', 2025, 2025, 1, 1000.00, 10.0, 'recorrente', 'OWNAGE · conferido nas planilhas 2021–2025', '2025', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'MIKKA', 2022, 2022, 1, 919.00, 10.0, 'inativo', 'OWNAGE · conferido nas planilhas 2021–2025', '2022', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'PS', 2024, 2024, 1, 900.00, 10.0, 'inativo', 'OWNAGE · conferido nas planilhas 2021–2025', '2024', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'Kalimera', 2025, 2025, 1, 700.00, 10.0, 'recorrente', 'OWNAGE · conferido nas planilhas 2021–2025', '2025', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'Bardeo', 2022, 2022, 1, 650.00, 8.0, 'inativo', 'OWNAGE · conferido nas planilhas 2021–2025', '2022', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'Zampini', 2022, 2022, 1, 600.00, 10.0, 'inativo', 'OWNAGE · conferido nas planilhas 2021–2025', '2022', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'Yan', 2024, 2024, 1, 600.00, 10.0, 'inativo', 'OWNAGE · conferido nas planilhas 2021–2025', '2024', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'Tree', 2022, 2022, 1, 500.00, 10.0, 'inativo', 'OWNAGE · conferido nas planilhas 2021–2025', '2022', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'Kurt Codein', 2022, 2022, 1, 500.00, 9.0, 'inativo', 'OWNAGE · conferido nas planilhas 2021–2025', '2022', 'gustavowng', false),
  ('aa47f125-4b29-4c2d-b367-88b912f1b33e', 'Uxie', 2022, 2022, 1, 500.00, 9.0, 'inativo', 'OWNAGE · conferido nas planilhas 2021–2025', '2022', 'gustavowng', false);

-- Não duplica se rodar de novo: apaga só as linhas com a nota de conferência acima.
