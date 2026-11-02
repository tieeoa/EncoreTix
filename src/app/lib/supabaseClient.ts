import type { SupabaseClient } from '@supabase/supabase-js'
import { createMysqlClient } from './mysqlClient'

// Nama fungsi dipertahankan agar seluruh API route tidak perlu diubah.
// Implementasi sekarang memakai MySQL lokal (Laragon) lewat mysqlClient.
// Konfigurasi: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME di .env.local.
export function getServerSupabase(): SupabaseClient {
  return createMysqlClient() as unknown as SupabaseClient
}

// Dulu dipakai untuk akses browser langsung ke Supabase. Sekarang semua akses
// data lewat API route (server), jadi ini hanya alias untuk kompatibilitas.
export function getBrowserSupabase(): SupabaseClient {
  return createMysqlClient() as unknown as SupabaseClient
}

// Generate kode booking unik, contoh: ETX-8F3K2Q
// Menggunakan crypto.randomInt (CSPRNG) untuk keacakan yang lebih aman.
function generateRawCode(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { randomInt } = require('crypto') as typeof import('crypto')
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[randomInt(chars.length)]
  }
  return `ETX-${code}`
}

// Pastikan kode unik — loop sampai tidak ada collision di DB.
// Probabilitas collision sangat kecil (1/32^6 ≈ 1 miliar), tapi lebih aman dicek.
export async function generateBookingCode(
  supabase?: ReturnType<typeof getServerSupabase>
): Promise<string> {
  if (!supabase) return generateRawCode()
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateRawCode()
    const { data } = await supabase
      .from('pesanan_tiket')
      .select('booking_id')
      .eq('booking_id', code)
      .maybeSingle()
    if (!data) return code
  }
  // Fallback jika setelah 10 percobaan masih collision (sangat tidak mungkin)
  return generateRawCode()
}
