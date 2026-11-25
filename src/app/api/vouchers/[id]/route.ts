import { NextResponse } from 'next/server'
import { getServerSupabase } from '../../../lib/supabaseClient'
import { requireRole, rejectInactiveAdminMutation } from '@/lib/serverAuth'

export const dynamic = 'force-dynamic'

// PATCH /api/vouchers/:id
// Ubah nominal, kuota, atau status voucher.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireRole(request, ['admin', 'superadmin'])
    if ('response' in auth) return auth.response
    const ro = await rejectInactiveAdminMutation(request, auth.session)
    if (ro) return ro
    const { id } = await params
    const body = await request.json()
    const supabase = getServerSupabase()

    const { data: existing, error: findError } = await supabase
      .from('voucher')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (findError) throw new Error(findError.message)
    if (!existing) {
      return NextResponse.json({ error: 'Voucher tidak ditemukan' }, { status: 404 })
    }

    const patch: Record<string, unknown> = {}

    // Izinkan edit KODE voucher (dengan validasi unik).
    if (body.kode_voucher !== undefined) {
      const kode = String(body.kode_voucher).trim().toUpperCase()
      if (!kode) {
        return NextResponse.json({ error: 'Kode voucher tidak boleh kosong' }, { status: 400 })
      }
      if (kode !== existing.kode_voucher) {
        const { data: dupe } = await supabase
          .from('voucher')
          .select('id')
          .eq('kode_voucher', kode)
          .neq('id', id)
          .maybeSingle()
        if (dupe) {
          return NextResponse.json({ error: 'Kode voucher sudah digunakan' }, { status: 409 })
        }
        patch.kode_voucher = kode
      }
    }

    if (body.nominal_diskon !== undefined) {
      const nominal = Number(body.nominal_diskon)
      if (nominal <= 0) return NextResponse.json({ error: 'Nominal diskon harus lebih dari 0' }, { status: 400 })
      patch.nominal_diskon = nominal
    }

    if (body.kuota_penggunaan !== undefined) {
      const kuota = Number(body.kuota_penggunaan)
      if (kuota < 1) return NextResponse.json({ error: 'Kuota minimal 1' }, { status: 400 })
      if (kuota < Number(existing.jumlah_digunakan)) {
        return NextResponse.json({ error: 'Kuota tidak boleh lebih kecil dari jumlah yang sudah digunakan' }, { status: 400 })
      }
      patch.kuota_penggunaan = kuota
    }

    if (body.status !== undefined) {
      if (!['aktif', 'nonaktif'].includes(body.status)) {
        return NextResponse.json({ error: 'Status harus aktif atau nonaktif' }, { status: 400 })
      }
      patch.status = body.status
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
    const auth = requireRole(_request, ['admin', 'superadmin'])
    if ('response' in auth) return auth.response
    const ro = await rejectInactiveAdminMutation(_request, auth.session)
    if (ro) return ro
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
