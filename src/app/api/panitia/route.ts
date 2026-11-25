import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getServerSupabase } from '@/app/lib/supabaseClient'
import { requireRole } from '@/lib/serverAuth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const auth = requireRole(request, ['superadmin'])
    if ('response' in auth) return auth.response
    const supabase = getServerSupabase()
    const { data, error } = await supabase
      .from('panitia')
      .select('id, nama, username, role, status, created_at')
      .eq('role', 'admin')
      .order('nama', { ascending: true })
    if (error) throw new Error(error.message)
    return NextResponse.json({ data: data || [] })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Terjadi kesalahan' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = requireRole(request, ['superadmin'])
    if ('response' in auth) return auth.response
    const body = await request.json()
    const nama = String(body.nama || '').trim()
    const username = String(body.username || '').trim()
    const password = String(body.password || '')
    const role = 'admin'
    if (!nama) return NextResponse.json({ error: 'Nama wajib diisi' }, { status: 400 })
    if (!username) return NextResponse.json({ error: 'Username wajib diisi' }, { status: 400 })
    if (password.length < 6) return NextResponse.json({ error: 'Password minimal 6 karakter' }, { status: 400 })

    const supabase = getServerSupabase()
    const { data: exists } = await supabase.from('panitia').select('id').eq('username', username).maybeSingle()
    if (exists) return NextResponse.json({ error: 'Username sudah dipakai' }, { status: 409 })

    const hashed = await bcrypt.hash(password, 10)
    const { data, error } = await supabase
      .from('panitia')
      .insert({ nama, username, password: hashed, role, status: 'aktif' })
      .select('id, nama, username, role, status, created_at')
      .single()
    if (error) throw new Error(error.message)
    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Terjadi kesalahan' }, { status: 500 })
  }
}
