import nodemailer, { type Transporter } from 'nodemailer'

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
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export interface ContactMessage {
  nama: string
  email: string
  telepon: string
  pesan: string
}

// Kirim pesan dari form "Hubungi Kami" ke email tujuan (CONTACT_EMAIL / SMTP_USER).
export async function sendContactEmail(data: ContactMessage) {
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER || ''
  const to = process.env.CONTACT_EMAIL || process.env.SMTP_USER || ''
  if (!to) {
    throw new Error('Email tujuan kontak belum dikonfigurasi. Isi CONTACT_EMAIL atau SMTP_USER di .env.local.')
  }

  const transporter = getTransporter()

  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:11px 16px;background:#f8fafc;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;width:170px;vertical-align:top;">${label}</td>
      <td style="padding:11px 16px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:13px;white-space:pre-wrap;">${esc(value) || '-'}</td>
    </tr>`

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f1f5f9;padding:24px;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
      <div style="background:#0b1d3a;padding:24px 28px;">
        <p style="margin:0;color:#93c5fd;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">EncoreTix</p>
        <h1 style="margin:6px 0 0;color:#ffffff;font-size:20px;">Pesan Baru dari Form Hubungi Kami</h1>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        ${row('Nama Lengkap', data.nama)}
        ${row('Email', data.email)}
        ${row('WhatsApp / Telepon', data.telepon ? `+62 ${data.telepon}` : '')}
        ${row('Pesan', data.pesan)}
      </table>
      <div style="padding:16px 28px;background:#f8fafc;">
        <p style="margin:0;color:#94a3b8;font-size:11px;">Dikirim otomatis dari halaman kontak encoretix.id</p>
      </div>
    </div>
  </div>`

  await transporter.sendMail({
    from,
    to,
    replyTo: data.email,
    subject: `[Kontak] Pesan baru dari ${data.nama}`,
    html,
  })
}
