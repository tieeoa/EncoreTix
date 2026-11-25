import type { SupabaseClient } from '@supabase/supabase-js'

export interface EventInfo {
  id: string
  nama_event: string
  slug: string | null
  tanggal: string | null
  waktu: string | null
  venue: string | null
  alamat: string | null
  deskripsi: string | null
  syarat_ketentuan: string | null
  status: string
  gambar: string | null
  updated_at: string
}

export const todayISO = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

// Event dianggap "selesai" bila statusnya 'closed' ATAU tanggalnya sudah lewat.
// Hari-H masih dianggap berlangsung; penjualan ditutup terpisah.
export function isEventFinished(e: { status?: string | null; tanggal?: string | null }): boolean {
  if (e.status === 'closed') return true
  return !!e.tanggal && todayISO() > e.tanggal
}

// Otomatis tutup event yang tanggalnya sudah lewat (status -> 'closed').
// Idempotent: hanya menulis bila ada yang perlu ditutup, dan tidak melempar
// error (return [] bila gagal) supaya tidak menggagalkan request baca.
// Mengembalikan daftar event yang baru saja ditutup.
export async function autoClosePastEvents(
  supabase: SupabaseClient,
  events: EventInfo[]
): Promise<EventInfo[]> {
  const due = events.filter(
    (e) => e.status !== 'closed' && !!e.tanggal && todayISO() > e.tanggal
  )
  if (due.length === 0) return []
  const { error } = await supabase
    .from('event_info')
    .update({ status: 'closed', updated_at: new Date().toISOString() })
    .in(
      'id',
      due.map((e) => e.id)
    )
  if (error) return []
  return due
}

// Ambil semua event, diurutkan berdasarkan tanggal (event terdekat duluan).
export async function getAllEvents(supabase: SupabaseClient): Promise<EventInfo[]> {
  const { data, error } = await supabase
    .from('event_info')
    .select('*')
    .order('tanggal', { ascending: true, nullsFirst: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as EventInfo[]
}

export async function getEventById(supabase: SupabaseClient, id: string): Promise<EventInfo | null> {
  const { data, error } = await supabase
    .from('event_info')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) return null
  return (data as EventInfo) ?? null
}

// Event yang sedang berjalan/aktif di web.
// Event yang ditutup manual oleh superadmin tetap tampil sampai tanggalnya lewat
// (penjualannya sudah ditutup lewat isTicketSalesClosed), agar pembeli tidak
// mengira tidak ada event. Setelah tanggal lewat, baru tidak ada event aktif.
export async function getActiveEvent(supabase: SupabaseClient): Promise<EventInfo | null> {
  const all = await getAllEvents(supabase)
  const justClosed = new Set((await autoClosePastEvents(supabase, all)).map((e) => e.id))
  const candidates = all.filter(
    (e) =>
      (e.status === 'active' || e.status === 'closed') &&
      !justClosed.has(e.id) &&
      (!e.tanggal || e.tanggal >= todayISO())
  )
  return candidates.find((e) => e.status === 'active') ?? candidates[0] ?? null
}

// Pastikan hanya event `keepId` yang berstatus 'active'; sisanya di-'paused'.
export async function deactivateOtherEvents(supabase: SupabaseClient, keepId: string) {
  const { error } = await supabase
    .from('event_info')
    .update({ status: 'paused' })
    .neq('id', keepId)
    .eq('status', 'active')
  if (error) throw new Error(error.message)
}

// Resolve event id: pakai parameter ?event= kalau ada & valid, kalau tidak pakai event aktif.
export async function resolveEventId(
  supabase: SupabaseClient,
  requested: string | null
): Promise<string | null> {
  if (requested) {
    const ev = await getEventById(supabase, requested)
    if (ev) return ev.id
    return null
  }
  const active = await getActiveEvent(supabase)
  return active?.id ?? null
}

// Bentuk ringkas info event untuk e-tiket / PDF / UI ringkas.
export interface EventDisplay {
  nama_event: string
  tanggal: string
  jam: string
  lokasi: string
  gambar: string | null
}

export function formatEventDisplay(e: EventInfo | null | undefined): EventDisplay {
  let tanggal = '-'
  if (e?.tanggal) {
    try {
      tanggal = new Date(`${e.tanggal}T00:00:00`).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    } catch {
      tanggal = e.tanggal
    }
  }
  const jam = e?.waktu || '-'
  const lokasi = [e?.venue, e?.alamat].filter(Boolean).join(', ') || '-'
  return { nama_event: e?.nama_event || 'Event EncoreTix', tanggal, jam, lokasi, gambar: e?.gambar ?? null }
}