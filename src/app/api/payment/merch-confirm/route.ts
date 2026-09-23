import { NextResponse } from 'next/server'
import { getServerSupabase } from '../../../lib/supabaseClient'
import { sendMerchEmailForOrder } from '../../../lib/merchSender'
import { PAYMENT_DURATION_MS } from '../../../lib/expireOrders'
import { resolveMerchGroup } from '../../../lib/merchGroup'
import { normalizeMetode } from '../../../lib/paymentMethod'

export const dynamic = 'force-dynamic'

// POST /api/payment/merch-confirm
// Simulasi konfirmasi pembayaran berhasil untuk pesanan merchandise (mirip tiket).
// Menandai SELURUH item dalam satu kelompok pesanan lunas dan mengisi qr_pengambilan.
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const kode = (body.kode_pengambilan as string || body.kode_pesanan as string || '').toUpperCase()
    if (!kode) {
      return NextResponse.json({ error: 'kode_pengambilan wajib diisi' }, { status: 400 })
    }
    // Metode yang dipilih pembeli di halaman payment (bca, qris, ...).
    const metode = normalizeMetode(body.metode_pembayaran || body.method || 'QRIS')

    const supabase = getServerSupabase()

    const resolved = await resolveMerchGroup(supabase, kode)
    if (!resolved) {
      return NextResponse.json({ error: 'Pesanan merch tidak ditemukan' }, { status: 404 })
    }

    const statusBayar = resolved.rows[0]?.status_bayar
    // Idempotent: jangan proses ulang yang sudah lunas.
    if (statusBayar === 'berhasil') {
      return NextResponse.json({ ok: true })
    }

    // Pesanan yang sudah dinyatakan gagal tidak boleh dibayar lagi.
    if (statusBayar === 'gagal') {
      return NextResponse.json({ error: 'Pesanan telah dibatalkan karena batas waktu pembayaran habis.' }, { status: 410 })
    }

    // Lewat batas waktu bayar (10 menit sejak pesanan dibuat) => tandai gagal dan tolak.
    const earliestPesan = resolved.rows.reduce(
      (min, r) => {
        const t = r.tanggal_pesan ? new Date(r.tanggal_pesan).getTime() : min
        return Math.min(min, t)
      },
      Infinity
    )
    const expiresAt = earliestPesan + PAYMENT_DURATION_MS
    if (expiresAt <= Date.now()) {
      await supabase
        .from('pesanan_merchandise')
        .update({ status_bayar: 'gagal' })
        .eq('kode_pesanan', resolved.groupCode)
      return NextResponse.json({ error: 'Batas waktu pembayaran telah habis. Pesanan dibatalkan.' }, { status: 410 })
    }

    // Simpan metode pembayaran bila kolomnya sudah ada (lihat migrasi
    // add_metode_pembayaran_merch). Toleran bila migrasi belum diterapkan.
    const baseUpdate = {
      status_bayar: 'berhasil',
      qr_pengambilan: `ENCORETIX:${resolved.groupCode}`,
    }
    const withMetode = { ...baseUpdate, metode_pembayaran: metode }
    let updateError = (
      await supabase
        .from('pesanan_merchandise')
        .update(withMetode)
        .eq('kode_pesanan', resolved.groupCode)
    ).error
    if (updateError && /metode_pembayaran/i.test(updateError.message)) {
      updateError = (
        await supabase
          .from('pesanan_merchandise')
          .update(baseUpdate)
          .eq('kode_pesanan', resolved.groupCode)
      ).error
    }
    if (updateError) throw new Error(updateError.message)

    // Kirim bukti pengambilan ke email pembeli (gagal email tidak menggagalkan pembayaran).
    await sendMerchEmailForOrder(resolved.groupCode)

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}