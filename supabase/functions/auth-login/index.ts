import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
/* JWT Secret do projeto (Settings → API → JWT Secret). Sem ele o PostgREST
   não aceita o token emitido aqui e o RLS não consegue identificar o tenant. */
const JWT_SECRET = Deno.env.get('AGE_JWT_SECRET') || ''
/* Duração da sessão. Expirado, o app pede login de novo. */
const TOKEN_TTL_SECONDS = 60 * 60 * 12

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info, x-age-token',
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

/* ── JWT HS256 ──────────────────────────────────────────────────────
   O token vai no Authorization das chamadas ao PostgREST. O Postgres lê
   as claims em request.jwt.claims e o RLS filtra por company_id. Validar
   isso no servidor é o que impede um usuário de trocar o próprio tenant. */
function b64url(bytes: Uint8Array) {
  return toB64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlJson(value: unknown) {
  return b64url(enc.encode(JSON.stringify(value)))
}

async function signJwt(claims: Record<string, unknown>) {
  if (!JWT_SECRET) return null
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss: 'age-ops',
    aud: 'authenticated',
    role: 'authenticated',
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
    ...claims,
  }
  const header = b64urlJson({ alg: 'HS256', typ: 'JWT' })
  const data = `${header}.${b64urlJson(payload)}`
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)))
  return `${data}.${b64url(sig)}`
}

/** Confere assinatura e validade do token emitido acima. */
async function verifyJwt(token: string): Promise<Record<string, unknown> | null> {
  if (!token || !JWT_SECRET) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    )
    const data = enc.encode(`${parts[0]}.${parts[1]}`)
    const sig = fromB64(parts[2].replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(parts[2].length / 4) * 4, '='))
    if (!(await crypto.subtle.verify('HMAC', key, sig, data))) return null
    const claims = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (typeof claims.exp === 'number' && claims.exp < Math.floor(Date.now() / 1000)) return null
    return claims
  } catch {
    return null
  }
}

/* O Authorization das chamadas a Edge Function carrega a anon key, então a
   sessão do usuário viaja num header próprio. */
function bearer(req: Request) {
  const own = req.headers.get('x-age-token')
  if (own) return own.trim()
  const h = req.headers.get('authorization') || ''
  return h.toLowerCase().startsWith('bearer ') ? h.slice(7).trim() : ''
}

/** Sessão devolvida ao navegador: usuário sem segredos + token de acesso. */
async function sessionFor(user: Record<string, unknown>) {
  const token = await signJwt({
    sub: String(user.id ?? ''),
    company_id: user.company_id ? String(user.company_id) : null,
    username: String(user.username ?? '').toLowerCase(),
    user_role: String(user.role ?? ''),
  })
  return {
    ok: true,
    user: sanitizeUser(user),
    access_token: token,
    expires_in: token ? TOKEN_TTL_SECONDS : 0,
    /* Avisa o front que o projeto ainda não tem AGE_JWT_SECRET configurado. */
    token_disabled: !token,
  }
}

/* Nomes que não podem ser tomados por cadastro público: dariam privilégio
   de bootstrap ou se passariam por contas internas. */
const RESERVED_USERNAMES = new Set([
  'vraulin', 'gustavowng', 'admin', 'administrator', 'root', 'suporte',
  'support', 'system', 'sistema', 'ageops', 'age', 'ownage', 'owner',
  'superadmin', 'super', 'master', 'billing', 'financeiro', 'no-reply',
  'noreply', 'postmaster', 'webmaster', 'security', 'seguranca',
])

async function loadUser(login: string) {
  const col = login.includes('@') ? 'email' : 'username'
  const { ok, data } = await rest(`age_users?${col}=eq.${encodeURIComponent(login)}&limit=5`)
  if (!ok || !Array.isArray(data)) return null
  return (data as Record<string, unknown>[]).find((r) => r && r.deleted !== true) || null
}

