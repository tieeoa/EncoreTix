import { NextResponse } from 'next/server'
import { getServerSupabase } from '../../../../lib/supabaseClient'
import { getEventById, formatEventDisplay, getActiveEvent } from '../../../../lib/events'
import { sendMerchEmailForOrder } from '../../../../lib/merchSender'
import { resolveMerchGroup, buildMerchGroupData } from '../../../../lib/merchGroup'

export const dynamic = 'force-dynamic'

// GET /api/merch/orders/:code
// Lihat pesanan merch berdasarkan kode pengambilan / pickup code
// (bisa berisi 1 item atau beberapa item dalam satu kelompok).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = getServerSupabase()

    const resolved = await resolveMerchGroup(supabase, id)
    if (!resolved) {
      return NextResponse.json({ error: 'Pesanan merch tidak ditemukan' }, { status: 404 })
    }

    const group = buildMerchGroupData(resolved.rows, resolved.groupCode)
    const event = formatEventDisplay(
      await getEventById(supabase, resolved.rows[0]?.merchandise?.id_event)
    )
    return NextResponse.json({ data: { ...group, event } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PATCH /api/merch/orders/:code
// Update status pengambilan seluruh item dalam kelompok (verifikasi panitia).
// Body opsional: { bukti_pengambilan?: string } — URL foto bukti serah terima.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    if (!['belum_diambil', 'sudah_diambil'].includes(body.status_pengambilan)) {
      return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 })
    }

    const supabase = getServerSupabase()
    const resolved = await resolveMerchGroup(supabase, id)
    if (!resolved) {
      return NextResponse.json({ error: 'Pesanan merch tidak ditemukan' }, { status: 404 })
    }

    // Validasi 1x pengambilan: tolak jika seluruh item sudah diambil.
    if (body.status_pengambilan === 'sudah_diambil') {
      const allTaken = resolved.rows.every((r) => r.status_pengambilan === 'sudah_diambil')
      if (allTaken) {
        return NextResponse.json(
          { error: 'Pesanan sudah diambil', code: 'ALREADY_PICKED_UP' },
          { status: 409 }
        )
      }
      // Pengambilan hanya boleh untuk pesanan yang sudah lunas.
      const unpaid = resolved.rows.find((r) => r.status_bayar !== 'berhasil')
      if (unpaid) {
        return NextResponse.json(
          { error: 'Pesanan belum lunas, tidak bisa diambil' },
          { status: 400 }
        )
      }
      // Verifikasi per-event: hanya pesanan milik event yang sedang berjalan
      // yang boleh diambil (mencegah kode event lain dipakai di booth ini).
      const activeEvent = await getActiveEvent(supabase)
      const orderEventId = resolved.rows[0]?.merchandise?.id_event ?? null
      if (activeEvent && orderEventId && String(orderEventId) !== String(activeEvent.id)) {
        return NextResponse.json(
          { error: `Pesanan ini bukan untuk${activeEvent.nama_event ? ` "${activeEvent.nama_event}"` : ' event yang sedang berjalan'}. Pengambilan ditolak.`, code: 'WRONG_EVENT' },
          { status: 403 }
        )
      }
    }

    const patch: Record<string, unknown> = {
      status_pengambilan: body.status_pengambilan,
    }
    if (body.status_pengambilan === 'sudah_diambil') {
      patch.bukti_pengambilan = typeof body.bukti_pengambilan === 'string' ? body.bukti_pengambilan : null
      patch.bukti_pengambilan_at = new Date().toISOString()
    } else {
      patch.bukti_pengambilan_at = null
    }

    const { data, error } = await supabase
      .from('pesanan_merchandise')
      .update(patch)
      .eq('kode_pesanan', resolved.groupCode)
      .select()
    if (error) throw new Error(error.message)
    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/merch/orders/:code
// Kirim ulang bukti pengambilan merchandise ke email pembeli (dipakai superadmin).
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = getServerSupabase()

    const resolved = await resolveMerchGroup(supabase, id)
    if (!resolved) {
      return NextResponse.json({ error: 'Pesanan merch tidak ditemukan' }, { status: 404 })
    }
    if (resolved.rows[0]?.status_bayar !== 'berhasil') {
      return NextResponse.json({ error: 'Pesanan belum lunas, tidak bisa dikirim ulang' }, { status: 400 })
    }

    const ok = await sendMerchEmailForOrder(resolved.groupCode)
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