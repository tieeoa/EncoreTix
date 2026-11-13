import { getServerSupabase } from './supabaseClient'
import { generateMerchPdf, type MerchPdfData } from './merchPdf'
import { sendMerchEmail } from './merchEmail'
import { getEventById, formatEventDisplay } from './events'
import { resolveMerchGroup, buildMerchGroupData } from './merchGroup'

// Kirim email berisi kode pengambilan merchandise setelah pembayaran berhasil.
// Secara default TANPA lampiran PDF — customer melihat E-Merch di web.
// Opsi `withPdf: true` untuk melampirkan PDF bukti pengambilan bila dibutuhkan.
// Menerima kode kelompok (kode_pesanan) atau kode pengambilan sebuah baris.
// Mengembalikan true jika email berhasil terkirim, false jika tidak.
export async function sendMerchEmailForOrder(kode: string, opts?: { withPdf?: boolean }): Promise<boolean> {
  try {
    const supabase = getServerSupabase()

    const resolved = await resolveMerchGroup(supabase, kode)
    if (!resolved || resolved.rows.length === 0) {
      console.error(`[merch-email] Pesanan ${kode} tidak ditemukan`)
      return false
    }

    const first = resolved.rows[0]
    const group = buildMerchGroupData(resolved.rows, resolved.groupCode)
    // group.customers sudah memakai snapshot pesanan (nama/email sesuai checkout).
    const cust = group.customers
    if (!cust?.email || !cust.email.includes('@')) {
      console.error(`[merch-email] Pesanan ${kode} tidak punya email valid`)
      return false
    }

    const event = await getEventById(supabase, first.merchandise?.id_event || null)
    const eventDisplay = formatEventDisplay(event)

    const pdfData: MerchPdfData = {
      kode_pengambilan: resolved.groupCode,
      nama: cust?.nama || '-',
      email: cust.email,
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

    const withPdf = opts?.withPdf === true
    const attachments: { filename: string; content: Buffer; contentType: string }[] = []
    if (withPdf) {
      const pdf = await generateMerchPdf(pdfData)
      attachments.push({
        filename: `Bukti-Pengambilan-${pdfData.kode_pengambilan}.pdf`,
        content: pdf,
        contentType: 'application/pdf',
      })
    }

    await sendMerchEmail(
      cust.email,
      attachments,
      pdfData,
      {
        statusBayar: first.status_bayar,
        tanggalPesan: first.tanggal_pesan ?? null,
        withPdf,
      }
    )
    console.log(`[merch-email] Bukti pengambilan terkirim ke ${cust.email} (${pdfData.kode_pengambilan})`)
    return true
  } catch (err) {
    console.error('[merch-email] Gagal kirim email:', err instanceof Error ? err.message : err)
    return false
  }
}