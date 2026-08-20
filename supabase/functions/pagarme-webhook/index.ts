import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { constantTimeEqual, hmacHex } from '../_shared/auth.ts'

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

/* Segredo que assina o postback. Na API v1 do Pagar.me é a própria chave de
   API; na v5, o secret configurado no painel do webhook. */
const WEBHOOK_SECRET = Deno.env.get('PAGARME_WEBHOOK_SECRET') || Deno.env.get('PAGARME_API_KEY') || ''

const STATUS_MAP: Record<string, string> = {
  trialing: 'trial',
  trial: 'trial',
  paid: 'active',
  active: 'active',
  canceled: 'canceled',
  cancelled: 'canceled',
  unpaid: 'past_due',
  ended: 'canceled',
}

/**
 * Confere que o corpo veio mesmo do Pagar.me.
 *
 * Sem esta checagem, qualquer pessoa que descubra a URL da função marca a
 * própria assinatura como paga com um POST — o endpoint escreve direto em
 * age_users com a service role.
 *
 * O HMAC é calculado sobre o corpo cru: qualquer reserialização muda os
 * bytes e invalida a comparação.
 */
async function signatureValid(req: Request, rawBody: string) {
  if (!WEBHOOK_SECRET) return false

  const candidates: Array<{ header: string; algo: 'SHA-1' | 'SHA-256' }> = [
    { header: 'x-hub-signature-256', algo: 'SHA-256' },
    { header: 'x-hub-signature', algo: 'SHA-1' },
  ]

  for (const { header, algo } of candidates) {
    const raw = req.headers.get(header)
    if (!raw) continue

    /* Formato "sha1=<hex>" / "sha256=<hex>"; o prefixo manda no algoritmo. */
    const [prefix, value] = raw.includes('=') ? raw.split('=', 2) : ['', raw]
    const effective = prefix.toLowerCase() === 'sha256'
      ? 'SHA-256'
      : prefix.toLowerCase() === 'sha1'
      ? 'SHA-1'
      : algo

    const expected = await hmacHex(effective, WEBHOOK_SECRET, rawBody)
    if (constantTimeEqual(expected, (value || '').trim().toLowerCase())) return true
  }

  return false
}

/**
 * O postback v1 chega como form-urlencoded com chaves aninhadas
 * (subscription[id]); a v5 manda JSON. Aceita os dois.
 */
function parseBody(rawBody: string, contentType: string): Record<string, unknown> {
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(rawBody)
    } catch {
      return {}
    }
  }

  const out: Record<string, unknown> = {}
  for (const [key, value] of new URLSearchParams(rawBody)) {
    const m = key.match(/^([^[]+)\[([^\]]+)\]$/)
    if (m) {
      const [, parent, child] = m
      const node = (out[parent] ??= {}) as Record<string, unknown>
      node[child] = value
    } else {
      out[key] = value
    }
  }
  return out
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type, x-hub-signature, x-hub-signature-256',
      },
    })
  }

  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })

  if (!WEBHOOK_SECRET) {
    console.error('[pagarme-webhook] PAGARME_WEBHOOK_SECRET ausente: recusando tudo.')
    return new Response('webhook secret not configured', { status: 500 })
  }

  try {
    const rawBody = await req.text()

    if (!(await signatureValid(req, rawBody))) {
      console.warn('[pagarme-webhook] assinatura inválida ou ausente; ignorado.')
      return new Response('invalid signature', { status: 401 })
    }

    const body = parseBody(rawBody, req.headers.get('content-type') || '')
    const subscription = (body.subscription ?? {}) as Record<string, unknown>

    /* v1 manda current_status na raiz; v5, status dentro do objeto. */
    const subId = subscription.id ?? body.id
    const rawStatus = subscription.status ?? body.current_status ?? body.status
    const status = rawStatus != null && rawStatus !== ''
      ? STATUS_MAP[String(rawStatus).toLowerCase()] ?? String(rawStatus)
      : null

    if (subId && status) {
      const { error } = await supabase
        .from('age_users')
        .update({ subscription_status: status })
        .eq('pagarme_subscription_id', String(subId))

      if (error) {
        console.error('pagarme-webhook update error:', error)
        return new Response(JSON.stringify({ error: error.message }), { status: 500 })
      }
    }

    return new Response('ok', { status: 200 })
  } catch (e) {
    console.error('[pagarme-webhook]', e)
    return new Response('erro interno', { status: 500 })
  }
})
