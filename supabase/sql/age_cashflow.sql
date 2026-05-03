-- Executar no Supabase SQL Editor.
-- Ajuste políticas RLS conforme seu modelo (por company_id).

CREATE TABLE IF NOT EXISTS age_cashflow (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id text,
  mes int,
  ano int,
  tipo text, -- 'receita' | 'custo_fixo' | 'custo_variavel' | 'projecao'
  categoria text, -- 'pessoal' | 'administrativo' | 'marketing' | 'financeiro' | 'projeto'
  descricao text,
  quantidade numeric DEFAULT 1,
  valor_unitario numeric DEFAULT 0,
  valor_total numeric DEFAULT 0,
  cliente text,
  projeto text,
  data_venda date,
  data_recebimento date,
  created_at bigint DEFAULT (extract(epoch from now()) * 1000)::bigint,
  updated_at bigint DEFAULT (extract(epoch from now()) * 1000)::bigint
);

CREATE INDEX IF NOT EXISTS idx_age_cashflow_company_mes_ano ON age_cashflow (company_id, ano, mes);

COMMENT ON TABLE age_cashflow IS 'Fluxo de caixa — lançamentos por empresa/mês';
