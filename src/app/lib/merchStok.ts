import type { SupabaseClient } from '@supabase/supabase-js'

export const MERCH_SIZES = ['S', 'M', 'L', 'XL', 'XXL'] as const
export type MerchSize = (typeof MERCH_SIZES)[number]

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

// Menghitung sisa stok online per ukuran:
// sisa_<ukuran> = stok_<ukuran> - total qty pesanan 'berhasil' dengan ukuran tsb.
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
    const bySize = sold[r.id] ?? {}
    const sisa: Record<string, number> = {}
    for (const s of MERCH_SIZES) {
      const cap = Number((r as Record<string, unknown>)[sizeColumn(s)] ?? 0)
      sisa[s] = Math.max(0, cap - (bySize[s] ?? 0))
    }
    return { ...r, sisa_stok: sisa }
  })
}