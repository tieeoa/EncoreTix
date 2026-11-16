import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getServerSupabase } from '../../../lib/supabaseClient'
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_MS } from '@/lib/serverAuth'

export const dynamic = 'force-dynamic'

// POST /api/auth/login
// Login untuk panitia (admin / superadmin). Return token sederhana.
export async function POST(request: Request) {
  try {
    const { username, password } = await request.json()
    if (!username || !password) {
      return NextResponse.json({ error: 'Username dan password wajib diisi' }, { status: 400 })
    }

    const supabase = getServerSupabase()
    const { data: user, error } = await supabase
      .from('panitia')
      .select('id, nama, username, role, password')
      .eq('username', username)
      .maybeSingle()

    if (error) throw new Error(error.message)

    const passwordValid = user ? await bcrypt.compare(password, user.password) : false

    if (!user || !passwordValid) {
      return NextResponse.json(
        { error: 'Password atau username mungkin salah' },
        { status: 401 }
      )
    }

    const token = createSessionToken({ id: user.id, role: user.role })
    const res = NextResponse.json({
      data: { token, id: user.id, nama: user.nama, username: user.username, role: user.role },
    })
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
      secure: process.env.NODE_ENV === 'production',
    })
    return res
  } catch (err) {
    console.error('Login error:', err)
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}