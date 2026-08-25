import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { constantTimeEqual, hmacHex, isRealUser, requireSession } from '../_shared/auth.ts'
import {
  consultSnapshot,
  executeAiAction,
  serviceClient,
  type AgeUser,
} from '../_shared/ai-execute.ts'

const CLAUDE_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') || ''
const CLAUDE_MODEL = Deno.env.get('ANTHROPIC_MODEL') || 'claude-haiku-4-5-20251001'
const VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN') || ''
const APP_SECRET = Deno.env.get('WHATSAPP_APP_SECRET') || ''
const META_TOKEN = Deno.env.get('WHATSAPP_TOKEN') || ''
const META_PHONE_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') || ''
const EVO_URL = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/+$/, '')
const EVO_KEY = Deno.env.get('EVOLUTION_API_KEY') || ''
const EVO_INSTANCE = Deno.env.get('EVOLUTION_INSTANCE') || 'ageops'
const EVO_WEBHOOK_SECRET = Deno.env.get('EVOLUTION_WEBHOOK_SECRET') || ''
const PROVIDER = (Deno.env.get('WHATSAPP_PROVIDER') || (META_TOKEN ? 'meta' : EVO_URL ? 'evolution' : '')).toLowerCase()

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-age-token, x-evolution-secret',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
}

const SYSTEM_PROMPT = `Você é o assistente do Age Ops pelo WhatsApp.
O usuário manda uma frase. Extraia a ação em JSON, sem markdown.

AÇÕES: criar_projeto, criar_cliente, criar_orcamento, criar_evento, criar_gasto,
criar_tarefa, criar_tarefas, criar_pagamento, consultar, desconhecido.

criar_projeto: { "acao":"criar_projeto", "confirmacao":"...", "dados": { "nome":"", "cliente_nome":"", "valor_total":null, "data_entrega":null, "status":"em_producao" } }
criar_cliente: { "acao":"criar_cliente", "confirmacao":"...", "dados": { "nome":"", "telefone":null } }
criar_orcamento: { "acao":"criar_orcamento", "confirmacao":"...", "dados": { "titulo":"", "cliente_nome":"", "valor_total":null, "validade_dias":15 } }
criar_evento: { "acao":"criar_evento", "confirmacao":"...", "dados": { "titulo":"", "data_inicio":"YYYY-MM-DD", "hora_inicio":null, "tipo":"reuniao" } }
criar_gasto: { "acao":"criar_gasto", "confirmacao":"...", "dados": { "descricao":"", "valor":0, "categoria":null, "data":"YYYY-MM-DD" } }
criar_tarefa: { "acao":"criar_tarefa", "confirmacao":"...", "dados": { "titulo":"", "prazo":null } }
criar_tarefas: { "acao":"criar_tarefas", "confirmacao":"...", "dados": { "tarefas":["..."], "prazo":null } }
criar_pagamento: { "acao":"criar_pagamento", "confirmacao":"...", "dados": { "nome_destinatario":"", "valor":0, "projeto_nome":null, "tipo_destinatario":"fornecedor", "data_vencimento":null, "status":"pendente", "forma_pagamento":"pix", "descricao":null } }
consultar: { "acao":"consultar", "resposta":"texto curto em português, com os números do contexto" }
desconhecido: { "acao":"desconhecido", "resposta":"Não entendi. Exemplos: Pagamento 2500 pro João do projeto Nike · Novo projeto Nike Campanha R$12k prazo 10/09 · Quanto paguei esse mês?" }

Regras: datas relativas usam contexto.data_iso como hoje. 50k = 50000. Sempre JSON puro.`

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS })
}

export function normalizePhone(raw: string) {
  let d = String(raw || '').replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.length === 10 || d.length === 11) d = '55' + d
  return d
}

function isYes(t: string) {
  return /^(sim|s|yes|ok|confirma|confirmar|pode|pode criar|isso|uai sim)\b/i.test(t.trim())
}

function isNo(t: string) {
  return /^(n[aã]o|nao|n|cancelar|cancela|deixa)\b/i.test(t.trim())
}

function pairCodeFrom(text: string) {
  const m = text.trim().match(/^(?:vincular|ligar|conectar|parear|code|c[oó]digo)[:\s-]*([a-z0-9]{4,8})$/i)
    || text.trim().match(/^age[\s-]?([a-z0-9]{4,8})$/i)
  return m ? String(m[1]).toUpperCase() : ''
}

