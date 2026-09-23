import { NextResponse } from 'next/server'
import { sendContactEmail } from '../../lib/contactEmail'

export const dynamic = 'force-dynamic'

// POST /api/contact
// Kirim pesan dari form "Hubungi Kami" ke email admin.
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const nama = String(body.nama || '').trim()
    const email = String(body.email || '').trim()
    const telepon = String(body.telepon || '').trim()
    const pesan = String(body.pesan || '').trim()

    if (!nama || !email || !pesan) {
      return NextResponse.json({ error: 'Nama, email, dan pesan wajib diisi' }, { status: 400 })
    }

    await sendContactEmail({ nama, email, telepon, pesan })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
