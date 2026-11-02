import { NextResponse } from 'next/server'
import { getServerSupabase } from '../../../lib/supabaseClient'
import { getEventById, formatEventDisplay, getActiveEvent } from '../../../lib/events'
import { sendTicketEmailForBooking } from '../../../lib/ticketSender'
import { checkRateLimit, getClientIp, rateLimitResponse } from '../../../lib/rateLimit'

export const dynamic = 'force-dynamic'

// Kode bisa berupa booking (ETX-XXXXXX) atau per-tiket (ETX-XXXXXX-2).
function parseTicketCode(raw: string): { bookingCode: string; ticketIndex: number | null } {
  const match = /^(.*)-(\d+)$/.exec(raw)
  if (match && match[1]) {
    return { bookingCode: match[1].toUpperCase(), ticketIndex: Number(match[2]) }
  }
  return { bookingCode: raw.toUpperCase(), ticketIndex: null }
}

// Ambil data pemilik tiket sesuai urutan (tiket #1, #2, dst).
async function getPemilikTiket(
  supabase: ReturnType<typeof getServerSupabase>,
  pemilikIds: string[] | null | undefined
) {
  if (!pemilikIds || pemilikIds.length === 0) return []
  const { data: customers } = await supabase
    .from('customers')
    .select('id, nama, email, no_hp, usia, no_identitas, jenis_identitas, jenis_kelamin')
    .in('id', pemilikIds)
  if (!customers) return []
  const byId = new Map(customers.map((c) => [c.id, c]))
  return pemilikIds.map((id) => {
    const c = byId.get(id)
    return {
      nama: c?.nama ?? null,
      email: c?.email ?? null,
      no_hp: c?.no_hp ?? null,
      usia: c?.usia ?? null,
      no_identitas: c?.no_identitas ?? null,
      jenis_identitas: c?.jenis_identitas ?? null,
      jenis_kelamin: c?.jenis_kelamin ?? null,
    }
  })
}

