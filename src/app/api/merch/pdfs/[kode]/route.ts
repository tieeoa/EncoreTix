import { NextResponse } from 'next/server'
import { getServerSupabase } from '../../../../lib/supabaseClient'
import { generateMerchPdf, type MerchPdfData } from '../../../../lib/merchPdf'
import { getEventById, formatEventDisplay } from '../../../../lib/events'
import { resolveMerchGroup, buildMerchGroupData } from '../../../../lib/merchGroup'

export const dynamic = 'force-dynamic'

// GET /api/merch/pdfs/:kode
// Download bukti pengambilan merchandise (PDF) untuk satu kelompok pesanan.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ kode: string }> }
) {
  try {
    const { kode } = await params
    const rawCode = decodeURIComponent(kode).toUpperCase()
    if (!rawCode) {
      return NextResponse.json({ error: 'Kode pengambilan tidak valid' }, { status: 400 })
    }

    const supabase = getServerSupabase()

    const resolved = await resolveMerchGroup(supabase, rawCode)
    if (!resolved || resolved.rows.length === 0) {
      return NextResponse.json({ error: 'Pesanan merch tidak ditemukan' }, { status: 404 })
    }

    const first = resolved.rows[0]
    const cust = first.customers
    const event = await getEventById(supabase, first.merchandise?.id_event || null)
    const eventDisplay = formatEventDisplay(event)
    const group = buildMerchGroupData(resolved.rows, resolved.groupCode)

    const pdfData: MerchPdfData = {
      kode_pengambilan: resolved.groupCode,
      nama: cust?.nama || '-',
      email: cust?.email || '-',
      no_hp: cust?.no_hp ?? null,
      no_identitas: cust?.no_identitas ?? null,
      jenis_identitas: cust?.jenis_identitas ?? null,
      jenis_kelamin: cust?.jenis_kelamin ?? null,
      usia: cust?.usia ?? null,
      alamat: first.alamat || null,
      items: resolved.rows.map((r) => ({
        nama_merch: r.merchandise?.nama_merch || 'Merchandise',
        harga: Number(r.merchandise?.harga ?? 0),
        kategori: r.merchandise?.kategori ?? null,
        jumlah: Number(r.jumlah ?? 1),
        ukuran: r.ukuran || null,
        total_harga: Number(r.total_harga ?? 0),
      })),
      subtotal: group.subtotal,
      admin_fee: group.admin_fee,
      total_harga: group.total_harga,
      event: eventDisplay,
    }

    const pdf = await generateMerchPdf(pdfData)

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Bukti-Pengambilan-${resolved.groupCode}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}