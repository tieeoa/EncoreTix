import { NextResponse } from 'next/server'
import { getServerSupabase } from '../../../lib/supabaseClient'
import { expireExpiredPendingOrders } from '../../../lib/expireOrders'
import { getReportStats } from '../../../lib/reportStats'
import { generateReportPdf } from '../../../lib/reportPdf'
import { getEventById, formatEventDisplay } from '../../../lib/events'

export const dynamic = 'force-dynamic'

// GET /api/reports/pdf
// Unduh laporan penjualan (PDF) manual untuk event yang sudah selesai.
// Filter: ?event=<id> (jika kosong = event aktif otomatis / semua data).
export async function GET(request: Request) {
  try {
    const supabase = getServerSupabase()
    await expireExpiredPendingOrders(supabase)

    const { searchParams } = new URL(request.url)
    const eventParam = searchParams.get('event')

    const stats = await getReportStats(supabase, eventParam)

    let eventName = 'Semua Event'
    let eventSubtitle = ''
    if (stats.event_id) {
      const ev = await getEventById(supabase, stats.event_id)
      const display = formatEventDisplay(ev)
      eventName = display.nama_event
      eventSubtitle = `${display.tanggal} · ${display.lokasi}`
    }

    const generatedAt = new Date().toLocaleString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

    const pdf = await generateReportPdf({ eventName, eventSubtitle, generatedAt, stats })

    const safeName = eventName
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Laporan-EncoreTix-${safeName || 'semua-event'}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}