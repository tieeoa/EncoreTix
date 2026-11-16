'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import LoadingSpinner from '@/components/LoadingSpinner'
import RealQR from '@/components/RealQR'
import { useLang } from '@/lib/i18n'
import { friendlyError } from '@/app/lib/fetchError'

interface MerchItem {
  kode_pengambilan: string
  jumlah: number
  ukuran: string | null
  total_harga: number
  merchandise: { nama_merch: string; harga: number; foto: string[] | null; kategori: string | null } | null
}

interface MerchBooking {
  kode_pesanan: string
  kode_pengambilan: string
  jumlah_total: number
  subtotal: number
  admin_fee: number
  total_harga: number
  status_bayar: string
  status_pengambilan: string
  alamat: string | null
  event_id?: string | null
  event?: {
    nama_event: string
    tanggal: string
    jam: string
    lokasi: string
    gambar: string | null
  } | null
  customers: { nama: string; email: string; no_hp: string | null; usia: number | null; jenis_kelamin: string | null; no_identitas: string | null } | null
  items: MerchItem[]
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

function QRCodeVisual({ value }: { value: string }) {
  return (
    <div className="w-56 h-56 sm:w-64 sm:h-64 border border-gray-100 rounded-2xl p-3 bg-white flex items-center justify-center shadow-xs">
      <RealQR value={value} size={224} className="w-full h-full" />
    </div>
  )
}

export default function MerchDetailPage() {
  const { t } = useLang()
  const params = useParams()
  const router = useRouter()
  const pickupCode = (params?.id as string)?.toUpperCase() || ''

  const [booking, setBooking] = useState<MerchBooking | null>(null)
  const [eventInfo, setEventInfo] = useState<EventInfo>(DEFAULT_EVENT)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeEvent, setActiveEvent] = useState<{ id: string; nama_event: string } | null>(null)

