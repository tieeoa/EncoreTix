import { NextResponse } from 'next/server'
import { getServerSupabase } from '../../../lib/supabaseClient'

export const dynamic = 'force-dynamic'

const isFkError = (err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  return message.toLowerCase().includes('foreign key')
}

// PATCH /api/bands/:id
// Update band (deskripsi, gambar, nama).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    if (body.nama_band !== undefined && !body.nama_band) {
      return NextResponse.json({ error: 'Nama band wajib diisi' }, { status: 400 })
    }

    const fields: Record<string, unknown> = {}
    if (body.nama_band !== undefined) fields.nama_band = body.nama_band
    if (body.deskripsi !== undefined) fields.deskripsi = body.deskripsi
    if (body.gambar !== undefined) fields.gambar = body.gambar

    const supabase = getServerSupabase()
    const { data, error } = await supabase.from('band').update(fields).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    return NextResponse.json({ data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/bands/:id
// Hapus band. Gagal jika band masih dipakai merchandise (FK restrict).
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = getServerSupabase()
    const { data: used } = await supabase
      .from('merchandise')
      .select('id')
      .eq('id_band', id)
      .limit(1)
    if (used && used.length > 0) {
      return NextResponse.json(
        { error: 'Band masih dipakai merchandise. Hapus/pindahkan produk terkait dulu.' },
        { status: 409 }
      )
    }
    const { error } = await supabase.from('band').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = isFkError(err)
      ? 'Band masih dipakai merchandise. Hapus/pindahkan produk terkait dulu.'
      : err instanceof Error ? err.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}