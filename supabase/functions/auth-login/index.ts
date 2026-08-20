import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

/** Colunas que nunca podem voltar para o navegador. */
const SECRET_COLUMNS = ['password_hash', 'password', 'pass']

async function rest(path: string, init: RequestInit = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...((init.headers as Record<string, string>) || {}),
    },
  })
  const text = await r.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  return { ok: r.ok, status: r.status, data }
}

/* ── Hash de senha: PBKDF2-SHA256 com salt aleatório por usuário ── */
const enc = new TextEncoder()
const ITERATIONS = 120000

function toB64(bytes: Uint8Array) {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

function fromB64(s: string) {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
}

async function derive(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    256,
  )
  return new Uint8Array(bits)
}

async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const bits = await derive(password, salt, ITERATIONS)
  return `pbkdf2$${ITERATIONS}$${toB64(salt)}$${toB64(bits)}`
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function verifyPassword(password: string, stored: string) {
  if (!stored) return false
  if (stored.startsWith('pbkdf2$')) {
    const parts = stored.split('$')
    if (parts.length !== 4) return false
    const iterations = parseInt(parts[1], 10) || ITERATIONS
    const bits = await derive(password, fromB64(parts[2]), iterations)
    return constantTimeEqual(toB64(bits), parts[3])
  }
  /* Legado: senha gravada em texto puro antes desta migração. */
  return constantTimeEqual(password, stored)
}

function sanitizeUser(u: Record<string, unknown>) {
  const out = { ...u }
  for (const c of SECRET_COLUMNS) delete out[c]
  return out
}

async function loadUser(login: string) {
  const col = login.includes('@') ? 'email' : 'username'
  const { ok, data } = await rest(`age_users?${col}=eq.${encodeURIComponent(login)}&limit=5`)
  if (!ok || !Array.isArray(data)) return null
  return (data as Record<string, unknown>[]).find((r) => r && r.deleted !== true) || null
}

async function loadSecret(userId: string) {
  const { ok, data } = await rest(`age_user_secrets?user_id=eq.${encodeURIComponent(userId)}&limit=1`)
  if (!ok || !Array.isArray(data)) return null
  return (data as Record<string, unknown>[])[0] || null
}

async function storeSecret(userId: string, username: string, passwordHash: string) {
  await rest('age_user_secrets?on_conflict=user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      user_id: userId,
      username: String(username || '').toLowerCase(),
      password_hash: passwordHash,
      updated_at: new Date().toISOString(),
    }),
  })
  /* Remove a cópia em texto puro da tabela que o navegador consegue ler. */
  await rest(`age_users?id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ password_hash: null }),
  }).catch(() => {})
}

/** Atraso em falhas para desencorajar força bruta. */
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ error: 'Função sem SUPABASE_SERVICE_ROLE_KEY configurada.' }, 500)
  }

  let body: Record<string, string> = {}
  try {
    body = await req.json()
  } catch {
    return json({ error: 'JSON inválido.' }, 400)
  }

  const action = String(body.action || 'login').toLowerCase()

  try {
    if (action === 'login') {
      const login = String(body.login || '').trim().toLowerCase()
      const password = String(body.password || '')
      if (!login || !password) return json({ error: 'Informe usuário e senha.' }, 400)

      const user = await loadUser(login)
      if (!user) {
        await wait(400)
        return json({ error: 'Usuário ou senha incorretos.' }, 401)
      }

      const secret = await loadSecret(String(user.id))
      const stored = String(secret?.password_hash ?? user.password_hash ?? user.password ?? '')
      if (!stored) {
        await wait(400)
        return json({ error: 'Conta sem senha definida. Peça a redefinição ao administrador.' }, 401)
      }

      const valid = await verifyPassword(password, stored)
      if (!valid) {
        await wait(400)
        return json({ error: 'Usuário ou senha incorretos.' }, 401)
      }

      if (user.active === false || user.active === 'false') {
        return json({ error: 'Usuário inativo. Contate o administrador.' }, 423)
      }

      /* Migração transparente: senha em texto puro vira hash no primeiro login válido. */
      if (!stored.startsWith('pbkdf2$')) {
        try {
          await storeSecret(String(user.id), String(user.username || ''), await hashPassword(password))
        } catch (_) { /* login não deve falhar por causa da migração */ }
      }

      return json({ ok: true, user: sanitizeUser(user) })
    }

    if (action === 'set_password') {
      const login = String(body.username || body.login || '').trim().toLowerCase()
      const newPassword = String(body.new_password || '')
      const currentPassword = String(body.current_password || '')
      if (!login || newPassword.length < 6) {
        return json({ error: 'Informe o usuário e uma senha de ao menos 6 caracteres.' }, 400)
      }

      const user = await loadUser(login)
      if (!user) return json({ error: 'Usuário não encontrado.' }, 404)

      const secret = await loadSecret(String(user.id))
      const stored = String(secret?.password_hash ?? user.password_hash ?? user.password ?? '')

      /* Sem senha ainda (cadastro/convite recém-criado): primeira definição é livre.
         Já existindo senha, exige a atual — impede troca de senha alheia. */
      if (stored) {
        const valid = currentPassword ? await verifyPassword(currentPassword, stored) : false
        if (!valid) {
          await wait(400)
          return json({ error: 'Senha atual incorreta.' }, 401)
        }
      }

      await storeSecret(String(user.id), String(user.username || login), await hashPassword(newPassword))
      return json({ ok: true })
    }

    return json({ error: 'Ação desconhecida.' }, 400)
  } catch (e) {
    console.error('[auth-login]', e)
    return json({ error: 'Erro interno de autenticação.' }, 500)
  }
})
