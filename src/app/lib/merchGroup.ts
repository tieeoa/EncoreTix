import type { SupabaseClient } from '@supabase/supabase-js'

export const ADMIN_FEE_RATE = 0.04

/* eslint-disable @typescript-eslint/no-explicit-any */
export type MerchOrderRow = Record<string, any>
/* eslint-enable @typescript-eslint/no-explicit-any */

// Kode kelompok pesanan (kode_pesanan). Dibagikan oleh semua baris item
// dalam satu checkout. Dipakai sebagai kode pengambilan yang tampil ke pembeli.
export function generateKodePesanan(): string {
  return `PESANAN-${randomCode()}`
}

// Kode unik per baris item (tetap wajib unik di kolom kode_pengambilan).
export function generateKodePengambilan(): string {
  return `MERCH-${randomCode()}`
}

function randomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

// Cari seluruh baris pesanan merchandise yang termasuk dalam satu kelompok.
// Cocok terhadap kode_pesanan ATAU kode_pengambilan (pesanan 1 item = keduanya sama).
export async function resolveMerchGroup(
  supabase: SupabaseClient,
  code: string | null | undefined
): Promise<{ rows: MerchOrderRow[]; groupCode: string } | null> {
  const normalized = (code || '').trim().toUpperCase()
  const safe = normalized.replace(/[^A-Z0-9-]/g, '')
  if (!safe) return null

  const { data, error } = await supabase
    .from('pesanan_merchandise')
    .select(
      '*, customers(nama, email, no_hp, usia, jenis_kelamin, no_identitas), merchandise(id_event, nama_merch, harga, foto, kategori)'
    )
    .or(`kode_pesanan.eq.${safe},kode_pengambilan.eq.${safe}`)
    .order('tanggal_pesan', { ascending: true })

  if (error) throw new Error(error.message)
  if (!data || data.length === 0) return null

  const groupCode = String(data[0].kode_pesanan || data[0].kode_pengambilan || '').toUpperCase()
  return { rows: data, groupCode }
}

export interface MerchGroupItem {
  id: string
  kode_pengambilan: string
  jumlah: number
  ukuran: string | null
  total_harga: number
  status_pengambilan: string
  merchandise: {
    id_event: string | null
    nama_merch: string
    harga: number
    foto: string[] | null
    kategori: string | null
  } | null
}

export interface MerchGroupData {
  kode_pesanan: string
  kode_pengambilan: string
  jumlah_total: number
  jumlah_item: number
  subtotal: number
  admin_fee: number
  total_harga: number
  status_bayar: string
  status_pengambilan: string
  tanggal_pesan: string | null
  alamat: string | null
  customers: {
    nama: string
    email: string
    no_hp: string | null
    usia: number | null
    jenis_kelamin: string | null
    no_identitas: string | null
  } | null
  items: MerchGroupItem[]
}

// Susun respon API dari baris-baris sebuah kelompok pesanan merchandise.
export function buildMerchGroupData(rows: MerchOrderRow[], groupCode: string): MerchGroupData {
  const first = rows[0]

  const items: MerchGroupItem[] = rows.map((r) => ({
    id: String(r.id || ''),
    kode_pengambilan: String(r.kode_pengambilan || '').toUpperCase(),
    jumlah: Number(r.jumlah ?? 1),
    ukuran: r.ukuran || null,
    total_harga: Number(r.total_harga ?? 0),
    status_pengambilan: r.status_pengambilan || 'belum_diambil',
    merchandise: r.merchandise || null,
  }))

  const subtotal = rows.reduce(
    (acc, r) => acc + Number(r.merchandise?.harga ?? 0) * Number(r.jumlah ?? 0),
    0
  )
  const totalHarga = rows.reduce((acc, r) => acc + Number(r.total_harga ?? 0), 0)
  const adminFee = Math.max(0, totalHarga - subtotal)
  const jumlahTotal = rows.reduce((acc, r) => acc + Number(r.jumlah ?? 0), 0)

  return {
    kode_pesanan: groupCode,
    kode_pengambilan: groupCode,
    jumlah_total: jumlahTotal,
    jumlah_item: rows.length,
    subtotal,
    admin_fee: adminFee,
    total_harga: totalHarga,
    status_bayar: first.status_bayar || 'pending',
    status_pengambilan: first.status_pengambilan || 'belum_diambil',
    tanggal_pesan: first.tanggal_pesan || null,
    alamat: first.alamat || null,
    customers: first.customers || null,
    items,
  }
}