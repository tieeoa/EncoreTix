import { NextResponse } from 'next/server'
import { getServerSupabase } from '../../../lib/supabaseClient'
import { expireExpiredPendingOrders } from '../../../lib/expireOrders'
import { getReportStats } from '../../../lib/reportStats'

export const dynamic = 'force-dynamic'

// GET /api/dashboard/stats
// Statistik agregat untuk dashboard admin & superadmin.
// Filter: ?event=<id> (jika kosong = event aktif otomatis).
// ?source=offline -> hitung metrik tiket HANYA dari input manual panitia (bukan penjualan web).
export async function GET(request: Request) {
  try {
    const supabase = getServerSupabase()
    const { searchParams } = new URL(request.url)
    const eventParam = searchParams.get('event')
    const offlineOnly = searchParams.get('source') === 'offline'

    // Tandai pesanan pending yang sudah lewat 10 menit sebagai gagal.
    await expireExpiredPendingOrders(supabase)

    const data = await getReportStats(supabase, eventParam, offlineOnly)
    return NextResponse.json({ data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}