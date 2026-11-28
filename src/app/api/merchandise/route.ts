import { NextResponse } from 'next/server'
import { getServerSupabase } from '../../lib/supabaseClient'
import { MERCH_SIZES, sizeColumn, withSisaStok, FREE_SIZE_SENTINEL } from '../../lib/merchStok'
import { resolveEventId } from '../../lib/events'
import { requireRole, rejectInactiveAdminMutation } from '@/lib/serverAuth'

export const dynamic = 'force-dynamic'

// GET /api/merchandise
// Mengambil daftar produk merch dari tabel `merchandise`.
// Filter: ?event=<id> (jika kosong = event aktif otomatis).
export async function GET(request: Request) {
  try {
    const supabase = getServerSupabase()
    const { searchParams } = new URL(request.url)
    const eventId = await resolveEventId(supabase, searchParams.get('event'))
    if (!eventId) return NextResponse.json({ data: [] })

    let query = supabase.from('merchandise').select('*, band(*)')
    if (eventId) {
      query = query.eq('id_event', eventId)
    }
    const { data, error } = await query.order('created_at', { ascending: true })

    if (error) throw new Error(error.message)
    const rows = await withSisaStok(supabase, data ?? [])
    return NextResponse.json({ data: rows })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/merchandise
// Menambah produk merch baru (dipakai superadmin).
// Body: { ..., event?: string } / event kosong = event aktif.
export async function POST(request: Request) {
  try {
    const auth = requireRole(request, ['admin', 'superadmin'])
    if ('response' in auth) return auth.response
    const ro = await rejectInactiveAdminMutation(request, auth.session)
    if (ro) return ro
    const body = await request.json()
    if (!body.nama_merch || !body.harga) {
      return NextResponse.json({ error: 'Nama dan harga wajib diisi' }, { status: 400 })
    }
    if (!body.id_band) {
      return NextResponse.json({ error: 'Pilih band untuk produk ini' }, { status: 400 })
    }
    const supabase = getServerSupabase()
    const eventId = await resolveEventId(supabase, body.event || null)
    const stok: Record<string, number> = {}
    for (const s of MERCH_SIZES) {
      const col = sizeColumn(s)
      const val = Number(body[col] ?? 0)
      stok[col] = col === 'stok_xxl' && val === FREE_SIZE_SENTINEL
        ? FREE_SIZE_SENTINEL
        : Math.max(0, val)
    }
    const foto: string[] | null = Array.isArray(body.foto) && body.foto.length > 0 ? body.foto : null
    const { data, error } = await supabase
      .from('merchandise')
      .insert({
        nama_merch: body.nama_merch,
        foto,
        harga: body.harga,
        kategori: body.kategori || null,
        status: body.status || 'aktif',
        id_band: body.id_band,
        id_event: eventId,
        ...stok,
      })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
