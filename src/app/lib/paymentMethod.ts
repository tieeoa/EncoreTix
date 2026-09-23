// Helper metode pembayaran: normalisasi nilai yang disimpan ke DB dan label
// yang tampil di UI. Dipakai saat konfirmasi pembayaran maupun di tabel transaksi.
const BANK_IDS = [
  'bca',
  'bri',
  'mandiri',
  'bni',
  'cimb',
  'danamon',
  'bsi',
  'sampoerna',
  'sinarmas',
  'maybank',
  'permata',
]

// Ubah input apa pun (id bank, label, dsb) menjadi nilai kanonis untuk disimpan.
export function normalizeMetode(input: unknown): string {
  const raw = String(input || '').trim()
  if (!raw) return 'QRIS'
  const lower = raw.toLowerCase()
  if (lower === 'qris' || lower.includes('qris')) return 'QRIS'
  if (lower === 'tunai' || lower === 'cash') return 'Tunai'
  if (BANK_IDS.includes(lower)) return lower.toUpperCase()
  // Label manual non-tunai ("Transfer Bank", "Kartu Debit/Kredit") disimpan apa adanya.
  return raw.slice(0, 40)
}

// Label ramah tampil untuk nilai yang tersimpan di DB.
export function labelMetode(input: unknown): string {
  const raw = String(input || '').trim()
  if (!raw) return '-'
  const lower = raw.toLowerCase()
  if (lower === 'qris') return 'QRIS'
  if (lower === 'tunai') return 'Tunai'
  if (BANK_IDS.includes(lower)) return lower.toUpperCase()
  return raw
}
