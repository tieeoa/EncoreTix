import { NextResponse } from 'next/server'
import { getServerSupabase } from '../../lib/supabaseClient'
import { resolveEventId } from '../../lib/events'

export const dynamic = 'force-dynamic'

// GET /api/kategori
// Ambil daftar kategori unik dari kolom merchandise.kategori.
// Filter: ?event=<id> (jika kosong = event aktif otomatis).
export async function GET(request: Request) {
  try {
    const supabase = getServerSupabase()
    const { searchParams } = new URL(request.url)
    const eventId = await resolveEventId(supabase, searchParams.get('event'))
    if (!eventId) return NextResponse.json({ data: [] })

    let query = supabase
      .from('merchandise')
      .select('kategori')
      .not('kategori', 'is', null)
    if (eventId) {
      query = query.eq('id_event', eventId)
    }
    const { data, error } = await query.order('kategori')
    if (error) throw new Error(error.message)

    const categories = Array.from(new Set((data || []).map((r) => r.kategori).filter(Boolean))) as string[]
    return NextResponse.json({ data: categories })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}