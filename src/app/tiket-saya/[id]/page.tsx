'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import RealQR from '@/components/RealQR'
import LoadingSpinner from '@/components/LoadingSpinner'
import { useLang } from '@/lib/i18n'
import { friendlyError } from '@/app/lib/fetchError'

interface TicketHolder {
  ticketId: string
  categoryType: string
  categoryName: string
  name: string
  jenisIdentitas: string
  ktp: string
  gender: string
  age: number | null
  email: string
  whatsapp: string
}

interface EventInfo {
  nama_event: string
  tanggal: string
  jam: string
  lokasi: string
  gambar: string
}

const DEFAULT_EVENT: EventInfo = {
  nama_event: 'CoravFest',
  tanggal: '-',
  jam: '-',
  lokasi: '-',
  gambar: '/coravfest.jpg',
}

function formatEventDate(iso: string | null): string {
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

interface PesananData {
  booking_id: string
  jumlah: number
  status_bayar: string
  customers: {
    nama: string
    email: string
    no_hp: string | null
    usia: number | null
    no_identitas: string | null
    jenis_identitas: string | null
    jenis_kelamin: string | null
  } | null
  tiket: { kategori: string; harga: number } | null
  pemilik_tiket?: Array<{
    nama: string | null
    email: string | null
    no_hp: string | null
    usia: number | null
    no_identitas: string | null
    jenis_identitas: string | null
    jenis_kelamin: string | null
  }> | null
}

function QRCodeVisual({ value }: { value: string }) {
  return (
    <div className="w-56 h-56 sm:w-64 sm:h-64 border border-gray-100 rounded-2xl p-3 bg-white flex items-center justify-center shadow-xs">
      <RealQR value={value} size={224} className="w-full h-full" />
    </div>
  )
}

export default function TiketDetailPage() {
  const { t } = useLang()
  const params = useParams()
  const router = useRouter()
  const bookingCode = (params?.id as string)?.toUpperCase() || ''

  const [booking, setBooking] = useState<PesananData | null>(null)
  const [eventInfo, setEventInfo] = useState<EventInfo>(DEFAULT_EVENT)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    fetch('/api/events?active=true')
      .then((r) => r.json())
      .then((res) => {
        const ev = res.data
        if (!ev) return
        setEventInfo({
          nama_event: ev.nama_event || DEFAULT_EVENT.nama_event,
          tanggal: formatEventDate(ev.tanggal),
          jam: ev.waktu || '-',
          lokasi: [ev.venue, ev.alamat].filter(Boolean).join(', ') || '-',
          gambar: ev.gambar || DEFAULT_EVENT.gambar,
        })
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!bookingCode) return
    fetch(`/api/transactions/${encodeURIComponent(bookingCode)}`)
      .then((r) => r.json())
      .then((pesananRes) => {
        if (pesananRes.error) throw new Error(pesananRes.error)
        setBooking(pesananRes.data)
      })
      .catch((e) => setError(friendlyError(e)))
      .finally(() => setLoading(false))
  }, [bookingCode])

  const cust = booking?.customers
  const totalTickets = booking?.jumlah || 1

  const tickets: TicketHolder[] = booking
    ? Array.from({ length: totalTickets }, (_, i) => {
        const holder = booking.pemilik_tiket?.[i] ?? null
        return {
          ticketId: `${booking.booking_id}-${i + 1}`,
          categoryType: 'REGULER',
          categoryName: (booking.tiket?.kategori || 'TIKET').toUpperCase(),
          name: holder?.nama || cust?.nama || '-',
          jenisIdentitas: holder?.jenis_identitas || cust?.jenis_identitas || 'KTP',
          ktp: holder?.no_identitas || cust?.no_identitas || '-',
          gender: holder?.jenis_kelamin || cust?.jenis_kelamin || '-',
          age: holder?.usia ?? cust?.usia ?? null,
          email: holder?.email || cust?.email || '-',
          whatsapp: holder?.no_hp || cust?.no_hp || '-',
        }
      })
    : []

  const currentTicket = tickets[currentIndex] || tickets[0]

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1)
  }

  const handleNext = () => {
    if (currentIndex < totalTickets - 1) setCurrentIndex(currentIndex + 1)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner label={t({ ID: 'Mencari tiket kamu...', EN: 'Finding your ticket...' })} />
      </div>
    )
  }

  if (error || !booking || !currentTicket) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-4">
        <p className="text-red-500 text-sm font-medium">{error}</p>
        <button onClick={() => router.push('/tiket-saya')} className="text-xs text-blue-600 underline">
          {t({ ID: 'Kembali ke Tiket Saya', EN: 'Back to My Tickets' })}
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950 py-10 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Top Navbar Header */}
        <div className="flex items-center justify-end mb-6">
          <button
            onClick={() => router.push('/tiket-saya')}
            className="inline-flex items-center gap-2 border border-blue-200 dark:border-blue-900 bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-xs sm:text-sm font-semibold px-4 py-2 rounded-xl transition-colors cursor-pointer shadow-xs"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2.2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75"
              />
            </svg>
            <span>{t({ ID: 'Keluar', EN: 'Exit' })}</span>
          </button>
        </div>

        {/* Event Header Banner Card */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden shadow-xs mb-6">
          <div className="relative h-48 sm:h-64 md:h-72 w-full bg-slate-950 overflow-hidden">
            <Image
              src={eventInfo.gambar}
              alt={eventInfo.nama_event}
              fill
              priority
              className="object-cover object-center opacity-90"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

            <div className="absolute bottom-5 left-5 sm:left-8">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white drop-shadow-md tracking-tight">
                {eventInfo.nama_event}
              </h1>
            </div>
          </div>

          <div className="px-5 sm:px-8 py-3.5 sm:py-4 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3 sm:gap-6 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
            <div className="flex items-center gap-1">
              <span className="font-medium">{eventInfo.tanggal}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-medium">{eventInfo.jam}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-medium">{eventInfo.lokasi}</span>
            </div>
          </div>
        </div>

        {/* Ticket Pagination Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4 px-1">
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">
            {t({ ID: 'Tiket', EN: 'Ticket' })} <strong className="text-gray-900 dark:text-white font-bold">{currentIndex + 1}</strong> {t({ ID: 'dari', EN: 'of' })}{' '}
            <strong className="text-gray-900 dark:text-white font-bold">{totalTickets}</strong> · {t({ ID: 'geser atau pakai tombol panah', EN: 'swipe or use arrow buttons' })}
          </p>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              aria-label={t({ ID: 'Tiket Sebelumnya', EN: 'Previous Ticket' })}
              className="w-8 h-8 rounded-lg border border-blue-200 dark:border-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
            <button
              onClick={handleNext}
              disabled={currentIndex === totalTickets - 1}
              aria-label={t({ ID: 'Tiket Berikutnya', EN: 'Next Ticket' })}
              className="w-8 h-8 rounded-lg border border-blue-200 dark:border-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        </div>

        {/* Main 2-Column Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          <div className="md:col-span-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-8 flex flex-col items-center shadow-xs">
            <div className="text-center mb-6">
              <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 tracking-wider uppercase">
                {currentTicket.categoryType}
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight mt-0.5">
                {currentTicket.categoryName}
              </h2>
            </div>

            <div className="mb-3">
              <QRCodeVisual value={`ENCORETIX:${currentTicket.ticketId}`} />
            </div>

            <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center mb-4">
              {t({ ID: 'Tunjukkan QR code ini kepada petugas saat masuk venue.', EN: 'Show this QR code to staff when entering the venue.' })}
            </p>

            <div className="text-center mb-6">
              <p className="text-[10px] font-bold tracking-wider text-gray-400 dark:text-gray-500 uppercase">
                {t({ ID: 'TIKET ID', EN: 'TICKET ID' })}
              </p>
              <p className="text-xs sm:text-sm font-mono font-bold text-gray-800 dark:text-gray-200 tracking-wide mt-0.5">
                {currentTicket.ticketId}
              </p>
            </div>

            <div className="w-full space-y-2.5">
              <a
                href={`/api/tickets/pdf/${encodeURIComponent(currentTicket.ticketId)}`}
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-xs sm:text-sm transition-colors shadow-xs cursor-pointer active:scale-[0.99]"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="2.2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
                  />
                </svg>
                <span>{t({ ID: 'Download Tiket (PDF)', EN: 'Download Ticket (PDF)' })}</span>
              </a>
            </div>
          </div>

          <div className="md:col-span-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-7 shadow-xs">
            <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
              {t({ ID: 'Data Pemegang Tiket', EN: 'Ticket Holder Information' })}
            </h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 mb-5">
              {t({ ID: 'Pastikan data cocok dengan identitas saat masuk venue.', EN: 'Make sure your data matches your identity when entering the venue.' })}
            </p>

            <div className="bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 rounded-2xl p-4 mb-6">
              <p className="text-[10px] font-bold tracking-wider text-blue-600 dark:text-blue-400 uppercase">
                BOOKING ID
              </p>
              <p className="text-lg sm:text-xl font-mono font-black text-blue-950 dark:text-blue-200 tracking-tight mt-0.5">
                {booking.booking_id}
              </p>
            </div>

            <div className="space-y-3.5 text-xs sm:text-sm">
              <div className="flex items-center justify-between gap-3 py-1 border-b border-gray-100 dark:border-gray-800 [&>span:last-child]:text-right [&>span:last-child]:min-w-0 [&>span:last-child]:break-words">
                <span className="text-gray-500 dark:text-gray-400">{t({ ID: 'Nama Lengkap', EN: 'Full Name' })}</span>
                <span className="font-semibold text-gray-900 dark:text-white">{currentTicket.name}</span>
              </div>

              <div className="flex items-center justify-between gap-3 py-1 border-b border-gray-100 dark:border-gray-800 [&>span:last-child]:text-right [&>span:last-child]:min-w-0 [&>span:last-child]:break-words">
                <span className="text-gray-500 dark:text-gray-400">{t({ ID: 'No. Identitas', EN: 'Identity No.' })} ({currentTicket.jenisIdentitas})</span>
                <span className="font-semibold text-gray-900 dark:text-white font-mono">{currentTicket.ktp}</span>
              </div>

              <div className="flex items-center justify-between gap-3 py-1 border-b border-gray-100 dark:border-gray-800 [&>span:last-child]:text-right [&>span:last-child]:min-w-0 [&>span:last-child]:break-words">
                <span className="text-gray-500 dark:text-gray-400">{t({ ID: 'Jenis Kelamin', EN: 'Gender' })}</span>
                <span className="font-semibold text-gray-900 dark:text-white">{currentTicket.gender}</span>
              </div>

              <div className="flex items-center justify-between gap-3 py-1 border-b border-gray-100 dark:border-gray-800 [&>span:last-child]:text-right [&>span:last-child]:min-w-0 [&>span:last-child]:break-words">
                <span className="text-gray-500 dark:text-gray-400">{t({ ID: 'Usia', EN: 'Age' })}</span>
                <span className="font-semibold text-gray-900 dark:text-white">{currentTicket.age}</span>
              </div>

              <div className="flex items-center justify-between gap-3 py-1 border-b border-gray-100 dark:border-gray-800 [&>span:last-child]:text-right [&>span:last-child]:min-w-0 [&>span:last-child]:break-words">
                <span className="text-gray-500 dark:text-gray-400">{t({ ID: 'Email', EN: 'Email' })}</span>
                <span className="font-semibold text-gray-900 dark:text-white truncate max-w-[200px]">
                  {currentTicket.email}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 py-1 [&>span:last-child]:text-right [&>span:last-child]:min-w-0 [&>span:last-child]:break-words">
                <span className="text-gray-500 dark:text-gray-400">{t({ ID: 'WhatsApp', EN: 'WhatsApp' })}</span>
                <span className="font-semibold text-gray-900 dark:text-white font-mono">
                  {currentTicket.whatsapp}
                </span>
              </div>
            </div>

            <a
              href="https://wa.me/6287763743577"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full mt-6 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-xs sm:text-sm transition-colors shadow-xs"
            >
              <span>🎧</span>
              <span>{t({ ID: 'Customer Service', EN: 'Customer Service' })}</span>
            </a>
          </div>
        </div>

        {totalTickets > 1 && (
          <div className="flex justify-center items-center gap-1.5 mt-6">
            {tickets.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                aria-label={t({ ID: 'Lihat tiket #{n}', EN: 'View ticket #{n}' }).replace('#{n}', String(i + 1))}
                className={`h-2 rounded-full transition-all ${
                  currentIndex === i ? 'w-6 bg-blue-600' : 'w-2 bg-gray-300 dark:bg-gray-700'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}