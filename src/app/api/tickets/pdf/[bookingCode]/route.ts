import { NextResponse } from 'next/server'
import { getServerSupabase } from '../../../../lib/supabaseClient'
import { generateTicketPdf, type TicketPdfData } from '../../../../lib/ticketPdf'
import { getEventById, formatEventDisplay } from '../../../../lib/events'

export const dynamic = 'force-dynamic'

// Kode bisa berupa booking (ETX-XXXXXX) atau per-tiket (ETX-XXXXXX-2).
function parseTicketCode(raw: string): { bookingCode: string; ticketIndex: number | null } {
  const match = /^(.*)-(\d+)$/.exec(raw)
  if (match && match[1]) {
    return { bookingCode: match[1].toUpperCase(), ticketIndex: Number(match[2]) }
  }
  return { bookingCode: raw.toUpperCase(), ticketIndex: null }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ bookingCode: string }> }
) {
  try {
    const { bookingCode } = await params
    const rawCode = decodeURIComponent(bookingCode)
    const { bookingCode: baseCode, ticketIndex } = parseTicketCode(rawCode)
    if (!rawCode) {
      return NextResponse.json({ error: 'Booking ID tidak valid' }, { status: 400 })
    }

    const supabase = getServerSupabase()

    const { data: pesanan } = await supabase
      .from('pesanan_tiket')
      .select('*, pemilik_ids, customers(nama, email, no_hp, no_identitas, jenis_identitas, jenis_kelamin, usia), tiket(kategori, harga, id_event)')
      .eq('booking_id', baseCode)
      .maybeSingle()

    if (!pesanan) {
      return NextResponse.json({ error: 'Tiket tidak ditemukan' }, { status: 404 })
    }

    const event = await getEventById(supabase, pesanan.tiket?.id_event)
    const eventDisplay = formatEventDisplay(event)

    let owner = pesanan.customers
    if (ticketIndex != null) {
      if (ticketIndex < 1 || ticketIndex > pesanan.jumlah) {
        return NextResponse.json({ error: 'Tiket tidak ditemukan' }, { status: 404 })
      }
      if (pesanan.pemilik_ids && pesanan.pemilik_ids.length >= ticketIndex) {
        const { data: ownersData } = await supabase
          .from('customers')
          .select('id, nama, email, no_hp, no_identitas, jenis_identitas, jenis_kelamin, usia')
          .in('id', pesanan.pemilik_ids)
        const byId = new Map((ownersData ?? []).map((c) => [c.id, c]))
        owner = byId.get(pesanan.pemilik_ids[ticketIndex - 1]) || pesanan.customers
      }
    }

    const pdfData: TicketPdfData = {
      booking_id: rawCode.toUpperCase(),
      jumlah: ticketIndex != null ? 1 : pesanan.jumlah,
      kategori: pesanan.tiket?.kategori || 'TIKET',
      harga: Number(pesanan.tiket?.harga ?? 0),
      nama: owner?.nama || '-',
      email: owner?.email || '-',
      no_hp: owner?.no_hp,
      no_identitas: owner?.no_identitas,
      jenis_identitas: owner?.jenis_identitas,
      jenis_kelamin: owner?.jenis_kelamin,
      usia: owner?.usia,
      event: eventDisplay,
    }

    const pdf = await generateTicketPdf(pdfData)

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="E-Tiket-${rawCode.toUpperCase()}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}