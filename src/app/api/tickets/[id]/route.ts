import { NextResponse } from 'next/server'
import { getServerSupabase } from '../../../lib/supabaseClient'
import { getEventById, formatEventDisplay } from '../../../lib/events'
import { requireRole, rejectInactiveAdminMutation } from '@/lib/serverAuth'

export const dynamic = 'force-dynamic'

const TICKET_HAS_ORDERS_MESSAGE =
  'Tiket tidak dapat dihapus karena sudah ada pesanan yang memakai tiket ini. Nonaktifkan tiket ini saja agar tidak bisa dipesan lagi.'


// GET /api/tickets/:id
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = getServerSupabase()
    const { data, error } = await supabase.from('tiket').select('*').eq('id', id).maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return NextResponse.json({ error: 'Tiket tidak ditemukan' }, { status: 404 })
    const event = formatEventDisplay(await getEventById(supabase, data.id_event))
    return NextResponse.json({ data: { ...data, event } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PATCH /api/tickets/:id
// Update kategori, harga, kuota, periode, deskripsi, atau status (aktif/nonaktif).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireRole(request, ['admin', 'superadmin'])
    if ('response' in auth) return auth.response
    const ro = await rejectInactiveAdminMutation(request, auth.session)
    if (ro) return ro
    const { id } = await params
    const body = await request.json()
    const supabase = getServerSupabase()
    const { data: existing, error: findError } = await supabase
      .from('tiket')
      .select('kuota, sisa_kuota')
      .eq('id', id)
      .maybeSingle()
    if (findError) throw new Error(findError.message)
    if (!existing) return NextResponse.json({ error: 'Tiket tidak ditemukan' }, { status: 404 })

    const allowed = ['kategori', 'harga', 'kuota', 'sisa_kuota', 'periode_penjualan', 'deskripsi', 'status', 'id_event']
    const patch: Record<string, unknown> = {}
    for (const key of allowed) {
      if (body[key] !== undefined) patch[key] = body[key]
    }
    if (patch.status !== undefined) {
      if (!['aktif', 'nonaktif'].includes(String(patch.status))) {
        return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 })
      }
      patch.status = String(patch.status)
    }
    // Jangan reset sisa_kuota ke kuota saat kuota diedit: itu menghapus
    // penjualan yang sudah tercatat. Pertahankan selisih (terjual) lama.
    if (patch.sisa_kuota == null && patch.kuota != null) {
      const oldKuota = Number(existing.kuota)
      const oldSisa = Number(existing.sisa_kuota)
      patch.sisa_kuota = Math.max(0, oldSisa + (Number(patch.kuota) - oldKuota))
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Tidak ada perubahan yang dikirim' }, { status: 400 })
    }
    const { data, error } = await supabase.from('tiket').update(patch).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    return NextResponse.json({ data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/tickets/:id
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireRole(_request, ['admin', 'superadmin'])
    if ('response' in auth) return auth.response
    const ro = await rejectInactiveAdminMutation(_request, auth.session)
    if (ro) return ro
    const { id } = await params
    const supabase = getServerSupabase()
    const { data: orders, error: orderError } = await supabase
      .from('pesanan_tiket')
      .select('id')
      .eq('id_tiket', id)
      .limit(1)
    if (orderError) throw new Error(orderError.message)
    if (orders && orders.length > 0) {
      return NextResponse.json({ error: TICKET_HAS_ORDERS_MESSAGE }, { status: 400 })
    }

    const { error } = await supabase.from('tiket').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : 'Terjadi kesalahan'
    const message = /foreign key|constraint|23503/i.test(rawMessage)
      ? TICKET_HAS_ORDERS_MESSAGE
      : rawMessage
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
