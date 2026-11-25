'use client'

import { adminFetch } from '@/lib/adminAuth'
import { useState, useEffect } from 'react'
import { useLang } from '@/lib/i18n'
import { friendlyError } from '@/app/lib/fetchError'
import { useSelectedEventId, selectEventId } from '@/lib/eventStore'

interface EventLite {
  id: string
  nama_event: string
  status: string
}

// Selector edisi event untuk halaman superadmin.
// Berperilaku sebagai switcher global (lihat /lib/eventStore).
// value = '' artinya "Event aktif (otomatis)".
export default function EventSelector() {
  const { t } = useLang()
  const value = useSelectedEventId()
  const [events, setEvents] = useState<EventLite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    adminFetch('/api/events')
      .then((r) => r.json())
      .then((res) => {
        if (res.error) throw new Error(res.error)
        setEvents(res.data || [])
      })
      .catch((e) => setError(friendlyError(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="h-10 w-40 sm:w-52 max-w-full rounded-xl bg-slate-100 animate-pulse" />
    )
  }

  const statusBadge = (status: string) =>
    status === 'active'
      ? t({ ID: 'Aktif', EN: 'Active' })
      : status === 'paused'
        ? t({ ID: 'Paused', EN: 'Paused' })
        : t({ ID: 'Selesai', EN: 'Finished' })

  return (
    <div className="flex flex-wrap items-center gap-2 min-w-0 max-w-full">
      <label className="text-xs font-semibold text-slate-500 shrink-0">
        {t({ ID: 'Event', EN: 'Event' })}
      </label>
      <select
        value={value}
        onChange={(e) => selectEventId(e.target.value)}
        className="h-10 min-w-0 max-w-full sm:max-w-64 rounded-xl border border-slate-200/90 bg-white px-3 pr-8 text-sm font-medium text-slate-700 shadow-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer truncate"
      >
        <option value="">{t({ ID: 'Event aktif (otomatis)', EN: 'Active event (auto)' })}</option>
        {events.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nama_event} — {statusBadge(e.status)}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-rose-500 break-words basis-full sm:basis-auto">⚠️ {error}</span>}
    </div>
  )
}