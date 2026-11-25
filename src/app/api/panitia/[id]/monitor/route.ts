import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/app/lib/supabaseClient'
import { resolveEventId } from '@/app/lib/events'
import { requireRole } from '@/lib/serverAuth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireRole(request, ['superadmin'])
    if ('response' in auth) return auth.response
    const { id } = await params
    const supabase = getServerSupabase()
    const { searchParams } = new URL(request.url)
    const eventId = await resolveEventId(supabase, searchParams.get('event'))

    const { data: admin, error: adminErr } = await supabase
      .from('panitia')
      .select('id, nama, username, role, status, created_at')
      .eq('id', id)
      .maybeSingle()
    if (adminErr) throw new Error(adminErr.message)
    if (!admin) return NextResponse.json({ error: 'Akun tidak ditemukan' }, { status: 404 })
    if (admin.role !== 'admin') return NextResponse.json({ error: 'Bukan akun admin' }, { status: 400 })

    const NONE = '00000000-0000-0000-0000-000000000000'
    let eventTiketIds: string[] | null = null
    let eventMerchIds: string[] | null = null
    if (eventId) {
      const [evTikets, evMerch] = await Promise.all([
        supabase.from('tiket').select('id').eq('id_event', eventId),
        supabase.from('merchandise').select('id').eq('id_event', eventId),
      ])
      if (evTikets.error) throw new Error(evTikets.error.message)
      if (evMerch.error) throw new Error(evMerch.error.message)
      eventTiketIds = (evTikets.data || []).map((t) => t.id)
      eventMerchIds = (evMerch.data || []).map((m) => m.id)
    }

    let moQuery = supabase
      .from('pesanan_tiket')
      .select('id, booking_id, jumlah, status_bayar, tanggal_pesan, source, tiket(id, kategori, harga), customers(nama, email), pembayaran(metode_pembayaran, total_bayar)')
      .eq('source', 'offline')
      .eq('id_panitia', id)
      .order('tanggal_pesan', { ascending: false })
      .limit(120)
    if (eventTiketIds) {
      moQuery = eventTiketIds.length ? moQuery.in('id_tiket', eventTiketIds) : moQuery.eq('id_tiket', NONE)
    }
    const { data: moData, error: moErr } = await moQuery
    if (moErr) throw new Error(moErr.message)

    const orders = (moData || []).map((o) => {
      const tiket = o.tiket as { kategori?: string; harga?: number } | null
      const pay = o.pembayaran as { metode_pembayaran?: string; total_bayar?: number } | null
      const cust = o.customers as { nama?: string; email?: string } | null
      const harga = Number(tiket?.harga ?? 0)
      const total = pay?.total_bayar != null ? Number(pay.total_bayar) : harga * Number(o.jumlah || 0)
      const metode = pay?.metode_pembayaran || (o.status_bayar === 'berhasil' ? 'Tunai' : null)
      return {
        id: o.id as string,
        booking_id: o.booking_id as string,
        tanggal_pesan: o.tanggal_pesan as string,
        jumlah: Number(o.jumlah || 0),
        status_bayar: String(o.status_bayar || ''),
        kategori: tiket?.kategori || '-',
        customer_nama: cust?.nama || '-',
        customer_email: cust?.email || '-',
        metode_pembayaran: metode,
        total_bayar: total,
      }
    })

    const berhasilOrders = orders.filter((o) => o.status_bayar === 'berhasil')
    const manualSummary = {
      totalOrders: orders.length,
      berhasil: berhasilOrders.length,
      pending: orders.filter((o) => o.status_bayar === 'pending').length,
      gagal: orders.filter((o) => o.status_bayar === 'gagal').length,
      totalTiket: berhasilOrders.reduce((s, o) => s + o.jumlah, 0),
      totalRevenue: berhasilOrders.reduce((s, o) => s + o.total_bayar, 0),
    }

    let ciQuery = supabase
      .from('pesanan_tiket')
      .select('id, booking_id, jumlah, tiket_check_in, status_check_in, source, tiket(kategori), customers(nama)')
      .eq('checked_in_by', id)
      .order('tanggal_pesan', { ascending: false })
      .limit(60)
    if (eventTiketIds) {
      ciQuery = eventTiketIds.length ? ciQuery.in('id_tiket', eventTiketIds) : ciQuery.eq('id_tiket', NONE)
    }
    const { data: ciData } = await ciQuery
    const checkinItems = (ciData || []).map((o) => {
      const arr = Array.isArray(o.tiket_check_in) ? (o.tiket_check_in as number[]) : []
      const count = arr.length > 0 ? arr.length : (o.status_check_in === 'sudah_check_in' ? Number(o.jumlah || 0) : 0)
      const tiket = o.tiket as { kategori?: string } | null
      const cust = o.customers as { nama?: string } | null
      return {
        booking_id: String(o.booking_id || ''),
        kategori: tiket?.kategori || '-',
        customer_nama: cust?.nama || '-',
        tiket_masuk: count,
        source: String(o.source || ''),
      }
    }).filter((r) => r.tiket_masuk > 0)
    const checkinSummary = { totalTiketMasuk: checkinItems.reduce((s, r) => s + r.tiket_masuk, 0), transaksi: checkinItems.length }

    let pickupQuery = supabase
      .from('pesanan_merchandise')
      .select('id, kode_pesanan, kode_pengambilan, jumlah, status_pengambilan, bukti_pengambilan_at, merchandise(nama_merch), customers(nama)')
      .eq('id_panitia', id)
      .order('tanggal_pesan', { ascending: false })
      .limit(60)
    if (eventMerchIds) {
      pickupQuery = eventMerchIds.length ? pickupQuery.in('id_merch', eventMerchIds) : pickupQuery.eq('id_merch', NONE)
    }
    const { data: pkData } = await pickupQuery
    const pickupItems = (pkData || []).map((m) => {
      const merch = m.merchandise as { nama_merch?: string } | null
      const cust = m.customers as { nama?: string } | null
      return {
        kode: String(m.kode_pesanan || m.kode_pengambilan || ''),
        nama_merch: merch?.nama_merch || '-',
        jumlah: Number(m.jumlah || 0),
        customer_nama: cust?.nama || '-',
        status_pengambilan: String(m.status_pengambilan || ''),
        waktu: (m.bukti_pengambilan_at as string | null) || null,
      }
    })
    const pickupSummary = { totalVerifikasi: pickupItems.length, totalItem: pickupItems.reduce((s, p) => s + p.jumlah, 0) }

    const flags: { level: 'warning' | 'info'; text: string }[] = []
    if (manualSummary.gagal > 0) flags.push({ level: 'warning', text: `${manualSummary.gagal} order manual berstatus gagal. Periksa apakah ada pola pembatalan/penyalahgunaan.` })
    if (manualSummary.pending > 0) flags.push({ level: 'warning', text: `${manualSummary.pending} order manual masih pending (belum final). Perlu ditindaklanjuti.` })
    if (manualSummary.totalOrders >= 25) flags.push({ level: 'info', text: `Volume order manual tinggi (${manualSummary.totalOrders} order). Pantau kesesuaian dengan setoran.` })
    if (manualSummary.totalRevenue >= 5_000_000) flags.push({ level: 'info', text: `Pendapatan order manual tercatat Rp ${manualSummary.totalRevenue.toLocaleString('id-ID')}. Pastikan sesuai setoran.` })
    if ((admin.status || 'aktif') === 'nonaktif') flags.push({ level: 'warning', text: 'Akun ini sedang dinonaktifkan dan tidak dapat mengakses sistem.' })

    return NextResponse.json({
      data: {
        admin,
        event_id: eventId,
        manual: { summary: manualSummary, orders: orders.slice(0, 30) },
        checkin: { summary: checkinSummary, items: checkinItems.slice(0, 20) },
        merch: { summary: pickupSummary, items: pickupItems.slice(0, 20) },
        flags,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Terjadi kesalahan' }, { status: 500 })
  }
}
