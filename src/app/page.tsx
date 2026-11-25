'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Bebas_Neue } from 'next/font/google'
import { useLang } from '@/lib/i18n'
import AutoScrollTrack from '@/components/AutoScrollTrack'
import StickyBottomBar from '@/components/StickyBottomBar'

const bebasNeue = Bebas_Neue({ weight: '400', subsets: ['latin'] })

interface EventData {
  id: string
  nama_event: string
  tanggal: string | null
  waktu: string | null
  venue: string | null
  alamat: string | null
  deskripsi: string | null
  syarat_ketentuan: string | null
  gambar: string | null
  status: string
}

interface Countdown {
  hari: number
  jam: number
  menit: number
  detik: number
}

const ZERO_COUNTDOWN: Countdown = { hari: 0, jam: 0, menit: 0, detik: 0 }

function computeCountdown(target: Date): Countdown {
  const diff = Math.max(0, target.getTime() - Date.now())
  return {
    hari: Math.floor(diff / 86400000),
    jam: Math.floor((diff / 3600000) % 24),
    menit: Math.floor((diff / 60000) % 60),
    detik: Math.floor((diff / 1000) % 60),
  }
}

function Countdown({ target }: { target: Date | null }) {
  const { t } = useLang()
  const [c, setC] = useState<Countdown>(ZERO_COUNTDOWN)

  useEffect(() => {
    if (!target) return
    const id = setInterval(() => setC(computeCountdown(target)), 1000)
    return () => clearInterval(id)
  }, [target])

  if (!target) return null

  return (
    <div className="flex gap-1.5 sm:gap-2 md:gap-3 text-center text-white">
      {[
        [t({ ID: 'Hari', EN: 'Days' }), c.hari],
        [t({ ID: 'Jam', EN: 'Hours' }), c.jam],
        [t({ ID: 'Menit', EN: 'Minutes' }), c.menit],
        [t({ ID: 'Detik', EN: 'Seconds' }), c.detik],
      ].map(([label, val]) => (
        <div key={String(label)} className="bg-white/10 backdrop-blur-md border border-white/20 rounded-lg sm:rounded-xl px-2 py-1.5 md:px-3 md:py-2 min-w-[46px] sm:min-w-[54px] md:min-w-[60px] shadow-lg shadow-black/20">
          <div className="text-sm sm:text-base md:text-xl font-bold tabular-nums leading-none">{String(val).padStart(2, '0')}</div>
          <div className="text-[8px] sm:text-[9px] md:text-[10px] uppercase tracking-widest text-indigo-200 mt-1">{String(label)}</div>
        </div>
      ))}
    </div>
  )
}

const TABS = ['Deskripsi', 'Line Up', 'Syarat & Ketentuan'] as const
type Tab = (typeof TABS)[number]

const TABS_ID: Record<Tab, { ID: string; EN: string }> = {
  Deskripsi: { ID: 'Deskripsi', EN: 'Description' },
  'Line Up': { ID: 'Line Up', EN: 'Line Up' },
  'Syarat & Ketentuan': { ID: 'Syarat & Ketentuan', EN: 'Terms & Conditions' },
}

