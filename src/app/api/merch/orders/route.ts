import { NextResponse } from 'next/server'
import { getServerSupabase } from '../../../lib/supabaseClient'
import { expireExpiredPendingOrders } from '../../../lib/expireOrders'
import { MERCH_SIZES, sizeColumn, type MerchSize, FREE_SIZE, FREE_SIZE_SENTINEL, isFreeSizeProduct } from '../../../lib/merchStok'
import {
  ADMIN_FEE_RATE,
  generateKodePesanan,
  generateKodePengambilan,
} from '../../../lib/merchGroup'
import { resolveEventId } from '../../../lib/events'
import { syncOrderWithMidtrans } from '@/app/lib/midtransSync'
import { parseJsonObject, type PartySnapshot } from '../../../lib/orderSnapshot'

export const dynamic = 'force-dynamic'

interface MerchItemInput {
  id_merch: string
  ukuran?: string
  jumlah: number
}

interface CreateMerchOrderBody {
  nama: string
  email: string
  no_hp?: string
  no_identitas?: string
  jenis_identitas?: string
  jenis_kelamin?: 'Laki-laki' | 'Perempuan'
  usia?: number
  alamat?: string
  // Multi item: satu checkout boleh berisi beberapa produk/ukuran.
  items?: MerchItemInput[]
  // Legacy (1 item): id_merch + jumlah + ukuran.
  id_merch?: string
  jumlah?: number
  ukuran?: string
}

function normalizeUkuran(u: string | undefined | null, productRec?: Record<string, unknown>): MerchSize | typeof FREE_SIZE | null {
  // Produk tanpa ukuran otomatis dapat FREE
  if (productRec && isFreeSizeProduct(productRec)) return FREE_SIZE
  if (u === FREE_SIZE) return FREE_SIZE
  return u && MERCH_SIZES.includes(u.toUpperCase() as MerchSize)
    ? (u.toUpperCase() as MerchSize)
    : null
}

// Validasi stok online: sisa = stok_<ukuran> - qty pesanan 'berhasil'.
// Untuk produk FREE_SIZE, cek stok_s dikurangi pesanan dengan ukuran 'FREE'.
async function checkStock(
  supabase: ReturnType<typeof getServerSupabase>,
  idMerch: string,
  ukuran: MerchSize | typeof FREE_SIZE
): Promise<number> {
  const { data: merch, error: merchError } = await supabase
    .from('merchandise')
    .select('id, status, stok_s, stok_m, stok_l, stok_xl, stok_xxl')
    .eq('id', idMerch)
    .single()
  if (merchError || !merch) return -1
  if (merch.status === 'nonaktif') return -2

  let cap: number
  if (ukuran === FREE_SIZE) {
    // Produk free size: stok total ada di stok_s, sentinel di stok_xxl
    if (Number(merch.stok_xxl) !== FREE_SIZE_SENTINEL) return -3 // bukan produk FREE
    cap = Number(merch.stok_s ?? 0)
  } else {
    cap = Number((merch as Record<string, unknown>)[sizeColumn(ukuran)] ?? 0)
  }
  const { data: soldRows } = await supabase
    .from('pesanan_merchandise')
    .select('jumlah')
    .eq('id_merch', idMerch)
    .eq('ukuran', ukuran)
    .eq('status_bayar', 'berhasil')
  const sold = (soldRows ?? []).reduce((acc, r) => acc + Number(r.jumlah ?? 0), 0)
  return Math.max(0, cap - sold)
}

