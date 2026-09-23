import { NextResponse } from 'next/server'
import { getServerSupabase } from '../../../lib/supabaseClient'
import { resolveEventId, getEventById, isEventFinished } from '../../../lib/events'

export const dynamic = 'force-dynamic'

// GET /api/merch/sales-status
// Status penjualan merch: closed = semua produk 'nonaktif'.
// Filter: ?event=<id> (jika kosong = event aktif otomatis).
export async function GET(request: Request) {
  try {
    const supabase = getServerSupabase()
    const { searchParams } = new URL(request.url)
    const eventId = await resolveEventId(supabase, searchParams.get('event'))

    let query = supabase.from('merchandise').select('status')
    if (eventId) {
      query = query.eq('id_event', eventId)
    }
    const { data, error } = await query
    if (error) throw new Error(error.message)
    const rows = data ?? []
    return NextResponse.json({ closed: rows.length > 0 && rows.every((r) => r.status === 'nonaktif') })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/merch/sales-status
// Body: { closed: boolean } → hentikan penjualan ('nonaktif') atau buka ('aktif')
// semua produk merchandise event terpilih sekaligus.
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const closed = !!body.closed
    const status = closed ? 'nonaktif' : 'aktif'
    const supabase = getServerSupabase()
    const eventId = await resolveEventId(supabase, body.event || null)

    if (!closed) {
      if (!eventId) {
        return NextResponse.json(
          { error: 'Pilih event terlebih dahulu untuk memulai penjualan merch.' },
          { status: 400 }
        )
      }
      const event = await getEventById(supabase, eventId)
      if (event && (event.status === 'paused' || isEventFinished(event))) {
        return NextResponse.json(
          { error: 'Penjualan merch tidak dapat dimulai karena event sudah selesai atau di-pause.' },
          { status: 400 }
        )
      }
    }

    let query = supabase.from('merchandise').update({ status }).neq('status', status)
    if (eventId) {
      query = query.eq('id_event', eventId)
    }
    const { error } = await query
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, closed })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}