/** Convite válido: existe, não foi usado e não venceu. */
async function loadInvite(token: string) {
  const { ok, data } = await rest(`age_invites?token=eq.${encodeURIComponent(token)}&limit=1`)
  const inv = ok && Array.isArray(data) ? (data[0] as Record<string, unknown>) : null
  if (!inv || inv.used === true) return null
  const exp = inv.expires_at ? Date.parse(String(inv.expires_at)) : NaN
  if (!Number.isNaN(exp) && exp < Date.now()) return null
  return inv
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

/** Nome da coluna reclamada pelo PostgREST quando ela não existe na tabela. */
function missingColumn(data: unknown): string | null {
  const msg = typeof data === 'string' ? data : String((data as { message?: string })?.message ?? '')
  const m = msg.match(/'([^']+)' column|column "([^"]+)"|Column '([^']+)'/i)
  return m ? (m[1] || m[2] || m[3] || null) : null
}

/** Insere descartando colunas que o schema do projeto não tem. */
async function insertTolerant(table: string, row: Record<string, unknown>) {
  const payload = { ...row }
  for (let attempt = 0; attempt < 15; attempt++) {
    const r = await rest(`${table}?select=*`, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(payload),
    })
    if (r.ok) return Array.isArray(r.data) ? (r.data[0] as Record<string, unknown>) : null
    const col = missingColumn(r.data)
    if (!col || !(col in payload)) throw new Error(String((r.data as { message?: string })?.message ?? 'Falha ao inserir.'))
    delete payload[col]
  }
  throw new Error('Não foi possível ajustar o cadastro ao schema.')
}

const slug = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)

async function usernameTaken(username: string) {
  const { ok, data } = await rest(`age_users?username=eq.${encodeURIComponent(username)}&select=id&limit=1`)
  return ok && Array.isArray(data) && data.length > 0
}

/** Username livre a partir do email, sem colidir e sem cair em nome reservado. */
async function pickUsername(email: string) {
  const base = slug(email.split('@')[0]) || 'user'
  for (let i = 0; i < 60; i++) {
    const candidate = i === 0 ? base : `${base}${i}`
    if (RESERVED_USERNAMES.has(candidate)) continue
    if (!(await usernameTaken(candidate))) return candidate
  }
  return `${base}${Date.now().toString(36)}`
}

/* Campos que o navegador nunca define: privilégio, identidade e cobrança. */
const BLOCKED_SIGNUP_FIELDS = [
  'id', 'password', 'password_hash', 'is_admin', 'is_bootstrap', 'bootstrap',
  'permissions', 'perm_full_bypass', 'created_at',
]

