import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveEventId } from './events'

export interface PaymentMethodSummary {
  metode: string
  label: string
  transaksi: number
  revenue: number
}

export interface ManualSummary {
  orders: number
  tiket: number
  revenue: number
  onlineOrders: number
  onlineTiket: number
  onlineRevenue: number
  sharePct: number
}

export interface TrendPoint {
  key: string
  label: string
  tiket: number
  merch: number
  total: number
}

export interface RevenueTrend {
  daily: TrendPoint[]
  weekly: TrendPoint[]
  monthly: TrendPoint[]
}

export interface ReportStats {
  event_id: string | null
  totalKuota: number
  tiketTerjual: number
  tiketLunas: number
  checkin: number
  manualOrders: number
  merchBelum: number
  merchDiambil: number
  merchTerjual: number
  revenueTiket: number
  revenueMerch: number
  totalRevenue: number
  transaksiBerhasil: number
  transaksiPending: number
  transaksiGagal: number
  totalTransaksi: number
  paymentBreakdown: PaymentMethodSummary[]
  manualSummary: ManualSummary
  revenueTrend: RevenueTrend
  tiketBreakdown: { id: string; kategori: string; periode: string | null; terjual: number; total: number; sisa: number; harga: number; persen: number; revenue: number }[]
  merchBreakdown: { id: string; nama: string; harga: number; stok: number; terjual: number; revenue: number }[]
}

