'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLang } from '@/lib/i18n'
import LoadingDots from '@/components/LoadingDots'

interface EventData {
  id: string
  nama_event: string
  tanggal: string | null
  venue: string | null
  alamat: string | null
  gambar: string | null
}

function formatTanggal(iso: string | null) {
  if (!iso) return '-'
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

// Penanda `/tentang-event`: redirect ke event aktif.
// Kalau tidak ada event aktif, tampilkan arsip "Event Sebelumnya".
export default function TentangEventIndexPage() {
  const { t } = useLang()
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [finished, setFinished] = useState<EventData[]>([])

  useEffect(() => {
    fetch('/api/events?active=true')
      .then((r) => r.json())
      .then((res) => {
        if (!res.error && res.data?.id) {
          router.replace(`/tentang-event/${res.data.id}`)
          return
        }
        setReady(true)
      })
      .catch(() => setReady(true))

    fetch('/api/events?finished=true')
      .then((r) => r.json())
      .then((res) => {
        if (!res.error) setFinished(res.data || [])
      })
      .catch(() => {})
  }, [router])

  if (!ready) {
    return (
      <div className="bg-white min-h-screen">
        <main className="max-w-6xl mx-auto px-4 py-20 text-center text-slate-400 text-sm">
          {t({ ID: 'Mengalihkan', EN: 'Redirecting' })}<LoadingDots />
        </main>
      </div>
    )
  }

  return (
    <div className="bg-white min-h-screen">
      <main className="max-w-6xl mx-auto px-4 py-10">
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight mb-2">
          {t({ ID: 'Event Sebelumnya', EN: 'Previous Events' })}
        </h1>
        <p className="text-slate-500 text-sm mb-10">
          {t({ ID: 'Belum ada event yang sedang berlangsung. Berikut arsip edisi CoravFest yang sudah selesai.', EN: 'No upcoming event right now. Here is the archive of finished CoravFest editions.' })}
        </p>

        {finished.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-16">
            {t({ ID: 'Belum ada arsip event. Nantikan event berikutnya!', EN: 'No archived events yet. Stay tuned for the next one!' })}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {finished.map((ev) => (
              <Link
                key={ev.id}
                href={`/tentang-event/${ev.id}`}
                className="group rounded-2xl overflow-hidden border border-gray-100 bg-white shadow-sm hover:shadow-md hover:border-gray-300 transition-all"
              >
                <div className="relative h-44">
                  {ev.gambar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ev.gambar} alt={ev.nama_event} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-800 flex items-center justify-center text-5xl">🎪</div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-4 right-4">
                    <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/15 backdrop-blur border border-white/25 text-white mb-1.5">
                      {t({ ID: 'Selesai', EN: 'Finished' })}
                    </span>
                    <h3 className="text-lg font-bold text-white drop-shadow">{ev.nama_event}</h3>
                    <p className="text-[11px] text-gray-200 mt-0.5">
                      {formatTanggal(ev.tanggal)}
                      {[ev.venue, ev.alamat].some(Boolean) && [ev.venue, ev.alamat].filter(Boolean).join(', ') ? ` · ${[ev.venue, ev.alamat].filter(Boolean).join(', ')}` : ''}
                    </p>
                  </div>
                </div>
                <div className="p-4 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">{t({ ID: 'Lihat Detail', EN: 'View Detail' })}</span>
                  <span className="text-gray-400 transition-transform duration-300 group-hover:translate-x-1">→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}