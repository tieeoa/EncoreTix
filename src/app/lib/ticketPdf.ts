import QRCode from 'qrcode'
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from 'pdf-lib'
import { getPosterJpeg } from './posterImage'

export interface TicketPdfData {
  booking_id: string
  jumlah: number
  kategori: string
  harga: number
  nama: string
  email: string
  no_hp: string | null
  no_identitas: string | null
  jenis_identitas: string | null
  jenis_kelamin: string | null
  usia: number | null
  event: {
    nama_event: string
    tanggal: string
    jam: string
    lokasi: string
    gambar?: string | null
  }
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

export async function generateTicketPdf(data: TicketPdfData): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const qrBuffer = await QRCode.toBuffer(`ENCORETIX:${data.booking_id}`, {
    width: 800,
    margin: 2,
    errorCorrectionLevel: 'M',
  })
  const qrImage = await pdfDoc.embedPng(new Uint8Array(qrBuffer))

  let posterImage: PDFImage | null = null
  try {
    const posterBytes = await getPosterJpeg(data.event.gambar, 1190, 420)
    posterImage = await pdfDoc.embedJpg(new Uint8Array(posterBytes))
  } catch {
    posterImage = null
  }

  const page = pdfDoc.addPage([595, 842])
  const W = 595
  const H = 842

  // Background
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(1, 1, 1) })

  // Poster event selebar halaman di bagian atas
  const bannerHeight = 210
  if (posterImage) {
    page.drawImage(posterImage, { x: 0, y: H - bannerHeight, width: W, height: bannerHeight })
  }

  const infoTop = H - bannerHeight
  page.drawRectangle({ x: 0, y: infoTop - 110, width: W, height: 110, color: NAVY })
  page.drawText('E-TICKET', { x: 24, y: infoTop - 24, size: 11, font: fontBold, color: BLUE })
  drawShrinkText(page, fontBold, data.event.nama_event, 24, infoTop - 54, 20, 547, rgb(1, 1, 1))
  drawShrinkText(page, font, `${data.event.tanggal} · ${data.event.jam}`, 24, infoTop - 80, 11, 547, rgb(0.82, 0.85, 0.89))
  drawShrinkText(page, font, data.event.lokasi, 24, infoTop - 100, 10, 547, rgb(0.61, 0.63, 0.68))

  // Category strip
  const stripY = infoTop - 110 - 12 - 52 // top of strip
  page.drawRectangle({ x: 40, y: stripY, width: 515, height: 52, color: LIGHT })
  drawShrinkText(page, font, 'TIKET', 60, stripY + 36, 12, 200, GRAY)
  drawShrinkText(page, fontBold, `${data.kategori} × ${data.jumlah}`, 60, stripY + 18, 16, 400)
  const priceText = formatRupiah(Number(data.harga) * (data.jumlah || 1))
  const priceW = fontBold.widthOfTextAtSize(priceText, 15)
  page.drawText(priceText, { x: 515 - priceW, y: stripY + 24, size: 15, font: fontBold, color: NAVY })

  // QR box
  const qrSize = 132
  const qrBoxBottom = stripY - 16 - (qrSize + 20)
  page.drawRectangle({ x: 40, y: qrBoxBottom, width: 400, height: qrSize + 20, borderColor: LINE, borderWidth: 1 })
  page.drawImage(qrImage, { x: 52, y: qrBoxBottom + 10, width: qrSize, height: qrSize })
  drawShrinkText(page, font, 'Scan untuk verifikasi', 210, qrBoxBottom + qrSize + 4, 11, 180, GRAY)
  drawShrinkText(page, fontBold, data.booking_id, 210, qrBoxBottom + qrSize - 20, 14, 180)
  drawShrinkText(page, font, data.event.nama_event, 210, qrBoxBottom + qrSize - 44, 9, 180, GRAY)

  // Holder rows
  const rows = [
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

  drawPageLine(page, { x: 40, y: rowY - 2 }, { x: 555, y: rowY - 2 }, LINE)
  page.drawText(
    'Tiket ini hanya berlaku untuk 1 orang dan 1 kali masuk sesuai tanggal yang tertera.',
    { x: 40, y: 30, size: 10, font, color: GRAY }
  )

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

function drawPageLine(
  page: PDFPage,
  start: { x: number; y: number },
  end: { x: number; y: number },
  color: ReturnType<typeof rgb>,
  thickness = 1.5
) {
  page.drawLine({ start, end, thickness, color })
}