// Hitung statistik agregat laporan. Dipakai oleh /api/dashboard/stats (source=offline
// untuk metrik panitia) dan /api/reports/pdf.
export async function getReportStats(
  supabase: SupabaseClient,
  eventParam: string | null,
  offlineOnly = false
): Promise<ReportStats> {
  const eventId = await resolveEventId(supabase, eventParam)

  let tiketQuery = supabase.from('tiket').select('id, harga, kuota, sisa_kuota, kategori, periode_penjualan')
  let merchQuery = supabase.from('merchandise').select('id, harga, stok_s, stok_m, stok_l, stok_xl, stok_xxl, nama_merch')
  let pesananQuery = supabase.from('pesanan_tiket').select('id, id_tiket, jumlah, status_bayar, status_check_in, tiket_check_in, source, tanggal_pesan, tiket(id_event)')

  // Kolom pesanan_merchandise.metode_pembayaran belum tentu ada di DB
  // (migrasi add_metode_pembayaran_merch.sql belum dijalankan) -> fallback tanpa kolom.
  const MERCH_COLS_WITH = 'id, id_merch, jumlah, status_bayar, status_pengambilan, total_harga, tanggal_pesan, metode_pembayaran, merchandise(id_event)'
  const MERCH_COLS_WITHOUT = 'id, id_merch, jumlah, status_bayar, status_pengambilan, total_harga, tanggal_pesan, merchandise(id_event)'
  let merchTiketIds: string[] | null = null

  if (eventId) {
    tiketQuery = tiketQuery.eq('id_event', eventId)
    merchQuery = merchQuery.eq('id_event', eventId)

    // Filter pesanan lewat kolom FK milik tabel induk. Filter PostgREST pada
    // relasi terembed (tiket.id_event / merchandise.id_event) tidak membatasi
    // baris induk, sehingga laporan tetap mencampur transaksi semua event.
    const [eventTikets, eventMerch] = await Promise.all([
      supabase.from('tiket').select('id').eq('id_event', eventId),
      supabase.from('merchandise').select('id').eq('id_event', eventId),
    ])
    if (eventTikets.error) throw new Error(eventTikets.error.message)
    if (eventMerch.error) throw new Error(eventMerch.error.message)

    const NONE = '00000000-0000-0000-0000-000000000000'
    const idsOf = (rows: { id: string }[] | null) => (rows && rows.length > 0 ? rows.map((r) => r.id) : [NONE])
    pesananQuery = pesananQuery.in('id_tiket', idsOf(eventTikets.data))
    merchTiketIds = idsOf(eventMerch.data)
  }

  const [tiketRes, merchRes, pesananRes] = await Promise.all([
    tiketQuery,
    merchQuery,
    pesananQuery,
  ])

  const fetchMerchOrders = async (cols: string): Promise<{ data: // eslint-disable-next-line @typescript-eslint/no-explicit-any
any[] | null; error: { message: string } | null }> => {
    let q = supabase.from('pesanan_merchandise').select(cols)
    if (merchTiketIds) q = q.in('id_merch', merchTiketIds)
    const res = await q
    return res as unknown as { data: // eslint-disable-next-line @typescript-eslint/no-explicit-any
any[] | null; error: { message: string } | null }
  }
  let checkoutMerchRes = await fetchMerchOrders(MERCH_COLS_WITH)
  if (checkoutMerchRes.error && /metode_pembayaran|does not exist|PGRST204/i.test(checkoutMerchRes.error.message)) {
    checkoutMerchRes = await fetchMerchOrders(MERCH_COLS_WITHOUT)
  }

  if (tiketRes.error) throw new Error(tiketRes.error.message)
  if (merchRes.error) throw new Error(merchRes.error.message)
  if (pesananRes.error) throw new Error(pesananRes.error.message)
  if (checkoutMerchRes.error) throw new Error(checkoutMerchRes.error.message)

  // Metode pembayaran tiket tersimpan di tabel pembayaran (1:1 ke pesanan_tiket).
  // Order manual Tunai yang langsung lunas tidak punya baris pembayaran -> fallback 'Tunai'.
  const pesananIds = (pesananRes.data || []).map((p) => p.id)
  const pembayaranByPesanan = new Map<string, { metode: string; tanggal: string | null; total: number }>()
  // .in() PostgREST dibatasi ~200 nilai, jadi ambil pembayaran per batch.
  for (let i = 0; i < pesananIds.length; i += 200) {
    const batch = pesananIds.slice(i, i + 200)
    const { data: payRows, error: payError } = await supabase
      .from('pembayaran')
      .select('id_pesanan_tiket, metode_pembayaran, tanggal_bayar, total_bayar')
      .in('id_pesanan_tiket', batch)
    if (payError) throw new Error(payError.message)
    for (const r of payRows || []) {
      pembayaranByPesanan.set(r.id_pesanan_tiket as string, {
        metode: String(r.metode_pembayaran || ''),
        tanggal: (r.tanggal_bayar as string | null) || null,
        total: Number((r as { total_bayar?: number | string | null }).total_bayar || 0),
      })
    }
  }

  const tikets = tiketRes.data
  const merches = merchRes.data
  const pesanans = offlineOnly
    ? (pesananRes.data || []).filter((p) => p.source === 'offline')
    : pesananRes.data
  const merchOrders = checkoutMerchRes.data || []

  const totalKuota = tikets.reduce((s, t) => s + t.kuota, 0)
  const totalSisa = tikets.reduce((s, t) => s + t.sisa_kuota, 0)
  const tiketTerjual = offlineOnly
    ? pesanans.filter((p) => p.status_bayar === 'berhasil').reduce((s, p) => s + p.jumlah, 0)
    : totalKuota - totalSisa

  const tiketLunas = pesanans
    .filter((p) => p.status_bayar === 'berhasil')
    .reduce((s, p) => s + p.jumlah, 0)
  // Hitung per TIKET (bukan per booking): jumlah nomor tiket di tiket_check_in.
  // Fallback ke jumlah penuh untuk data lama yang statusnya sudah_check_in
  // tapi array-nya masih kosong.
  const checkin = pesanans.reduce((s, p) => {
    const arr = Array.isArray((p as { tiket_check_in?: unknown }).tiket_check_in)
      ? ((p as { tiket_check_in?: unknown }).tiket_check_in as number[])
      : []
    if (arr.length > 0) return s + arr.length
    if (p.status_check_in === 'sudah_check_in') return s + p.jumlah
    return s
  }, 0)
  const manualOrders = pesanans.filter((p) => p.source === 'offline').length

  const merchBelum = merchOrders.filter((m) => m.status_pengambilan === 'belum_diambil').length
  const merchDiambil = merchOrders.filter((m) => m.status_pengambilan === 'sudah_diambil').length
  const merchTerjual = merchOrders
    .filter((m) => m.status_bayar === 'berhasil')
    .reduce((s, m) => s + m.jumlah, 0)

  const revenueTiket = pesanans
    .filter((p) => p.status_bayar === 'berhasil')
    .reduce((s, p) => {
      const paid = pembayaranByPesanan.get(p.id)
      if (paid) return s + paid.total
      const tiket = tikets.find((t) => t.id === p.id_tiket)
      return s + (tiket ? Number(tiket.harga) * p.jumlah : 0)
    }, 0)
  const revenueMerch = merchOrders
    .filter((m) => m.status_bayar === 'berhasil')
    .reduce((s, m) => s + Number(m.total_harga), 0)

  const transaksiBerhasil = pesanans.filter((p) => p.status_bayar === 'berhasil').length
  const transaksiPending = pesanans.filter((p) => p.status_bayar === 'pending').length
  const transaksiGagal = pesanans.filter((p) => p.status_bayar === 'gagal').length
  const totalTransaksi = pesanans.length + merchOrders.length

  const canonicalMetode = (raw: unknown, fallback: string) => {
    const s = String(raw || '').trim()
    return s || fallback
  }
  const metodeLabel = (metode: string) => {
    const lower = metode.toLowerCase()
    const banks = ['bca', 'bri', 'mandiri', 'bni', 'cimb', 'danamon', 'bsi', 'sampoerna', 'sinarmas', 'maybank', 'permata']
    if (lower === 'qris') return 'QRIS'
    if (lower === 'tunai') return 'Tunai'
    if (banks.includes(lower)) return lower.toUpperCase()
    return metode
  }

  // --- Ringkasan per metode pembayaran (hanya transaksi berhasil) ---
  const payAgg = new Map<string, { transaksi: number; revenue: number }>()
  const addPay = (metode: string, revenue: number) => {
    const hit = payAgg.get(metode) || { transaksi: 0, revenue: 0 }
    hit.transaksi += 1
    hit.revenue += revenue
    payAgg.set(metode, hit)
  }
  const tiketHargaById = new Map(tikets.map((t) => [t.id, Number(t.harga)]))
  for (const p of pesanans) {
    if (p.status_bayar !== 'berhasil') continue
    const pay = pembayaranByPesanan.get(p.id)
    const metode = canonicalMetode(
      pay?.metode || (p.source === 'offline' ? 'Tunai' : 'Lainnya'),
      'Lainnya'
    )
    // Pakai nominal yang benar-benar dibayar bila ada (termasuk biaya admin);
    // order manual tanpa baris pembayaran memakai harga tiket saat ini.
    addPay(metode, pay ? pay.total : (tiketHargaById.get(p.id_tiket) ?? 0) * p.jumlah)
  }
  for (const m of merchOrders) {
    if (m.status_bayar !== 'berhasil') continue
    const metode = canonicalMetode((m as { metode_pembayaran?: unknown }).metode_pembayaran || 'QRIS', 'Lainnya')
    addPay(metode, Number(m.total_harga))
  }
  const paymentBreakdown: PaymentMethodSummary[] = [...payAgg.entries()]
    .map(([metode, v]) => ({ metode, label: metodeLabel(metode), transaksi: v.transaksi, revenue: v.revenue }))
    .sort((a, b) => b.revenue - a.revenue)

  // --- Ringkasan input manual panitia (source offline) vs online ---
  const offlineOk = pesanans.filter((p) => p.source === 'offline' && p.status_bayar === 'berhasil')
  const onlineOk = pesanans.filter((p) => p.source !== 'offline' && p.status_bayar === 'berhasil')
  const sumTiketRevenue = (rows: typeof pesanans) =>
    rows.reduce((s, p) => {
      const pay = pembayaranByPesanan.get(p.id)
      if (pay) return s + pay.total
      return s + (tiketHargaById.get(p.id_tiket) ?? 0) * p.jumlah
    }, 0)
  const manualRevenue = sumTiketRevenue(offlineOk)
  const onlineRevenue = sumTiketRevenue(onlineOk) + revenueMerch
  const manualSummary: ManualSummary = {
    orders: pesanans.filter((p) => p.source === 'offline').length,
    tiket: offlineOk.reduce((s, p) => s + p.jumlah, 0),
    revenue: manualRevenue,
    onlineOrders: pesanans.filter((p) => p.source !== 'offline').length,
    onlineTiket: onlineOk.reduce((s, p) => s + p.jumlah, 0),
    onlineRevenue,
    sharePct: revenueTiket + revenueMerch > 0 ? Math.round((manualRevenue / (revenueTiket + revenueMerch)) * 100) : 0,
  }

  // --- Tren pendapatan: harian (14 hari), mingguan (12 minggu), bulanan (12 bulan) ---
  const startOfDay = (d: Date) => {
    const c = new Date(d)
    c.setHours(0, 0, 0, 0)
    return c
  }
  const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  const mondayOf = (d: Date) => {
    const c = startOfDay(d)
    const dow = (c.getDay() + 6) % 7
    c.setDate(c.getDate() - dow)
    return c
  }
  const now = new Date()
  const today = startOfDay(now)

  const dailyKeys: string[] = []
  const dailyLabel = new Map<string, string>()
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const k = dayKey(d)
    dailyKeys.push(k)
    dailyLabel.set(k, d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }))
  }
  const weeklyKeys: string[] = []
  const weeklyLabel = new Map<string, string>()
  const thisMonday = mondayOf(today)
  for (let i = 11; i >= 0; i--) {
    const m = new Date(thisMonday)
    m.setDate(m.getDate() - i * 7)
    const k = dayKey(m)
    weeklyKeys.push(k)
    weeklyLabel.set(k, m.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }))
  }
  const monthlyKeys: string[] = []
  const monthlyLabel = new Map<string, string>()
  for (let i = 11; i >= 0; i--) {
    const m = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const k = monthKey(m)
    monthlyKeys.push(k)
    monthlyLabel.set(k, m.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }))
  }

  const sumToBucket = (map: Map<string, { tiket: number; merch: number }>, key: string, kind: 'tiket' | 'merch', amount: number) => {
    if (!map.has(key)) map.set(key, { tiket: 0, merch: 0 })
    map.get(key)![kind] += amount
  }
  const dailyMap = new Map<string, { tiket: number; merch: number }>()
  const weeklyMap = new Map<string, { tiket: number; merch: number }>()
  const monthlyMap = new Map<string, { tiket: number; merch: number }>()

  for (const p of pesanans) {
    if (p.status_bayar !== 'berhasil') continue
    const pay = pembayaranByPesanan.get(p.id)
    const rawDate = pay?.tanggal || (p as { tanggal_pesan?: string }).tanggal_pesan
    if (!rawDate) continue
    const d = new Date(rawDate)
    if (Number.isNaN(d.getTime())) continue
    const amount = pay ? pay.total : (tiketHargaById.get(p.id_tiket) ?? 0) * p.jumlah
    const dk = dayKey(d)
    if (dailyLabel.has(dk)) sumToBucket(dailyMap, dk, 'tiket', amount)
    const wk = dayKey(mondayOf(d))
    if (weeklyLabel.has(wk)) sumToBucket(weeklyMap, wk, 'tiket', amount)
    const mk = monthKey(d)
    if (monthlyLabel.has(mk)) sumToBucket(monthlyMap, mk, 'tiket', amount)
  }
  for (const m of merchOrders) {
    if (m.status_bayar !== 'berhasil') continue
    const rawDate = (m as { tanggal_pesan?: string }).tanggal_pesan
    if (!rawDate) continue
    const d = new Date(rawDate)
    if (Number.isNaN(d.getTime())) continue
    const amount = Number(m.total_harga)
    const dk = dayKey(d)
    if (dailyLabel.has(dk)) sumToBucket(dailyMap, dk, 'merch', amount)
    const wk = dayKey(mondayOf(d))
    if (weeklyLabel.has(wk)) sumToBucket(weeklyMap, wk, 'merch', amount)
    const mk = monthKey(d)
    if (monthlyLabel.has(mk)) sumToBucket(monthlyMap, mk, 'merch', amount)
  }

  const toPoints = (keys: string[], labels: Map<string, string>, map: Map<string, { tiket: number; merch: number }>): TrendPoint[] =>
    keys.map((k) => {
      const v = map.get(k) || { tiket: 0, merch: 0 }
      return { key: k, label: labels.get(k) || k, tiket: v.tiket, merch: v.merch, total: v.tiket + v.merch }
    })
  const revenueTrend: RevenueTrend = {
    daily: toPoints(dailyKeys, dailyLabel, dailyMap),
    weekly: toPoints(weeklyKeys, weeklyLabel, weeklyMap),
    monthly: toPoints(monthlyKeys, monthlyLabel, monthlyMap),
  }

  return {
    event_id: eventId,
    totalKuota,
    tiketTerjual,
    tiketLunas,
    checkin,
    manualOrders,
    merchBelum,
    merchDiambil,
    merchTerjual,
    revenueTiket,
    revenueMerch,
    totalRevenue: revenueTiket + revenueMerch,
    transaksiBerhasil,
    transaksiPending,
    transaksiGagal,
    totalTransaksi,
    paymentBreakdown,
    manualSummary,
    revenueTrend,
    tiketBreakdown: tikets.map((t) => {
      const terjual = offlineOnly
        ? pesanans
            .filter((p) => p.id_tiket === t.id && p.status_bayar === 'berhasil')
            .reduce((s, p) => s + p.jumlah, 0)
        : t.kuota - t.sisa_kuota
      // Pendapatan per kategori memakai nominal dibayar (bila ada), bukan harga
      // tiket saat ini yang bisa berubah setelah penjualan.
      const revenue = pesanans
        .filter((p) => p.id_tiket === t.id && p.status_bayar === 'berhasil')
        .reduce((s, p) => {
          const pay = pembayaranByPesanan.get(p.id)
          return s + (pay ? pay.total : Number(t.harga) * p.jumlah)
        }, 0)
      return {
        id: t.id,
        kategori: t.kategori,
        periode: (t as { periode_penjualan?: string | null }).periode_penjualan || null,
        terjual,
        total: t.kuota,
        sisa: t.sisa_kuota,
        harga: Number(t.harga),
        persen: t.kuota > 0 ? Math.round((terjual / t.kuota) * 100) : 0,
        revenue,
      }
    }),
    merchBreakdown: merches.map((m) => {
      const sold = merchOrders
        .filter((ord) => ord.status_bayar === 'berhasil' && ord.id_merch === m.id)
        .reduce((s, ord) => s + ord.jumlah, 0)
      const stokPerMerch =
        (m.stok_s ?? 0) + (m.stok_m ?? 0) + (m.stok_l ?? 0) + (m.stok_xl ?? 0) + (m.stok_xxl ?? 0)
      const revenue = merchOrders
        .filter((ord) => ord.status_bayar === 'berhasil' && ord.id_merch === m.id)
        .reduce((s, ord) => s + Number(ord.total_harga), 0)
      return {
        id: m.id,
        nama: m.nama_merch,
        harga: Number(m.harga),
        stok: stokPerMerch,
        terjual: sold,
        revenue,
      }
    }),
  }
}