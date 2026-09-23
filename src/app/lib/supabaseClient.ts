import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Client untuk dipakai di SERVER (API route / server component).
// Pakai service role key supaya bisa baca/tulis semua data tanpa RLS.
export function getServerSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Env Supabase belum diatur. Salin .env.example ke .env.local dan isi key-nya.')
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

// Client untuk dipakai di BROWSER (client component).
// Hanya pakai anon key — aman untuk baca data publik.
export function getBrowserSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('Env Supabase belum diatur. Salin .env.example ke .env.local dan isi key-nya.')
  }
  return createClient(url, key)
}

// Generate kode booking unik, contoh: ETX-8F3K2Q
export function generateBookingCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return `ETX-${code}`
}