// POST /api/merch/orders
// Membuat pesanan merchandise baru. Mendukung 1 item (legacy) maupun banyak
// item sekaligus (items[]). Semua baris dalam satu request membentuk satu
// kelompok pesanan dengan kode_pesanan yang sama.
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateMerchOrderBody

    if (!body.nama || !body.email) {
      return NextResponse.json({ error: 'Nama dan email wajib diisi' }, { status: 400 })
    }

    // Normalisasi input menjadi daftar item.
    const items: MerchItemInput[] = Array.isArray(body.items) && body.items.length > 0
      ? body.items
      : body.id_merch
        ? [{ id_merch: body.id_merch, jumlah: body.jumlah || 1, ukuran: body.ukuran }]
        : []
    if (items.length === 0) {
      return NextResponse.json({ error: 'Pilih produk dan jumlah yang valid' }, { status: 400 })
    }

    const supabase = getServerSupabase()

    // Validasi setiap item: ukuran, status produk, stok.
    // Validasi sengaja dilakukan SEBELUM membuat customer agar pesanan yang
    // gagal (stok habis / produk ditutup) tidak meninggalkan customer yatim.
    const prepared: {
      id_merch: string
      jumlah: number
      ukuran: MerchSize | typeof FREE_SIZE
      itemTotal: number
    }[] = []
    let totalHarga = 0
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (!item.id_merch || !item.jumlah || item.jumlah < 1) {
        return NextResponse.json({
          error: `Item ke-${i + 1}: pilih produk dan jumlah yang valid`,
        }, { status: 400 })
      }
      const { data: merchData } = await supabase
        .from('merchandise')
        .select('id, status, harga, stok_s, stok_m, stok_l, stok_xl, stok_xxl')
        .eq('id', item.id_merch)
        .single()
      const merchRec = merchData as Record<string, unknown> | null

      const ukuran = normalizeUkuran(item.ukuran, merchRec ?? undefined)
      if (!ukuran) {
        return NextResponse.json({
          error: `Item ke-${i + 1}: pilih ukuran merchandise`,
        }, { status: 400 })
      }

      const remaining = await checkStock(supabase, item.id_merch, ukuran)
      if (remaining === -1) {
        return NextResponse.json({ error: `Produk pada item ke-${i + 1} tidak ditemukan` }, { status: 404 })
      }
      if (remaining === -2) {
        return NextResponse.json({ error: 'Penjualan merchandise sedang ditutup' }, { status: 400 })
      }
      if (item.jumlah > remaining) {
        return NextResponse.json(
          { error: `Item ke-${i + 1}: stok ukuran ${ukuran} tidak mencukupi (sisa: ${remaining})` },
          { status: 400 }
        )
      }

      const subtotal = Number(merchData?.harga ?? 0) * item.jumlah
      const itemTotal = subtotal + Math.round(subtotal * ADMIN_FEE_RATE)
      totalHarga += itemTotal

      prepared.push({
        id_merch: item.id_merch,
        jumlah: item.jumlah,
        ukuran,
        itemTotal,
      })
    }

    // Cari atau buat customer (baru setelah semua item valid).
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id')
      .eq('email', body.email)
      .maybeSingle()

    let customerId: string
    if (existingCustomer) {
      customerId = existingCustomer.id
    } else {
      const { data: newCustomer, error: custError } = await supabase
        .from('customers')
        .insert({
          nama: body.nama,
          email: body.email,
          no_hp: body.no_hp || null,
          usia: body.usia || null,
          no_identitas: body.no_identitas || null,
          jenis_identitas: body.jenis_identitas || null,
          jenis_kelamin: body.jenis_kelamin || null,
        })
        .select('id')
        .single()
      if (custError) throw new Error(custError.message)
      customerId = newCustomer.id
    }

    const kodePesanan = generateKodePesanan()
    // Snapshot data pemesan per pesanan agar bukti pengambilan & dashboard
    // konsisten dengan isian checkout (bukan nama lama pada tabel customers).
    const pemesanData = {
      nama: body.nama,
      email: body.email,
      no_hp: body.no_hp ?? null,
      usia: body.usia ?? null,
      no_identitas: body.no_identitas ?? null,
      jenis_identitas: body.jenis_identitas ?? null,
      jenis_kelamin: body.jenis_kelamin ?? null,
    }
    const rows: Record<string, unknown>[] = prepared.map((p) => ({
      id_customer: customerId,
      nama_pemesan: body.nama,
      email_pemesan: body.email,
      pemesan_data: pemesanData,
      id_merch: p.id_merch,
      jumlah: p.jumlah,
      ukuran: p.ukuran,
      alamat: body.alamat || null,
      total_harga: p.itemTotal,
      kode_pengambilan: generateKodePengambilan(),
      kode_pesanan: kodePesanan,
      status_bayar: 'pending',
      status_pengambilan: 'belum_diambil',
    }))

    const { data: inserted, error: orderError } = await supabase
      .from('pesanan_merchandise')
      .insert(rows)
      .select('*, customers(nama, email, no_hp), merchandise(nama_merch, harga)')
    if (orderError) throw new Error(orderError.message)

    const jumlahTotal = rows.reduce((acc, r) => acc + Number(r.jumlah), 0)
    return NextResponse.json(
      {
        data: {
          kode_pesanan: kodePesanan,
          kode_pengambilan: kodePesanan,
          total_harga: totalHarga,
          jumlah_total: jumlahTotal,
          jumlah_item: (inserted ?? []).length,
        },
      },
      { status: 201 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// GET /api/merch/orders
// Daftar pesanan merch (dipakai superadmin / admin verification).
// Filter: ?event=<id> (jika kosong = event aktif otomatis).
export async function GET(request: Request) {
  try {
    const supabase = getServerSupabase()
    await expireExpiredPendingOrders(supabase)
    const { searchParams } = new URL(request.url)

    let query = supabase
      .from('pesanan_merchandise')
      .select('*, customers(nama, email, no_hp), merchandise(nama_merch, harga, id_event)')
      .order('tanggal_pesan', { ascending: false })

    const eventId = await resolveEventId(supabase, searchParams.get('event'))
    if (eventId) {
      // Filter lewat kolom FK milik tabel induk. Filter PostgREST pada relasi
      // terembed (merchandise.id_event) tidak membatasi baris induk.
      const { data: eventMerch, error: merchErr } = await supabase
        .from('merchandise')
        .select('id')
        .eq('id_event', eventId)
      if (merchErr) throw new Error(merchErr.message)
      const ids = (eventMerch ?? []).map((m) => m.id)
      if (ids.length === 0) return NextResponse.json({ data: [] })
      query = query.in('id_merch', ids)
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)

    // Auto-sync pesanan merch yang masih pending dengan Midtrans
    const pendingMerch = (data || []).filter((r) => r.status_bayar === 'pending')
    if (pendingMerch.length > 0) {
      const distinctCodes = [...new Set(pendingMerch.map((r) => r.kode_pesanan || r.kode_pengambilan).filter(Boolean))]
      await Promise.allSettled(
        distinctCodes.slice(0, 5).map(async (code) => {
          const synced = await syncOrderWithMidtrans(String(code))
          if (synced && synced !== 'pending') {
            ;(data || []).forEach((row) => {
              if (row.kode_pesanan === code || row.kode_pengambilan === code) {
                row.status_bayar = synced
              }
            })
          }
        })
      )
    }

    return NextResponse.json({ data: withPemesanSnapshot(data || []) })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Ganti nama/email pada relasi customers dengan snapshot pesanan agar daftar
// transaksi (dashboard admin & superadmin) konsisten dengan isian checkout.
function withPemesanSnapshot<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.map((r) => {
    const snap = parseJsonObject<PartySnapshot>(r.pemesan_data)
    const customers = r.customers as { nama?: string | null; email?: string | null } | null
    if (!customers) return r
    return {
      ...r,
      customers: {
        ...customers,
        nama: snap?.nama || (r.nama_pemesan as string | null) || customers.nama,
        email: snap?.email || (r.email_pemesan as string | null) || customers.email,
      },
    }
  })
}