import { createHmac, timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/app/lib/supabaseClient'

export const SESSION_COOKIE = 'encoretix_session'
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000

export type AdminRole = 'admin' | 'superadmin'

export interface SessionPayload {
  id: string
  role: AdminRole
  exp: number
}

function secret(): string {
  return process.env.AUTH_SECRET || 'encoretix-dev-secret-change-me'
}

function sign(body: string): string {
  return createHmac('sha256', secret()).update(body).digest('base64url')
}

export function createSessionToken(
  payload: { id: string; role: string },
  ttlMs = SESSION_TTL_MS
): string {
  const body = Buffer.from(
    JSON.stringify({ id: String(payload.id), role: payload.role, exp: Date.now() + ttlMs })
  ).toString('base64url')
  return `${body}.${sign(body)}`
}

export function verifySessionToken(token?: string | null): SessionPayload | null {
  if (!token) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null

  const expected = sign(body)
  const given = Buffer.from(sig)
  const want = Buffer.from(expected)
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload
    if (!payload?.id || !payload?.role || !payload?.exp) return null
    if (payload.role !== 'admin' && payload.role !== 'superadmin') return null
    if (Date.now() > payload.exp) return null
    return payload
  } catch {
    return null
  }
}

export function getSessionFromRequest(request: Request): SessionPayload | null {
  const auth = request.headers.get('authorization') || ''
  if (auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim()
    const fromHeader = verifySessionToken(token)
    if (fromHeader) return fromHeader
  }
  const cookie = request.headers.get('cookie') || ''
  const prefix = `${SESSION_COOKIE}=`
  const raw = cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
  if (!raw) return null
  try {
    return verifySessionToken(decodeURIComponent(raw.slice(prefix.length)))
  } catch {
    return null
  }
}

export function requireRole(
  request: Request,
  roles: AdminRole[]
): { session: SessionPayload } | { response: NextResponse } {
  const session = getSessionFromRequest(request)
  if (!session) {
    return {
      response: NextResponse.json(
        { error: 'Sesi tidak valid. Silakan login ulang.' },
        { status: 401 }
      ),
    }
  }
  if (!roles.includes(session.role)) {
    return { response: NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 }) }
  }
  return { session }
}

// Blokir seluruh akses API untuk admin yang dinonaktifkan.
export async function rejectInactiveAdminMutation(
  _request: Request,
  session: SessionPayload
): Promise<NextResponse | null> {
  if (session.role !== 'admin') return null
  try {
    const supabase = getServerSupabase()
    const { data } = await supabase.from('panitia').select('status').eq('id', session.id).maybeSingle()
    if (!data || (data.status ?? 'aktif') === 'nonaktif') {
      return NextResponse.json(
        { error: 'Akun admin dinonaktifkan. Hubungi superadmin.' },
        { status: 403 }
      )
    }
  } catch {
    return NextResponse.json({ error: 'Gagal memverifikasi status akun.' }, { status: 500 })
  }
  return null
}
