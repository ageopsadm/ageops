import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    })
  }

  try {
    const body = await req.json()
    const subId = body?.subscription?.id
    const raw = body?.subscription?.status
    const status =
      raw != null && raw !== ''
        ? STATUS_MAP[String(raw).toLowerCase()] ?? String(raw)
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
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(msg, { status: 500 })
  }
})
