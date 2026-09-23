import type { SupabaseClient } from '@supabase/supabase-js'

export const PAYMENT_DURATION_MS = 10 * 60 * 1000

// Tandai pesanan 'pending' yang sudah melewati batas 10 menit sejak dibuat (tanggal_pesan)
// menjadi 'gagal'. Dipanggil sebelum data dibaca (dashboard/transaksi/stats) dan sebelum
// pemrosesan pembayaran. Tidak butuh kolom expires_at: batas dihitung dari tanggal_pesan.
export async function expireExpiredPendingOrders(supabase: SupabaseClient) {
  const now = Date.now()
  let tiket = 0
  let merch = 0

  const { data: pendingTiket, error: tiketErr } = await supabase
    .from('pesanan_tiket')
    .select('id, tanggal_pesan')
    .eq('status_bayar', 'pending')

  if (!tiketErr && pendingTiket && pendingTiket.length > 0) {
    const ids = pendingTiket
      .filter((p) => p.tanggal_pesan && new Date(p.tanggal_pesan).getTime() + PAYMENT_DURATION_MS <= now)
      .map((p) => p.id)
    if (ids.length > 0) {
      const { data: updated, error: updateErr } = await supabase
        .from('pesanan_tiket')
        .update({ status_bayar: 'gagal' })
        .in('id', ids)
        .select('id')
      if (!updateErr) tiket = updated?.length ?? 0
    }
  }

  const { data: pendingMerch, error: merchErr } = await supabase
    .from('pesanan_merchandise')
    .select('id, kode_pesanan, kode_pengambilan, tanggal_pesan')
    .eq('status_bayar', 'pending')

  if (!merchErr && pendingMerch && pendingMerch.length > 0) {
    // Kelompokkan per kode_pesanan: satu checkout punya beberapa baris item.
    // Jika kelompok paling awal lewat batas waktu (10 menit), semua barisnya dibatalkan.
    const groups = new Map<string, { ids: string[]; earliest: number }>()
    for (const p of pendingMerch) {
      if (!p.tanggal_pesan) continue
      const key = String(p.kode_pesanan || p.kode_pengambilan || p.id)
      const hit = groups.get(key) ?? { ids: [], earliest: Infinity }
      hit.ids.push(p.id)
      hit.earliest = Math.min(hit.earliest, new Date(p.tanggal_pesan).getTime())
      groups.set(key, hit)
    }
    const expiredIds = [...groups.values()]
      .filter((g) => g.earliest + PAYMENT_DURATION_MS <= now)
      .flatMap((g) => g.ids)
    if (expiredIds.length > 0) {
      const { data: updated, error: updateErr } = await supabase
        .from('pesanan_merchandise')
        .update({ status_bayar: 'gagal' })
        .in('id', expiredIds)
        .select('id')
      if (!updateErr) merch = updated?.length ?? 0
    }
  }

  return {
    tiket,
    merch,
    errors: [tiketErr, merchErr].filter(Boolean).map((e) => e?.message ?? ''),
  }
}