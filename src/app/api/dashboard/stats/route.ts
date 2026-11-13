import { NextResponse } from 'next/server'
import { getServerSupabase } from '../../../lib/supabaseClient'
import { expireExpiredPendingOrders } from '../../../lib/expireOrders'
import { getReportStats } from '../../../lib/reportStats'
import { syncOrderWithMidtrans } from '@/app/lib/midtransSync'

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

    // Sinkronisasi pesanan tiket online yang masih pending dengan Midtrans terlebih dahulu
    const { data: pendingTiket } = await supabase
      .from('pesanan_tiket')
      .select('booking_id')
      .eq('status_bayar', 'pending')
      .eq('source', 'online')
      .limit(10)
    if (pendingTiket && pendingTiket.length > 0) {
      await Promise.allSettled(pendingTiket.map((p) => syncOrderWithMidtrans(p.booking_id)))
    }

    // Sinkronisasi pesanan merchandise yang masih pending dengan Midtrans
    const { data: pendingMerch } = await supabase
      .from('pesanan_merchandise')
      .select('kode_pesanan')
      .eq('status_bayar', 'pending')
      .limit(10)
    if (pendingMerch && pendingMerch.length > 0) {
      const distinct = [...new Set(pendingMerch.map((m) => m.kode_pesanan).filter(Boolean))]
      await Promise.allSettled(distinct.map((code) => syncOrderWithMidtrans(String(code))))
    }

    // Tandai pesanan pending yang sudah lewat 10 menit sebagai gagal.
    await expireExpiredPendingOrders(supabase)

    const data = await getReportStats(supabase, eventParam, offlineOnly)
    return NextResponse.json({ data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}