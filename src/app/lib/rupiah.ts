// Helper parsing input uang format Indonesia.
// Masalah yang diselesaikan: input `type="number"` menafsirkan titik sebagai
// koma desimal, sehingga ketikan "100.000" (seratus ribu) terbaca sebagai 100.
// `parseRupiah` menganggap titik = pemisah ribuan (dibuang) dan
// koma = desimal, sehingga semua format umum terbaca benar:
//   "100.000" -> 100000
//   "100000"  -> 100000
//   "Rp 100.000" -> 100000
//   "99.999,50" -> 99999.5
//   "" / tidak valid -> 0
export function parseRupiah(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (value == null) return 0
  const s = String(value).trim()
  if (!s) return 0
  const cleaned = s.replace(/[^0-9.,-]/g, '')
  if (!cleaned || cleaned === '-' || cleaned === '.' || cleaned === ',') return 0
  const normalized = cleaned.replace(/\./g, '').replace(/,/g, '.')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : 0
}
