// Helper export CSV. Memakai separator titik koma (;) supaya rapi dibuka di
// Microsoft Excel dengan locale Indonesia (desimal pakai koma).

export type CsvValue = string | number | null | undefined

export function csvCell(value: CsvValue): string {
  const s = value == null ? '' : String(value)
  return `"${s.replace(/"/g, '""')}"`
}

// header = baris pertama; rows = baris data. Setiap sel dibungkus kutip.
// Baris `sep=;` di awal adalah petunjuk untuk Excel: file selalu dipisah pakai
// titik koma, tidak peduli locale komputer (komma vs titik-koma), jadi hasilnya
// tampil rapi sebagai tabel, bukan menumpuk di satu kolom.
export function buildCsv(header: string[], rows: CsvValue[][]): string {
  const lines = [header, ...rows].map((cells) => cells.map(csvCell).join(';'))
  return ['sep=;', ...lines].join('\r\n')
}

// Simpan otomatis ke perangkat (Downloads) tanpa interaksi manual.
// BOM \uFEFF menandakan UTF-8 supaya karakter ber-aksara tidak rusak di Excel.
export function autoSaveCsv(filename: string, csv: string) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}