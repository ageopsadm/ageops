-- Executar no Supabase SQL Editor (uma vez).
-- Custo fixo com recorrente_mensal = true aplica o valor em todos os meses do ano.

ALTER TABLE age_cashflow
  ADD COLUMN IF NOT EXISTS recorrente_mensal boolean DEFAULT false;

COMMENT ON COLUMN age_cashflow.recorrente_mensal IS 'Se true, o custo fixo replica em todos os 12 meses do ano (mes = mês de referência no cadastro)';
