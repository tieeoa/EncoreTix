import { NextResponse } from 'next/server'
import { getServerSupabase } from '../../lib/supabaseClient'
import { resolveEventId } from '../../lib/events'

export const dynamic = 'force-dynamic'

// GET /api/bands
// Daftar band lineup. Filter: ?event=<id> (jika kosong = event aktif otomatis).
export async function GET(request: Request) {
  try {
    const supabase = getServerSupabase()
    const { searchParams } = new URL(request.url)
    const eventId = await resolveEventId(supabase, searchParams.get('event'))

    let query = supabase.from('band').select('*')
    if (eventId) {
      query = query.eq('id_event', eventId)
    }
    const { data, error } = await query.order('created_at', { ascending: true })
    if (error) throw new Error(error.message)
    return NextResponse.json({ data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/bands
// Tambah band baru (dipakai superadmin).
// Body: { ..., event?: string } / event kosong = event aktif.
export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body.nama_band) {
      return NextResponse.json({ error: 'Nama band wajib diisi' }, { status: 400 })
    }
    const supabase = getServerSupabase()
    const eventId = await resolveEventId(supabase, body.event || null)
    const { data, error } = await supabase
      .from('band')
      .insert({
        nama_band: body.nama_band,
        deskripsi: body.deskripsi || null,
        gambar: body.gambar || null,
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