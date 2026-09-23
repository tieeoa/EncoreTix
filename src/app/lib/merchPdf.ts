import QRCode from 'qrcode'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from 'pdf-lib'
import type { EventDisplay } from './events'

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
    const posterBytes = await readFile(path.join(process.cwd(), 'public', 'coravfest.jpg'))
    posterImage = await pdfDoc.embedJpg(new Uint8Array(posterBytes))
  } catch {
    posterImage = null
  }

  const page = pdfDoc.addPage([595, 842])
  const W = 595
  const H = 842

  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(1, 1, 1) })

  const headerTop = H
  page.drawRectangle({ x: 0, y: headerTop - 170, width: W, height: 170, color: NAVY })

  page.drawText('OFFICIAL MERCHANDISE', { x: 24, y: headerTop - 40, size: 13, font: fontBold, color: BLUE })
  page.drawText(data.event.nama_event, { x: 24, y: headerTop - 76, size: 24, font: fontBold, color: rgb(1, 1, 1) })
  drawShrinkText(page, font, `${data.event.tanggal} · ${data.event.jam}`, 24, headerTop - 104, 12, 350, rgb(0.82, 0.85, 0.89))
  drawShrinkText(page, font, data.event.lokasi, 24, headerTop - 126, 11, 350, rgb(0.61, 0.63, 0.68))
  page.drawText('BUKTI PENGAMBILAN MERCHANDISE', { x: 24, y: headerTop - 152, size: 14, font: fontBold, color: rgb(0.95, 0.97, 1) })

  if (posterImage) {
    const posterScale = Math.min(170 / posterImage.width, 170 / posterImage.height)
    const pw = posterImage.width * posterScale
    const ph = posterImage.height * posterScale
    page.drawImage(posterImage, {
      x: W - pw,
      y: headerTop - ph,
      width: pw,
      height: ph,
    })
  }

  const stripY = headerTop - 170 - 14 - 52
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

  // Jika cuma 1 item, tampilkan ringkas di halaman pertama.
  if (data.items.length === 1) {
    const it = data.items[0]
    const detailRows: [string, string][] = [
      ['Produk', it.nama_merch],
      ['Kategori', it.kategori || '-'],
      ['Ukuran', it.ukuran || '-'],
      ['Jumlah', String(it.jumlah)],
      ['Alamat', data.alamat || 'Ambil di booth Official Merchandise'],
    ]
    let kY = rowY - 34
    for (const [k, v] of detailRows) {
      drawShrinkText(page, font, k, 40, kY, 11, 200, GRAY)
      drawShrinkText(page, fontBold, v, 260, kY, 12, 295)
      kY -= 22
    }
  } else {
    drawShrinkText(page, fontBold, `Rincian ${data.items.length} item`, 40, rowY - 34, 12, 300, NAVY)
    drawShrinkText(page, font, 'Lihat halaman berikutnya.', 320, rowY - 34, 10, 235, GRAY)
    drawDetailPage(pdfDoc, font, fontBold, data)
  }

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