import { NextResponse } from 'next/server'
import { getServerSupabase } from '../../lib/supabaseClient'
import { requireRole, rejectInactiveAdminMutation } from '@/lib/serverAuth'

export const dynamic = 'force-dynamic'

interface VoucherRow {
  id: string
  kode_voucher: string
  nominal_diskon: number
  jumlah_digunakan: number
  kuota_penggunaan: number
  status: string
  id_event: string | null
  created_at: string
}

// GET /api/vouchers
// Daftar voucher, opsional disaring per event (?event=<id>).
// Voucher tanpa id_event (NULL) tidak dimunculkan pada filter event tertentu.
export async function GET(request: Request) {
  try {
    const auth = requireRole(request, ['admin', 'superadmin'])
    if ('response' in auth) return auth.response
    const ro = await rejectInactiveAdminMutation(request, auth.session)
    if (ro) return ro
    const event = new URL(request.url).searchParams.get('event')
    const supabase = getServerSupabase()

    const { data: rows, error } = await supabase
      .from('voucher')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)

    const { data: eventRows } = await supabase.from('event_info').select('id, nama_event')

    let list: VoucherRow[] = (rows || []).map((v) => ({
      id: v.id,
      kode_voucher: v.kode_voucher,
      nominal_diskon: Number(v.nominal_diskon),
      jumlah_digunakan: Number(v.jumlah_digunakan || 0),
      kuota_penggunaan: Number(v.kuota_penggunaan || 0),
      status: v.status,
      id_event: v.id_event != null ? String(v.id_event) : null,
      created_at: v.created_at,
    }))

    if (event) {
      list = list.filter((v) => !!v.id_event && v.id_event === event)
    }

    const events = (eventRows || []).map((e) => ({ id: String(e.id), nama_event: e.nama_event }))
    return NextResponse.json({ data: list, events })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/vouchers
// Buat voucher baru untuk satu event.
// Body: { kode_voucher: string, nominal_diskon: number, kuota_penggunaan: number, id_event: string }
export async function POST(request: Request) {
  try {
    const auth = requireRole(request, ['admin', 'superadmin'])
    if ('response' in auth) return auth.response
    const ro = await rejectInactiveAdminMutation(request, auth.session)
    if (ro) return ro
    const body = await request.json()
    const kode = String(body.kode_voucher || '').trim().toUpperCase()
    if (!kode) {
      return NextResponse.json({ error: 'Kode voucher wajib diisi' }, { status: 400 })
    }
    const nominal = Number(body.nominal_diskon)
    const kuota = Number(body.kuota_penggunaan)
    if (!Number.isFinite(nominal) || nominal < 0) {
      return NextResponse.json({ error: 'Nominal diskon harus angka positif' }, { status: 400 })
    }
    if (!Number.isInteger(kuota) || kuota < 1) {
      return NextResponse.json({ error: 'Kuota penggunaan minimal 1' }, { status: 400 })
    }
    const idEvent = String(body.id_event || '').trim()
    if (!idEvent) {
      return NextResponse.json({ error: 'Pilih event dulu — voucher harus terikat ke satu event' }, { status: 400 })
    }

    const supabase = getServerSupabase()

    const { data: eventExists } = await supabase
      .from('event_info')
      .select('id')
      .eq('id', idEvent)
      .maybeSingle()
    if (!eventExists) {
      return NextResponse.json({ error: 'Event tidak ditemukan' }, { status: 400 })
    }

    const { data: exists } = await supabase
      .from('voucher')
      .select('kode_voucher')
      .eq('kode_voucher', kode)
      .maybeSingle()
    if (exists) {
      return NextResponse.json({ error: 'Kode voucher sudah dipakai' }, { status: 409 })
    }

    const { data, error } = await supabase
      .from('voucher')
      .insert({
        kode_voucher: kode,
        nominal_diskon: nominal,
        kuota_penggunaan: kuota,
        jumlah_digunakan: 0,
        status: 'aktif',
        id_event: idEvent,
      })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    if (/id_event.*column/i.test(message)) {
      return NextResponse.json(
        { error: 'Kolom id_event belum ada. Jalankan migration db/migrations/add_voucher_event.sql di database MySQL.' },
        { status: 500 }
      )
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}