// GET /api/transactions/:bookingCode
// Melihat detail pesanan tiket berdasarkan kode booking.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ bookingCode: string }> }
) {
  // Rate limit: maks 30 lookup per menit per IP
  const rl = checkRateLimit(`lookup:${getClientIp(request)}`, { max: 30, windowMs: 60_000 })
  if (!rl.allowed) return rateLimitResponse(rl.resetAt)

  try {
    const { bookingCode } = await params
    const { bookingCode: baseCode, ticketIndex } = parseTicketCode(decodeURIComponent(bookingCode))
    const supabase = getServerSupabase()

    const { data: pesanan, error } = await supabase
      .from('pesanan_tiket')
      .select('*, customers(nama, email, no_hp, usia, no_identitas, jenis_identitas, jenis_kelamin), tiket(kategori, harga, sisa_kuota, id_event), voucher(kode_voucher, nominal_diskon), pembayaran(*)')
      .eq('booking_id', baseCode)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!pesanan) {
      return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 })
    }
    if (ticketIndex != null && (ticketIndex < 1 || ticketIndex > pesanan.jumlah)) {
      return NextResponse.json({ error: 'Tiket tidak ditemukan' }, { status: 404 })
    }

    const pemilikTiket = await getPemilikTiket(supabase, pesanan.pemilik_ids)
    const event = formatEventDisplay(await getEventById(supabase, pesanan.tiket?.id_event))
    return NextResponse.json({ data: { ...pesanan, pemilik_tiket: pemilikTiket, event } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PATCH /api/transactions/:bookingCode
// Update status check-in (dipakai admin saat check-in).
// Body:
//   { status_check_in: 'sudah_check_in', ticketIndex?: number } → check-in 1 tiket
//   { status_check_in: 'sudah_check_in', all: true }            → check-in semua tiket
//   { status_check_in: 'belum_check_in' }                       → reset semua
// Nomor tiket juga bisa dikirim lewat suffix kode (mis. ETX-XXXX-2).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ bookingCode: string }> }
) {
  // Rate limit: maks 20 check-in attempt per menit per IP
  const rl = checkRateLimit(`checkin:${getClientIp(request)}`, { max: 20, windowMs: 60_000 })
  if (!rl.allowed) return rateLimitResponse(rl.resetAt)

  try {
    const { bookingCode } = await params
    const { bookingCode: baseCode, ticketIndex } = parseTicketCode(decodeURIComponent(bookingCode))
    const body = await request.json()

    const supabase = getServerSupabase()
    const { data: existing, error: findError } = await supabase
      .from('pesanan_tiket')
      .select('id, status_bayar, status_check_in, jumlah, tiket_check_in, tiket(id_event)')
      .eq('booking_id', baseCode)
      .maybeSingle()
    if (findError) throw new Error(findError.message)
    if (!existing) {
      return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 })
    }

    // Reset check-in seluruh tiket.
    if (body.status_check_in !== 'sudah_check_in') {
      const { data, error } = await supabase
        .from('pesanan_tiket')
        .update({ status_check_in: body.status_check_in, tiket_check_in: [] })
        .eq('booking_id', baseCode)
        .select()
        .single()
      if (error) throw new Error(error.message)
      return NextResponse.json({ data })
    }

    if (existing.status_bayar !== 'berhasil') {
      return NextResponse.json({ error: 'Belum lunas' }, { status: 400 })
    }

    // Validasi per-event: hanya tiket milik event yang sedang berjalan
    // yang boleh check-in (mencegah tiket event lain dipakai di gate ini).
    const activeEvent = await getActiveEvent(supabase)
    const orderEventId = (existing.tiket as { id_event?: string | null } | null)?.id_event ?? null
    if (activeEvent && orderEventId && String(orderEventId) !== String(activeEvent.id)) {
      return NextResponse.json(
        { error: `Tiket ini bukan untuk${activeEvent.nama_event ? ` "${activeEvent.nama_event}"` : ' event yang sedang berjalan'}. Check-in ditolak.`, code: 'WRONG_EVENT' },
        { status: 403 }
      )
    }

    const jumlah = Number(existing.jumlah) || 0
    const already: number[] = Array.isArray(existing.tiket_check_in) ? existing.tiket_check_in : []

    let targets: number[]
    if (body.all === true) {
      targets = Array.from({ length: jumlah }, (_, i) => i + 1)
    } else {
      const idx = body.ticketIndex != null ? Number(body.ticketIndex) : ticketIndex
      if (idx != null) {
        if (idx < 1 || idx > jumlah) {
          return NextResponse.json({ error: 'Tiket tidak ditemukan' }, { status: 404 })
        }
        targets = [idx]
      } else {
        // Tanpa nomor tiket → anggap check-in semua (kompatibel dengan perilaku lama).
        targets = Array.from({ length: jumlah }, (_, i) => i + 1)
      }
    }

    const alreadySet = new Set(already.filter((n) => n >= 1 && n <= jumlah))
    const newTargets = targets.filter((n) => !alreadySet.has(n))

    // Validasi 1x check-in: tolak jika semua tiket yang diminta sudah check-in.
    if (newTargets.length === 0) {
      const detail =
        targets.length === 1
          ? `Tiket #${targets[0]} sudah check-in`
          : 'Semua tiket sudah check-in'
      return NextResponse.json(
        { error: detail, code: 'ALREADY_CHECKED_IN', tiket_check_in: already },
        { status: 409 }
      )
    }

    const merged = Array.from(new Set([...already, ...newTargets]))
      .filter((n) => n >= 1 && n <= jumlah)
      .sort((a, b) => a - b)
    const newStatus = jumlah > 0 && merged.length >= jumlah ? 'sudah_check_in' : 'belum_check_in'

    const { data, error } = await supabase
      .from('pesanan_tiket')
      .update({ status_check_in: newStatus, tiket_check_in: merged })
      .eq('booking_id', baseCode)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return NextResponse.json({ data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/transactions/:bookingCode
// Kirim ulang e-tiket ke email pembeli (dipakai superadmin).
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ bookingCode: string }> }
) {
  try {
    const { bookingCode } = await params
    const { bookingCode: baseCode } = parseTicketCode(decodeURIComponent(bookingCode))
    const supabase = getServerSupabase()

    const { data: pesanan, error } = await supabase
      .from('pesanan_tiket')
      .select('status_bayar, customers(email)')
      .eq('booking_id', baseCode)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!pesanan) {
      return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 })
    }
    if (pesanan.status_bayar !== 'berhasil') {
      return NextResponse.json({ error: 'Tiket belum lunas, tidak bisa dikirim ulang' }, { status: 400 })
    }

    const ok = await sendTicketEmailForBooking(baseCode)
    if (!ok) {
      return NextResponse.json(
        { error: 'Gagal mengirim email. Periksa pengaturan SMTP dan alamat email pembeli.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}