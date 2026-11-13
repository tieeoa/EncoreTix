import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { getServerSupabase } from '../../../lib/supabaseClient'
import { sendTicketEmailForBooking } from '../../../lib/ticketSender'
import { sendMerchEmailForOrder } from '../../../lib/merchSender'
import { resolveMerchGroup } from '../../../lib/merchGroup'
import { PAYMENT_DURATION_MS } from '../../../lib/expireOrders'

export const dynamic = 'force-dynamic'

// POST /api/payment/webhook
// Dipanggil otomatis oleh Midtrans saat ada notifikasi perubahan status transaksi.
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const supabase = getServerSupabase()

    // ------- 1. VERIFIKASI TANDA TANGAN (SHA512) -------
    // Midtrans: signature_key = sha512(order_id + status_code + gross_amount + server_key)
    const serverKey = process.env.MIDTRANS_SERVER_KEY
    if (serverKey) {
      const raw = `${body.order_id}${body.status_code}${body.gross_amount}${serverKey}`
      const expected = crypto.createHash('sha512').update(raw).digest('hex')
      if (expected !== body.signature_key) {
        return NextResponse.json({ error: 'Signature tidak valid' }, { status: 403 })
      }
    }

    // Normalisasi ID pesanan: hilangkan suffix retry seperti -1, -2 jika ada
    const rawOrderId = String(body.order_id || '')
    const bookingId = rawOrderId.replace(/-\d+$/, '').trim().toUpperCase()

    // ------- 2. PETAKAN STATUS GATEWAY MIDTRANS -------
    const transactionStatus = body.transaction_status as string
    const fraudStatus = (body.fraud_status as string) || 'accept'

    let status: 'berhasil' | 'pending' | 'gagal'
    if (transactionStatus === 'capture' || transactionStatus === 'settlement') {
      status = fraudStatus === 'accept' || transactionStatus === 'settlement' ? 'berhasil' : 'pending'
    } else if (transactionStatus === 'pending') {
      status = 'pending'
    } else if (transactionStatus === 'deny' || transactionStatus === 'cancel' || transactionStatus === 'expire') {
      status = 'gagal'
    } else {
      status = 'pending'
    }

    // ------- 3. CEK APAKAH INI PESANAN TIKET -------
    const { data: pesananTiket } = await supabase
      .from('pesanan_tiket')
      .select('*, tiket(id, sisa_kuota), voucher(id, nominal_diskon, kuota_penggunaan, jumlah_digunakan)')
      .eq('booking_id', bookingId)
      .maybeSingle()

    if (pesananTiket) {
      // Idempotent: jangan proses ulang pesanan tiket yang sudah berhasil
      if (pesananTiket.status_bayar === 'berhasil' && status === 'berhasil') {
        return NextResponse.json({ ok: true })
      }

      // Validasi batas waktu pembayaran (10 menit)
      const expiresAt = new Date(pesananTiket.tanggal_pesan).getTime() + PAYMENT_DURATION_MS
      if (status === 'berhasil' && expiresAt <= Date.now()) {
        await supabase
          .from('pesanan_tiket')
          .update({ status_bayar: 'gagal' })
          .eq('id', pesananTiket.id)
        return NextResponse.json(
          { error: 'Pesanan telah dibatalkan karena batas waktu pembayaran habis.' },
          { status: 410 }
        )
      }

      // Update status pesanan tiket
      const updateData: Record<string, unknown> = { status_bayar: status }
      if (status === 'berhasil') {
        updateData.qr_code = `ENCORETIX:${bookingId}`
      }
      await supabase.from('pesanan_tiket').update(updateData).eq('id', pesananTiket.id)

      // Simpan rincian pembayaran di tabel pembayaran
      await supabase.from('pembayaran').upsert({
        id_pesanan_tiket: pesananTiket.id,
        metode_pembayaran: body.payment_type || 'midtrans',
        tanggal_bayar: status === 'berhasil' ? new Date().toISOString() : null,
        total_bayar: Number(body.gross_amount) || 0,
        status_pembayaran: status,
      })

      // Jika berhasil: kurangi kuota tiket, konsumsi voucher, dan kirim email e-tiket
      if (status === 'berhasil') {
        if (pesananTiket.tiket) {
          await supabase
            .from('tiket')
            .update({ sisa_kuota: Math.max(0, pesananTiket.tiket.sisa_kuota - pesananTiket.jumlah) })
            .eq('id', pesananTiket.tiket.id)
        }

        if (pesananTiket.voucher && Number(pesananTiket.voucher.jumlah_digunakan) < Number(pesananTiket.voucher.kuota_penggunaan)) {
          await supabase
            .from('voucher')
            .update({ jumlah_digunakan: Number(pesananTiket.voucher.jumlah_digunakan) + 1 })
            .eq('id', pesananTiket.voucher.id)
        }

        await sendTicketEmailForBooking(bookingId)
      }

      return NextResponse.json({ ok: true })
    }

    // ------- 4. JIKA BUKAN TIKET, CEK PESANAN MERCHANDISE -------
    const resolvedMerch = await resolveMerchGroup(supabase, bookingId)
    if (resolvedMerch && resolvedMerch.rows.length > 0) {
      const currentStatus = resolvedMerch.rows[0]?.status_bayar
      if (currentStatus === 'berhasil' && status === 'berhasil') {
        return NextResponse.json({ ok: true })
      }

      if (status === 'berhasil') {
        const updateMerch: Record<string, unknown> = {
          status_bayar: 'berhasil',
          qr_pengambilan: `ENCORETIX:${resolvedMerch.groupCode}`,
          metode_pembayaran: body.payment_type || 'midtrans',
        }
        await supabase
          .from('pesanan_merchandise')
          .update(updateMerch)
          .eq('kode_pesanan', resolvedMerch.groupCode)

        await sendMerchEmailForOrder(resolvedMerch.groupCode)
      } else if (status === 'gagal') {
        await supabase
          .from('pesanan_merchandise')
          .update({ status_bayar: 'gagal' })
          .eq('kode_pesanan', resolvedMerch.groupCode)
      }

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    console.error('[Midtrans Webhook Error]:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
