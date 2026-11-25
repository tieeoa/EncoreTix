import { NextResponse } from 'next/server'
import { getServerSupabase } from '../../../lib/supabaseClient'
import { getEventById, formatEventDisplay } from '../../../lib/events'
import { MERCH_SIZES, sizeColumn, withSisaStok } from '../../../lib/merchStok'
import { requireRole, rejectInactiveAdminMutation } from '@/lib/serverAuth'

export const dynamic = 'force-dynamic'

// GET /api/merchandise/:id
// Mengambil detail satu produk merch.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = getServerSupabase()
    const { data, error } = await supabase
      .from('merchandise')
      .select('*, band(*)')
      .eq('id', id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) {
      return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 })
    }
    const [row] = await withSisaStok(supabase, [data])
    const event = formatEventDisplay(await getEventById(supabase, data.id_event))
    return NextResponse.json({ data: { ...row, event } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PATCH /api/merchandise/:id
// Update stok / harga / status merch (dipakai superadmin).
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

    // Kalau body berisi array foto kosong, simpan sebagai null.
    if (Array.isArray(body.foto) && body.foto.length === 0) {
      body.foto = null
    }

    // Kalau ada update stok per ukuran, batasi ke bilangan bulat non-negatif.
    for (const s of MERCH_SIZES) {
      const col = sizeColumn(s)
      if (body[col] !== undefined) {
        body[col] = Math.max(0, Math.round(Number(body[col]) || 0))
      }
    }

    const { data, error } = await supabase
      .from('merchandise')
      .update(body)
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

// DELETE /api/merchandise/:id
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
    const { error } = await supabase.from('merchandise').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