function helpText() {
  return [
    'Oi, sou o Age Ops. Manda em texto o que quiser anotar:',
    '• Pagamento 2.500 pro João do projeto Nike',
    '• Novo projeto Nike Campanha 12 mil prazo 10/09',
    '• Gasto 180 uber gravação',
    '• Tarefa ligar pro cliente amanhã',
    '• Quanto paguei esse mês?',
    'Eu confirmo antes de gravar. Responda SIM ou NÃO.',
  ].join('\n')
}

type Inbound = { phone: string; text: string; msgId: string }

function parseMeta(body: Record<string, unknown>): Inbound | null {
  const entry = Array.isArray(body.entry) ? body.entry[0] as Record<string, unknown> : null
  const changes = entry && Array.isArray(entry.changes) ? entry.changes[0] as Record<string, unknown> : null
  const value = changes?.value as Record<string, unknown> | undefined
  const msg = Array.isArray(value?.messages) ? value!.messages[0] as Record<string, unknown> : null
  if (!msg) return null
  const from = normalizePhone(String(msg.from || ''))
  let text = ''
  if (msg.type === 'text') text = String((msg.text as { body?: string } | undefined)?.body || '')
  else if (msg.type === 'button') text = String((msg.button as { text?: string } | undefined)?.text || '')
  else if (msg.type === 'interactive') {
    const inter = msg.interactive as { button_reply?: { title?: string }; list_reply?: { title?: string } }
    text = String(inter?.button_reply?.title || inter?.list_reply?.title || '')
  }
  const msgId = String(msg.id || '')
  if (!from || !text.trim()) return null
  return { phone: from, text: text.trim(), msgId }
}

function parseEvolution(body: Record<string, unknown>): Inbound | null {
  const data = (body.data || body) as Record<string, unknown>
  const key = (data.key || {}) as { remoteJid?: string; fromMe?: boolean; id?: string }
  if (key.fromMe) return null
  const jid = String(key.remoteJid || data.sender || '')
  if (jid.includes('@g.us') || jid.includes('status@')) return null
  const phone = normalizePhone(jid.split('@')[0])
  const message = (data.message || {}) as Record<string, unknown>
  const text = String(
    message.conversation
    || (message.extendedTextMessage as { text?: string } | undefined)?.text
    || data.body
    || '',
  ).trim()
  const msgId = String(key.id || data.id || '')
  if (!phone || !text) return null
  return { phone, text, msgId }
}

async function metaSignatureOk(req: Request, raw: string) {
  if (!APP_SECRET) return false
  const header = req.headers.get('x-hub-signature-256') || ''
  const hex = header.toLowerCase().startsWith('sha256=') ? header.slice(7) : header
  if (!hex) return false
  const expected = await hmacHex('SHA-256', APP_SECRET, raw)
  return constantTimeEqual(expected, hex.trim().toLowerCase())
}

function evolutionSecretOk(req: Request) {
  if (!EVO_WEBHOOK_SECRET) return false
  const header = req.headers.get('x-evolution-secret') || req.headers.get('apikey') || ''
  const qs = new URL(req.url).searchParams.get('secret') || ''
  return constantTimeEqual(header, EVO_WEBHOOK_SECRET) || constantTimeEqual(qs, EVO_WEBHOOK_SECRET)
}

async function sendWhatsApp(phone: string, text: string) {
  const body = text.slice(0, 3500)
  if (PROVIDER === 'evolution' && EVO_URL && EVO_KEY) {
    await fetch(`${EVO_URL}/message/sendText/${encodeURIComponent(EVO_INSTANCE)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
      body: JSON.stringify({ number: phone, text: body }),
    })
    return
  }
  if (META_TOKEN && META_PHONE_ID) {
    await fetch(`https://graph.facebook.com/v21.0/${META_PHONE_ID}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${META_TOKEN}` },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body, preview_url: false },
      }),
    })
  }
}

