import { NextResponse } from 'next/server'
import { getServerSupabase } from '../../../lib/supabaseClient'
import { sendTicketEmailForBooking } from '../../../lib/ticketSender'
import { PAYMENT_DURATION_MS } from '../../../lib/expireOrders'
import { normalizeMetode } from '../../../lib/paymentMethod'

export const dynamic = 'force-dynamic'

// POST /api/payment/confirm
// Simulasi konfirmasi pembayaran berhasil dari sisi klien (demo).
// Menandai pesanan lunas, menyimpan detail pembayaran, dan mengurangi kuota tiket.
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const bookingId = body.booking_id as string
    if (!bookingId) {
      return NextResponse.json({ error: 'booking_id wajib diisi' }, { status: 400 })
    }
    // Metode yang dipilih pembeli di halaman payment (bca, qris, Tunai, ...).
    const metode = normalizeMetode(body.metode_pembayaran || body.method || 'QRIS')

    const supabase = getServerSupabase()

    const { data: pesanan, error: findError } = await supabase
      .from('pesanan_tiket')
      .select('*, tiket(id, sisa_kuota, harga), voucher(id, nominal_diskon, kuota_penggunaan, jumlah_digunakan)')
      .eq('booking_id', bookingId)
      .maybeSingle()
    if (findError) throw new Error(findError.message)
    if (!pesanan) {
      return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 })
    }

    // Idempotent: jangan proses ulang yang sudah lunas.
    if (pesanan.status_bayar === 'berhasil') {
      return NextResponse.json({ ok: true })
    }

    // Pesanan yang sudah dinyatakan gagal tidak boleh dibayar lagi.
    if (pesanan.status_bayar === 'gagal') {
      return NextResponse.json({ error: 'Pesanan telah dibatalkan karena batas waktu pembayaran habis.' }, { status: 410 })
    }

    // Lewat batas waktu bayar (10 menit sejak pesanan dibuat) => tandai gagal dan tolak.
    const expiresAt = new Date(pesanan.tanggal_pesan).getTime() + PAYMENT_DURATION_MS
    if (expiresAt <= Date.now()) {
      await supabase
        .from('pesanan_tiket')
        .update({ status_bayar: 'gagal' })
        .eq('id', pesanan.id)
      return NextResponse.json({ error: 'Batas waktu pembayaran telah habis. Pesanan dibatalkan.' }, { status: 410 })
    }

    // Total tagihan = subtotal + biaya admin (4%, sama dengan tampilan UI) - diskon voucher.
    const subtotal = Number(pesanan.tiket?.harga ?? 0) * pesanan.jumlah
    const adminFee = Math.round(subtotal * 0.04)
    const diskon = Number(pesanan.voucher?.nominal_diskon ?? 0)
    const totalBayar = Math.max(0, subtotal + adminFee - diskon)

    const { error: updateError } = await supabase
      .from('pesanan_tiket')
      .update({ status_bayar: 'berhasil', qr_code: `ENCORETIX:${bookingId}` })
      .eq('id', pesanan.id)
    if (updateError) throw new Error(updateError.message)

    // Konsumsi kuota voucher hanya saat pembayaran benar-benar sukses.
    // Idempoten: kalau pesanan sudah 'berhasil', route ini return lebih awal di atas.
    if (pesanan.voucher && Number(pesanan.voucher.jumlah_digunakan) < Number(pesanan.voucher.kuota_penggunaan)) {
      await supabase
        .from('voucher')
        .update({ jumlah_digunakan: Number(pesanan.voucher.jumlah_digunakan) + 1 })
        .eq('id', pesanan.voucher.id)
    }

    // Kirim e-tiket ke email pembeli (gagal email tidak menggagalkan pembayaran).
    await sendTicketEmailForBooking(bookingId)

    const { error: payError } = await supabase
      .from('pembayaran')
      .upsert(
        {
          id_pesanan_tiket: pesanan.id,
          metode_pembayaran: metode,
          tanggal_bayar: new Date().toISOString(),
          total_bayar: totalBayar,
          status_pembayaran: 'berhasil',
        },
        { onConflict: 'id_pesanan_tiket' }
      )
    if (payError) throw new Error(payError.message)

    const { error: stockError } = await supabase
      .from('tiket')
      .update({ sisa_kuota: (pesanan.tiket?.sisa_kuota ?? 0) - pesanan.jumlah })
      .eq('id', pesanan.tiket?.id)
    if (stockError) throw new Error(stockError.message)

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}