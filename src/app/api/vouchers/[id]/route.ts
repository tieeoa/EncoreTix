import { NextResponse } from 'next/server'
import { getServerSupabase } from '../../../lib/supabaseClient'

export const dynamic = 'force-dynamic'

// PATCH /api/vouchers/:id
// Ubah nominal, kuota, atau status voucher.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const supabase = getServerSupabase()

    const patch: Record<string, unknown> = {}

    if (body.nominal_diskon !== undefined) {
      const nominal = Number(body.nominal_diskon)
      if (!Number.isFinite(nominal) || nominal < 0) {
        return NextResponse.json({ error: 'Nominal diskon harus angka positif' }, { status: 400 })
      }
      patch.nominal_diskon = nominal
    }

    if (body.kuota_penggunaan !== undefined) {
      const kuota = Number(body.kuota_penggunaan)
      if (!Number.isInteger(kuota) || kuota < 1) {
        return NextResponse.json({ error: 'Kuota penggunaan minimal 1' }, { status: 400 })
      }
      const { data: current } = await supabase
        .from('voucher')
        .select('jumlah_digunakan')
        .eq('id', id)
        .maybeSingle()
      if (current && Number(current.jumlah_digunakan) > kuota) {
        return NextResponse.json(
          { error: 'Kuota tidak boleh kurang dari jumlah voucher yang sudah terpakai' },
          { status: 400 }
        )
      }
      patch.kuota_penggunaan = kuota
    }

    if (body.status !== undefined) {
      if (!['aktif', 'nonaktif'].includes(body.status)) {
        return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 })
      }
      patch.status = body.status
    }

    if (body.id_event !== undefined) {
      const idEvent = String(body.id_event || '').trim()
      if (!idEvent) {
        return NextResponse.json({ error: 'id_event tidak boleh kosong' }, { status: 400 })
      }
      const { data: eventExists } = await supabase.from('event_info').select('id').eq('id', idEvent).maybeSingle()
      if (!eventExists) {
        return NextResponse.json({ error: 'Event tidak ditemukan' }, { status: 400 })
      }
      patch.id_event = idEvent
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Tidak ada perubahan yang dikirim' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('voucher')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return NextResponse.json({ data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/vouchers/:id
// Hapus voucher. Pesanan yang memakainya otomatis melepas relasi voucher (set null).
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = getServerSupabase()
    const { error } = await supabase.from('voucher').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}