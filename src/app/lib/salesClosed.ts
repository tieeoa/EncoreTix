import type { SupabaseClient } from '@supabase/supabase-js'
import { getEventById, todayISO } from './events'

// Cek apakah penjualan tiket event tertentu otomatis tertutup.
// Tertutup bila:
//  1. event_info.status = 'closed' atau 'paused' (dijeda), ATAU
//  2. tanggal event (event_info.tanggal) sudah lewat / sudah hari-H.
export async function isTicketSalesClosed(
  supabase: SupabaseClient,
  eventId: string | null | undefined
): Promise<boolean> {
  if (!eventId) return false
  const event = await getEventById(supabase, eventId)
  if (!event) return false

  if (event.status === 'closed' || event.status === 'paused') return true

  const eventDate = event.tanggal
  if (!eventDate) return false

  const today = todayISO()
  return today >= eventDate
}