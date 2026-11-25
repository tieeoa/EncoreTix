import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getServerSupabase } from '@/app/lib/supabaseClient'
import { requireRole } from '@/lib/serverAuth'

export const dynamic = 'force-dynamic'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireRole(request, ['superadmin'])
    if ('response' in auth) return auth.response
    const { id } = await params
    const body = await request.json()
    const supabase = getServerSupabase()

    const { data: existing } = await supabase.from('panitia').select('id, nama, username, role, status').eq('id', id).maybeSingle()
    if (!existing) return NextResponse.json({ error: 'Akun tidak ditemukan' }, { status: 404 })
    if (existing.role === 'superadmin') return NextResponse.json({ error: 'Akun superadmin tidak dikelola di sini' }, { status: 403 })

    const patch: Record<string, unknown> = {}
    if (body.nama !== undefined) {
      const nama = String(body.nama || '').trim()
      if (!nama) return NextResponse.json({ error: 'Nama wajib diisi' }, { status: 400 })
      patch.nama = nama
    }
    if (body.username !== undefined) {
      const username = String(body.username || '').trim()
      if (!username) return NextResponse.json({ error: 'Username wajib diisi' }, { status: 400 })
      const { data: dup } = await supabase.from('panitia').select('id').eq('username', username).neq('id', id).maybeSingle()
      if (dup) return NextResponse.json({ error: 'Username sudah dipakai' }, { status: 409 })
      patch.username = username
    }
    if (body.password !== undefined && String(body.password) !== '') {
      const password = String(body.password)
      if (password.length < 6) return NextResponse.json({ error: 'Password minimal 6 karakter' }, { status: 400 })
      patch.password = await bcrypt.hash(password, 10)
    }
    if (body.status !== undefined) {
      const status = String(body.status)
      if (status !== 'aktif' && status !== 'nonaktif') {
        return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 })
      }
      patch.status = status
    }
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Tidak ada perubahan' }, { status: 400 })

    const { data, error } = await supabase
      .from('panitia')
      .update(patch)
      .eq('id', id)
      .select('id, nama, username, role, status, created_at')
      .single()
    if (error) throw new Error(error.message)
    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Terjadi kesalahan' }, { status: 500 })
  }
}


