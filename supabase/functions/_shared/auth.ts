/* Verificação do token de sessão emitido pela função auth-login.
   Sem isto, qualquer pessoa com a URL da função consegue chamá-la: a chave
   anônima está no HTML e não identifica ninguém. */

const JWT_SECRET = Deno.env.get('AGE_JWT_SECRET') || ''
const enc = new TextEncoder()

export type Claims = {
  sub?: string
  company_id?: string | null
  username?: string
  user_role?: string
  exp?: number
  [k: string]: unknown
}

function fromB64Url(s: string) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, '=')
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
}

/** O Authorization carrega a chave anônima; a sessão vem em header próprio. */
export function sessionToken(req: Request) {
  const own = req.headers.get('x-age-token')
  if (own) return own.trim()
  const h = req.headers.get('authorization') || ''
  return h.toLowerCase().startsWith('bearer ') ? h.slice(7).trim() : ''
}

export async function verifyJwt(token: string): Promise<Claims | null> {
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
    const ok = await crypto.subtle.verify(
      'HMAC',
      key,
      fromB64Url(parts[2]),
      enc.encode(`${parts[0]}.${parts[1]}`),
    )
    if (!ok) return null
    const claims = JSON.parse(new TextDecoder().decode(fromB64Url(parts[1]))) as Claims
    if (typeof claims.exp === 'number' && claims.exp < Math.floor(Date.now() / 1000)) return null
    return claims
  } catch {
    return null
  }
}

/** Claims da requisição, ou null se não houver sessão válida. */
export async function requireSession(req: Request) {
  return await verifyJwt(sessionToken(req))
}

/** A chave anônima é um JWT válido do projeto; não serve como identidade. */
export function isRealUser(claims: Claims | null) {
  return !!claims && !!claims.sub && String(claims.role ?? '') !== 'anon'
}

export const AGE_JWT_CONFIGURED = !!JWT_SECRET

/** Comparação sem vazar tempo, para assinaturas e segredos. */
export function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export function toHex(bytes: Uint8Array) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function hmacHex(algo: 'SHA-1' | 'SHA-256', secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: algo },
    false,
    ['sign'],
  )
  return toHex(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message))))
}
