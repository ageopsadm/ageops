-- Vincular pagamento a projeto (Age Ops)
-- Execute no Supabase SQL Editor.

ALTER TABLE age_payments
ADD COLUMN IF NOT EXISTS projeto_id TEXT,
ADD COLUMN IF NOT EXISTS projeto_nome TEXT;
