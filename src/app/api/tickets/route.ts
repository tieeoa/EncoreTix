import { NextResponse } from 'next/server'
import { getServerSupabase } from '../../lib/supabaseClient'
import { requireRole, rejectInactiveAdminMutation } from '@/lib/serverAuth'
import { isTicketSalesClosed } from '../../lib/salesClosed'
import { resolveEventId } from '../../lib/events'

export const dynamic = 'force-dynamic'

// GET /api/tickets
// Mengambil daftar tiket dari tabel Supabase `tiket`.
// Filter: ?event=<id> (jika kosong = event aktif otomatis).
export async function GET(request: Request) {
  try {
    const supabase = getServerSupabase()
    const { searchParams } = new URL(request.url)
    const eventId = await resolveEventId(supabase, searchParams.get('event'))
    if (!eventId) return NextResponse.json({ data: [], sales_closed: true })

    let query = supabase.from('tiket').select('*')
    if (eventId) {
      query = query.eq('id_event', eventId)
    }
    const { data, error } = await query.order('created_at', { ascending: true })

    if (error) throw new Error(error.message)
    const sales_closed = await isTicketSalesClosed(supabase, eventId)
    return NextResponse.json({ data, sales_closed })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/tickets
// Membuat tiket baru (dipakai superadmin).
// Body: { ..., event?: string } / event kosong = event aktif.
export async function POST(request: Request) {
  try {
    const auth = requireRole(request, ['admin', 'superadmin'])
    if ('response' in auth) return auth.response
    const ro = await rejectInactiveAdminMutation(request, auth.session)
    if (ro) return ro
    const body = await request.json()
    if (!body.kategori || !body.harga) {
      return NextResponse.json({ error: 'Kategori dan harga wajib diisi' }, { status: 400 })
    }
    const supabase = getServerSupabase()
    const eventId = await resolveEventId(supabase, body.event || null)

    const status = body.status !== undefined ? String(body.status) : 'aktif'
    if (!['aktif', 'nonaktif'].includes(status)) {
      return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('tiket')
      .insert({
        kategori: body.kategori,
        harga: body.harga,
        periode_penjualan: body.periode_penjualan || null,
        deskripsi: body.deskripsi || null,
        kuota: body.kuota || 0,
        sisa_kuota: body.kuota || 0,
        status,
        id_event: eventId,
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