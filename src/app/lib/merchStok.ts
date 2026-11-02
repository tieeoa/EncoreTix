import type { SupabaseClient } from '@supabase/supabase-js'

export const MERCH_SIZES = ['S', 'M', 'L', 'XL', 'XXL'] as const
export type MerchSize = (typeof MERCH_SIZES)[number]

// Ukuran khusus untuk produk tanpa ukuran tertentu (topi, gantungan kunci, dll).
// Stoknya disimpan di stok_s. Penanda (flag) = stok_xxl diset -1.
// Tidak perlu migrasi DB — nilai -1 tidak mungkin muncul pada stok normal.
export const FREE_SIZE = 'FREE' as const
export type AnySize = MerchSize | typeof FREE_SIZE

// Nilai sentinel yang disimpan di kolom stok_xxl untuk menandai produk FREE_SIZE.
export const FREE_SIZE_SENTINEL = -1

type SizeColumn = 'stok_s' | 'stok_m' | 'stok_l' | 'stok_xl' | 'stok_xxl'

const SIZE_COLUMNS: Record<MerchSize, SizeColumn> = {
  S: 'stok_s',
  M: 'stok_m',
  L: 'stok_l',
  XL: 'stok_xl',
  XXL: 'stok_xxl',
}

export function sizeColumn(size: MerchSize): SizeColumn {
  return SIZE_COLUMNS[size]
}

/**
 * Cek apakah produk adalah FREE_SIZE (tanpa pilihan ukuran).
 * Penanda: stok_xxl === -1.
 */
export function isFreeSizeProduct(product: Record<string, unknown>): boolean {
  return Number(product.stok_xxl ?? 0) === FREE_SIZE_SENTINEL
}

// Menghitung sisa stok online per ukuran:
// - Produk biasa: sisa[S/M/L/XL/XXL] = stok_kolom - terjual
// - Produk FREE_SIZE: sisa['FREE'] = stok_s - terjual dengan ukuran 'FREE'
export async function withSisaStok<T extends { id: string }>(
  supabase: SupabaseClient,
  rows: T[]
): Promise<Array<T & { sisa_stok: Record<string, number> }>> {
  if (rows.length === 0) {
    return rows.map((r) => ({ ...r, sisa_stok: {} }))
  }

  const { data, error } = await supabase
    .from('pesanan_merchandise')
    .select('id_merch, ukuran, jumlah')
    .in('id_merch', rows.map((r) => r.id))
    .eq('status_bayar', 'berhasil')
  if (error) throw new Error(error.message)

  const sold: Record<string, Record<string, number>> = {}
  for (const p of data ?? []) {
    if (!p.ukuran) continue
    sold[p.id_merch] ??= {}
    sold[p.id_merch][p.ukuran] = (sold[p.id_merch][p.ukuran] ?? 0) + Number(p.jumlah ?? 0)
  }

  return rows.map((r) => {
    const rec = r as Record<string, unknown>
    const bySize = sold[r.id] ?? {}
    const sisa: Record<string, number> = {}

    if (isFreeSizeProduct(rec)) {
      // Produk tanpa ukuran: total stok ada di stok_s
      const cap = Number(rec.stok_s ?? 0)
      sisa[FREE_SIZE] = Math.max(0, cap - (bySize[FREE_SIZE] ?? 0))
    } else {
      for (const s of MERCH_SIZES) {
        const cap = Number(rec[sizeColumn(s)] ?? 0)
        sisa[s] = Math.max(0, cap - (bySize[s] ?? 0))
      }
    }
    return { ...r, sisa_stok: sisa }
  })
}