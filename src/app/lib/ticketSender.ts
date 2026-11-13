import { getServerSupabase } from './supabaseClient'
import { generateTicketPdf, type TicketPdfData } from './ticketPdf'
import { sendTicketEmail } from './ticketEmail'
import { getEventById, formatEventDisplay } from './events'
import { mergeHolder, parseJsonArray, resolvePemesan, type PartySnapshot } from './orderSnapshot'

// Kirim email berisi kode booking setelah pembayaran berhasil.
// Secara default TANPA lampiran PDF — customer melihat tiket di web.
// Opsi `withPdf: true` untuk melampirkan PDF e-tiket bila dibutuhkan.
// Mengembalikan true jika email berhasil terkirim, false jika tidak.
export async function sendTicketEmailForBooking(
  bookingId: string,
  opts?: { withPdf?: boolean }
): Promise<boolean> {
  try {
    const supabase = getServerSupabase()

    const { data: pesanan } = await supabase
      .from('pesanan_tiket')
      .select('*, pemilik_ids, customers(nama, email, no_hp, no_identitas, jenis_identitas, jenis_kelamin, usia), tiket(kategori, harga, id_event)')
      .eq('booking_id', bookingId)
      .maybeSingle()

    if (!pesanan) {
      console.error(`[ticket-email] Booking ${bookingId} tidak ditemukan`)
      return false
    }

    const event = await getEventById(supabase, pesanan.tiket?.id_event)
    const eventDisplay = formatEventDisplay(event)
    const cust = pesanan.customers
    // Data pemesan per pesanan (snapshot) diprioritaskan di atas customers.
    const pemesan = resolvePemesan(pesanan, cust)
    const pemilikSnaps = parseJsonArray<PartySnapshot>(pesanan.pemilik_data)
    const kategori = pesanan.tiket?.kategori || 'TIKET'
    const harga = Number(pesanan.tiket?.harga ?? 0)

    if (!pemesan.email || !pemesan.email.includes('@')) {
      console.error(`[ticket-email] Booking ${bookingId} tidak punya email valid`)
      return false
    }

    const { data: pembayaran } = await supabase
      .from('pembayaran')
      .select('metode_pembayaran, total_bayar, status_pembayaran, tanggal_bayar')
      .eq('id_pesanan_tiket', pesanan.id)
      .maybeSingle()

    // Siapkan daftar pemegang tiket sesuai urutan (tiket #1, #2, dst).
    let ownerById = new Map<string, NonNullable<typeof cust>>()
    if (pesanan.pemilik_ids && pesanan.pemilik_ids.length > 0) {
      const { data: ownersData } = await supabase
        .from('customers')
        .select('id, nama, email, no_hp, no_identitas, jenis_identitas, jenis_kelamin, usia')
        .in('id', pesanan.pemilik_ids)
      ownerById = new Map((ownersData ?? []).map((c) => [c.id, c]))
    }

    const count = Math.max(1, Number(pesanan.jumlah) || 1)
    const withPdf = opts?.withPdf === true
    const attachments: { filename: string; content: Buffer; contentType: string }[] = []
    const holderNames: string[] = []
    for (let i = 0; i < count; i++) {
      const dbHolder = ownerById.get(pesanan.pemilik_ids?.[i] ?? '') ?? cust
      const holder = mergeHolder(pemilikSnaps[i], dbHolder, pemesan)
      holderNames.push(holder.nama || '-')
      if (!withPdf) continue
      const pdfData: TicketPdfData = {
        booking_id: `${pesanan.booking_id}-${i + 1}`,
        jumlah: 1,
        kategori,
        harga,
        nama: holder.nama || '-',
        email: holder.email || '-',
        no_hp: holder.no_hp ?? null,
        no_identitas: holder.no_identitas ?? null,
        jenis_identitas: holder.jenis_identitas ?? null,
        jenis_kelamin: holder.jenis_kelamin ?? null,
        usia: holder.usia ?? null,
        event: eventDisplay,
      }
      const pdf = await generateTicketPdf(pdfData)
      attachments.push({
        filename: `E-Tiket-${pdfData.booking_id}.pdf`,
        content: pdf,
        contentType: 'application/pdf',
      })
    }

    const summary: TicketPdfData = {
      booking_id: pesanan.booking_id,
      jumlah: count,
      kategori,
      harga,
      nama: pemesan.nama || '-',
      email: pemesan.email || '-',
      no_hp: pemesan.no_hp ?? null,
      no_identitas: pemesan.no_identitas ?? null,
      jenis_identitas: pemesan.jenis_identitas ?? null,
      jenis_kelamin: pemesan.jenis_kelamin ?? null,
      usia: pemesan.usia ?? null,
      event: eventDisplay,
    }

    await sendTicketEmail(
      pemesan.email,
      attachments,
      summary,
      holderNames,
      {
        statusBayar: pesanan.status_bayar,
        metodePembayaran: pembayaran?.metode_pembayaran ?? null,
        tanggalPesan: pesanan.tanggal_pesan ?? null,
        totalBayar: pembayaran ? Number(pembayaran.total_bayar) : undefined,
        withPdf,
      }
    )
    console.log(`[ticket-email] ${attachments.length} e-tiket terkirim ke ${pemesan.email} (${bookingId})`)
    return true
  } catch (err) {
    console.error('[ticket-email] Gagal kirim email:', err instanceof Error ? err.message : err)
    return false
  }
}