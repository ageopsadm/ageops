import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const PAGARME_API_KEY = Deno.env.get('PAGARME_API_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { card_hash, plan_id, customer, username: _username, company_id: _company_id } = await req.json()

    if (!card_hash || !plan_id) {
      return new Response(JSON.stringify({ error: 'card_hash e plan_id são obrigatórios.' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // Criar customer
    const custResp = await fetch('https://api.pagar.me/1/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: PAGARME_API_KEY,
        email: customer?.email,
        name: customer?.name,
        document_number: (customer?.document || '').replace(/\D/g, ''),
      }),
    })
    const cust = await custResp.json()

    if (!custResp.ok || cust.errors || cust.error || !cust.id) {
      return new Response(JSON.stringify({ error: cust.errors || cust.error || cust || 'Falha ao criar customer' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // Criar assinatura com trial 7 dias (planos já criados com trial_days: 7)
    const subResp = await fetch('https://api.pagar.me/1/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: PAGARME_API_KEY,
        plan_id: plan_id,
        card_hash: card_hash,
        customer_id: cust.id,
        trial_days: 7,
        postback_url: 'https://wiiewucszdbbcxzivnyo.supabase.co/functions/v1/pagarme-webhook',
      }),
    })
    const sub = await subResp.json()

    if (!subResp.ok || sub.errors || sub.error) {
      return new Response(JSON.stringify({ error: sub.errors || sub.error || sub }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ subscription_id: sub.id, customer_id: cust.id, status: sub.status }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
