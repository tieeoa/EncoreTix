'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useLang } from '@/lib/i18n'
import LoadingDots from '@/components/LoadingDots'

interface EventData {
  id: string
  nama_event: string
  slug: string | null
  tanggal: string | null
  waktu: string | null
  venue: string | null
  alamat: string | null
  deskripsi: string | null
  syarat_ketentuan: string | null
  status: string
  gambar: string | null
}

interface LineUpBand {
  id: string
  nama_band: string
  deskripsi: string | null
  gambar: string | null
}

const ICON_CLS = 'w-6 h-6'

const PARTNERS = [
  {
    name: 'Coravfest Production',
    role: 'Promotor Resmi',
    icon: (
      <svg className={ICON_CLS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 21V4m0 1h12l-3 4 3 4H5" />
      </svg>
    ),
  },
  {
    name: 'EncoreTix Platform',
    role: 'Official Ticketing',
    icon: (
      <svg className={ICON_CLS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
      </svg>
    ),
  },
  {
    name: 'Acoustic Audio Lab',
    role: 'Sound Engineer',
    icon: (
      <svg className={ICON_CLS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5L6 9H3v6h3l5 4V5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" />
      </svg>
    ),
  },
  {
    name: 'Official Band Merch',
    role: 'Produk Resmi Kolaborasi Band',
    icon: (
      <svg className={ICON_CLS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
    ),
  },
  {
    name: 'Food & Beverage Area',
    role: 'Tenant Kuliner Pilihan',
    icon: (
      <svg className={ICON_CLS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 17h16M12 8a8 8 0 018 8H4a8 8 0 018-8z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8V6.5M10.5 6.5h3" />
      </svg>
    ),
  },
  {
    name: 'Paramedic First',
    role: 'Health & Security',
    icon: (
      <svg className={ICON_CLS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.5v5M9.5 12h5" />
      </svg>
    ),
  },
]

function formatTanggal(iso: string | null) {
  if (!iso) return '-'
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

function eventJam(e: EventData) {
  return e.waktu || '-'
}

function googleMapsEmbedUrl(e: EventData) {
  const q = [e.venue, e.alamat].filter(Boolean).join(', ') || e.nama_event
  return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=15&output=embed`
}

// Angka beranimasi naik (count-up) dengan easing keluar.
function useCountUp(target: number, started: boolean, duration = 1600) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!started || target <= 0) return
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration)
      const eased = p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)
      setValue(Math.round(eased * target))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, started, duration])
  return value
}

// Section rekap keseruan: hanya tampil untuk event yang sudah selesai.
// Angka mulai menghitung + kartu memantul saat section masuk viewport.
function RekapKeseruan({ tiket, merch, kapasitas }: { tiket: number; merch: number; kapasitas: number | null }) {
  const { t } = useLang()
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true)
          obs.disconnect()
        }
      },
      { threshold: 0.3 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const tiketCount = useCountUp(tiket, inView)
  const merchCount = useCountUp(merch, inView)
  const pct = kapasitas && kapasitas > 0 ? Math.min(100, Math.round((tiket / kapasitas) * 100)) : null
  const pctCount = useCountUp(pct ?? 0, inView)

  const iconCls = 'w-6 h-6'
  const stats = [
    {
      icon: (
        <svg className={iconCls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
        </svg>
      ),
      value: tiketCount, label: t({ ID: 'Tiket Terjual', EN: 'Tickets Sold' }), delay: '0.05s',
    },
    {
      icon: (
        <svg className={iconCls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      ),
      value: merchCount, label: t({ ID: 'Merch Terjual', EN: 'Merch Sold' }), delay: '0.18s',
    },
    ...(pct !== null
      ? [{
          icon: (
            <svg className={iconCls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          ),
          value: pctCount, suffix: '%', label: t({ ID: 'Tingkat Keterisian', EN: 'Venue Fill Rate' }), delay: '0.31s',
        }]
      : []),
  ]

  return (
    <div ref={ref} className="mb-14 rounded-3xl overflow-hidden bg-gradient-to-br from-indigo-950 via-slate-900 to-fuchsia-950 animate-gradient-slow relative shadow-lg shadow-indigo-950/20">
      {/* Pita teks berjalan */}
      <div className="overflow-hidden border-b border-white/10 py-2 select-none" aria-hidden>
        <div className="animate-rekap-marquee whitespace-nowrap inline-block text-[10px] font-bold tracking-[0.25em] text-white/60">
          <span className="mx-4">{t({ ID: 'TERIMA KASIH • SAMPAI JUMPA DI EDISI BERIKUTNYA • TERIMA KASIH • SAMPAI JUMPA DI EDISI BERIKUTNYA • ', EN: 'THANK YOU • SEE YOU AT THE NEXT EDITION • THANK YOU • SEE YOU AT THE NEXT EDITION • ' })}</span>
          <span className="mx-4">{t({ ID: 'TERIMA KASIH • SAMPAI JUMPA DI EDISI BERIKUTNYA • TERIMA KASIH • SAMPAI JUMPA DI EDISI BERIKUTNYA • ', EN: 'THANK YOU • SEE YOU AT THE NEXT EDITION • THANK YOU • SEE YOU AT THE NEXT EDITION • ' })}</span>
        </div>
      </div>

      {/* Dekorasi melayang */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <span className="animate-rekap-float absolute top-10 left-[8%] text-white/25" style={{ animationDelay: '0s' }}>
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" /></svg>
        </span>
        <span className="animate-rekap-float absolute top-20 right-[10%] text-white/20" style={{ animationDelay: '0.7s' }}>
          <svg className="w-9 h-9" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" /></svg>
        </span>
        <span className="animate-rekap-float absolute bottom-12 left-[16%] text-white/20" style={{ animationDelay: '1.3s' }}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /></svg>
        </span>
        <span className="animate-rekap-float absolute bottom-16 right-[18%] text-white/25" style={{ animationDelay: '1.9s' }}>
          <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /></svg>
        </span>
        <span className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <span className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-indigo-500/20 blur-3xl" />
      </div>

      <div className="relative p-6 lg:p-8 text-center">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white text-[10px] font-bold tracking-widest uppercase backdrop-blur-sm mb-4">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          {t({ ID: 'Rekap Keseruan', EN: 'Event Recap' })}
        </span>
        <h2 className="text-2xl lg:text-3xl font-bold text-white tracking-tight mb-2">
          {t({ ID: 'Event Ini Rame Banget!', EN: 'This Event Was Packed!' })}
        </h2>
        <p className="text-indigo-200 text-[13px] mb-8 max-w-lg mx-auto leading-relaxed">
          {t({ ID: 'Ribuan penonton tumplek blek bareng. Nih buktinya — angka resmi penjualan edisi ini:', EN: 'Thousands of fans showed up together. Here is the proof — the official sales figures for this edition:' })}
        </p>

        <div className={`grid grid-cols-1 sm:grid-cols-2 ${pct !== null ? 'lg:grid-cols-3' : ''} gap-3 max-w-2xl mx-auto mb-8`}>
          {stats.map((s) => (
            <div
              key={s.label}
              className={`bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-5 ${inView ? 'animate-rekap-pop' : 'opacity-0'}`}
              style={{ animationDelay: s.delay }}
            >
              <div className="w-11 h-11 mx-auto mb-3 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-amber-300">{s.icon}</div>
              <p className="text-3xl font-black text-white tabular-nums tracking-tight">
                {(s.value || 0).toLocaleString('id-ID')}{('suffix' in s && s.suffix) || ''}
              </p>
              <p className="text-indigo-200 text-[11px] font-semibold mt-1.5 uppercase tracking-widest">{s.label}</p>
            </div>
          ))}
        </div>

        {pct !== null && (
          <div className="max-w-2xl mx-auto">
            <div className="flex justify-between text-[11px] font-semibold text-indigo-200 mb-2">
              <span>{t({ ID: 'Keterisian venue', EN: 'Venue fill' })}</span>
              <span className="text-white font-bold">{pct}%</span>
            </div>
            <div className="h-2.5 bg-white/10 rounded-full overflow-hidden border border-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 transition-[width] duration-[1500ms] ease-out"
                style={{ width: inView ? `${pct}%` : '0%' }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function TentangEventDetailPage() {
  const { t } = useLang()
  const params = useParams<{ id: string }>()
  const id = params?.id || ''
  const [event, setEvent] = useState<EventData | null>(null)
  const [lineUp, setLineUp] = useState<LineUpBand[]>([])
  const [kapasitas, setKapasitas] = useState<number | null>(null)
  const [salesClosed, setSalesClosed] = useState(false)
  const [rekap, setRekap] = useState<{ tiket: number; merch: number } | null>(null)
  const [others, setOthers] = useState<EventData[]>([])
  const [error, setError] = useState('')
  const [nowMs] = useState(() => Date.now())

  useEffect(() => {
    if (!id) return
    fetch(`/api/events/${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.error) {
          setError(res.error)
          return
        }
        setEvent(res.data)
      })
      .catch((e) => setError(e.message || t({ ID: 'Gagal memuat data event', EN: 'Failed to load event' })))

    fetch(`/api/bands?event=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((res) => {
        if (!res.error) setLineUp(res.data || [])
      })
      .catch(() => setLineUp([]))

    fetch(`/api/tickets?event=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((res) => {
        if (!res.error) {
          const total = (res.data || []).reduce((sum: number, tk: { kuota?: number }) => sum + Number(tk.kuota || 0), 0)
          setKapasitas(total || null)
          setSalesClosed(!!res.sales_closed)
        }
      })
      .catch(() => setKapasitas(null))

    fetch('/api/events/summaries')
      .then((r) => r.json())
      .then((res) => {
        if (res.error || !Array.isArray(res.data)) return
        const found = (res.data as { id: string; tiketTerjual?: number; merchTerjual?: number }[]).find(
          (s) => String(s.id) === String(id)
        )
        if (found) setRekap({ tiket: Number(found.tiketTerjual || 0), merch: Number(found.merchTerjual || 0) })
      })
      .catch(() => {})

    fetch('/api/events?finished=true')
      .then((r) => r.json())
      .then((res) => {
        if (res.error || !Array.isArray(res.data)) return
        setOthers((res.data as EventData[]).filter((e) => String(e.id) !== String(id)))
      })
      .catch(() => {})
  }, [id])

  if (error) {
    return (
      <div className="bg-white min-h-screen">
        <main className="max-w-6xl mx-auto px-4 py-20 text-center">
          <p className="text-slate-500 text-sm mb-6">{t({ ID: 'Event tidak ditemukan atau belum tersedia.', EN: 'Event not found or not available yet.' })}</p>
          <Link href="/" className="inline-block bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-colors">
            {t({ ID: 'Kembali ke Beranda', EN: 'Back to Home' })}
          </Link>
        </main>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="bg-white min-h-screen">
        <main className="max-w-6xl mx-auto px-4 py-20 text-center text-slate-400 text-sm">
          {t({ ID: 'Memuat data event', EN: 'Loading event' })}<LoadingDots />
        </main>
      </div>
    )
  }

  // Di web, event yang ditutup manual tetap tampil normal dengan penjualan ditutup.
  // Yang benar-benar "selesai" hanya setelah tanggalnya lewat.
  const isFinished = !!event.tanggal && new Date(`${event.tanggal}T00:00:00`).getTime() < nowMs
  const eventPaused = event?.status === 'paused'

  return (
    <div className="bg-white min-h-screen">
      <main className="max-w-6xl mx-auto px-4 py-10">

        {/* HERO SECTION */}
        <div className="flex flex-col lg:flex-row justify-between items-start gap-12 mb-16">
          <div className="lg:w-7/12">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[#0f4eb8] font-bold text-sm uppercase tracking-wide">{t({ ID: 'Tentang Event', EN: 'About the Event' })}</span>
              {isFinished && (
                <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-500">
                  {t({ ID: 'Event Selesai', EN: 'Finished' })}
                </span>
              )}
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-[42px] font-bold text-slate-900 leading-[1.1] mb-6 tracking-tight break-words">
              {event.nama_event}
            </h1>
            <p className="text-slate-600 text-sm leading-[1.8] max-w-xl whitespace-pre-line">
              {event.deskripsi || t({ ID: 'Detail event akan segera diumumkan.', EN: 'Event details coming soon.' })}
            </p>
          </div>
          <div className="lg:w-5/12 flex flex-col gap-3 lg:items-end w-full pt-4">
            {isFinished ? (
              <Link href="/" className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 w-full sm:w-auto lg:w-full max-w-sm text-sm shadow-sm">
                {t({ ID: 'Lihat Event Berikutnya', EN: 'See Next Event' })}
              </Link>
            ) : (
              <Link href="/tiket" className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white px-6 py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 w-full sm:w-auto lg:w-full max-w-sm text-sm shadow-md">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>
                {t({ ID: 'Amankan Tiket Kamu', EN: 'Secure Your Ticket' })}
              </Link>
            )}
            <Link href={isFinished ? '/' : '/merchandise'} className="bg-white border-2 border-indigo-50 hover:border-indigo-100 text-indigo-600 px-6 py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 w-full sm:w-auto lg:w-full max-w-sm text-sm">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
              {isFinished ? t({ ID: 'Kembali ke Beranda', EN: 'Back to Home' }) : t({ ID: 'Koleksi Official Merchandise', EN: 'Official Merchandise Collection' })}
            </Link>
          </div>
        </div>

        {/* POSTER + INFO OVERLAY */}
        <div className="mb-20">
          <div className="rounded-3xl overflow-hidden bg-slate-200 h-[380px] relative">
            <iframe
              title={t({ ID: 'Peta lokasi event', EN: 'Event location map' })}
              src={googleMapsEmbedUrl(event)}
              className="absolute inset-0 h-full w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-slate-100 p-6 flex items-start justify-between">
              <div>
                <h4 className="text-xs uppercase tracking-wide font-bold text-[#0f4eb8] mb-1">{t({ ID: 'Tanggal', EN: 'Date' })}</h4>
                <p className="text-slate-900 font-bold text-sm mb-1">{formatTanggal(event.tanggal)}</p>
                <p className="text-slate-500 text-[11px]">{eventJam(event)} WIB</p>
              </div>
              <div className="text-slate-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-slate-100 p-6 flex items-start justify-between">
              <div>
                <h4 className="text-xs uppercase tracking-wide font-bold text-[#0f4eb8] mb-1">{t({ ID: 'Lokasi', EN: 'Location' })}</h4>
                <p className="text-slate-900 font-bold text-sm mb-1">{event.venue || '-'}</p>
                <p className="text-slate-500 text-[11px]">{event.alamat}</p>
              </div>
              <div className="text-slate-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-slate-100 p-6 flex items-start justify-between">
              <div>
                <h4 className="text-xs uppercase tracking-wide font-bold text-[#0f4eb8] mb-1">{t({ ID: 'Kapasitas', EN: 'Capacity' })}</h4>
                <p className="text-2xl font-bold text-[#0f4eb8] mb-1">{kapasitas ? kapasitas.toLocaleString('id-ID') : t({ ID: '-', EN: '-' })}</p>
                <p className="text-slate-500 text-[11px]">{t({ ID: 'Total stok tiket', EN: 'Total ticket stock' })}</p>
              </div>
              <div className="text-slate-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              </div>
            </div>
          </div>
        </div>

        {/* REKAP KESERUAN — khusus event yang sudah selesai */}
        {isFinished && rekap && (
          <RekapKeseruan tiket={rekap.tiket} merch={rekap.merch} kapasitas={kapasitas} />
        )}

        {/* LINE UP SECTION */}
        <div className="flex flex-col md:flex-row gap-12 lg:gap-20 mb-20 items-center">
          <div className="md:w-5/12">
            <p className="text-[#0f4eb8] font-bold text-xs mb-3 tracking-widest uppercase">{t({ ID: 'Rangkaian Penampil', EN: 'Performers' })}</p>
            <h2 className="text-3xl font-bold text-slate-900 mb-5 leading-tight">{t({ ID: 'Line Up', EN: 'Line Up' })} {event.nama_event}</h2>
            <p className="text-slate-600 text-sm leading-[1.8]">
              {event.deskripsi ||
                t({ ID: 'Pengalaman festival terpadu disusun secara cermat agar setiap penonton dapat menikmati penampilan musik tanpa khawatir bentrok jadwal panggung utama.', EN: 'An integrated festival experience is carefully arranged so every attendee can enjoy musical performances without worrying about main stage schedule clashes.' })}
            </p>
          </div>
          <div className="md:w-7/12 w-full">
            {lineUp.length === 0 ? (
              <div className="bg-[#f4f7fb] rounded-[32px] p-10 text-center text-slate-400 text-sm">
                {t({ ID: 'Line up belum diumumkan.', EN: 'Line up has not been announced yet.' })}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {lineUp.map((artist) => (
                  <div key={artist.id} className="bg-[#f4f7fb] rounded-3xl overflow-hidden border border-slate-100">
                    {artist.gambar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={artist.gambar} alt={artist.nama_band} className="h-28 w-full object-cover" />
                    ) : (
                      <div className="h-28 bg-gradient-to-br from-indigo-900 to-slate-900 flex items-center justify-center text-2xl">🎸</div>
                    )}
                    <div className="p-4">
                      <p className="font-bold text-slate-900 text-sm">{artist.nama_band}</p>
                      {artist.deskripsi && <p className="text-slate-500 text-[10px] mt-1 line-clamp-2">{artist.deskripsi}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* PARTNERS SECTION */}
        <div className="bg-[#f8f9fc] rounded-[32px] p-6 sm:p-8 lg:p-12 mb-20 border border-slate-100">
          <div className="flex flex-col lg:flex-row gap-12 items-center">
            <div className="lg:w-[45%]">
              <p className="text-[#0f4eb8] font-bold text-[10px] mb-3 uppercase tracking-widest">{t({ ID: 'Kolaborasi & Ekosistem Resmi', EN: 'Collaboration & Official Ecosystem' })}</p>
              <h2 className="text-2xl font-bold text-slate-900 mb-5 leading-[1.3]">{t({ ID: 'Bekerja Sama dengan Mitra Unggulan', EN: 'Collaborating with Top Partners' })}</h2>
              <p className="text-slate-600 text-[13px] leading-[1.8]">
                {t({ ID: 'Setiap edisi CoravFest digarap bersama mitra terbaik: produk resmi merch kolaborasi band, tenant kuliner pilihan, serta platform ticketing EncoreTix yang menjamin keaslian 100% tiket dan keamanan transaksi pengguna.', EN: 'Every CoravFest edition is produced with the best partners: official band collaboration merch, curated culinary tenants, and the EncoreTix ticketing platform guaranteeing 100% authentic tickets and secure transactions.' })}
              </p>
            </div>
            <div className="lg:w-[55%] grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
              {PARTNERS.map((partner, i) => (
                <div key={i} className="bg-white rounded-2xl p-5 text-center shadow-[0_2px_10px_rgb(0,0,0,0.02)] border border-slate-100/50 flex flex-col items-center justify-center gap-3">
                  <div className="text-[#0f4eb8] bg-[#f4f7fb] p-3 rounded-xl w-12 h-12 flex items-center justify-center">{partner.icon}</div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-[11px] leading-tight mb-1">{partner.name}</h4>
                    <p className="text-slate-500 text-[10px]">{t({ ID: partner.role, EN: partner.role })}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* EVENT LAIN YANG SUDAH SELESAI */}
        {others.length > 0 && (
          <div className="mb-20">
            <div className="flex items-end justify-between mb-6">
              <div>
                <p className="text-[#0f4eb8] font-bold text-xs mb-2 tracking-widest uppercase">
                  {t({ ID: 'Arsip Edisi Lain', EN: 'Other Archived Editions' })}
                </p>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                  {t({ ID: 'Event Lain yang Sudah Selesai', EN: 'Other Finished Events' })}
                </h2>
                <p className="text-slate-500 text-[13px] mt-1.5">
                  {t({ ID: 'Jelajahi keseruan edisi CoravFest lainnya', EN: 'Explore the excitement of other CoravFest editions' })}
                </p>
              </div>
              <Link
                href="/tentang-event"
                className="hidden sm:inline-flex text-[13px] font-semibold text-[#0f4eb8] hover:underline shrink-0"
              >
                {t({ ID: 'Lihat Semua →', EN: 'View All →' })}
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {others.slice(0, 6).map((ev) => (
                <Link
                  key={ev.id}
                  href={`/tentang-event/${ev.id}`}
                  className="group rounded-2xl overflow-hidden border border-slate-100 bg-white shadow-sm hover:shadow-md hover:border-slate-300 transition-all"
                >
                  <div className="relative h-40">
                    {ev.gambar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={ev.gambar} alt={ev.nama_event} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-800 flex items-center justify-center text-4xl">🎪</div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4">
                      <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/15 backdrop-blur border border-white/25 text-white mb-1.5">
                        {t({ ID: 'Selesai', EN: 'Finished' })}
                      </span>
                      <h3 className="text-base font-bold text-white drop-shadow line-clamp-1">{ev.nama_event}</h3>
                      <p className="text-[11px] text-gray-200 mt-0.5 line-clamp-1">
                        {formatTanggal(ev.tanggal)}
                        {[ev.venue, ev.alamat].filter(Boolean).join(', ') ? ` · ${[ev.venue, ev.alamat].filter(Boolean).join(', ')}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="px-4 py-3 flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-slate-700">{t({ ID: 'Lihat Detail', EN: 'View Detail' })}</span>
                    <span className="text-slate-400 transition-transform duration-300 group-hover:translate-x-1">→</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* CTA SECTION */}
        <div className="bg-[#0f4eb8] rounded-[32px] p-6 sm:p-10 lg:p-14 relative overflow-hidden shadow-xl shadow-blue-900/10">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[500px] h-[500px] rounded-full bg-white/5 blur-3xl" />
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-[400px] h-[400px] rounded-full bg-blue-400/20 blur-3xl" />

          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-white text-[11px] font-semibold mb-8 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-300 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-300" />
              </span>
              {eventPaused
                ? t({ ID: 'Event Dijeda Sebentar', EN: 'Event Temporarily Paused' })
                : isFinished
                ? t({ ID: 'Edisi ini telah selesai & tersimpan', EN: 'This edition has finished & is archived' })
                : salesClosed
                  ? t({ ID: 'Penjualan Tiket Ditutup', EN: 'Ticket Sales Closed' })
                  : t({ ID: 'Penjualan Tiket Sedang Berlangsung!', EN: 'Ticket Sales Are Now Ongoing!' })}
            </div>

            <h2 className="text-3xl lg:text-[40px] font-bold text-white mb-6 leading-[1.2] tracking-tight">
              {isFinished
                ? t({ ID: 'Terima Kasih Sudah Menjadi', EN: 'Thank You for Being Part of' })
                : t({ ID: 'Jadilah Bagian dari Sejarah Pesta', EN: 'Be Part of the Festival History' })}
              <br className="hidden lg:block" />
              {isFinished
                ? t({ ID: 'Bagian dari Sejarah Kami', EN: 'Our History' })
                : t({ ID: 'Musik Terbesar Tahun Ini', EN: 'Biggest Music of the Year' })}
            </h2>

            {eventPaused && (
              <p className="text-amber-100 text-sm mb-4 max-w-2xl">
                {t({ ID: 'Event ini masih dijeda sebentar. Pemesanan belum dibuka.', EN: 'This event is temporarily paused. Ticketing is not open yet.' })}
              </p>
            )}

            <p className="text-blue-100 text-sm mb-10 max-w-2xl leading-[1.8]">
              {isFinished
                ? t({ ID: 'Semua data penjualan tiket dan merchandise edisi ini telah dikunci permanen. Terima kasih atas dukungannya, sampai jumpa di edisi berikutnya!', EN: 'All ticket & merchandise data for this edition has been permanently locked. Thank you for your support — see you at the next edition!' })
                : t({ ID: 'Jangan lewatkan kesempatan Anda untuk menikmati perayaan musik tak terlupakan bersama puluhan ribu penikmat musik lainnya.', EN: "Don't miss your chance to enjoy an unforgettable music celebration with tens of thousands of music lovers." })}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-12">
              <Link href={isFinished ? '/' : '/tiket'} className="bg-white hover:bg-indigo-50 text-indigo-600 px-8 py-3.5 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 text-sm">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                {isFinished
                  ? t({ ID: 'Kembali ke Beranda', EN: 'Back to Home' })
                  : eventPaused || salesClosed
                    ? t({ ID: 'Lihat Tiket', EN: 'View Tickets' })
                    : t({ ID: 'Beli Tiket Sekarang', EN: 'Buy Tickets Now' })}
              </Link>
              {!isFinished && (
                <Link href="/merchandise" className="bg-transparent hover:bg-white/10 border border-white/30 text-white px-8 py-3.5 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 backdrop-blur-sm text-sm">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                  {t({ ID: 'Lihat Merchandise Resmi', EN: 'View Official Merchandise' })}
                </Link>
              )}
            </div>
          </div>
        </div>

      </main>
    </div>
  )
}