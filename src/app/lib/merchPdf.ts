import QRCode from 'qrcode'
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from 'pdf-lib'
import type { EventDisplay } from './events'
import { getPosterJpeg } from './posterImage'

export interface MerchPdfItem {
  nama_merch: string
  harga: number
  kategori: string | null
  jumlah: number
  ukuran: string | null
  total_harga: number
}

export interface MerchPdfData {
  kode_pengambilan: string
  nama: string
  email: string
  no_hp: string | null
  no_identitas: string | null
  jenis_identitas: string | null
  jenis_kelamin: string | null
  usia: number | null
  alamat: string | null
  items: MerchPdfItem[]
  subtotal: number
  admin_fee: number
  total_harga: number
  event: EventDisplay
}

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

export async function generateMerchPdf(data: MerchPdfData): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const qrBuffer = await QRCode.toBuffer(`ENCORETIX:${data.kode_pengambilan}`, {
    width: 800,
    margin: 2,
    errorCorrectionLevel: 'M',
  })
  const qrImage = await pdfDoc.embedPng(new Uint8Array(qrBuffer))

  let posterImage: PDFImage | null = null
  try {
    const posterBytes = await getPosterJpeg(data.event.gambar, 1190, 380)
    posterImage = await pdfDoc.embedJpg(new Uint8Array(posterBytes))
  } catch {
    posterImage = null
  }

  const page = pdfDoc.addPage([595, 842])
  const W = 595
  const H = 842

  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(1, 1, 1) })

  // Poster event selebar halaman di bagian atas
  const bannerHeight = 190
  if (posterImage) {
    page.drawImage(posterImage, { x: 0, y: H - bannerHeight, width: W, height: bannerHeight })
  }

  const infoTop = H - bannerHeight
  page.drawRectangle({ x: 0, y: infoTop - 70, width: W, height: 70, color: NAVY })
  drawShrinkText(page, fontBold, 'BUKTI PENGAMBILAN — OFFICIAL MERCHANDISE', 24, infoTop - 20, 10, 547, BLUE)
  drawShrinkText(page, fontBold, data.event.nama_event, 24, infoTop - 44, 18, 547, rgb(1, 1, 1))
  drawShrinkText(page, font, `${data.event.tanggal} · ${data.event.jam} · ${data.event.lokasi}`, 24, infoTop - 62, 10, 547, rgb(0.82, 0.85, 0.89))

  const stripY = infoTop - 70 - 14 - 52
  page.drawRectangle({ x: 40, y: stripY, width: 515, height: 52, color: LIGHT })
  drawShrinkText(page, font, 'PESANAN', 60, stripY + 36, 12, 200, GRAY)
  drawShrinkText(page, fontBold, data.items.length === 1
    ? `${data.items[0].nama_merch} × ${data.items[0].jumlah}${data.items[0].ukuran ? ` (${data.items[0].ukuran})` : ''}`
    : `${data.items.length} ITEM MERCHANDISE`, 60, stripY + 18, 16, 360)
  const totalText = formatRupiah(Number(data.total_harga))
  const priceW = fontBold.widthOfTextAtSize(totalText, 15)
  drawShrinkText(page, fontBold, totalText, 515 - priceW, stripY + 24, 15, 200, NAVY)

  const qrSize = 132
  const qrBoxBottom = stripY - 16 - (qrSize + 20)
  page.drawRectangle({ x: 40, y: qrBoxBottom, width: 400, height: qrSize + 20, borderColor: LINE, borderWidth: 1 })
  page.drawImage(qrImage, { x: 52, y: qrBoxBottom + 10, width: qrSize, height: qrSize })
  drawShrinkText(page, font, 'Scan untuk verifikasi', 210, qrBoxBottom + qrSize + 4, 11, 180, GRAY)
  drawShrinkText(page, fontBold, data.kode_pengambilan, 210, qrBoxBottom + qrSize - 20, 15, 180)
  drawShrinkText(page, font, 'Kode grup pesanan merchandise', 210, qrBoxBottom + qrSize - 44, 9, 180, GRAY)

  const rows: [string, string][] = [
    ['Nama Lengkap', data.nama],
    ['No. Identitas', `${data.jenis_identitas || 'KTP'}: ${data.no_identitas || '-'}`],
    ['Jenis Kelamin', data.jenis_kelamin || '-'],
    ['Usia', data.usia != null ? String(data.usia) : '-'],
    ['Email', data.email],
    ['WhatsApp', data.no_hp || '-'],
  ]

  page.drawLine({ start: { x: 40, y: qrBoxBottom - 18 }, end: { x: 555, y: qrBoxBottom - 18 }, thickness: 1.5, color: LINE })

  let rowY = qrBoxBottom - 38
  for (const [k, v] of rows) {
    drawShrinkText(page, font, k, 40, rowY, 12, 250, GRAY)
    drawShrinkText(page, fontBold, v, 320, rowY, 13, 235)
    rowY -= 30
  }

  page.drawLine({ start: { x: 40, y: rowY - 2 }, end: { x: 555, y: rowY - 2 }, thickness: 1.5, color: LINE })

  drawShrinkText(page, fontBold, `Rincian ${data.items.length} item`, 40, rowY - 30, 12, 300, NAVY)
  drawShrinkText(page, font, 'Lihat halaman berikutnya.', 320, rowY - 30, 10, 235, GRAY)
  drawDetailPage(pdfDoc, font, fontBold, data)

  page.drawText(
    'Bukti ini adalah alat pengambilan merchandise di venue. Tunjukkan QR code & data identitas kepada petugas booth.',
    { x: 40, y: 30, size: 10, font, color: GRAY }
  )

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

