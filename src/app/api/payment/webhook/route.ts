import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { getServerSupabase } from '../../../lib/supabaseClient'
import { sendTicketEmailForBooking } from '../../../lib/ticketSender'
import { PAYMENT_DURATION_MS } from '../../../lib/expireOrders'

export const dynamic = 'force-dynamic'

// POST /api/payment/webhook
// Dipanggil otomatis oleh payment gateway (Midtrans) saat ada notifikasi
// perubahan status pembayaran. JANGAN dipanggil dari browser.
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const supabase = getServerSupabase()

    // ------- 1. VERIFIKASI TANDA TANGAN (keamanan) -------
    // Midtrans: signature_key = sha512(order_id + status_code + gross_amount + server_key)
    const serverKey = process.env.MIDTRANS_SERVER_KEY
    if (serverKey) {
      const raw = `${body.order_id}${body.status_code}${body.gross_amount}${serverKey}`
      const expected = crypto.createHash('sha512').update(raw).digest('hex')
      if (expected !== body.signature_key) {
        return NextResponse.json({ error: 'Signature tidak valid' }, { status: 403 })
      }
    }

    // ------- 2. CARI PESANAN BERDASARKAN BOOKING ID -------
    const bookingId = body.order_id
    const { data: pesanan, error: findError } = await supabase
      .from('pesanan_tiket')
      .select('*, tiket(id, sisa_kuota), voucher(id, nominal_diskon, kuota_penggunaan, jumlah_digunakan)')
      .eq('booking_id', bookingId)
      .maybeSingle()
    if (findError) throw new Error(findError.message)
    if (!pesanan) {
      return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 })
    }

    // ------- 3. PETAKAN STATUS GATEWAY -> STATUS KITA -------
    const transactionStatus = body.transaction_status as string
    const fraudStatus = (body.fraud_status as string) || 'accept'

    let status: string
    if (transactionStatus === 'capture' || transactionStatus === 'settlement') {
      status = fraudStatus === 'accept' || transactionStatus === 'settlement' ? 'berhasil' : 'pending'
    } else if (transactionStatus === 'pending') {
      status = 'pending'
    } else if (transactionStatus === 'deny' || transactionStatus === 'cancel') {
      status = 'gagal'
    } else if (transactionStatus === 'expire') {
      status = 'gagal'
    } else {
      status = 'pending'
    }

    // Jangan proses ulang pesanan yang sudah berhasil (idempotent).
    if (pesanan.status_bayar === 'berhasil' && status === 'berhasil') {
      return NextResponse.json({ ok: true })
    }

    // Pesanan yang sudah lewat batas waktu bayar (10 menit sejak dibuat) tidak boleh
    // berubah jadi berhasil. (Tolak pembayaran yang datang setelah batas waktu.)
    const expiresAt = new Date(pesanan.tanggal_pesan).getTime() + PAYMENT_DURATION_MS
    if (status === 'berhasil' && expiresAt <= Date.now()) {
      await supabase
        .from('pesanan_tiket')
        .update({ status_bayar: 'gagal' })
        .eq('id', pesanan.id)
      return NextResponse.json(
        { error: 'Pesanan telah dibatalkan karena batas waktu pembayaran habis.' },
        { status: 410 }
      )
    }

    // ------- 4. UPDATE STATUS PESANAN -------
    const { error: updateError } = await supabase
      .from('pesanan_tiket')
      .update({ status_bayar: status })
      .eq('id', pesanan.id)
    if (updateError) throw new Error(updateError.message)

    // ------- 5. SIMPAN DETAIL PEMBAYARAN -------
    const orderBefore = pesanan.tiket
    const { error: payError } = await supabase
      .from('pembayaran')
      .upsert({
        id_pesanan_tiket: pesanan.id,
        metode_pembayaran: body.payment_type ?? '',
        tanggal_bayar: status === 'berhasil' ? new Date().toISOString() : null,
        total_bayar: Number(body.gross_amount) || 0,
        status_pembayaran: status,
      })
    if (payError) throw new Error(payError.message)

    // ------- 6. KALAU SUDAH BAYAR: KURANGI SISA KUOTA TIKET -------
    if (status === 'berhasil') {
      const { error: stockError } = await supabase
        .from('tiket')
        .update({ sisa_kuota: orderBefore.sisa_kuota - pesanan.jumlah })
        .eq('id', orderBefore.id)
      if (stockError) throw new Error(stockError.message)

      // Konsumsi kuota voucher saat pembayaran dinyatakan sukses oleh gateway.
      if (pesanan.voucher && Number(pesanan.voucher.jumlah_digunakan) < Number(pesanan.voucher.kuota_penggunaan)) {
        await supabase
          .from('voucher')
          .update({ jumlah_digunakan: Number(pesanan.voucher.jumlah_digunakan) + 1 })
          .eq('id', pesanan.voucher.id)
      }

      // Kirim e-tiket ke email pembeli (gagal email tidak menggagalkan pembayaran).
      await sendTicketEmailForBooking(bookingId)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}