import { NextResponse } from 'next/server'
import { getServerSupabase } from '../../../lib/supabaseClient'
import { getEventById, formatEventDisplay } from '../../../lib/events'
import { requireRole } from '@/lib/serverAuth'

export const dynamic = 'force-dynamic'

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
    const { id } = await params
    const body = await request.json()
    const supabase = getServerSupabase()
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
    if (patch.sisa_kuota == null && patch.kuota != null) {
      patch.sisa_kuota = patch.kuota
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
    const { id } = await params
    const supabase = getServerSupabase()
    const { error } = await supabase.from('tiket').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}