interface LineUpBand {
  id: string
  nama_band: string
  deskripsi: string | null
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

function eventLokasi(e: EventData) {
  return [e.venue, e.alamat].filter(Boolean).join(', ')
}

function eventJam(e: EventData) {
  return e.waktu || ''
}

export default function Home() {
  const { t } = useLang()
  const [activeTab, setActiveTab] = useState<Tab>('Deskripsi')
  const [showExpiredToast, setShowExpiredToast] = useState(false)
  const [lineUp, setLineUp] = useState<LineUpBand[]>([])
  const [selectedBand, setSelectedBand] = useState<LineUpBand | null>(null)
  const [minTicketPrice, setMinTicketPrice] = useState<number | null>(null)
  const [event, setEvent] = useState<EventData | null>(null)
  const [salesClosed, setSalesClosed] = useState(false)
  const [finished, setFinished] = useState<EventData[]>([])

  useEffect(() => {
    fetch('/api/events?active=true')
      .then((r) => r.json())
      .then((res) => {
        if (!res.error && res.data) setEvent(res.data)
      })
      .catch(() => {})

    fetch('/api/events?finished=true')
      .then((r) => r.json())
      .then((res) => {
        if (!res.error) setFinished(res.data || [])
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!event) return
    fetch(`/api/bands?event=${encodeURIComponent(event.id)}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.error) throw new Error(res.error)
        setLineUp(res.data || [])
      })
      .catch(() => setLineUp([]))
  }, [event])

  useEffect(() => {
    fetch('/api/tickets')
      .then((r) => r.json())
      .then((res) => {
        const rows = res.data && !res.error ? (res.data as { harga: number; status?: string | null }[]) : []
        setSalesClosed(!!res.sales_closed)
        const aktif = rows.filter((tk) => (tk.status ?? 'aktif') === 'aktif')
        if (aktif.length > 0) {
          setMinTicketPrice(Math.min(...aktif.map((tk) => Number(tk.harga))))
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!window.location.search.includes('waktu=habis')) return
    const t = setTimeout(() => {
      setShowExpiredToast(true)
      window.history.replaceState(null, '', '/')
    }, 0)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!showExpiredToast) return
    const id = setTimeout(() => setShowExpiredToast(false), 7000)
    return () => clearTimeout(id)
  }, [showExpiredToast])

  // Fungsi untuk smooth scroll ke section yang dituju
  const scrollToSection = (tab: Tab) => {
    setActiveTab(tab)
    let elementId = ''
    if (tab === 'Deskripsi') elementId = 'section-deskripsi'
    if (tab === 'Syarat & Ketentuan') elementId = 'section-syarat'
    if (tab === 'Line Up') elementId = 'section-lineup'

    const element = document.getElementById(elementId)
    if (element) {
      // Memberikan jarak sedikit dari atas layar saat di-scroll
      const yOffset = -20 
      const y = element.getBoundingClientRect().top + window.scrollY + yOffset
      window.scrollTo({ top: y, behavior: 'smooth' })
    }
  }

  const noEventText = t({ ID: 'Belum ada event yang berlangsung', EN: 'No ongoing event' })
  const heroTitle = event?.nama_event || t({ ID: 'Event Segera Diumumkan', EN: 'Upcoming Event Announcement' })
  const heroSubtitle = event
    ? [event.tanggal ? formatTanggal(event.tanggal) : '', eventLokasi(event), eventJam(event)]
        .filter(Boolean)
        .join(' | ')
    : t({ ID: 'Event berikutnya segera diumumkan', EN: 'Next event coming soon' })
  const countdownTarget = event?.tanggal ? new Date(`${event.tanggal}T00:00:00`) : null

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {showExpiredToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-md w-[calc(100%-2rem)]">
          <div className="flex items-start gap-3 bg-white border border-red-200 shadow-lg rounded-2xl px-4 py-3.5">
            <div>
              <p className="text-sm font-semibold text-gray-900">{t({ ID: 'Waktu Habis', EN: 'Time is Up' })}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {t({ ID: 'Waktu isi data & pembayaran kamu telah habis. Silakan mulai pemesanan ulang.', EN: 'Your time to fill in the data & payment has run out. Please start a new booking.' })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowExpiredToast(false)}
              aria-label="Tutup notifikasi"
              className="text-gray-400 hover:text-gray-600 text-sm cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      {/* Hero */}
      <div className="relative rounded-3xl overflow-hidden min-h-[300px] md:h-[420px] flex shadow-2xl shadow-indigo-950/30">
        {event?.gambar ? (
          <Image
            src={event.gambar}
            alt={heroTitle}
            fill
            priority
            sizes="(max-width: 1184px) calc(100vw - 32px), 1152px"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-slate-900 to-violet-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/25" />
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-950/50 via-transparent to-transparent" />
        {/* Glow dekoratif */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-600/30 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute bottom-0 -left-20 w-72 h-72 bg-violet-600/20 blur-3xl rounded-full pointer-events-none" />

        <div className="relative mt-auto w-full p-5 sm:p-6 md:p-10 flex flex-col md:flex-row md:items-end gap-4 sm:gap-6 justify-between">
          <div className="max-w-2xl">
            {/* Badge status */}
            {event && salesClosed ? (
              <span className="inline-flex items-center gap-2 text-[10px] sm:text-[11px] font-semibold tracking-widest uppercase text-amber-200 bg-amber-400/15 backdrop-blur-md border border-amber-300/30 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full mb-3">
                {t({ ID: 'Penjualan Ditutup', EN: 'Sales Closed' })}
              </span>
            ) : event ? (
              <span className="inline-flex items-center gap-2 text-[10px] sm:text-[11px] font-semibold tracking-widest uppercase text-emerald-200 bg-emerald-400/15 backdrop-blur-md border border-emerald-300/30 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full mb-3">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-300" />
                </span>
                {t({ ID: 'Tiket Tersedia', EN: 'Tickets Available' })}
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 text-[10px] sm:text-[11px] font-semibold tracking-widest uppercase text-amber-200 bg-amber-400/15 backdrop-blur-md border border-amber-300/30 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full mb-3">
                {t({ ID: 'Segera Diumumkan', EN: 'Coming Soon' })}
              </span>
            )}

            <h1 className={`${bebasNeue.className} text-3xl sm:text-5xl md:text-7xl text-white tracking-wide leading-[0.95] drop-shadow-lg break-words`}>
              {heroTitle}
            </h1>

            {/* Chip info tanggal / venue / jam */}
            {event && (
              <>
                <p className="sm:hidden mt-3 text-[11px] leading-relaxed text-white/85">
                  {[event.tanggal ? formatTanggal(event.tanggal) : '', eventLokasi(event), eventJam(event)]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <div className="hidden sm:flex flex-wrap items-center gap-1.5 sm:gap-2 mt-3">
                {event.tanggal && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs text-white bg-white/10 backdrop-blur-md border border-white/20 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full">
                    <svg className="w-3.5 h-3.5 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {formatTanggal(event.tanggal)}
                  </span>
                )}
                {eventLokasi(event) && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs text-white bg-white/10 backdrop-blur-md border border-white/20 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full">
                    <svg className="w-3.5 h-3.5 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {eventLokasi(event)}
                  </span>
                )}
                {eventJam(event) && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs text-white bg-white/10 backdrop-blur-md border border-white/20 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full">
                    <svg className="w-3.5 h-3.5 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {eventJam(event)}
                  </span>
                )}
                </div>
              </>
            )}
            {!event && (
              <p className="text-sm text-gray-300 mt-4">{heroSubtitle}</p>
            )}

            {/* CTA */}
            {event && (
              <div className="hidden sm:flex flex-wrap items-center gap-2.5 sm:gap-3 mt-5">
                {salesClosed ? (
                  <Link
                    href="/tiket"
                    className="inline-flex items-center gap-2 bg-white/10 border border-white/30 text-white text-sm font-semibold px-5 py-3 sm:px-7 sm:py-3.5 rounded-full transition-all hover:bg-white/15"
                  >
                    {t({ ID: 'Penjualan Tiket Ditutup', EN: 'Ticket Sales Closed' })}
                  </Link>
                ) : (
                  <Link
                    href="/tiket"
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-bold px-5 py-3 sm:px-7 sm:py-3.5 rounded-full transition-all shadow-lg shadow-indigo-950/50 hover:shadow-indigo-900/60 hover:-translate-y-0.5"
                  >
                    {t({ ID: 'Beli Tiket Sekarang', EN: 'Buy Tickets Now' })}
                    <span aria-hidden>→</span>
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => scrollToSection('Line Up')}
                  className="hidden sm:inline-flex items-center gap-2 text-white text-sm font-semibold px-7 py-3.5 rounded-full border border-white/30 bg-white/5 backdrop-blur-md hover:bg-white/15 transition-all cursor-pointer"
                >
                  {t({ ID: 'Lihat Line Up', EN: 'View Line Up' })}
                </button>
              </div>
            )}
          </div>

          <div className="shrink-0">
            <p className="hidden sm:block text-[10px] font-semibold tracking-[0.25em] uppercase text-indigo-200 mb-2">
              {t({ ID: 'Menghitung mundur', EN: 'Counting down' })}
            </p>
            <Countdown target={countdownTarget} />
          </div>
        </div>
      </div>

      {/* Content + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10 mt-8 sm:mt-10">
        <div className="lg:col-span-2">
          
          {/* TABS Navigation */}
          <div className="flex gap-4 sm:gap-6 border-b border-gray-200 overflow-x-auto no-scrollbar">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => scrollToSection(tab)}
                className={`pb-2.5 sm:pb-3 text-[13px] sm:text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                {t(TABS_ID[tab])}
              </button>
            ))}
          </div>

          {/* ALL CONTENT RENDERED BELOW */}
          <div className="mt-5 sm:mt-6 space-y-8 sm:space-y-12 pb-10 sm:pb-12">
            
            {/* Section Deskripsi */}
            <div id="section-deskripsi" className="space-y-5 text-[15px] sm:text-base text-gray-600 leading-[1.75] sm:leading-[1.8] scroll-mt-6">
              {event?.deskripsi ? (
                <p className="whitespace-pre-line">{event.deskripsi}</p>
              ) : (
                <p className="text-gray-400">
                  {event
                    ? t({ ID: 'Belum ada deskripsi event.', EN: 'No event description yet.' })
                    : noEventText}
                </p>
              )}
            </div>

            <hr className="border-gray-100" />

            {/* Section Line Up */}
            <div id="section-lineup" className="scroll-mt-6">
              <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-3 sm:mb-4">{t({ ID: 'Line Up', EN: 'Line Up' })}</h3>
              {!event ? (
                <p className="text-sm text-gray-400">{noEventText}</p>
              ) : lineUp.length === 0 ? (
                <p className="text-sm text-gray-400">{t({ ID: 'Line up belum diumumkan.', EN: 'Line up has not been announced yet.' })}</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {lineUp.map((artist) => (
                    <button
                      key={artist.id}
                      onClick={() => setSelectedBand(artist)}
                      className="text-left rounded-xl overflow-hidden border border-gray-100 pb-3 bg-white shadow-sm hover:border-gray-300 hover:shadow-md transition-all cursor-pointer"
                    >
                      {artist.gambar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={artist.gambar} alt={artist.nama_band} className="h-32 w-full object-cover" />
                      ) : (
                        <div className="h-32 bg-gradient-to-br from-indigo-900 to-slate-900 flex items-center justify-center text-3xl">🎸</div>
                      )}
                      <p className="text-sm font-medium text-gray-900 mt-3 px-3 text-center">{artist.nama_band}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <hr className="border-gray-100" />

            {/* Section Syarat & Ketentuan */}
            <div id="section-syarat" className="scroll-mt-6">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">
                {t({ ID: 'Syarat dan Ketentuan', EN: 'Terms and Conditions' })}
              </h2>

              {event?.syarat_ketentuan ? (
                <div className="space-y-3 sm:space-y-4 text-[15px] sm:text-base text-gray-600">
                  {event.syarat_ketentuan.split('\n').filter((s) => s.trim()).map((s, i) => (
                    <p key={i} className="pl-5">{i + 1}. {s}</p>
                  ))}
                </div>
              ) : (
                <p className="text-base text-gray-400">
                  {event
                    ? t({ ID: 'Belum ada syarat & ketentuan.', EN: 'No terms & conditions yet.' })
                    : noEventText}
                </p>
              )}
            </div>

          </div>
        </div>

        {/* Sidebar — disembunyikan di HP karena hero + sticky bar sudah punya info & CTA */}
        <div className="hidden lg:block lg:col-span-1">
          <div className="lg:sticky lg:top-20 space-y-4">
            <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="relative h-40 w-full">
              {event?.gambar ? (
                <Image
                  src={event.gambar}
                  alt={`Poster ${heroTitle}`}
                  fill
                  sizes="(max-width: 1024px) 100vw, 33vw"
                  className="object-cover"
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-indigo-950 via-slate-900 to-violet-950" />
              )}
            </div>

            <div className="p-4 sm:p-5">
              <span className="inline-block bg-gray-100 text-gray-600 text-xs font-medium px-2.5 py-1 rounded-full mb-3">
                {heroTitle}
              </span>

              {/* Media sosial */}
              <div className="border-t border-gray-200 pt-4 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    {t({ ID: 'Media sosial', EN: 'Social media' })}
                  </span>

                  <div className="flex items-center gap-3">
                    {/* Instagram */}
                    <a
                      href="#"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Instagram"
                      className="w-7 h-7 rounded-md flex items-center justify-center bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 hover:opacity-80 transition"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="w-4 h-4 text-white"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <rect x="3" y="3" width="18" height="18" rx="5" />
                        <circle cx="12" cy="12" r="4" />
                        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                      </svg>
                    </a>

                    {/* TikTok */}
                    <a
                      href="#"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="TikTok"
                      className="w-7 h-7 rounded-md flex items-center justify-center bg-[#111827] hover:opacity-80 transition"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="w-4 h-4 text-white"
                        fill="currentColor"
                      >
                        <path d="M19.5 8.2a5.7 5.7 0 0 1-3.4-1.1v7.2a5.7 5.7 0 1 1-4.9-5.6v2.9a2.8 2.8 0 1 0 2 2.7V3h2.9c.2 1.7 1.5 3 3.4 3.2v2z" />
                      </svg>
                    </a>
                  </div>
                </div>
              </div>

              {/* Mulai dari */}
              {event && (
                <>
                  <p className="text-xs text-gray-500 mb-1">{t({ ID: 'Mulai dari', EN: 'Starting from' })}</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">
                    {minTicketPrice == null ? 'Rp ...' : 'Rp ' + minTicketPrice.toLocaleString('id-ID')}
                  </p>

                  <Link
                    href="/tiket"
                    className="block text-center bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-bold py-3 rounded-xl transition-all shadow-md shadow-indigo-950/20"
                  >
                    {t({ ID: 'Pilih Tiket →', EN: 'Choose Ticket →' })}
                  </Link>

                  <p className="text-[11px] text-gray-400 mt-2 text-center">
                    {t({ ID: 'Harga belum termasuk admin fee', EN: 'Price excludes admin fee' })}
                  </p>
                </>
              )}
            </div>
          </div>
          </div>
        </div>
      </div>

      {/* Section Event Sebelumnya */}
      {finished.length > 0 && (
        <div className="mt-12 sm:mt-16">
          <div className="flex items-end justify-between mb-4 sm:mb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                {t({ ID: 'Event Sebelumnya', EN: 'Previous Events' })}
              </h2>
              <p className="hidden sm:block text-sm text-gray-500 mt-1">
                {t({ ID: 'Rekap edisi CoravFest yang sudah selesai', EN: 'Recap of previous CoravFest editions' })}
              </p>
            </div>
          </div>

          <AutoScrollTrack className="gap-6">
            {finished.map((ev) => (
              <Link
                key={ev.id}
                href={`/tentang-event/${ev.id}`}
                className="group w-72 sm:w-80 shrink-0 rounded-2xl overflow-hidden border border-gray-100 bg-white shadow-sm hover:shadow-md hover:border-gray-300 transition-all"
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
                      {[ev.venue, ev.alamat].some(Boolean) ? ` · ${eventLokasi(ev)}` : ''}
                    </p>
                  </div>
                </div>
                <div className="p-4 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">{t({ ID: 'Lihat Detail', EN: 'View Detail' })}</span>
                  <span className="text-gray-400 transition-transform duration-300 group-hover:translate-x-1">→</span>
                </div>
              </Link>
            ))}
          </AutoScrollTrack>
        </div>
      )}

      {/* Overlay (di bawah navbar) */}
      <div
        aria-hidden={!selectedBand}
        onClick={() => setSelectedBand(null)}
        className={`fixed top-16 inset-x-0 bottom-0 z-40 bg-gray-950/50 backdrop-blur-sm transition-opacity duration-300 ${
          selectedBand ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Side panel detail band (di bawah navbar) */}
      <aside
        role="dialog"
        aria-modal="true"
        className={`fixed top-16 right-0 bottom-0 z-50 w-96 max-w-[85vw] transition-transform duration-500 ease-out ${
          selectedBand ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {selectedBand && (
          <div className="h-full bg-white dark:bg-gray-900 shadow-2xl overflow-hidden flex flex-col rounded-l-2xl border-l border-gray-100 dark:border-gray-800">
            {/* Header image */}
            <div className="relative h-56 shrink-0">
              {selectedBand.gambar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selectedBand.gambar} alt={selectedBand.nama_band} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-800 flex items-center justify-center text-6xl">🎸</div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10" />

              <button
                onClick={() => setSelectedBand(null)}
                aria-label="Tutup detail band"
                className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-white/20 backdrop-blur border border-white/30 text-white text-sm flex items-center justify-center hover:bg-white/35 transition-colors cursor-pointer"
              >
                ✕
              </button>

              <div className="absolute bottom-0 left-0 right-0 p-6">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-widest uppercase text-indigo-200 bg-white/10 backdrop-blur border border-white/20 px-2.5 py-1 rounded-full mb-2.5">
                  🎵 {t({ ID: 'Line Up', EN: 'Line Up' })}
                </span>
                <h3 className="text-2xl font-bold text-white">{selectedBand.nama_band}</h3>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto flex-1 min-h-0">
              <div className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-widest font-semibold mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                {t({ ID: 'Tentang Band', EN: 'About the Band' })}
                <span className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                {selectedBand.deskripsi || t({ ID: 'Belum ada deskripsi band.', EN: 'No band description yet.' })}
              </p>
            </div>
          </div>
        )}
      </aside>

      {/* Sticky bottom CTA bar — hanya di HP */}
      {event && (
        <StickyBottomBar
          label={salesClosed ? t({ ID: 'Penjualan ditutup', EN: 'Sales closed' }) : t({ ID: 'Mulai dari', EN: 'Starting from' })}
          value={salesClosed ? '-' : minTicketPrice == null ? 'Rp ...' : 'Rp ' + minTicketPrice.toLocaleString('id-ID')}
        >
          <Link
            href="/tiket"
            className="inline-flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-bold px-6 py-3 rounded-full shadow-md shadow-indigo-950/20"
          >
            {salesClosed ? t({ ID: 'Lihat Tiket', EN: 'View Tickets' }) : t({ ID: 'Beli Tiket', EN: 'Buy Ticket' })}
            <span aria-hidden>→</span>
          </Link>
        </StickyBottomBar>
      )}
    </div>
  )
}