function drawDetailPage(
  pdfDoc: PDFDocument,
  font: PDFFont,
  fontBold: PDFFont,
  data: MerchPdfData
) {
  const page = pdfDoc.addPage([595, 842])
  const W = 595

  page.drawRectangle({ x: 0, y: 0, width: W, height: 842, color: rgb(1, 1, 1) })
  page.drawRectangle({ x: 0, y: 842 - 80, width: W, height: 80, color: NAVY })
  drawShrinkText(page, fontBold, 'Rincian Pesanan Merchandise', 24, 842 - 34, 16, 400, rgb(1, 1, 1))
  drawShrinkText(page, font, `Kode: ${data.kode_pengambilan}`, 24, 842 - 54, 11, 400, rgb(0.82, 0.85, 0.89))

  let y = 700
  const labelW = 250

  for (const it of data.items) {
    drawShrinkText(page, fontBold, `• ${it.nama_merch}`, 40, y, 12.5, labelW)
    drawShrinkText(page, fontBold, formatRupiah(Number(it.total_harga)), 400, y, 12.5, 155, NAVY)

    const parts: string[] = []
    if (it.ukuran) parts.push(`Ukuran ${it.ukuran}`)
    parts.push(`Jumlah ${it.jumlah}`)
    const spec = parts.join(' · ')
    drawShrinkText(page, font, spec, 40, y - 16, 10, labelW, GRAY)
    const cat = it.kategori ? `${it.kategori} · ` : ''
    drawShrinkText(page, font, `${cat}Rp ${Number(it.harga).toLocaleString('id-ID')}/unit`, 40, y - 30, 10, labelW, GRAY)
    y -= 58
  }

  y -= 12
  page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 1.5, color: LINE })
  y -= 28

  const totals: [string, string][] = [
    ['Subtotal', formatRupiah(Number(data.subtotal))],
    ['Biaya Admin (4%)', formatRupiah(Number(data.admin_fee))],
  ]
  for (const [k, v] of totals) {
    drawShrinkText(page, font, k, 40, y, 12, 250, GRAY)
    drawShrinkText(page, fontBold, v, 400, y, 13, 155, DARK)
    y -= 26
  }

  page.drawLine({ start: { x: 40, y: y - 2 }, end: { x: 555, y: y - 2 }, thickness: 1.5, color: LINE })
  drawShrinkText(page, fontBold, 'Total Bayar', 40, y - 26, 14, 250, NAVY)
  drawShrinkText(page, fontBold, formatRupiah(Number(data.total_harga)), 400, y - 26, 14, 155, NAVY)

  drawShrinkText(page, fontBold, 'Lokasi Pengambilan', 40, y - 62, 11, 250, NAVY)
  const lokasiBooth =
    data.event.lokasi && data.event.lokasi !== '-'
      ? data.event.lokasi
      : 'lihat info venue pada event'
  drawShrinkText(page, font, `Booth Official Merchandise — ${lokasiBooth}`, 40, y - 82, 11, 500, GRAY)
  drawShrinkText(page, font, data.alamat || 'Ambil di booth Official Merchandise', 40, y - 100, 10, 500, GRAY)

  page.drawText(
    'Bukti ini adalah alat pengambilan merchandise di venue. Tunjukkan QR code & data identitas kepada petugas booth.',
    { x: 40, y: 30, size: 10, font, color: GRAY }
  )
}