// @ts-expect-error midtrans-client tidak menyertakan deklarasi tipe TS resmi
import midtransClient from 'midtrans-client'
import { getServerSupabase } from './supabaseClient'
import { sendTicketEmailForBooking } from './ticketSender'
import { sendMerchEmailForOrder } from './merchSender'
import { resolveMerchGroup } from './merchGroup'

function getCoreClient() {
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true'
  const serverKey = process.env.MIDTRANS_SERVER_KEY || ''
  const clientKey =
    process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ||
    process.env.MIDTRANS_CLIENT_KEY ||
    ''

  return new midtransClient.CoreApi({
    isProduction,
    serverKey,
    clientKey,
  })
}

/**
 * Memeriksa status transaksi langsung ke Midtrans API (Pull/Polling).
 * Berguna saat webhook Midtrans tidak bisa menembus localhost (tanpa ngrok).
 */
export async function syncOrderWithMidtrans(bookingId: string): Promise<'berhasil' | 'pending' | 'gagal' | null> {
  const normalizedId = bookingId.trim().toUpperCase()
  const baseId = normalizedId.replace(/-\d+$/, '')
  const supabase = getServerSupabase()

  // Cek apakah di database memang masih pending
  let isTicket = false
  let isMerch = false
  let currentStatus: string | null = null
  let ticketRecord: Record<string, unknown> | null = null
  let merchGroupCode: string | null = null

  const { data: pesananTiket } = await supabase
    .from('pesanan_tiket')
    .select('*, tiket(id, sisa_kuota), voucher(id, nominal_diskon, kuota_penggunaan, jumlah_digunakan)')
    .eq('booking_id', baseId)
    .maybeSingle()

  if (pesananTiket) {
    isTicket = true
    currentStatus = pesananTiket.status_bayar
    ticketRecord = pesananTiket as Record<string, unknown>
  } else {
    const resolved = await resolveMerchGroup(supabase, baseId)
    if (resolved && resolved.rows.length > 0) {
      isMerch = true
      currentStatus = resolved.rows[0].status_bayar
      merchGroupCode = resolved.groupCode
    }
  }

  // Jika sudah berhasil atau tidak ditemukan, tidak perlu sync
  if (!currentStatus) return null
  if (currentStatus === 'berhasil') return 'berhasil'

  // Cek status ke Midtrans (coba baseId, lalu coba suffix -1 s/d -4 jika ada)
  const core = getCoreClient()
  let midtransRes: Record<string, unknown> | null = null

  const candidateIds = [baseId, `${baseId}-1`, `${baseId}-2`, `${baseId}-3`]
  for (const cid of candidateIds) {
    try {
      const res = await core.transaction.status(cid)
      if (res && res.transaction_status) {
        midtransRes = res
        // Prioritaskan jika sudah settlement/capture
        if (res.transaction_status === 'settlement' || res.transaction_status === 'capture') {
          break
        }
      }
    } catch {
      // Abaikan 404 pada kandidat suffix
    }
  }

  if (!midtransRes || !midtransRes.transaction_status) {
    return null
  }

  const txStatus = String(midtransRes.transaction_status)
  const fraudStatus = String(midtransRes.fraud_status || 'accept')

  let newStatus: 'berhasil' | 'pending' | 'gagal'
  if (txStatus === 'capture' || txStatus === 'settlement') {
    newStatus = fraudStatus === 'accept' || txStatus === 'settlement' ? 'berhasil' : 'pending'
  } else if (txStatus === 'pending') {
    newStatus = 'pending'
  } else if (txStatus === 'deny' || txStatus === 'cancel' || txStatus === 'expire') {
    newStatus = 'gagal'
  } else {
    newStatus = 'pending'
  }

  if (newStatus === currentStatus) {
    return newStatus
  }

  // Update Database jika ada perubahan status
  if (isTicket && ticketRecord) {
    const updateTiket: Record<string, unknown> = { status_bayar: newStatus }
    if (newStatus === 'berhasil') {
      updateTiket.qr_code = `ENCORETIX:${baseId}`
    }
    await supabase.from('pesanan_tiket').update(updateTiket).eq('id', ticketRecord.id)

    await supabase.from('pembayaran').upsert({
      id_pesanan_tiket: ticketRecord.id,
      metode_pembayaran: midtransRes.payment_type || 'midtrans',
      tanggal_bayar: newStatus === 'berhasil' ? new Date().toISOString() : null,
      total_bayar: Number(midtransRes.gross_amount) || 0,
      status_pembayaran: newStatus,
    })

    if (newStatus === 'berhasil') {
      const tiket = ticketRecord.tiket as { id: string; sisa_kuota: number } | null
      if (tiket) {
        await supabase
          .from('tiket')
          .update({ sisa_kuota: Math.max(0, Number(tiket.sisa_kuota) - Number(ticketRecord.jumlah)) })
          .eq('id', tiket.id)
      }

      const voucher = ticketRecord.voucher as { id: string; jumlah_digunakan: number; kuota_penggunaan: number } | null
      if (voucher && Number(voucher.jumlah_digunakan) < Number(voucher.kuota_penggunaan)) {
        await supabase
          .from('voucher')
          .update({ jumlah_digunakan: Number(voucher.jumlah_digunakan) + 1 })
          .eq('id', voucher.id)
      }

      await sendTicketEmailForBooking(baseId)
    }
  } else if (isMerch && merchGroupCode) {
    if (newStatus === 'berhasil') {
      await supabase
        .from('pesanan_merchandise')
        .update({
          status_bayar: 'berhasil',
          qr_pengambilan: `ENCORETIX:${merchGroupCode}`,
          metode_pembayaran: midtransRes.payment_type || 'midtrans',
        })
        .eq('kode_pesanan', merchGroupCode)

      await sendMerchEmailForOrder(merchGroupCode)
    } else if (newStatus === 'gagal') {
      await supabase
        .from('pesanan_merchandise')
        .update({ status_bayar: 'gagal' })
        .eq('kode_pesanan', merchGroupCode)
    }
  }

  return newStatus
}

