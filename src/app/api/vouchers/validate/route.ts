import { NextResponse } from 'next/server'
import { getServerSupabase } from '../../../lib/supabaseClient'

export const dynamic = 'force-dynamic'

// POST /api/vouchers/validate
// Body: { kode_voucher: string, id_event?: string }
// Voucher hanya berlaku jika status aktif, kuota masih ada, DAN
// terikat ke event yang sedang dipesan (id_event NULL = berlaku semua event).
export async function POST(req: Request) {
  try {
    const { kode_voucher, id_event } = await req.json()

    if (!kode_voucher || !kode_voucher.trim()) {
      return NextResponse.json({ error: 'Kode voucher wajib diisi.' }, { status: 400 })
    }

    const supabase = getServerSupabase()

    const { data: voucher, error } = await supabase
      .from('voucher')
      .select('*')
      .eq('kode_voucher', kode_voucher.trim().toUpperCase())
      .maybeSingle()

    if (error || !voucher) {
      return NextResponse.json({ error: 'Kode voucher tidak ditemukan.' }, { status: 404 })
    }

    if (voucher.status !== 'aktif') {
      return NextResponse.json({ error: 'Voucher ini sudah tidak aktif.' }, { status: 400 })
    }

    if (Number(voucher.jumlah_digunakan) >= Number(voucher.kuota_penggunaan)) {
      return NextResponse.json({ error: 'Kuota penggunaan voucher sudah habis.' }, { status: 400 })
    }

    // Voucher hanya berlaku jika terikat ke event yang sedang dipesan.
// id_event NULL = belum terikat event = tidak berlaku di event mana pun.
    if (id_event) {
      const voucherEvent = voucher.id_event != null ? String(voucher.id_event) : null
      if (!voucherEvent) {
        return NextResponse.json({ error: 'Voucher ini belum terikat ke event sehingga tidak berlaku.' }, { status: 400 })
      }
      if (voucherEvent !== String(id_event)) {
        return NextResponse.json({ error: 'Voucher ini tidak berlaku untuk event yang dipilih.' }, { status: 400 })
      }
    }

    return NextResponse.json({
      data: {
        kode_voucher: voucher.kode_voucher,
        nominal_diskon: Number(voucher.nominal_diskon),
      },
    })
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 })
  }
}