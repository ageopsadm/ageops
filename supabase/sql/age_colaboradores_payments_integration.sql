-- Integração pagamentos × colaboradores (Age Ops)
-- Execute no Supabase SQL Editor.

ALTER TABLE age_colaboradores
ADD COLUMN IF NOT EXISTS forma_recebimento TEXT DEFAULT 'pix',
ADD COLUMN IF NOT EXISTS pix_tipo TEXT,
ADD COLUMN IF NOT EXISTS pix_chave TEXT,
ADD COLUMN IF NOT EXISTS banco TEXT,
ADD COLUMN IF NOT EXISTS agencia TEXT,
ADD COLUMN IF NOT EXISTS conta TEXT,
ADD COLUMN IF NOT EXISTS tipo_conta TEXT DEFAULT 'corrente',
ADD COLUMN IF NOT EXISTS usuario_username TEXT;

ALTER TABLE age_payments
ADD COLUMN IF NOT EXISTS colaborador_id TEXT,
ADD COLUMN IF NOT EXISTS colaborador_nome TEXT;

COMMENT ON COLUMN age_colaboradores.usuario_username IS 'Username em age_users após convite — acelera notificações de pagamento';
