import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// POST /api/auth/logout
// Sesi admin/superadmin sekarang disimpan per-tab di sessionStorage (client-side).
export async function POST() {
  return NextResponse.json({ ok: true })
}
