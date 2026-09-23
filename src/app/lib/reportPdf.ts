import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import type { ReportStats } from './reportStats'

export interface ReportPdfData {
  eventName: string
  eventSubtitle: string
  generatedAt: string
  stats: ReportStats
}

const W = 595
const H = 842
const MARGIN = 40
const NAVY = rgb(0.043, 0.11, 0.23)
const BLUE = rgb(0.38, 0.65, 0.98)
const GRAY = rgb(0.42, 0.45, 0.5)
const DARK = rgb(0.067, 0.09, 0.15)
const LIGHT = rgb(0.945, 0.96, 0.976)
const LINE = rgb(0.9, 0.906, 0.914)

function formatRupiah(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID')
}

function drawShrinkText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  size: number,
  maxWidth: number,
  color = DARK
) {
  let useSize = size
  while (useSize > 6 && font.widthOfTextAtSize(text, useSize) > maxWidth) {
    useSize -= 0.5
  }
  page.drawText(text, { x, y, size: useSize, font, color })
}

function drawTextRight(
  page: PDFPage,
  font: PDFFont,
  text: string,
  rightX: number,
  y: number,
  size: number,
  color = DARK
) {
  const width = font.widthOfTextAtSize(text, size)
  page.drawText(text, { x: rightX - width, y, size, font, color })
}

interface TableCol {
  x: number
  w: number
  align: 'left' | 'right'
  label: string
}

function drawTableHeader(page: PDFPage, fontBold: PDFFont, y: number, title: string) {
  page.drawRectangle({ x: MARGIN - 10, y: y, width: W - 60, height: 30, color: NAVY })
  drawShrinkText(page, fontBold, title, MARGIN, y + 9, 11, 380, rgb(1, 1, 1))
}

