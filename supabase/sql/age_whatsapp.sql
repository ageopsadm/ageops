-- AGE OPS · WhatsApp como segunda tela do assistente
-- Rode no SQL Editor do Supabase (produção ou staging).
-- O webhook (service_role) escreve aqui. Anon/authenticated não leem o log.

ALTER TABLE public.age_users
  ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_pair_code TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_pair_expires TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS whatsapp_linked_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS age_users_whatsapp_phone_uidx
  ON public.age_users (whatsapp_phone)
  WHERE whatsapp_phone IS NOT NULL AND length(whatsapp_phone) >= 10;

CREATE INDEX IF NOT EXISTS age_users_whatsapp_pair_idx
  ON public.age_users (whatsapp_pair_code)
  WHERE whatsapp_pair_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.age_whatsapp_pending (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
  user_id       TEXT NOT NULL,
  company_id    TEXT,
  phone         TEXT NOT NULL,
  acao          TEXT NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
  confirmacao   TEXT
);

CREATE INDEX IF NOT EXISTS age_whatsapp_pending_phone_idx
  ON public.age_whatsapp_pending (phone, created_at DESC);

CREATE TABLE IF NOT EXISTS public.age_whatsapp_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  provider_msg_id TEXT,
  phone         TEXT NOT NULL,
  user_id       TEXT,
  company_id    TEXT,
  direction     TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  body          TEXT,
  acao          TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS age_whatsapp_messages_provider_uidx
  ON public.age_whatsapp_messages (provider_msg_id)
  WHERE provider_msg_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS age_whatsapp_messages_phone_idx
  ON public.age_whatsapp_messages (phone, created_at DESC);

ALTER TABLE public.age_whatsapp_pending ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.age_whatsapp_messages ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.age_whatsapp_pending FROM anon, authenticated;
REVOKE ALL ON public.age_whatsapp_messages FROM anon, authenticated;

COMMENT ON TABLE public.age_whatsapp_pending IS
  'Ação do assistente esperando SIM no WhatsApp. Só a Edge Function (service_role) acessa.';
COMMENT ON TABLE public.age_whatsapp_messages IS
  'Log curto das mensagens WhatsApp ↔ Age Ops. Só a Edge Function acessa.';
