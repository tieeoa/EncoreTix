import nodemailer, { type Transporter } from 'nodemailer'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { MerchPdfData } from './merchPdf'

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

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
const LOGO_CID = 'encoretix-logo'

// Kirim email berisi kode pengambilan merchandise ke pembeli.
// Secara default TANPA lampiran PDF — customer melihat E-Merch di web.
export async function sendMerchEmail(
  to: string,
  attachments: { filename: string; content: Buffer; contentType: string }[],
  data: MerchPdfData,
  meta: {
    statusBayar?: string | null
    tanggalPesan?: string | null
    withPdf?: boolean
  } = {}
) {
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER || ''
  const transporter = getTransporter()

  const nama = esc(data.nama)
  const itemCount = data.items.length
  const pickupCode = esc(data.kode_pengambilan)
  const lihatBuktiUrl = `${BASE_URL}/merch-saya/${encodeURIComponent(data.kode_pengambilan)}`

  const itemRowsHtml = data.items
    .map((it) => {
      const label = `${esc(it.nama_merch)}${it.ukuran ? ` (${esc(it.ukuran)})` : ''}`
      const detail = `${it.jumlah} × ${formatRupiah(it.harga)}`
      return `
        <tr style="border-top:1px solid #e5e7eb;">
          <td style="padding:12px 16px;color:#0b1d3a;font-size:13px;font-weight:600;">${label}</td>
          <td style="padding:12px 16px;color:#6b7280;font-size:12px;text-align:right;">${detail}</td>
          <td style="padding:12px 16px;font-size:13px;font-weight:700;color:#0b1d3a;text-align:right;">${formatRupiah(it.total_harga)}</td>
        </tr>`
    })
    .join('')

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
        <h1 style="margin:10px 0 0;font-size:22px;font-weight:800;color:#0b1d3a;">Pemesanan Merchandise Berhasil</h1>
      </div>

      <div style="padding:6px 24px 0;">
        <p style="margin:14px 0;font-size:14px;line-height:1.6;color:#374151;">Halo <strong style="color:#0b1d3a;">${nama}</strong>,</p>
        <p style="margin:14px 0;font-size:14px;line-height:1.6;color:#374151;">Terima kasih telah memesan merchandise untuk <strong style="color:#0b1d3a;">${esc(data.event.nama_event)}</strong>. Transaksi kamu berhasil dan bukti pengambilan sudah siap.</p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:12px;margin:20px 0;overflow:hidden;">
          <tr>
            <td style="padding:12px 16px;background:#f9fafb;color:#6b7280;font-size:12px;">Status Pesanan</td>
            <td style="padding:12px 16px;font-size:13px;font-weight:700;color:#16a34a;text-align:right;">${meta.statusBayar === 'berhasil' ? 'Lunas' : esc(meta.statusBayar || '-')}</td>
          </tr>
          <tr style="border-top:1px solid #e5e7eb;">
            <td style="padding:12px 16px;background:#f9fafb;color:#6b7280;font-size:12px;">Tgl Pesanan</td>
            <td style="padding:12px 16px;font-size:13px;font-weight:700;color:#0b1d3a;text-align:right;">${formatTanggal(meta.tanggalPesan)}</td>
          </tr>
          <tr style="border-top:1px solid #e5e7eb;">
            <td style="padding:12px 16px;background:#f9fafb;color:#6b7280;font-size:12px;">Total Bayar</td>
            <td style="padding:12px 16px;font-size:13px;font-weight:700;color:#0b1d3a;text-align:right;">${formatRupiah(data.total_harga)}</td>
          </tr>
        </table>

        <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#374151;">Simpan <strong style="color:#0b1d3a;">KODE PENGAMBILAN</strong> berikut dan tunjukkan bersama QR code saat mengambil merchandise di booth:</p>
        <div style="margin:12px 0;text-align:center;">
          <span style="display:inline-block;background:#0b1d3a;color:#ffffff;font-size:15px;font-weight:800;letter-spacing:1px;padding:12px 24px;border-radius:10px;font-family:Consolas,Menlo,monospace;">${pickupCode}</span>
        </div>
        <p style="margin:12px 0;font-size:12px;color:#d97706;line-height:1.5;text-align:center;">Perhatian! Kode pengambilan ini bersifat rahasia. Jangan bagikan kepada siapapun.</p>

        <div style="text-align:center;margin:22px 0;">
          <a href="${lihatBuktiUrl}" style="display:inline-block;background:#4f46e5 !important;background-color:#4f46e5;color:#ffffff !important;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:12px;">Lihat Bukti Pengambilan</a>
        </div>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:12px;margin:20px 0;overflow:hidden;">
          <tr>
            <td colspan="2" style="padding:16px 16px 10px;">
              <div style="font-size:15px;font-weight:800;color:#0b1d3a;">${esc(data.event.nama_event)}</div>
            </td>
          </tr>
          <tr style="border-top:1px solid #e5e7eb;">
            <td style="padding:12px 16px;color:#6b7280;font-size:13px;">Tanggal Event</td>
            <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#0b1d3a;text-align:right;">${esc(data.event.tanggal)}</td>
          </tr>
          <tr style="border-top:1px solid #e5e7eb;">
            <td style="padding:12px 16px;color:#6b7280;font-size:13px;">Waktu Event</td>
            <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#0b1d3a;text-align:right;">${esc(data.event.jam)}</td>
          </tr>
          <tr style="border-top:1px solid #e5e7eb;">
            <td style="padding:12px 16px;color:#6b7280;font-size:13px;">Lokasi</td>
            <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#0b1d3a;text-align:right;">${esc(data.event.lokasi)}</td>
          </tr>
        </table>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:12px;margin:20px 0;overflow:hidden;">
          <tr>
            <td colspan="3" style="padding:16px 16px 10px;">
              <div style="font-size:14px;font-weight:800;color:#0b1d3a;">Rincian Pesanan${itemCount > 0 ? ` (${itemCount} item)` : ''}</div>
            </td>
          </tr>
          ${itemRowsHtml}
          <tr style="border-top:1px solid #e5e7eb;background:#f9fafb;">
            <td style="padding:12px 16px;color:#6b7280;font-size:13px;">Subtotal</td>
            <td colspan="2" style="padding:12px 16px;font-size:13px;font-weight:600;color:#0b1d3a;text-align:right;">${formatRupiah(Number(data.subtotal))}</td>
          </tr>
          <tr style="border-top:1px solid #e5e7eb;">
            <td style="padding:12px 16px;color:#6b7280;font-size:13px;">Biaya Admin (4%)</td>
            <td colspan="2" style="padding:12px 16px;font-size:13px;font-weight:600;color:#0b1d3a;text-align:right;">${formatRupiah(Number(data.admin_fee))}</td>
          </tr>
          <tr style="border-top:1px solid #e5e7eb;background:#f9fafb;">
            <td style="padding:14px 16px;color:#0b1d3a;font-size:14px;font-weight:700;">Total Bayar</td>
            <td colspan="2" style="padding:14px 16px;font-size:14px;font-weight:800;color:#4f46e5;text-align:right;">${formatRupiah(data.total_harga)}</td>
          </tr>
          <tr style="border-top:1px solid #e5e7eb;">
            <td style="padding:12px 16px;color:#6b7280;font-size:13px;">Alamat</td>
            <td colspan="2" style="padding:12px 16px;font-size:13px;font-weight:600;color:#0b1d3a;text-align:right;">${esc(data.alamat || 'Booth Official Merchandise')}</td>
          </tr>
        </table>

        <p style="margin:16px 0 0;font-size:12px;color:#6b7280;line-height:1.5;">${meta.withPdf === true ? 'Bukti pengambilan (PDF) terlampir pada email ini. Tunjukkan QR code saat mengambil merchandise di booth. Bukti juga bisa diakses kapan saja lewat menu <strong>Merch Saya</strong>.' : 'Tunjukkan <strong>KODE PENGAMBILAN</strong> di atas kepada petugas booth saat mengambil merchandise. Bukti juga bisa diakses kapan saja lewat menu <strong>Merch Saya</strong>.'}</p>
      </div>
    </div>
  `

  await transporter.sendMail({
    from,
    to,
    subject: `Bukti Pengambilan Merchandise - ${pickupCode}`,
    html,
    attachments: mailAttachments,
  })
}