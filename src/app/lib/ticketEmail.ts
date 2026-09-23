import nodemailer, { type Transporter } from 'nodemailer'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { TicketPdfData } from './ticketPdf'

let cachedTransporter: Transporter | null = null

function getTransporter(): Transporter {
  if (cachedTransporter) return cachedTransporter

  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const host = process.env.SMTP_HOST || 'smtp.gmail.com'
  const port = Number(process.env.SMTP_PORT) || 587

  if (!user || !pass) {
    throw new Error('SMTP belum dikonfigurasi. Isi SMTP_USER dan SMTP_PASS di .env.local.')
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })
  return cachedTransporter
}

function esc(value: unknown): string {
  return String(value ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function formatRupiah(n: number | null | undefined) {
  const num = Number(n ?? 0)
  return 'Rp ' + num.toLocaleString('id-ID')
}

function formatTanggal(value: string | null | undefined) {
  if (!value) return '-'
  const d = new Date(value)
  return d.toLocaleString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusBayarLabel(value: string | null | undefined) {
  if (value === 'berhasil') return 'Lunas'
  if (value === 'pending') return 'Menunggu Pembayaran'
  if (value === 'gagal') return 'Gagal'
  return esc(value || '-')
}

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
const LOGO_CID = 'encoretix-logo'

// Kirim email berisi e-tiket (PDF) ke pembeli. Bisa berisi lebih dari satu PDF (per tiket).
export async function sendTicketEmail(
  to: string,
  attachments: { filename: string; content: Buffer; contentType: string }[],
  data: TicketPdfData,
  holderNames: string[] = [],
  meta: {
    statusBayar?: string | null
    metodePembayaran?: string | null
    tanggalPesan?: string | null
    totalBayar?: number | null
    withPdf?: boolean
  } = {}
) {
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER || ''
  const transporter = getTransporter()

  const holderList =
    holderNames.length > 0
      ? `<ul style="margin:6px 0 0;padding-left:20px;font-size:13px;color:#374151;">${holderNames
          .map((n) => `<li>${esc(n)}</li>`)
          .join('')}</ul>`
      : ''

  const nama = esc(data.nama)
  const eventName = esc(data.event.nama_event)
  const bookingId = esc(data.booking_id)
  const kategori = esc(data.kategori)
  const jumlah = data.jumlah || 1
  const totalBayar = meta.totalBayar ?? Number(data.harga) * jumlah
  const subTotal = Number(data.harga) * jumlah
  const lihatTiketUrl = `${BASE_URL}/tiket-saya/${encodeURIComponent(data.booking_id)}`

  const mailAttachments: {
    filename?: string
    content: Buffer
    contentType: string
    cid?: string
    contentDisposition?: string
  }[] = [...attachments]

  let logoHTML = ''
  try {
    const logoBuffer = await readFile(path.join(process.cwd(), 'public', 'logo.png'))
    mailAttachments.push({ filename: 'logo.png', content: logoBuffer, contentType: 'image/png', cid: LOGO_CID, contentDisposition: 'inline' })
    logoHTML = `<img src="cid:${LOGO_CID}" alt="EncoreTix" width="170" style="max-width:170px;height:auto;display:inline-block;" />`
  } catch {
    logoHTML = `<div style="font-size:20px;font-weight:800;color:#4f46e5;letter-spacing:1px;">ENCORETIX</div>`
  }

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;color:#1f2937;padding-bottom:28px;">
      <div style="text-align:center;padding:28px 24px 6px;">
        ${logoHTML}
      </div>

      <div style="text-align:center;padding:0 24px;">
        <h1 style="margin:10px 0 0;font-size:22px;font-weight:800;color:#0b1d3a;">Pemesanan Tiket Berhasil</h1>
      </div>

      <div style="padding:6px 24px 0;">
        <p style="margin:14px 0;font-size:14px;line-height:1.6;color:#374151;">Halo <strong style="color:#0b1d3a;">${nama}</strong>,</p>
        <p style="margin:14px 0;font-size:14px;line-height:1.6;color:#374151;">Terima kasih telah memesan tiket <strong style="color:#0b1d3a;">${eventName}</strong>. Transaksi kamu berhasil, dan tiketmu sudah siap untuk digunakan.</p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:12px;margin:20px 0;overflow:hidden;">
          <tr>
            <td style="padding:12px 16px;background:#f9fafb;color:#6b7280;font-size:12px;">Status Pesanan</td>
            <td style="padding:12px 16px;font-size:13px;font-weight:700;color:#16a34a;text-align:right;">${statusBayarLabel(meta.statusBayar)}</td>
          </tr>
          <tr style="border-top:1px solid #e5e7eb;">
            <td style="padding:12px 16px;background:#f9fafb;color:#6b7280;font-size:12px;">Metode Pembayaran</td>
            <td style="padding:12px 16px;font-size:13px;font-weight:700;color:#0b1d3a;text-align:right;">${esc(meta.metodePembayaran || '-')}</td>
          </tr>
          <tr style="border-top:1px solid #e5e7eb;">
            <td style="padding:12px 16px;background:#f9fafb;color:#6b7280;font-size:12px;">Tgl Pesanan</td>
            <td style="padding:12px 16px;font-size:13px;font-weight:700;color:#0b1d3a;text-align:right;">${formatTanggal(meta.tanggalPesan)}</td>
          </tr>
        </table>

        <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#374151;">Salin dan gunakan <strong style="color:#0b1d3a;">BOOKING ID</strong> ini untuk masuk dan check tiket yang berhasil kamu pesan:</p>
        <div style="margin:12px 0;text-align:center;">
          <span style="display:inline-block;background:#0b1d3a;color:#ffffff;font-size:15px;font-weight:800;letter-spacing:1px;padding:12px 24px;border-radius:10px;font-family:Consolas,Menlo,monospace;">${bookingId}</span>
        </div>
        <p style="margin:12px 0;font-size:12px;color:#d97706;line-height:1.5;text-align:center;">Perhatian! Booking ID ini bersifat rahasia. Jangan bagikan kepada siapapun.</p>

        <div style="text-align:center;margin:22px 0;">
          <a href="${lihatTiketUrl}" style="display:inline-block;background:#4f46e5 !important;background-color:#4f46e5;color:#ffffff !important;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:12px;">Lihat Tiket</a>
        </div>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:12px;margin:20px 0;overflow:hidden;">
          <tr>
            <td colspan="2" style="padding:16px 16px 10px;">
              <div style="font-size:15px;font-weight:800;color:#0b1d3a;">${eventName}</div>
            </td>
          </tr>
          <tr style="border-top:1px solid #e5e7eb;">
            <td style="padding:12px 16px;color:#6b7280;font-size:13px;">Lokasi</td>
            <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#0b1d3a;text-align:right;">${esc(data.event.lokasi)}</td>
          </tr>
          <tr style="border-top:1px solid #e5e7eb;">
            <td style="padding:12px 16px;color:#6b7280;font-size:13px;">Waktu Event</td>
            <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#0b1d3a;text-align:right;">${esc(data.event.jam)}</td>
          </tr>
          <tr style="border-top:1px solid #e5e7eb;">
            <td style="padding:12px 16px;color:#6b7280;font-size:13px;">Tanggal Event</td>
            <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#0b1d3a;text-align:right;">${esc(data.event.tanggal)}</td>
          </tr>
        </table>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:12px;margin:20px 0;overflow:hidden;">
          <tr>
            <td colspan="2" style="padding:16px 16px 10px;">
              <div style="font-size:14px;font-weight:800;color:#0b1d3a;">Rincian Pesanan</div>
            </td>
          </tr>
          <tr style="border-top:1px solid #e5e7eb;">
            <td style="padding:12px 16px;color:#6b7280;font-size:13px;">Tiket</td>
            <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#0b1d3a;text-align:right;">${kategori} × ${jumlah}</td>
          </tr>
          <tr style="border-top:1px solid #e5e7eb;">
            <td style="padding:12px 16px;color:#6b7280;font-size:13px;">Subtotal</td>
            <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#0b1d3a;text-align:right;">${formatRupiah(subTotal)}</td>
          </tr>
          <tr style="border-top:1px solid #e5e7eb;background:#f9fafb;">
            <td style="padding:14px 16px;color:#0b1d3a;font-size:14px;font-weight:700;">Total Bayar</td>
            <td style="padding:14px 16px;font-size:14px;font-weight:800;color:#4f46e5;text-align:right;">${formatRupiah(totalBayar)}</td>
          </tr>
        </table>

        <p style="margin:16px 0 0;"><strong style="color:#0b1d3a;">Pemegang Tiket:</strong>${holderList}</p>
        ${meta.withPdf === false
          ? `<p style="margin:14px 0;font-size:12px;color:#6b7280;line-height:1.5;">Tunjukkan BOOKING ID di atas kepada panitia saat masuk venue. E-tiket juga bisa diakses kapan saja lewat menu <strong>Tiket Saya</strong>.</p>`
          : `<p style="margin:14px 0;font-size:12px;color:#6b7280;line-height:1.5;">E-tiket (PDF) terlampir pada email ini. Tunjukkan QR code saat masuk venue. E-tiket juga bisa diakses kapan saja lewat menu <strong>Tiket Saya</strong>.</p>`}
      </div>
    </div>
  `

  await transporter.sendMail({
    from,
    to,
    subject:
      meta.withPdf === false
        ? `Kode Booking ${data.event.nama_event} - ${data.booking_id}`
        : `E-Tiket ${data.event.nama_event} - ${data.booking_id}`,
    html,
    attachments: mailAttachments,
  })
}