export async function generateReportPdf(data: ReportPdfData): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const stats = data.stats

  let page: PDFPage = pdfDoc.addPage([W, H])
  let y = 0

  const openPage = () => {
    page = pdfDoc.addPage([W, H])
    y = H
    page.drawRectangle({ x: 0, y: H - 90, width: W, height: 90, color: NAVY })
    drawShrinkText(page, fontBold, 'LAPORAN PENJUALAN', MARGIN, H - 30, 13, 300, rgb(1, 1, 1))
    drawShrinkText(page, font, data.eventName, MARGIN, H - 50, 11, 400, rgb(0.82, 0.85, 0.89))
    drawShrinkText(page, font, data.generatedAt, MARGIN, H - 68, 9, 400, rgb(0.61, 0.63, 0.68))
    y = H - 112
  }

  // --- Halaman pertama: header besar ---
  y = H
  page.drawRectangle({ x: 0, y: H - 150, width: W, height: 150, color: NAVY })
  page.drawText('ENCORETIX', { x: MARGIN, y: H - 36, size: 13, font: fontBold, color: BLUE })
  drawShrinkText(page, fontBold, data.eventName, MARGIN, H - 72, 24, 500, rgb(1, 1, 1))
  drawShrinkText(page, font, data.eventSubtitle, MARGIN, H - 98, 12, 500, rgb(0.82, 0.85, 0.89))
  page.drawText('LAPORAN PENJUALAN EVENT', { x: MARGIN, y: H - 122, size: 14, font: fontBold, color: rgb(0.95, 0.97, 1) })
  y = H - 180

  // --- Ringkasan 4 kotak ---
  const summary: { label: string; value: string }[] = [
    { label: 'Total Revenue', value: formatRupiah(stats.totalRevenue) },
    { label: 'Tiket Terjual', value: stats.tiketTerjual.toLocaleString('id-ID') },
    { label: 'Merch Terjual', value: stats.merchTerjual.toLocaleString('id-ID') },
    { label: 'Transaksi', value: stats.totalTransaksi.toLocaleString('id-ID') },
  ]
  const boxW = (W - 2 * MARGIN - 3 * 10) / 4
  const boxH = 62
  summary.forEach((s, i) => {
    const x = MARGIN + i * (boxW + 10)
    page.drawRectangle({ x, y: y - boxH, width: boxW, height: boxH, color: LIGHT })
    drawShrinkText(page, font, s.label, x + 10, y - 22, 9, boxW - 20, GRAY)
    drawShrinkText(page, fontBold, s.value, x + 10, y - 44, 13, boxW - 20, NAVY)
  })
  y -= boxH + 24

  // --- Komposisi Revenue ---
  const tiketShare = stats.totalRevenue > 0 ? Math.round((stats.revenueTiket / stats.totalRevenue) * 100) : 0
  const merchShare = stats.totalRevenue > 0 ? Math.round((stats.revenueMerch / stats.totalRevenue) * 100) : 0
  drawShrinkText(page, fontBold, 'Komposisi Revenue', MARGIN, y, 12, 400, NAVY)
  y -= 18
  const compRows: { label: string; value: string; pct: string }[] = [
    { label: 'Revenue Tiket', value: formatRupiah(stats.revenueTiket), pct: `(${tiketShare}%)` },
    { label: 'Revenue Merchandise', value: formatRupiah(stats.revenueMerch), pct: `(${merchShare}%)` },
  ]
  for (const r of compRows) {
    drawShrinkText(page, font, r.label, MARGIN, y - 6, 10, 200, GRAY)
    drawShrinkText(page, fontBold, r.value, 320, y - 6, 11, 200, DARK)
    drawShrinkText(page, font, r.pct, 470, y - 6, 10, 80, GRAY)
    y -= 20
  }
  page.drawLine({ start: { x: MARGIN, y: y + 2 }, end: { x: 555, y: y + 2 }, thickness: 1, color: LINE })
  y -= 12
  drawShrinkText(page, fontBold, 'Total Revenue', MARGIN, y - 5, 11, 200, NAVY)
  drawTextRight(page, fontBold, formatRupiah(stats.totalRevenue), 555, y - 5, 12, NAVY)
  y -= 30

  // --- Ringkasan Metode Pembayaran ---
  const payRows = stats.paymentBreakdown || []
  const payTotal = payRows.reduce((s, r) => s + r.revenue, 0)
  drawShrinkText(page, fontBold, 'Ringkasan Metode Pembayaran', MARGIN, y, 12, 400, NAVY)
  y -= 16
  drawShrinkText(page, font, 'Tiket + merchandise, hanya transaksi berhasil', MARGIN, y, 9, 400, GRAY)
  y -= 14
  if (payRows.length === 0) {
    drawShrinkText(page, font, 'Belum ada transaksi berhasil.', MARGIN, y - 6, 10, 400, GRAY)
    y -= 24
  } else {
    for (const r of payRows) {
      if (y - 30 < 60) openPage()
      const pct = payTotal > 0 ? Math.round((r.revenue / payTotal) * 100) : 0
      drawShrinkText(page, font, `${r.label} (${r.transaksi}x)`, MARGIN, y - 6, 10, 200, DARK)
      drawShrinkText(page, fontBold, formatRupiah(r.revenue), 320, y - 6, 11, 200, DARK)
      drawShrinkText(page, font, `(${pct}%)`, 470, y - 6, 10, 80, GRAY)
      y -= 14
      // Bar proporsional
      const barW = 515 * (pct / 100)
      page.drawRectangle({ x: MARGIN, y: y - 4, width: 515, height: 6, color: LIGHT })
      if (barW > 0) page.drawRectangle({ x: MARGIN, y: y - 4, width: barW, height: 6, color: rgb(0.39, 0.4, 0.86) })
      y -= 16
    }
    page.drawLine({ start: { x: MARGIN, y: y + 2 }, end: { x: 555, y: y + 2 }, thickness: 1, color: LINE })
    y -= 12
    drawShrinkText(page, fontBold, 'Total (berhasil)', MARGIN, y - 5, 11, 200, NAVY)
    drawTextRight(page, fontBold, formatRupiah(payTotal), 555, y - 5, 12, NAVY)
    y -= 30
  }

  // --- Input Manual Panitia ---
  const manual = stats.manualSummary
  if (manual) {
    if (y - 110 < 60) openPage()
    drawShrinkText(page, fontBold, 'Input Manual Panitia', MARGIN, y, 12, 400, NAVY)
    y -= 16
    drawShrinkText(page, font, 'Order offline (source manual) vs penjualan online', MARGIN, y, 9, 400, GRAY)
    y -= 16
    const manualRows: { label: string; value: string }[] = [
      { label: 'Order manual', value: `${manual.orders} order` },
      { label: 'Tiket manual (lunas)', value: `${manual.tiket.toLocaleString('id-ID')} tiket` },
      { label: 'Revenue manual', value: formatRupiah(manual.revenue) },
      { label: 'Order online', value: `${manual.onlineOrders} order (${manual.onlineTiket.toLocaleString('id-ID')} tiket)` },
      { label: 'Revenue online (tiket + merch)', value: formatRupiah(manual.onlineRevenue) },
      { label: 'Kontribusi manual', value: `${manual.sharePct}% dari total revenue` },
    ]
    for (const r of manualRows) {
      drawShrinkText(page, font, r.label, MARGIN, y - 6, 10, 240, GRAY)
      drawShrinkText(page, fontBold, r.value, 320, y - 6, 11, 230, DARK)
      y -= 18
    }
    y -= 12
  }

  // --- Tabel Tiket ---
  const tiketCols: TableCol[] = [
    { x: 40, w: 100, align: 'left', label: 'Kategori' },
    { x: 140, w: 105, align: 'left', label: 'Periode' },
    { x: 245, w: 60, align: 'left', label: 'Harga' },
    { x: 305, w: 45, align: 'right', label: 'Kuota' },
    { x: 350, w: 55, align: 'right', label: 'Terjual' },
    { x: 405, w: 50, align: 'right', label: 'Sisa' },
    { x: 455, w: 100, align: 'right', label: 'Revenue' },
  ]

  openPage()
  drawTableHeader(page, fontBold, y, 'Detail Penjualan Tiket per Kategori')
  y -= 30
  page.drawRectangle({ x: MARGIN - 10, y: y, width: W - 60, height: 22, color: LIGHT })
  for (const c of tiketCols) {
    if (c.align === 'right') drawTextRight(page, fontBold, c.label, c.x + c.w, y + 7, 9, NAVY)
    else drawShrinkText(page, fontBold, c.label, c.x, y + 7, 9, c.w, NAVY)
  }
  y -= 22
  for (const r of stats.tiketBreakdown) {
    if (y - 26 < 60) openPage()
    page.drawRectangle({ x: MARGIN - 10, y: y - 20, width: W - 60, height: 20, color: y % 2 === 0 ? LIGHT : rgb(1, 1, 1) })
    drawShrinkText(page, font, r.kategori || '-', 40, y - 8, 10, 95, DARK)
    drawShrinkText(page, font, r.periode || '-', 140, y - 8, 9, 100, GRAY)
    drawShrinkText(page, font, formatRupiah(r.harga), 245, y - 8, 10, 58, GRAY)
    drawTextRight(page, font, String(r.total), 350, y - 8, 10)
    drawTextRight(page, font, String(r.terjual), 405, y - 8, 10, rgb(0.1, 0.6, 0.35))
    drawTextRight(page, font, String(r.sisa), 455, y - 8, 10, GRAY)
    drawTextRight(page, fontBold, formatRupiah(r.revenue), 555, y - 8, 10)
    y -= 26
  }
  if (y - 26 < 60) openPage()
  page.drawRectangle({ x: MARGIN - 10, y: y - 20, width: W - 60, height: 20, color: LIGHT })
  drawShrinkText(page, fontBold, 'TOTAL', 40, y - 8, 10, 95, NAVY)
  drawTextRight(page, fontBold, String(stats.tiketBreakdown.reduce((s, r) => s + r.total, 0)), 350, y - 8, 10)
  drawTextRight(page, fontBold, String(stats.tiketBreakdown.reduce((s, r) => s + r.terjual, 0)), 405, y - 8, 10, rgb(0.1, 0.6, 0.35))
  drawTextRight(page, fontBold, String(stats.tiketBreakdown.reduce((s, r) => s + r.sisa, 0)), 455, y - 8, 10)
  drawTextRight(page, fontBold, formatRupiah(stats.tiketBreakdown.reduce((s, r) => s + r.revenue, 0)), 555, y - 8, 10)
  y -= 40

  // --- Tabel Merch ---
  const merchCols: TableCol[] = [
    { x: 40, w: 190, align: 'left', label: 'Produk' },
    { x: 230, w: 90, align: 'left', label: 'Harga' },
    { x: 320, w: 60, align: 'right', label: 'Stok' },
    { x: 380, w: 70, align: 'right', label: 'Terjual' },
    { x: 450, w: 105, align: 'right', label: 'Revenue' },
  ]

  openPage()
  drawTableHeader(page, fontBold, y, 'Detail Penjualan Merchandise')
  y -= 30
  page.drawRectangle({ x: MARGIN - 10, y: y, width: W - 60, height: 22, color: LIGHT })
  for (const c of merchCols) {
    if (c.align === 'right') drawTextRight(page, fontBold, c.label, c.x + c.w, y + 7, 9, NAVY)
    else drawShrinkText(page, fontBold, c.label, c.x, y + 7, 9, c.w, NAVY)
  }
  y -= 22
  for (const m of stats.merchBreakdown) {
    if (y - 26 < 60) openPage()
    page.drawRectangle({ x: MARGIN - 10, y: y - 20, width: W - 60, height: 20, color: y % 2 === 0 ? LIGHT : rgb(1, 1, 1) })
    drawShrinkText(page, font, m.nama || '-', 40, y - 8, 10, 185, DARK)
    drawShrinkText(page, font, formatRupiah(m.harga), 230, y - 8, 10, 85, GRAY)
    drawTextRight(page, font, String(m.stok), 380, y - 8, 10)
    drawTextRight(page, font, String(m.terjual), 450, y - 8, 10, rgb(0.85, 0.55, 0.1))
    drawTextRight(page, fontBold, formatRupiah(m.revenue), 555, y - 8, 10)
    y -= 26
  }
  if (y - 26 < 60) openPage()
  page.drawRectangle({ x: MARGIN - 10, y: y - 20, width: W - 60, height: 20, color: LIGHT })
  drawShrinkText(page, fontBold, 'TOTAL', 40, y - 8, 10, 185, NAVY)
  drawTextRight(page, fontBold, String(stats.merchBreakdown.reduce((s, m) => s + m.stok, 0)), 380, y - 8, 10)
  drawTextRight(page, fontBold, String(stats.merchBreakdown.reduce((s, m) => s + m.terjual, 0)), 450, y - 8, 10, rgb(0.85, 0.55, 0.1))
  drawTextRight(page, fontBold, formatRupiah(stats.merchBreakdown.reduce((s, m) => s + m.revenue, 0)), 555, y - 8, 10)
  y -= 40

  // --- Tren Pendapatan (grafik batang + tabel) ---
  const trendFull: { title: string; subtitle: string; points: { label: string; tiket: number; merch: number; total: number }[] }[] = [
    { title: 'Tren Harian — 14 hari terakhir', subtitle: 'Transaksi berhasil per hari', points: stats.revenueTrend?.daily || [] },
    { title: 'Tren Mingguan — 12 minggu terakhir', subtitle: 'Per pekan (Senin–Minggu)', points: stats.revenueTrend?.weekly || [] },
    { title: 'Tren Bulanan — 12 bulan terakhir', subtitle: 'Per bulan', points: stats.revenueTrend?.monthly || [] },
  ]
  for (const g of trendFull) {
    openPage()
    drawTableHeader(page, fontBold, y, g.title)
    y -= 20
    drawShrinkText(page, font, g.subtitle, MARGIN, y, 9, 400, GRAY)
    y -= 18
    const peak = g.points.reduce((m, p) => Math.max(m, p.total), 0)
    if (peak <= 0) {
      drawShrinkText(page, font, 'Belum ada pendapatan pada periode ini.', MARGIN, y - 6, 10, 400, GRAY)
      y -= 24
      continue
    }
    for (const p of g.points) {
      if (y - 30 < 60) openPage()
      drawShrinkText(page, font, p.label, MARGIN, y - 6, 10, 90, DARK)
      const barMaxW = 280
      const barW = Math.max(p.total > 0 ? 2 : 0, (barMaxW * p.total) / peak)
      const tiketW = p.total > 0 ? (barW * p.tiket) / p.total : 0
      page.drawRectangle({ x: 140, y: y - 10, width: barMaxW, height: 10, color: LIGHT })
      if (tiketW > 0) page.drawRectangle({ x: 140, y: y - 10, width: tiketW, height: 10, color: rgb(0.15, 0.35, 0.9) })
      if (barW - tiketW > 0) page.drawRectangle({ x: 140 + tiketW, y: y - 10, width: barW - tiketW, height: 10, color: rgb(0.96, 0.72, 0.2) })
      drawTextRight(page, font, formatRupiah(p.total), 555, y - 6, 9, DARK)
      y -= 20
    }
    y -= 6
    drawShrinkText(page, font, 'Biru = tiket, kuning = merch.', MARGIN, y - 6, 9, 300, GRAY)
    y -= 20
  }

  // Footer
  if (y - 40 < 60) openPage()
  page.drawLine({ start: { x: MARGIN, y: y + 4 }, end: { x: 555, y: y + 4 }, thickness: 1, color: LINE })
  drawShrinkText(page, font, `Dibuat otomatis oleh EncoreTix · ${data.generatedAt}`, MARGIN, y - 14, 9, 400, GRAY)
  drawShrinkText(page, font, 'Statistik penjualan resmi event. Transaksi dihitung saat pembayaran berhasil.', MARGIN, y - 28, 9, 500, GRAY)

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}