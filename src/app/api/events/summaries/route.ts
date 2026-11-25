import { NextResponse } from 'next/server'
import { getServerSupabase } from '../../../lib/supabaseClient'
import { getAllEvents, isEventFinished } from '../../../lib/events'

export const dynamic = 'force-dynamic'

// GET /api/events/summaries
// Ringkasan per event (nama, status, tiket terjual, revenue) untuk sidebar da
// superadmin & tampilan "event selesai" di dashboard.
export async function GET() {
  try {
    const supabase = getServerSupabase()
    const events = await getAllEvents(supabase)

    const [tiketRes, merchRes] = await Promise.all([
      supabase
        .from('pesanan_tiket')
        .select('jumlah, status_bayar, tiket(id_event, harga), pembayaran(total_bayar)'),
      supabase
        .from('pesanan_merchandise')
        .select('jumlah, status_bayar, total_harga, merchandise(id_event)'),
    ])
    if (tiketRes.error) throw new Error(tiketRes.error.message)
    if (merchRes.error) throw new Error(merchRes.error.message)

    const data = events.map((e) => {
      let tiketTerjual = 0
      let revenueTiket = 0
      let merchTerjual = 0
      let revenueMerch = 0

      const tiketRows = (tiketRes.data ?? []) as unknown as {
        jumlah: number
        status_bayar: string
        tiket: { id_event: string; harga: number } | null
        pembayaran: { total_bayar: number | null } | null
      }[]
      const merchRows = (merchRes.data ?? []) as unknown as {
        jumlah: number
        status_bayar: string
        total_harga: number
        merchandise: { id_event: string } | null
      }[]

      for (const p of tiketRows) {
        if (p.tiket?.id_event === e.id && p.status_bayar === 'berhasil') {
          const qty = Number(p.jumlah || 0)
          tiketTerjual += qty
          // Pakai nominal yang benar-benar dibayar bila ada (termasuk biaya
          // admin, setelah diskon voucher) agar sama dengan dashboard.
          revenueTiket += p.pembayaran?.total_bayar != null
            ? Number(p.pembayaran.total_bayar)
            : qty * Number(p.tiket?.harga || 0)
        }
      }
      for (const o of merchRows) {
        if (o.merchandise?.id_event === e.id && o.status_bayar === 'berhasil') {
          merchTerjual += Number(o.jumlah || 0)
          revenueMerch += Number(o.total_harga || 0)
        }
      }

      return {
        id: e.id,
        nama_event: e.nama_event,
        status: e.status,
        finished: isEventFinished(e),
        tanggal: e.tanggal,
        venue: e.venue,
        tiketTerjual,
        revenueTiket,
        merchTerjual,
        revenueMerch,
        totalRevenue: revenueTiket + revenueMerch,
      }
    })

    // Event aktif (status 'active' & belum lewat) tampil paling atas,
    // sisanya diurutkan berdasarkan tanggal terbaru.
    data.sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1
      if (b.status === 'active' && a.status !== 'active') return 1
      return String(b.tanggal || '').localeCompare(String(a.tanggal || ''))
    })

    return NextResponse.json({ data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}