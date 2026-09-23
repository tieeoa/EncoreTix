// Normalisasi isi QR menjadi kode booking/pengambilan.
// Mendukung format "ENCORETIX:CODE", URL dengan parameter code/booking/ticket/kode,
// atau kode mentah (fallback).
export function extractScanCode(raw: string): string {
  const text = (raw || '').trim()
  if (!text) return ''

  const prefixed = /^encoretix:\s*(.+)$/i.exec(text)
  if (prefixed) return prefixed[1].trim().toUpperCase()

  try {
    const url = new URL(text)
    const q =
      url.searchParams.get('code') ||
      url.searchParams.get('booking') ||
      url.searchParams.get('ticket') ||
      url.searchParams.get('kode')
    if (q) return q.trim().toUpperCase()
  } catch {
    // bukan URL, lanjut ke fallback
  }

  return text.toUpperCase()
}