import { NextResponse } from 'next/server'
import { getServerSupabase } from '../../../lib/supabaseClient'
import { getEventById, deactivateOtherEvents } from '../../../lib/events'
import { requireRole } from '@/lib/serverAuth'

export const dynamic = 'force-dynamic'

const EDITABLE_FIELDS = [
  'nama_event',
  'slug',
  'tanggal',
  'waktu',
  'venue',
  'alamat',
  'deskripsi',
  'syarat_ketentuan',
  'status',
  'gambar',
] as const

// GET /api/events/[id]
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = getServerSupabase()
    const data = await getEventById(supabase, id)
    if (!data) {
      return NextResponse.json({ error: 'Event tidak ditemukan' }, { status: 404 })
    }
    return NextResponse.json({ data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PATCH /api/events/[id]
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireRole(request, ['superadmin'])
    if ('response' in auth) return auth.response
    const { id } = await params
    const body = await request.json()
    const supabase = getServerSupabase()

    const existing = await getEventById(supabase, id)
    if (!existing) {
      return NextResponse.json({ error: 'Event tidak ditemukan' }, { status: 404 })
    }

    const fields: Record<string, unknown> = {}
    for (const key of EDITABLE_FIELDS) {
      if (key in body) {
        fields[key] = body[key] ?? null
      }
    }

    const { data, error } = await supabase
      .from('event_info')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)

    // Hanya satu event yang boleh berstatus 'active'.
    if (fields.status === 'active') {
      await deactivateOtherEvents(supabase, id)
    }

    return NextResponse.json({ data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/events/[id]
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireRole(_req, ['superadmin'])
    if ('response' in auth) return auth.response
    const { id } = await params
    const supabase = getServerSupabase()
    const { error } = await supabase.from('event_info').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}