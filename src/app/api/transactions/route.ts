import { NextResponse } from 'next/server'
import { getServerSupabase, generateBookingCode } from '../../lib/supabaseClient'
import { expireExpiredPendingOrders } from '../../lib/expireOrders'
import { sendTicketEmailForBooking } from '../../lib/ticketSender'
import { isTicketSalesClosed } from '../../lib/salesClosed'
import { resolveEventId } from '../../lib/events'

export const dynamic = 'force-dynamic'

// GET /api/transactions
// Daftar pesanan tiket. Panitia (via UI admin) memakai ?source=offline sehingga
// hanya transaksi manual yang diterima; superadmin memanggil tanpa parameter.
// Filter: ?event=<id> (jika kosong = event aktif otomatis).
export async function GET(request: Request) {
  try {
    const supabase = getServerSupabase()
    await expireExpiredPendingOrders(supabase)
    const { searchParams } = new URL(request.url)
    const source = searchParams.get('source')

    let query = supabase
      .from('pesanan_tiket')
      .select('*, customers(nama, email, no_hp), tiket(kategori, harga, id_event), voucher(kode_voucher, nominal_diskon), pembayaran(metode_pembayaran)')
      .order('tanggal_pesan', { ascending: false })
      .limit(200)

    if (source === 'online' || source === 'offline') {
      query = query.eq('source', source)
    }

    const eventId = await resolveEventId(supabase, searchParams.get('event'))
    if (eventId) {
      // Filter pesanan lewat kolom FK milik tabel induk. Filter PostgREST pada
      // relasi terembed (tiket.id_event) tidak membatasi baris induk, jadi hasilnya
      // tetap mencampur transaksi dari semua event.
      const { data: eventTikets, error: tiketErr } = await supabase
        .from('tiket')
        .select('id')
        .eq('id_event', eventId)
      if (tiketErr) throw new Error(tiketErr.message)
      const ids = (eventTikets ?? []).map((t) => t.id)
      if (ids.length === 0) return NextResponse.json({ data: [] })
      query = query.in('id_tiket', ids)
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)

    // Sertakan nama pemilik tiap tiket (pemilik_ids) agar riwayat check-in
    // bisa tampil per tiket, bukan hanya nama pemesan yang sama berulang.
    const allOwnerIds = [...new Set((data || []).flatMap((r) => r.pemilik_ids || []))]
    let ownerById = new Map<string, { nama: string }>()
    if (allOwnerIds.length > 0) {
      const { data: owners } = await supabase
        .from('customers')
        .select('id, nama')
        .in('id', allOwnerIds)
      ownerById = new Map((owners || []).map((o) => [o.id, { nama: o.nama }]))
    }
    const withOwners = (data || []).map((r) => ({
      ...r,
      pemilik_tiket: (r.pemilik_ids || []).map((id: string) => ({
        nama: ownerById.get(id)?.nama ?? null,
      })),
      // Metode pembayaran dari tabel pembayaran; order manual Tunai yang lunas
      // tidak punya baris pembayaran sehingga fallback ke Tunai. Yang masih
      // pending/gagal (belum ada pembayaran) tampil '-'.
      metode_pembayaran:
        r.pembayaran?.metode_pembayaran ||
        (r.source === 'offline' && r.status_bayar === 'berhasil' ? 'Tunai' : null),
    }))
    return NextResponse.json({ data: withOwners })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

interface PemilikInput {
  nama: string
  email: string
  no_hp?: string
  usia?: number
  no_identitas?: string
  jenis_identitas?: string
  jenis_kelamin?: 'Laki-laki' | 'Perempuan'
}

interface CreatePesananBody {
  nama: string
  email: string
  no_hp?: string
  usia?: number
  no_identitas?: string
  jenis_identitas?: string
  jenis_kelamin?: 'Laki-laki' | 'Perempuan'
  owners?: PemilikInput[]
  id_tiket: string
  jumlah: number
  kode_voucher?: string
  source?: 'online' | 'offline'
  manual: boolean
}

// POST /api/transactions
// Membuat pesanan tiket baru: validasi stok, hitung total, simpan ke pesanan_tiket.
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreatePesananBody

    if (!body.nama || !body.email) {
      return NextResponse.json({ error: 'Nama dan email wajib diisi' }, { status: 400 })
    }
    if (!body.id_tiket || !body.jumlah || body.jumlah < 1) {
      return NextResponse.json({ error: 'Pilih tiket dan jumlah yang valid' }, { status: 400 })
    }

    const supabase = getServerSupabase()

    // Ambil data tiket + validasi stok (dipindah ke atas supaya bisa cek status penjualan per event dulu)
    const { data: tiket, error: tiketErr } = await supabase
      .from('tiket')
      .select('id, harga, kuota, sisa_kuota, kategori, id_event, status')
      .eq('id', body.id_tiket)
      .single()
    if (tiketErr || !tiket) {
      return NextResponse.json({ error: 'Tiket tidak ditemukan' }, { status: 404 })
    }

    // Tiket nonaktif tidak bisa dibeli online, tapi tetap bisa dijual manual/offline oleh admin.
    if (!body.manual && (tiket as { status?: string | null }).status === 'nonaktif') {
      return NextResponse.json({ error: `Penjualan tiket ${tiket.kategori} sudah selesai.` }, { status: 400 })
    }

    // Jualan online otomatis ditutup saat sudah hari-H / lewat tanggal event.
    if (!body.manual && (await isTicketSalesClosed(supabase, tiket.id_event))) {
      return NextResponse.json({ error: 'Penjualan tiket telah ditutup. Pemesanan hanya dapat dilakukan via panitia.' }, { status: 400 })
    }

    // Order manual (panitia) juga dilarang bila event sudah selesai / ditutup.
    if (body.manual && (await isTicketSalesClosed(supabase, tiket.id_event))) {
      return NextResponse.json({ error: 'Event sudah selesai. Order manual tidak dapat dibuat.' }, { status: 400 })
    }

// 1. Simpan customer pemesan (penerima e-tiket) + customer pemilik tiket.
    //    id_customer = PEMESAN; pemilik_ids = urutan pemegang tiket per tiket.
    const owners: PemilikInput[] =
      body.owners && body.owners.length > 0
        ? body.owners
        : [
            {
              nama: body.nama,
              email: body.email,
              no_hp: body.no_hp,
              usia: body.usia,
              no_identitas: body.no_identitas,
              jenis_identitas: body.jenis_identitas,
              jenis_kelamin: body.jenis_kelamin,
            },
          ]

    const getOrCreateCustomer = async (c: PemilikInput) => {
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('email', c.email)
        .maybeSingle()

      if (existingCustomer) {
        const { error: updError } = await supabase
          .from('customers')
          .update({
            nama: c.nama,
            no_hp: c.no_hp || null,
            usia: c.usia || null,
            no_identitas: c.no_identitas || null,
            jenis_identitas: c.jenis_identitas || null,
            jenis_kelamin: c.jenis_kelamin || null,
          })
          .eq('id', existingCustomer.id)
        if (updError) throw new Error(updError.message)
        return existingCustomer.id
      }

      const { data: newCustomer, error: custError } = await supabase
        .from('customers')
        .insert({
          nama: c.nama,
          email: c.email,
          no_hp: c.no_hp || null,
          usia: c.usia || null,
          no_identitas: c.no_identitas || null,
          jenis_identitas: c.jenis_identitas || null,
          jenis_kelamin: c.jenis_kelamin || null,
        })
        .select('id')
        .single()
      if (custError) throw new Error(custError.message)
      return newCustomer.id
    }

    const pemesanId = await getOrCreateCustomer({
      nama: body.nama,
      email: body.email,
      no_hp: body.no_hp,
      usia: body.usia,
      no_identitas: body.no_identitas,
      jenis_identitas: body.jenis_identitas,
      jenis_kelamin: body.jenis_kelamin,
    })

    const ownerIds: string[] = []
    for (const owner of owners) {
      ownerIds.push(await getOrCreateCustomer(owner))
    }

    // 2. Validasi stok (data tiket sudah diambil di atas)
    if (body.jumlah > tiket.sisa_kuota) {
      return NextResponse.json({ error: `Stok tiket ${tiket.kategori} tidak mencukupi (sisa: ${tiket.sisa_kuota})` }, { status: 400 })
    }

    // 3. Hitung subtotal
    let subtotal = Number(tiket.harga) * body.jumlah

    // 4. Terapkan voucher jika ada
    let idVoucher: string | null = null
    let diskon = 0
    let voucherIncrement: { id: string; jumlah_digunakan: number } | null = null
    if (body.kode_voucher) {
      const { data: voucher, error: voucherErr } = await supabase
        .from('voucher')
        .select('*')
        .eq('kode_voucher', body.kode_voucher)
        .maybeSingle()
      if (!voucherErr && voucher && voucher.status === 'aktif' && Number(voucher.jumlah_digunakan) < Number(voucher.kuota_penggunaan)) {
        const voucherEvent = voucher.id_event != null ? String(voucher.id_event) : null
        if (!voucherEvent || voucherEvent !== String(tiket.id_event)) {
          return NextResponse.json({ error: 'Voucher tidak berlaku untuk event ini.' }, { status: 400 })
        }
        idVoucher = voucher.id
        diskon = Number(voucher.nominal_diskon)
        subtotal = Math.max(0, subtotal - diskon)
        voucherIncrement = { id: voucher.id, jumlah_digunakan: Number(voucher.jumlah_digunakan) }
      }
    }

    const bookingId = generateBookingCode()

    // 5. Simpan pesanan_tiket
    const { data: pesanan, error: pesananError } = await supabase
      .from('pesanan_tiket')
      .insert({
        booking_id: bookingId,
        id_customer: pemesanId,
        id_tiket: body.id_tiket,
        id_voucher: idVoucher,
        jumlah: body.jumlah,
        pemilik_ids: ownerIds,
        source: body.source || 'online',
        status_bayar: body.manual ? 'berhasil' : 'pending',
        status_check_in: 'belum_check_in',
      })
      .select('*, customers(nama, email), tiket(kategori, harga), voucher(kode_voucher, nominal_diskon)')
      .single()
    if (pesananError) throw new Error(pesananError.message)

    // Kuota voucher hanya dikonsumsi untuk pesanan yang langsung lunas (manual/offline).
    // Pesanan online (pending) dihitung saat /api/payment/confirm menandai berhasil,
    // jadi voucher tidak "terbakar" gara-gara pembayaran gagal/batal.
    // Increment dilakukan SETELAH pesanan tersimpan supaya retry yang gagal tidak
    // memakai kuota berulang kali.
    if (voucherIncrement && body.manual) {
      await supabase
        .from('voucher')
        .update({ jumlah_digunakan: voucherIncrement.jumlah_digunakan + 1 })
        .eq('id', voucherIncrement.id)
    }

    // Kalau manual (offline) => langsung lunas, kurangi sisa kuota.
    // Email hanya berisi kode booking (tanpa lampiran PDF tiket).
    let emailSent = false
    if (body.manual) {
      const { error: stockError } = await supabase
        .from('tiket')
        .update({ sisa_kuota: tiket.sisa_kuota - body.jumlah })
        .eq('id', body.id_tiket)
      if (stockError) throw new Error(stockError.message)
      emailSent = await sendTicketEmailForBooking(bookingId)
    }

    return NextResponse.json({
      data: {
        ...pesanan,
        subtotal,
        diskon,
        total_bayar: subtotal,
        email_sent: emailSent,
      },
    }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