async function interpret(comando: string, contexto: Record<string, unknown>) {
  if (!CLAUDE_API_KEY) {
    return { acao: 'erro', resposta: 'Assistente sem chave de IA no servidor.' }
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Contexto: ${JSON.stringify(contexto)}\n\nMensagem: "${comando}"` }],
    }),
  })
  const data = await res.json()
  const texto = (data?.content || []).find((b: { type?: string }) => b?.type === 'text')?.text
    || data?.content?.[0]?.text
    || ''
  let cleaned = String(texto || '').trim()
  if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    return { acao: 'desconhecido', resposta: cleaned || 'Não entendi.' }
  }
}

async function findUserByPhone(sb: ReturnType<typeof serviceClient>, phone: string) {
  const { data: linked } = await sb
    .from('age_users')
    .select('id, username, name, company_id, company_name, role, phone, whatsapp_phone')
    .eq('whatsapp_phone', phone)
    .limit(1)
    .maybeSingle()
  if (linked) return linked as AgeUser

  const local = phone.startsWith('55') ? phone.slice(2) : phone
  const { data: byReg } = await sb
    .from('age_users')
    .select('id, username, name, company_id, company_name, role, phone, whatsapp_phone')
    .or(`phone.eq.${phone},phone.eq.${local}`)
    .is('whatsapp_phone', null)
    .limit(1)
    .maybeSingle()
  return (byReg as AgeUser) || null
}

async function bindPhone(sb: ReturnType<typeof serviceClient>, userId: string, phone: string) {
  await sb.from('age_users').update({
    whatsapp_phone: phone,
    whatsapp_linked_at: new Date().toISOString(),
    whatsapp_pair_code: null,
    whatsapp_pair_expires: null,
  }).eq('id', userId)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  if (req.method === 'GET') {
    const url = new URL(req.url)
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')
    if (mode === 'subscribe' && VERIFY_TOKEN && token === VERIFY_TOKEN && challenge) {
      return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } })
    }
    return json({ ok: true, service: 'whatsapp-webhook' })
  }

  if (req.method !== 'POST') return json({ erro: 'método' }, 405)

  const raw = await req.text()
  let body: Record<string, unknown> = {}
  try {
    body = raw ? JSON.parse(raw) : {}
  } catch {
    body = {}
  }

  const action = String(body.action || '')
  if (action === 'issue_pair_code' || action === 'unlink' || action === 'status') {
    const claims = await requireSession(req)
    if (!isRealUser(claims)) return json({ erro: 'Faça login.' }, 401)
    const sb = serviceClient()
    if (action === 'unlink') {
      await sb.from('age_users').update({
        whatsapp_phone: null,
        whatsapp_linked_at: null,
        whatsapp_pair_code: null,
        whatsapp_pair_expires: null,
      }).eq('id', String(claims!.sub))
      return json({ ok: true, linked: false })
    }
    if (action === 'status') {
      const { data } = await sb.from('age_users')
        .select('whatsapp_phone, whatsapp_linked_at, phone')
        .eq('id', String(claims!.sub))
        .maybeSingle()
      return json({
        ok: true,
        linked: !!data?.whatsapp_phone,
        whatsapp_phone: data?.whatsapp_phone || null,
        signup_phone: data?.phone || null,
      })
    }
    const code = String(Math.floor(100000 + Math.random() * 900000))
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString()
    await sb.from('age_users').update({
      whatsapp_pair_code: code,
      whatsapp_pair_expires: expires,
    }).eq('id', String(claims!.sub))
    return json({ ok: true, code, expires })
  }

  const looksMeta = body.object === 'whatsapp_business_account' || Array.isArray(body.entry)
  const looksEvo = !looksMeta && !!(body.event || body.data || body.instance)
  if (looksMeta) {
    if (!(await metaSignatureOk(req, raw))) return json({ erro: 'assinatura' }, 401)
  } else if (looksEvo) {
    if (!evolutionSecretOk(req)) return json({ erro: 'assinatura' }, 401)
  } else {
    return json({ ok: true, ignored: true })
  }

  const inbound = looksMeta ? parseMeta(body) : parseEvolution(body)
  if (!inbound) return json({ ok: true, ignored: true })

  const sb = serviceClient()
  if (inbound.msgId) {
    const { data: dup } = await sb.from('age_whatsapp_messages')
      .select('id')
      .eq('provider_msg_id', inbound.msgId)
      .maybeSingle()
    if (dup) return json({ ok: true, duplicate: true })
  }

  await sb.from('age_whatsapp_messages').insert({
    provider_msg_id: inbound.msgId || null,
    phone: inbound.phone,
    direction: 'in',
    body: inbound.text.slice(0, 2000),
  })

  const reply = async (text: string, extra?: { user?: AgeUser; acao?: string }) => {
    await sendWhatsApp(inbound.phone, text)
    await sb.from('age_whatsapp_messages').insert({
      phone: inbound.phone,
      user_id: extra?.user?.id || null,
      company_id: extra?.user?.company_id || null,
      direction: 'out',
      body: text.slice(0, 2000),
      acao: extra?.acao || null,
    })
  }

  try {
    const pair = pairCodeFrom(inbound.text)
    if (pair) {
      const { data: owner } = await sb.from('age_users')
        .select('id, username, name, company_id, whatsapp_pair_code, whatsapp_pair_expires')
        .eq('whatsapp_pair_code', pair)
        .limit(1)
        .maybeSingle()
      if (!owner) {
        await reply('Código inválido ou já usado. Gere outro em Meu perfil → WhatsApp.')
        return json({ ok: true })
      }
      if (owner.whatsapp_pair_expires && new Date(owner.whatsapp_pair_expires).getTime() < Date.now()) {
        await reply('Esse código expirou. Gere outro no Age Ops.')
        return json({ ok: true })
      }
      await bindPhone(sb, String(owner.id), inbound.phone)
      await reply(`Pronto, ${owner.name || owner.username}. Este WhatsApp está ligado à sua conta. Pode mandar: pagamento, projeto, gasto, tarefa.`)
      return json({ ok: true, linked: true })
    }

    const found = await findUserByPhone(sb, inbound.phone)
    let user = found
    if (found && !(found as { whatsapp_phone?: string }).whatsapp_phone) {
      await bindPhone(sb, String(found.id), inbound.phone)
    }

    if (!user) {
      await reply('Não achei sua conta. No Age Ops: Meu perfil → WhatsApp → gerar código, e me mande: vincular 123456')
      return json({ ok: true, unbound: true })
    }

    const text = inbound.text.trim()
    if (/^(oi|ol[aá]|hey|ajuda|help|menu|\?)$/i.test(text)) {
      await reply(helpText(), { user, acao: 'ajuda' })
      return json({ ok: true })
    }

    const { data: pending } = await sb.from('age_whatsapp_pending')
      .select('*')
      .eq('phone', inbound.phone)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (pending) {
      if (isNo(text)) {
        await sb.from('age_whatsapp_pending').delete().eq('id', pending.id)
        await reply('Cancelado. Nada foi gravado.', { user, acao: 'cancelar' })
        return json({ ok: true })
      }
      if (isYes(text)) {
        try {
          const msg = await executeAiAction(sb, user, pending.acao, pending.payload || {})
          await sb.from('age_whatsapp_pending').delete().eq('id', pending.id)
          await reply(msg, { user, acao: pending.acao })
        } catch (err) {
          const m = err instanceof Error ? err.message : String(err)
          await reply(`Não consegui gravar: ${m}`, { user, acao: 'erro' })
        }
        return json({ ok: true })
      }
    }

    const snap = await consultSnapshot(sb, user.company_id ? String(user.company_id) : null)
    const now = new Date()
    const parsed = await interpret(text, {
      empresa: user.company_name || '',
      usuario: user.name || user.username || '',
      data_iso: now.toISOString().slice(0, 10),
      data_hoje: now.toLocaleDateString('pt-BR'),
      projetos: snap.projetos,
      pagamentos_mes: snap.pagamentos,
    })
    const acao = String(parsed.acao || 'desconhecido')

    if (acao === 'consultar' || acao === 'desconhecido' || acao === 'erro') {
      await reply(String(parsed.resposta || helpText()), { user, acao })
      return json({ ok: true, acao })
    }

    await sb.from('age_whatsapp_pending').delete().eq('phone', inbound.phone)
    await sb.from('age_whatsapp_pending').insert({
      user_id: String(user.id),
      company_id: user.company_id || null,
      phone: inbound.phone,
      acao,
      payload: parsed.dados || {},
      confirmacao: parsed.confirmacao || null,
    })
    const ask = String(parsed.confirmacao || `Posso gravar essa ação (${acao})?`)
    await reply(`${ask}\n\nResponda SIM para gravar ou NÃO para cancelar.`, { user, acao: 'pendente' })
    return json({ ok: true, acao, pending: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[whatsapp-webhook]', err)
    try { await reply(`Deu erro aqui: ${msg}`) } catch { /* ignore */ }
    return json({ ok: false, erro: msg }, 500)
  }
})
