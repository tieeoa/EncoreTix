import type { SupabaseClient } from '@supabase/supabase-js'
import { getEventById } from './events'

// Cek apakah penjualan tiket event tertentu otomatis tertutup.
// Tertutup bila:
//  1. event_info.status = 'closed', ATAU
//  2. tanggal event (event_info.tanggal) sudah lewat / sudah hari-H.
export async function isTicketSalesClosed(
  supabase: SupabaseClient,
  eventId: string | null | undefined
): Promise<boolean> {
  if (!eventId) return false
  const event = await getEventById(supabase, eventId)
  if (!event) return false

  if (event.status === 'closed') return true

  const eventDate = event.tanggal
  if (!eventDate) return false

  const today = new Date().toISOString().slice(0, 10)
  return today >= eventDate
}