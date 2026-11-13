// Snapshot data pemesan/pemilik tiket per pesanan.
//
// Tabel `customers` disimpan unik per email, sehingga nama orang yang sama bisa
// berubah/kembali ke nama lama saat memesan lagi. Agar e-tiket, e-merch, dan
// dashboard menampilkan data yang persis sama dengan yang diisi saat checkout,
// setiap pesanan menyimpan snapshot data pemesan (`pemesan_data`) dan daftar
// pemilik tiket (`pemilik_data`, sesuai urutan `pemilik_ids`).
//
// Kolom JSON di MySQL bisa dikembalikan sebagai string maupun objek/array
// tergantung driver, jadi helper di sini menormalkan keduanya.

export interface PartySnapshot {
  nama?: string | null
  email?: string | null
  no_hp?: string | null
  usia?: number | null
  no_identitas?: string | null
  jenis_identitas?: string | null
  jenis_kelamin?: string | null
}

export interface HolderInfo {
  nama: string
  email: string
  no_hp: string | null
  usia: number | null
  no_identitas: string | null
  jenis_identitas: string | null
  jenis_kelamin: string | null
}

export function parseJsonArray<T = unknown>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? (parsed as T[]) : []
    } catch {
      return []
    }
  }
  return []
}

export function parseJsonObject<T = unknown>(value: unknown): T | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as T
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as T)
        : null
    } catch {
      return null
    }
  }
  return null
}

// Gabungkan snapshot pesanan dengan data customer (fallback data lama yang
// belum punya snapshot). Urutan prioritas: snapshot -> customer -> fallback.
export function mergeHolder(
  snapshot: PartySnapshot | null | undefined,
  customer: PartySnapshot | null | undefined,
  fallback?: PartySnapshot | null
): HolderInfo {
  const pick = <K extends keyof PartySnapshot>(key: K): PartySnapshot[K] | null =>
    snapshot?.[key] ?? customer?.[key] ?? fallback?.[key] ?? null

  const nama = String(pick('nama') ?? '').trim()
  const email = String(pick('email') ?? '').trim()

  return {
    nama: nama || '-',
    email: email || '-',
    no_hp: (pick('no_hp') as string | null) ?? null,
    usia: (pick('usia') as number | null) ?? null,
    no_identitas: (pick('no_identitas') as string | null) ?? null,
    jenis_identitas: (pick('jenis_identitas') as string | null) ?? null,
    jenis_kelamin: (pick('jenis_kelamin') as string | null) ?? null,
  }
}

// Ambil data pemesan dari sebuah baris pesanan (snapshot dahulu, lalu fallback
// ke kolom snapshot nama/email lama dan relasi customers).
export function resolvePemesan(
  row: Record<string, unknown> | null | undefined,
  customer?: PartySnapshot | null
): HolderInfo {
  const snap = parseJsonObject<PartySnapshot>(row?.pemesan_data)
  const fallbackCustomer: PartySnapshot | null = customer ?? null
  const legacy: PartySnapshot = {
    nama: (row?.nama_pemesan as string | null | undefined) ?? null,
    email: (row?.email_pemesan as string | null | undefined) ?? null,
  }
  return mergeHolder(snap, fallbackCustomer, legacy)
}
