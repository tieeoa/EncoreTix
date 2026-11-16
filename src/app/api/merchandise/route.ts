import { NextResponse } from 'next/server'
import { getServerSupabase } from '../../lib/supabaseClient'
import { MERCH_SIZES, sizeColumn, withSisaStok } from '../../lib/merchStok'
import { resolveEventId } from '../../lib/events'
import { requireRole } from '@/lib/serverAuth'

export const dynamic = 'force-dynamic'

// GET /api/merchandise
// Mengambil daftar produk merch dari tabel `merchandise`.
// Filter: ?event=<id> (jika kosong = event aktif otomatis).
export async function GET(request: Request) {
  try {
    const supabase = getServerSupabase()
    const { searchParams } = new URL(request.url)
    const eventId = await resolveEventId(supabase, searchParams.get('event'))

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
      stok[sizeColumn(s)] = Math.max(0, Number(body[sizeColumn(s)] ?? 0))
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