  useEffect(() => {
    fetch('/api/events?active=true')
      .then((r) => r.json())
      .then((res) => {
        const ev = res.data
        if (!ev) return
        setActiveEvent({ id: String(ev.id), nama_event: ev.nama_event || '' })
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
    if (!pickupCode) return
    fetch(`/api/merch/orders/${encodeURIComponent(pickupCode)}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.error) throw new Error(res.error)
        setBooking(res.data)
      })
      .catch((e) => setError(friendlyError(e)))
      .finally(() => setLoading(false))
  }, [pickupCode])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner label={t({ ID: 'Mencari data merchandise...', EN: 'Searching for merchandise data...' })} />
      </div>
    )
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-4">
        <p className="text-red-500 text-sm font-medium">{error}</p>
        <button onClick={() => router.push('/merch-saya')} className="text-xs text-blue-600 underline">
          {t({ ID: 'Kembali ke Merch Saya', EN: 'Back to My Merch' })}
        </button>
      </div>
    )
  }

  const displayEvent: EventInfo = booking.event
    ? {
        nama_event: booking.event.nama_event || DEFAULT_EVENT.nama_event,
        tanggal: booking.event.tanggal || DEFAULT_EVENT.tanggal,
        jam: booking.event.jam || DEFAULT_EVENT.jam,
        lokasi: booking.event.lokasi || DEFAULT_EVENT.lokasi,
        gambar: booking.event.gambar || DEFAULT_EVENT.gambar,
      }
    : eventInfo

  const wrongEvent = Boolean(
    activeEvent?.id &&
      booking.event_id &&
      String(booking.event_id) !== String(activeEvent.id)
  )

  if (wrongEvent) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">
          {t({ ID: 'Pesanan Bukan untuk Event Ini', EN: 'Order Is for Another Event' })}
        </h1>
        <button onClick={() => router.push('/merch-saya')} className="text-xs text-blue-600 underline">
          {t({ ID: 'Kembali ke Merch Saya', EN: 'Back to My Merch' })}
        </button>
      </div>
    )
  }

  if (booking.status_bayar !== 'berhasil') {
    const gagal = booking.status_bayar === 'gagal'
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">
          {gagal
            ? t({ ID: 'Pesanan Gagal / Kedaluwarsa', EN: 'Order Failed / Expired' })
            : t({ ID: 'Pembayaran Belum Selesai', EN: 'Payment Not Completed' })}
        </h1>
        <p className="max-w-md text-sm text-gray-500 dark:text-gray-400">
          {gagal
            ? t({
                ID: 'Pesanan ini dibatalkan karena pembayaran tidak diselesaikan tepat waktu. Silakan pesan merchandise baru.',
                EN: 'This order was cancelled because payment was not completed in time. Please place a new order.',
              })
            : t({
                ID: 'QR pengambilan dan bukti pengambilan baru tersedia setelah pembayaran dikonfirmasi.',
                EN: 'The pickup QR and proof are available only after payment is confirmed.',
              })}
        </p>
        {!gagal && (
          <button
            onClick={() => router.push(`/payment/merch?booking=${encodeURIComponent(booking.kode_pesanan)}`)}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            {t({ ID: 'Lanjutkan Pembayaran', EN: 'Continue Payment' })}
          </button>
        )}
        <button onClick={() => router.push('/merch-saya')} className="text-xs text-blue-600 underline">
          {t({ ID: 'Kembali ke Merch Saya', EN: 'Back to My Merch' })}
        </button>
      </div>
    )
  }

  const cust = booking.customers
  const first = booking.items[0]
  const itemName =
    booking.items.length === 1 && first
      ? `${first.merchandise?.nama_merch || t({ ID: 'Merchandise', EN: 'Merchandise' })} × ${first.jumlah}${first.ukuran ? ` (Ukuran ${first.ukuran})` : ''}`
      : t({ ID: 'Merchandise', EN: 'Merchandise' }) + (booking.items.length > 0 ? ` (${booking.items.length} item)` : '')
  const displayCode = booking.kode_pesanan || booking.kode_pengambilan

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950 py-10 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Top Navbar Header */}
        <div className="flex items-center justify-end mb-6">
          <button
            onClick={() => router.push('/merch-saya')}
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
              src={displayEvent.gambar}
              alt={displayEvent.nama_event}
              fill
              priority
              className="object-cover object-center opacity-90"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

            <div className="absolute bottom-5 left-5 sm:left-8">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white drop-shadow-md tracking-tight">
                {displayEvent.nama_event}
              </h1>
            </div>
          </div>

          <div className="px-5 sm:px-8 py-3.5 sm:py-4 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3 sm:gap-6 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
            <div className="flex items-center gap-1">
              <span className="font-medium">{displayEvent.tanggal}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-medium">{displayEvent.jam}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-medium">{displayEvent.lokasi}</span>
            </div>
          </div>
        </div>

        {/* Main 2-Column Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          <div className="md:col-span-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-8 flex flex-col items-center shadow-xs">
            <div className="text-center mb-6">
              <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 tracking-wider uppercase">
                OFFICIAL MERCHANDISE
              </span>
              <h2 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white tracking-tight mt-0.5 max-w-xs text-center leading-snug">
                {itemName}
              </h2>
            </div>

            <div className="mb-3">
              <QRCodeVisual value={`ENCORETIX:${displayCode}`} />
            </div>

            <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center mb-4">
              {t({ ID: 'Tunjukkan QR code ini kepada petugas booth saat pengambilan merchandise.', EN: 'Show this QR code to booth staff when collecting your merchandise.' })}
            </p>

            <div className="text-center mb-6">
              <p className="text-[10px] font-bold tracking-wider text-gray-400 dark:text-gray-500 uppercase">
                PICKUP CODE
              </p>
              <p className="text-xs sm:text-sm font-mono font-bold text-gray-800 dark:text-gray-200 tracking-wide mt-0.5">
                {displayCode}
              </p>
            </div>

            <div className="w-full space-y-2.5">
              <a
                href={`/api/merch/pdfs/${encodeURIComponent(displayCode)}`}
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
                <span>{t({ ID: 'Download Bukti Pengambilan (PDF)', EN: 'Download Pickup Proof (PDF)' })}</span>
              </a>
            </div>
          </div>

          <div className="md:col-span-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-7 shadow-xs">
            <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
              {t({ ID: 'Data Pemesan Merchandise', EN: 'Merchandise Buyer Data' })}
            </h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 mb-5">
              {t({ ID: 'Pastikan data cocok dengan identitas saat pengambilan di venue.', EN: 'Make sure the data matches your identity when picking up at the venue.' })}
            </p>

            <div className="bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 rounded-2xl p-4 mb-4">
              <p className="text-[10px] font-bold tracking-wider text-blue-600 dark:text-blue-400 uppercase">
                {t({ ID: 'KODE PENGAMBILAN', EN: 'PICKUP CODE' })}
              </p>
              <p className="text-lg sm:text-xl font-mono font-black text-blue-950 dark:text-blue-200 tracking-tight mt-0.5">
                {displayCode}
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-950/40 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 mb-5">
              <p className="text-[10px] font-bold tracking-wider text-gray-500 dark:text-gray-400 uppercase">
                {t({ ID: 'Rincian Pesanan', EN: 'Order Items' })}
              </p>
              <div className="mt-2 space-y-1.5 text-xs sm:text-sm">
                {booking.items.map((it) => (
                  <div key={it.kode_pengambilan} className="flex items-start justify-between gap-3">
                    <span className="font-semibold text-gray-800 dark:text-gray-100 min-w-0 break-words">
                      {it.merchandise?.nama_merch || '-'}
                      {it.ukuran ? ` (${it.ukuran})` : ''} × {it.jumlah}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      Rp {Number(it.total_harga).toLocaleString('id-ID')}
                    </span>
                  </div>
                ))}
                <div className="flex items-start justify-between gap-3 pt-2 border-t border-gray-200 dark:border-gray-800">
                  <span className="font-bold text-gray-900 dark:text-white">{t({ ID: 'Total', EN: 'Total' })}</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                    Rp {Number(booking.total_harga).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-4 mb-5 flex items-start gap-3">
              <span className="text-base shrink-0 mt-0.5">⚠️</span>
              <div>
                <p className="text-xs font-bold text-amber-900 dark:text-amber-200 leading-snug">
                  {t({ ID: 'Ketentuan Pengambilan Merchandise:', EN: 'Merchandise Pickup Terms:' })}
                </p>
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mt-1 leading-relaxed">
                  {t({ ID: 'Pengambilan merch dilakukan mulai dari jam pemesanan hingga maksimal 1 (satu) hari setelahnya di venue kami.', EN: 'Merch pickup must be done from order time up to at most 1 (one) day after at our venue.' })}
                </p>
              </div>
            </div>

            <div className="space-y-3.5 text-xs sm:text-sm">
              <div className="flex items-center justify-between gap-3 py-1 border-b border-gray-100 dark:border-gray-800 [&>span:last-child]:text-right [&>span:last-child]:min-w-0 [&>span:last-child]:break-words">
                <span className="text-gray-500 dark:text-gray-400">{t({ ID: 'Nama Lengkap', EN: 'Full Name' })}</span>
                <span className="font-semibold text-gray-900 dark:text-white">{cust?.nama}</span>
              </div>

              <div className="flex items-center justify-between gap-3 py-1 border-b border-gray-100 dark:border-gray-800 [&>span:last-child]:text-right [&>span:last-child]:min-w-0 [&>span:last-child]:break-words">
                <span className="text-gray-500 dark:text-gray-400">KTP/Passport</span>
                <span className="font-semibold text-gray-900 dark:text-white font-mono">
                  {cust?.no_identitas || '-'}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 py-1 border-b border-gray-100 dark:border-gray-800 [&>span:last-child]:text-right [&>span:last-child]:min-w-0 [&>span:last-child]:break-words">
                <span className="text-gray-500 dark:text-gray-400">{t({ ID: 'Jenis Kelamin', EN: 'Gender' })}</span>
                <span className="font-semibold text-gray-900 dark:text-white">{cust?.jenis_kelamin || '-'}</span>
              </div>

              <div className="flex items-center justify-between gap-3 py-1 border-b border-gray-100 dark:border-gray-800 [&>span:last-child]:text-right [&>span:last-child]:min-w-0 [&>span:last-child]:break-words">
                <span className="text-gray-500 dark:text-gray-400">{t({ ID: 'Usia', EN: 'Age' })}</span>
                <span className="font-semibold text-gray-900 dark:text-white">{cust?.usia ?? '-'}</span>
              </div>

              <div className="flex items-center justify-between gap-3 py-1 border-b border-gray-100 dark:border-gray-800 [&>span:last-child]:text-right [&>span:last-child]:min-w-0 [&>span:last-child]:break-words">
                <span className="text-gray-500 dark:text-gray-400">{t({ ID: 'Lokasi Booth', EN: 'Booth Location' })}</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">Booth Official Merch — {displayEvent.lokasi !== '-' ? displayEvent.lokasi : t({ ID: 'lihat info venue pada event', EN: 'see the venue info on the event' })}</span>
              </div>

              <div className="flex items-start justify-between gap-4 py-1 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-500 dark:text-gray-400 shrink-0">{t({ ID: 'Alamat', EN: 'Address' })}</span>
                <span className="font-semibold text-gray-900 dark:text-white text-right break-words max-w-[220px]">
                  {booking.alamat || '-'}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 py-1 border-b border-gray-100 dark:border-gray-800 [&>span:last-child]:text-right [&>span:last-child]:min-w-0 [&>span:last-child]:break-words">
                <span className="text-gray-500 dark:text-gray-400">Email</span>
                <span className="font-semibold text-gray-900 dark:text-white truncate max-w-[200px]">
                  {cust?.email}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 py-1 [&>span:last-child]:text-right [&>span:last-child]:min-w-0 [&>span:last-child]:break-words">
                <span className="text-gray-500 dark:text-gray-400">WhatsApp</span>
                <span className="font-semibold text-gray-900 dark:text-white font-mono">
                  {cust?.no_hp || '-'}
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
      </div>
    </div>
  )
}