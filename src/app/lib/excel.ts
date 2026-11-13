// Ekspor Excel tanpa dependency: format SpreadsheetML 2003 (.xls).
// Berbeda dengan CSV (teks biasa), file ini menyimpan kolom secara terstruktur
// sehingga langsung tampil sebagai tabel (header, border, lebar kolom, format
// angka) saat dibuka di Excel/LibreOffice.

export type ExcelValue = string | number | null | undefined

function xmlEscape(value: ExcelValue): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // Buang karakter kontrol yang tidak valid di XML.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
}

// Perkiraan lebar kolom (poin): Kode, Tipe, Nama, Email, Item, Total, Metode,
// Status, Sumber, Waktu. Kolom lain memakai lebar default.
const COLUMN_WIDTHS = [95, 70, 150, 190, 210, 95, 110, 90, 80, 150]

const BORDERS =
  '<Borders>' +
  ['Bottom', 'Left', 'Right', 'Top']
    .map((pos) => `<Border ss:Position="${pos}" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>`)
    .join('') +
  '</Borders>'

const STYLES =
  '<Styles>' +
  `<Style ss:ID="sHeader"><Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="11"/>` +
  `<Interior ss:Color="#1E293B" ss:Pattern="Solid"/>` +
  `<Alignment ss:Vertical="Center" ss:WrapText="1"/>${BORDERS}</Style>` +
  `<Style ss:ID="sBody"><Alignment ss:Vertical="Top" ss:WrapText="1"/>${BORDERS}</Style>` +
  `<Style ss:ID="sNumber"><NumberFormat ss:Format="#,##0"/>` +
  `<Alignment ss:Vertical="Top"/>${BORDERS}</Style>` +
  '</Styles>'

function cellXml(value: ExcelValue, styleId: string): string {
  const numeric = typeof value === 'number' && Number.isFinite(value)
  return `<Cell ss:StyleID="${styleId}"><Data ss:Type="${numeric ? 'Number' : 'String'}">${xmlEscape(value)}</Data></Cell>`
}

function sheetNameXml(name: string): string {
  return xmlEscape(name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Sheet1')
}

export function buildExcelXml(sheetName: string, header: ExcelValue[], rows: ExcelValue[][]): string {
  const columns = header.map((_, i) => `<Column ss:Width="${COLUMN_WIDTHS[i] ?? 110}"/>`).join('')
  const headerRow = `<Row ss:Height="22">${header.map((v) => cellXml(v, 'sHeader')).join('')}</Row>`
  const body = rows
    .map(
      (cells) =>
        `<Row>${cells.map((v) => cellXml(v, typeof v === 'number' ? 'sNumber' : 'sBody')).join('')}</Row>`
    )
    .join('')
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<?mso-application progid="Excel.Sheet"?>\n' +
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ' +
    'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n' +
    STYLES +
    '\n' +
    `<Worksheet ss:Name="${sheetNameXml(sheetName)}">` +
    `<Table ss:ExpandedColumnCount="${header.length}" ss:ExpandedRowCount="${rows.length + 1}">` +
    columns +
    headerRow +
    body +
    '</Table></Worksheet>\n' +
    '</Workbook>'
  )
}

export function autoSaveXls(filename: string, xml: string) {
  const blob = new Blob(['\uFEFF' + xml], { type: 'application/vnd.ms-excel;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