function stripBlocked(row: Record<string, unknown>) {
  const out = { ...row }
  for (const f of BLOCKED_SIGNUP_FIELDS) delete out[f]
  return out
}

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

      return json(await sessionFor(user))
    }

    if (action === 'signup') {
      const raw = (body as unknown as { user?: Record<string, unknown>; company?: Record<string, unknown> })
      const userIn = stripBlocked(raw.user || {})
      const companyIn = stripBlocked(raw.company || {})
      const password = String(body.password || '')
      const email = String(userIn.email || '').trim().toLowerCase()

      if (!email.includes('@')) return json({ error: 'Email inválido.' }, 400)
      if (password.length < 8) return json({ error: 'A senha precisa de ao menos 8 caracteres.' }, 400)
      if (!String(companyIn.name || '').trim()) return json({ error: 'Informe o nome da empresa.' }, 400)

      const existing = await loadUser(email)
      if (existing) return json({ error: 'Este email já está cadastrado.' }, 409)

      const username = await pickUsername(email)

      const company = await insertTolerant('age_companies', {
        ...companyIn,
        name: String(companyIn.name).trim(),
        owner_username: username,
      })
      const companyId = company?.id
      if (!companyId) return json({ error: 'Não foi possível criar a empresa.' }, 500)

      /* role e company_id vêm do servidor: é o que garante que a conta nova
         nasce isolada e sem privilégio elevado. */
      const created = await insertTolerant('age_users', {
        ...userIn,
        username,
        email,
        role: 'admin',
        company_id: companyId,
        company_name: String(companyIn.name).trim(),
        active: true,
        deleted: false,
      })
      if (!created?.id) return json({ error: 'Não foi possível criar o usuário.' }, 500)

      await storeSecret(String(created.id), username, await hashPassword(password))
      return json(await sessionFor(created))
    }

    if (action === 'accept_invite') {
      const raw = (body as unknown as {
        user?: Record<string, unknown>
        colaborador?: Record<string, unknown>
      })
      const token = String(body.token || '')
      const password = String(body.password || '')
      const userIn = stripBlocked(raw.user || {})
      const email = String(userIn.email || '').trim().toLowerCase()

      if (!token) return json({ error: 'Convite inválido.' }, 400)
      if (!email.includes('@')) return json({ error: 'Email inválido.' }, 400)
      if (password.length < 8) return json({ error: 'A senha precisa de ao menos 8 caracteres.' }, 400)

      const inv = await loadInvite(token)
      if (!inv) return json({ error: 'Convite inválido, já usado ou expirado.' }, 404)

      if (await loadUser(email)) return json({ error: 'Este email já está cadastrado.' }, 409)

      /* Empresa e papel vêm do convite, nunca do formulário: é o que impede
         alguém de entrar numa empresa alheia ou se promover a admin. */
      const role = String(inv.role || '').toLowerCase() === 'gestor' ? 'gestor' : 'colaborador'
      const username = await pickUsername(email)

      const created = await insertTolerant('age_users', {
        ...userIn,
        username,
        email,
        role,
        company_id: inv.company_id,
        company_name: inv.company_name ?? '',
        active: true,
        deleted: false,
        subscription_status: null,
        trial_ends_at: null,
        plan: null,
      })
      if (!created?.id) return json({ error: 'Não foi possível criar o usuário.' }, 500)

      await storeSecret(String(created.id), username, await hashPassword(password))

      if (raw.colaborador && Object.keys(raw.colaborador).length) {
        try {
          await insertTolerant('age_colaboradores', {
            ...stripBlocked(raw.colaborador),
            company_id: inv.company_id,
            usuario_username: username,
            created_by: 'system',
            status: 'ativo',
          })
        } catch (e) {
          console.error('[accept_invite colaborador]', e)
        }
      }

      await rest(`age_invites?id=eq.${encodeURIComponent(String(inv.id))}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ used: true, used_at: new Date().toISOString() }),
      }).catch(() => {})

      return json(await sessionFor(created))
    }

    if (action === 'set_password') {
      const login = String(body.username || body.login || '').trim().toLowerCase()
      const newPassword = String(body.new_password || '')
      const currentPassword = String(body.current_password || '')
      const inviteToken = String(body.invite_token || '')
      if (!login || newPassword.length < 8) {
        return json({ error: 'Informe o usuário e uma senha de ao menos 8 caracteres.' }, 400)
      }

      const user = await loadUser(login)
      if (!user) return json({ error: 'Usuário não encontrado.' }, 404)

      const secret = await loadSecret(String(user.id))
      const stored = String(secret?.password_hash ?? user.password_hash ?? user.password ?? '')

      /* Trocar senha exige provar identidade por um destes caminhos.
         Sem isso, qualquer um define a senha de uma conta que ainda não tem. */
      let authorized = false
      if (stored && currentPassword) {
        authorized = await verifyPassword(currentPassword, stored)
      }
      if (!authorized && inviteToken) {
        const { ok, data } = await rest(
          `age_invites?token=eq.${encodeURIComponent(inviteToken)}&select=email,used&limit=1`,
        )
        const inv = ok && Array.isArray(data) ? (data[0] as Record<string, unknown>) : null
        authorized = !!inv && inv.used !== true &&
          String(inv.email || '').toLowerCase() === String(user.email || '').toLowerCase()
      }
      if (!authorized) {
        const claims = await verifyJwt(bearer(req))
        authorized = !!claims && String(claims.sub || '') === String(user.id)
      }

      if (!authorized) {
        await wait(400)
        return json({ error: 'Não autorizado a alterar esta senha.' }, 401)
      }

      await storeSecret(String(user.id), String(user.username || login), await hashPassword(newPassword))
      return json({ ok: true })
    }

    if (action === 'refresh') {
      const claims = await verifyJwt(bearer(req))
      if (!claims?.sub) return json({ error: 'Sessão expirada.' }, 401)
      const { ok, data } = await rest(`age_users?id=eq.${encodeURIComponent(String(claims.sub))}&limit=1`)
      const user = ok && Array.isArray(data) ? (data[0] as Record<string, unknown>) : null
      if (!user || user.deleted === true || user.active === false) {
        return json({ error: 'Conta indisponível.' }, 401)
      }
      return json(await sessionFor(user))
    }

    return json({ error: 'Ação desconhecida.' }, 400)
  } catch (e) {
    console.error('[auth-login]', e)
    return json({ error: 'Erro interno de autenticação.' }, 500)
  }
})
