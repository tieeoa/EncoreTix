import { NextResponse } from 'next/server'
import { getServerSupabase } from '../../lib/supabaseClient'
import { getAllEvents, getActiveEvent, isEventFinished, autoClosePastEvents, deactivateOtherEvents } from '../../lib/events'

export const dynamic = 'force-dynamic'

// GET /api/events
// Daftar semua edisi event (untuk kelola event, selector, dan home page).
// Query:
//   ?active=true   → { data: <event aktif|null> } (objek tunggal)
//   ?finished=true → { data: [event selesai...] }
export async function GET(request: Request) {
  try {
    const supabase = getServerSupabase()
    const { searchParams } = new URL(request.url)

    if (searchParams.get('active') === 'true') {
      const active = await getActiveEvent(supabase)
      return NextResponse.json({ data: active })
    }

    const raw = await getAllEvents(supabase)

    // Event yang tanggalnya sudah sampai/lewat otomatis jadi 'closed'.
    const justClosed = await autoClosePastEvents(supabase, raw)
    const justClosedIds = new Set(justClosed.map((e) => e.id))
    const data = raw.map((e) =>
      justClosedIds.has(e.id) ? { ...e, status: 'closed' } : e
    )

    if (searchParams.get('finished') === 'true') {
      return NextResponse.json({ data: data.filter(isEventFinished) })
    }

    return NextResponse.json({
      data,
      autoClosed: justClosed.map((e) => e.nama_event),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/events
// Membuat event baru (dipakai superadmin pada halaman Kelola Event).
export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body.nama_event) {
      return NextResponse.json({ error: 'Nama event wajib diisi' }, { status: 400 })
    }
    const supabase = getServerSupabase()
    const { data, error } = await supabase
      .from('event_info')
      .insert({
        nama_event: body.nama_event,
        slug: body.slug || null,
        tanggal: body.tanggal || null,
        waktu: body.waktu || null,
        venue: body.venue || null,
        alamat: body.alamat || null,
        deskripsi: body.deskripsi || null,
        syarat_ketentuan: body.syarat_ketentuan || null,
        status: body.status || 'active',
        gambar: body.gambar || null,
      })
      .select()
      .single()
    if (error) throw new Error(error.message)

    // Hanya satu event yang boleh berstatus 'active'.
    const status = body.status || 'active'
    if (status === 'active') {
      await deactivateOtherEvents(supabase, data.id)
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}