import { NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/serverAuth'

export const dynamic = 'force-dynamic'

// POST /api/auth/logout
// Hapus cookie sesi admin/superadmin.
export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    secure: process.env.NODE_ENV === 'production',
  })
  return res
}
