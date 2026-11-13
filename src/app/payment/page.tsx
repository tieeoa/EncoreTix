'use client'

import { Suspense, useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { usePaymentCountdown, syncPaymentDeadline, formatRemaining } from '../lib/paymentTimer'
import LoadingSpinner from '@/components/LoadingSpinner'
import PaymentStatusModal from '@/components/PaymentStatusModal'
import StickyBottomBar from '@/components/StickyBottomBar'
import { useLang } from '@/lib/i18n'
import { friendlyError } from '@/app/lib/fetchError'
import { loadSnapScript } from '@/app/lib/midtransSnap'
import {
  PAYMENT_CATEGORIES,
  MIDTRANS_PAYMENT_METHODS,
  PaymentMethodItem,
} from '@/app/lib/midtransMethods'
import DirectPaymentView, { DirectPaymentData } from '@/components/DirectPaymentView'

interface PemilikTiket {
  nama: string | null
  email: string | null
  no_hp: string | null
  no_identitas: string | null
  jenis_identitas: string | null
  jenis_kelamin: string | null
  usia: number | null
}

interface Pesanan {
  booking_id: string
  jumlah: number
  status_bayar: string
  tanggal_pesan: string
  customers: {
    nama: string
    email?: string
    no_hp?: string | null
    no_identitas?: string | null
    jenis_identitas?: string | null
    jenis_kelamin?: string | null
    usia?: number | null
  } | null
  pemilik_tiket?: PemilikTiket[]
  tiket: { kategori: string; harga: number } | null
  voucher: { kode_voucher: string; nominal_diskon: number } | null
  event: { nama_event: string; tanggal: string; jam: string; lokasi: string; gambar: string | null } | null
}

function formatRupiah(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID')
}

function CategoryIcon({ type }: { type: string }) {
  if (type === 'qr') {
    return (
      <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
      </svg>
    )
  }
  if (type === 'bank') {
    return (
      <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21h18M3 10h18M5 10v11M9 10v11M15 10v11M19 10v11M12 3l9 7H3l9-7z" />
      </svg>
    )
  }
  if (type === 'card') {
    return (
      <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    )
  }
  return (
    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
    </svg>
  )
}

function PaymentContent() {
  const router = useRouter()
  const { t } = useLang()
  const searchParams = useSearchParams()
  const booking = searchParams.get('booking') || ''

  // Pilihan metode pembayaran (default: QRIS)
  const [selectedMethod, setSelectedMethod] = useState<string>('qris')
  const [step, setStep] = useState<1 | 2>(1) // 1 = review data, 2 = pilih metode
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    ewallet: true,
    va: true,
    card: false,
    cstore: false,
  })

  // States countdown & pesanan
  const { remaining, isExpired } = usePaymentCountdown(false, false)
  const [pesanan, setPesanan] = useState<Pesanan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [orderExpired, setOrderExpired] = useState(false)
  const [isPaying, setIsPaying] = useState(false)
  const [payError, setPayError] = useState('')
  const [mounted, setMounted] = useState(false)
  const [directPaymentData, setDirectPaymentData] = useState<DirectPaymentData | null>(null)

  const toggleCategory = (catId: string) => {
    setOpenCategories((prev) => ({ ...prev, [catId]: !prev[catId] }))
  }

  useEffect(() => {
    setMounted(true)
    loadSnapScript().catch(() => {})
  }, [])

  useEffect(() => {
    if (!booking) return
    fetch(`/api/transactions/${encodeURIComponent(booking)}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.error) throw new Error(res.error)
        setPesanan(res.data)
        if (res.data?.status_bayar === 'gagal') setOrderExpired(true)
        if (res.data?.tanggal_pesan) syncPaymentDeadline(res.data.tanggal_pesan)
      })
      .catch((e) => setError(friendlyError(e)))
      .finally(() => setLoading(false))
  }, [booking])

  const expired = isExpired || orderExpired

  // Perhitungan rincian biaya
  const hargaTiket = pesanan?.tiket ? Number(pesanan.tiket.harga) : 0
  const subtotal = hargaTiket * (pesanan?.jumlah || 0)
  const adminFee = Math.round(subtotal * 0.04)
  const discount = pesanan?.voucher ? Number(pesanan.voucher.nominal_diskon) : 0
  const total = Math.max(0, subtotal + adminFee - discount)

  // Otomatis arahkan ke QRIS jika metode yang dipilih butuh min 10rb sedangkan total < 10rb
  useEffect(() => {
    if (total > 0 && total < 10000) {
      const current = MIDTRANS_PAYMENT_METHODS.find((m) => m.id === selectedMethod)
      if (current?.minAmount && total < current.minAmount) {
        setSelectedMethod('qris')
      }
    }
  }, [total, selectedMethod])

  const selectedMethodObj: PaymentMethodItem | undefined = MIDTRANS_PAYMENT_METHODS.find(
    (m) => m.id === selectedMethod
  )

  const handleBayar = async () => {
    if (isPaying || expired || !booking) return
    setIsPaying(true)
    setPayError('')

    try {
      // 1. Jika pengguna memilih kartu kredit, gunakan flow Snap
      if (selectedMethod === 'credit_card') {
        await loadSnapScript()
        const res = await fetch('/api/payment/snap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            booking_id: booking,
            payment_method: selectedMethod,
          }),
        })
        const data = await res.json()
        if (!res.ok || data.error) {
          throw new Error(data.error || 'Gagal menyiapkan pembayaran Midtrans')
        }

        if (window.snap && data.token) {
          window.snap.pay(data.token, {
            onSuccess: () => {
              router.push(`/tiket-saya/${encodeURIComponent(booking)}`)
            },
            onPending: () => {
              router.push(`/tiket-saya/${encodeURIComponent(booking)}`)
            },
            onError: () => {
              setIsPaying(false)
              setPayError(t({ ID: 'Pembayaran gagal atau dibatalkan.', EN: 'Payment failed or cancelled.' }))
            },
            onClose: () => {
              setIsPaying(false)
            },
          })
        } else if (data.redirect_url) {
          window.location.href = data.redirect_url
        }
        return
      }

      // 2. Untuk QRIS, Virtual Account Bank (BCA, BNI, BRI, Permata, Mandiri), dan Gerai Retail:
      // Panggil Direct Core Charge API sehingga instruksi & kode QRIS tampil langsung di halaman EncoreTix (tanpa popup Midtrans!)
      const res = await fetch('/api/payment/charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: booking,
          payment_method: selectedMethod,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Gagal menyiapkan instruksi pembayaran')
      }

      setDirectPaymentData(data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kendala saat memproses pembayaran'
      setPayError(msg)
    } finally {
      setIsPaying(false)
    }
  }

  // Tandai pesanan gagal jika waktu countdown habis
  useEffect(() => {
    if (!expired || !booking) return
    fetch('/api/payment/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: booking }),
    }).catch(() => {})
  }, [expired, booking])

  if (loading) {
    return <LoadingSpinner label={t({ ID: 'Memuat data pesanan...', EN: 'Loading order data...' })} />
  }

  if (error || !pesanan) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-20 text-center">
        <p className="text-red-500 text-sm font-medium">{error}</p>
      </div>
    )
  }

  const pemilikList = pesanan.pemilik_tiket && pesanan.pemilik_tiket.length > 0
    ? pesanan.pemilik_tiket
    : pesanan.customers ? [pesanan.customers] : []

  return (
    <div className="min-h-screen bg-[#f9fafc] pb-24">
      {/* Timer Banner */}
      <div suppressHydrationWarning className="sticky top-16 z-40 w-full bg-[#ccff00] py-2.5 text-center text-[13px] font-medium text-black">
        <span suppressHydrationWarning>{mounted ? formatRemaining(remaining) : '10:00'}</span> | {t({ ID: 'Sisa waktu untuk memesan tiket', EN: 'Time left to book your ticket' })}
      </div>

      <div className="max-w-6xl mx-auto px-4 pt-6">
        {/* Tombol Kembali */}
        {step === 2 && !directPaymentData ? (
          <button 
            onClick={() => setStep(1)}
            className="flex items-center text-sm text-gray-700 hover:text-gray-900 mb-6 font-medium cursor-pointer"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            {t({ ID: 'Kembali ke Konfirmasi Data', EN: 'Back to Order Details' })}
          </button>
        ) : (
          <button 
            onClick={() => router.back()}
            className="flex items-center text-sm text-gray-700 hover:text-gray-900 mb-6 font-medium cursor-pointer"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            {t({ ID: 'Kembali ke Form Pengisian', EN: 'Back to Form' })}
          </button>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* KOLOM KIRI: Card 1 (Review Data) ATAU Card 2 (Pilih Metode) */}
          <div className="lg:col-span-8 space-y-6">
            {directPaymentData ? (
              <DirectPaymentView
                data={directPaymentData}
                bookingCode={booking}
                onSuccess={() => router.push(`/tiket-saya/${encodeURIComponent(booking)}`)}
                onChangeMethod={() => setDirectPaymentData(null)}
              />
            ) : step === 1 ? (
              /* CARD 1: KONFIRMASI DATA PEMESAN & PEMILIK TIKET */
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between pb-4 border-b border-gray-100 gap-2">
                  <div>
                    <h2 className="text-base font-bold text-gray-900">
                      {t({ ID: 'Konfirmasi Data Pemesanan', EN: 'Order Details Confirmation' })}
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {t({ ID: 'Pastikan data berikut sudah benar sebelum memilih metode pembayaran.', EN: 'Ensure the details below are correct before selecting a payment method.' })}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      // Navigasi ke checkout tanpa hapus storage agar data form tetap ada
                      window.history.back()
                    }}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700 underline underline-offset-2 transition"
                  >
                    {t({ ID: 'Ubah Data', EN: 'Edit Data' })}
                  </button>
                </div>

                {/* Rincian Data Pemesan */}
                <div className="mt-5 space-y-4">
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                        {t({ ID: 'Data Pemesan', EN: 'Buyer Details' })}
                      </span>
                      <span className="text-[11px] font-mono text-gray-600">
                        {pesanan.booking_id}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                      <div>
                        <span className="text-gray-400 block">{t({ ID: 'Nama Lengkap', EN: 'Full Name' })}</span>
                        <span className="font-semibold text-gray-900 text-sm">{pesanan.customers?.nama || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block">{t({ ID: 'Email Penerima', EN: 'Recipient Email' })}</span>
                        <span className="font-semibold text-gray-900 text-sm">{pesanan.customers?.email || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block">{t({ ID: 'Nomor WhatsApp', EN: 'WhatsApp Number' })}</span>
                        <span className="font-medium text-gray-800">{pesanan.customers?.no_hp || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block">
                          {pesanan.customers?.jenis_identitas || 'Identitas'}
                        </span>
                        <span className="font-mono font-medium text-gray-800">{pesanan.customers?.no_identitas || '-'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Rincian Pemilik Tiket jika lebih dari 1 atau berbeda */}
                  <div>
                    <p className="text-xs font-semibold text-gray-700 mb-2.5">
                      {t({ ID: 'Daftar Pemegang Tiket', EN: 'Ticket Holders List' })} ({pesanan.jumlah} {t({ ID: 'Tiket', EN: 'Tickets' })})
                    </p>
                    <div className="space-y-2">
                      {pemilikList.map((holder, idx) => (
                        <div
                          key={idx}
                          className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white border border-gray-100 rounded-xl text-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-700 font-medium flex items-center justify-center text-[10px]">
                              {idx + 1}
                            </span>
                            <div>
                              <span className="font-semibold text-gray-900 block">{holder.nama || '-'}</span>
                              <span className="text-[11px] text-gray-400 font-mono">
                                {holder.jenis_identitas || 'ID'}: {holder.no_identitas || '-'}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-medium text-gray-600 block">{holder.email || '-'}</span>
                            <span className="text-[11px] text-gray-400 font-mono">{holder.no_hp || '-'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* CARD 2: PILIH METODE PEMBAYARAN */
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-5">
                  <div>
                    <h2 className="text-base font-bold text-gray-900">
                      {t({ ID: 'Pilih Metode Pembayaran', EN: 'Select Payment Method' })}
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {t({ ID: 'Pilih salah satu metode pembayaran yang tersedia di bawah ini.', EN: 'Select one of the available payment methods below.' })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700 underline underline-offset-2 transition"
                  >
                    {t({ ID: 'Periksa Data', EN: 'Check Details' })}
                  </button>
                </div>

                {/* Alert Khusus Jika Nominal Kecil (< Rp 10.000) */}
                {total < 10000 && (
                  <div className="mb-5 bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-xs text-gray-700">
                    <span className="font-semibold block text-gray-900">
                      {t({ ID: 'Info Transaksi', EN: 'Transaction Info' })} ({formatRupiah(total)})
                    </span>
                    <span className="leading-relaxed block mt-0.5 text-gray-500">
                      {t({
                        ID: 'Untuk nominal di bawah Rp 10.000, silakan gunakan metode QRIS, GoPay, ShopeePay, BRI, BNI, atau Mandiri.',
                        EN: 'For amounts under Rp 10,000, please use QRIS, GoPay, ShopeePay, BRI, BNI, or Mandiri.'
                      })}
                    </span>
                  </div>
                )}

                {/* Accordion / Daftar Kategori Metode Pembayaran */}
                <div className="space-y-3">
                  {PAYMENT_CATEGORIES.map((cat) => {
                    const isOpen = openCategories[cat.id] ?? true
                    const methodsInCat = MIDTRANS_PAYMENT_METHODS.filter((m) => m.category === cat.id)

                    return (
                      <div key={cat.id} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                        {/* Header Kategori */}
                        <button
                          type="button"
                          onClick={() => toggleCategory(cat.id)}
                          className="w-full flex items-center justify-between px-4 sm:px-5 py-3.5 bg-gray-50/50 hover:bg-gray-50 transition-colors text-left"
                        >
                          <div className="flex items-center gap-3">
                            <CategoryIcon type={cat.icon} />
                            <div>
                              <h3 className="text-sm font-bold text-gray-900">{t(cat.title)}</h3>
                              <p className="text-[11px] text-gray-500">{t(cat.subtitle)}</p>
                            </div>
                          </div>
                          <svg
                            className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                    {/* Daftar Opsi Pembayaran */}
                    {isOpen && (
                      <div className="p-3 sm:p-4 space-y-2 border-t border-gray-100">
                        {methodsInCat.map((method) => {
                          const isSelected = selectedMethod === method.id
                          const isDisabled = Boolean(method.minAmount && total < method.minAmount)

                          return (
                            <div
                              key={method.id}
                              onClick={() => {
                                if (!isDisabled) setSelectedMethod(method.id)
                              }}
                              className={`rounded-xl p-3 border transition-all flex items-start gap-3 ${
                                isDisabled
                                  ? 'opacity-40 bg-gray-50 border-gray-200 cursor-not-allowed'
                                  : isSelected
                                    ? 'border-blue-600 bg-blue-50/40 ring-1 ring-blue-600 cursor-pointer'
                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50 bg-white cursor-pointer'
                              }`}
                            >
                              {/* Radio Button Custom */}
                              <div className="pt-0.5">
                                <div
                                  className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                                    isSelected ? 'border-blue-600 bg-blue-600' : 'border-gray-300 bg-white'
                                  }`}
                                >
                                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                </div>
                              </div>

                              {/* Info Metode */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className={`text-sm font-bold ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                                    {method.name}
                                  </span>
                                  {method.badge && (
                                    <span
                                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                        method.popular
                                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                          : 'bg-gray-100 text-gray-600'
                                      }`}
                                    >
                                      {isDisabled ? t({ ID: 'Min. Rp 10.000', EN: 'Min. Rp 10,000' }) : method.badge}
                                    </span>
                                  )}
                                </div>
                                {method.description && (
                                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                                    {method.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Catatan singkat setelah pilih metode */}
            {selectedMethodObj && (
              <p className="mt-3 text-xs text-gray-400 leading-relaxed">
                {t({
                  ID: 'Kode pembayaran akan tampil langsung di halaman ini setelah klik tombol bayar.',
                  EN: 'Payment instructions will appear on this page after you click the pay button.'
                })}
              </p>
            )}
          </div>
          )}

          </div>

          {/* KOLOM KANAN - Sidebar Ringkasan Tagihan */}
          <div className="lg:col-span-4">
            <div className="border border-gray-200 bg-white rounded-2xl p-5 lg:sticky lg:top-20 shadow-sm space-y-4">
              <h3 className="font-bold text-gray-900 text-base">{t({ ID: 'Ringkasan Pesanan', EN: 'Order Summary' })}</h3>
              
              {/* Event Info */}
              <div className="flex gap-3 pb-4 border-b border-gray-100">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-950 to-black shrink-0 relative overflow-hidden">
                  {pesanan.event?.gambar ? (
                    <Image
                      src={pesanan.event.gambar}
                      alt={pesanan.event.nama_event}
                      fill
                      className="object-cover"
                      sizes="56px"
                    />
                  ) : null}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 line-clamp-1">{pesanan.event?.nama_event || '-'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{pesanan.event?.tanggal || '-'}</p>
                </div>
              </div>

              {/* Rincian Harga */}
              <div className="space-y-2 text-sm pb-4 border-b border-gray-100">
                <div className="flex justify-between text-gray-500">
                  <span>{pesanan.tiket?.kategori} × {pesanan.jumlah}</span>
                  <span className="font-medium text-gray-900">{formatRupiah(subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>{t({ ID: 'Biaya Layanan (4%)', EN: 'Service Fee (4%)' })}</span>
                  <span className="font-medium text-gray-900">{formatRupiah(adminFee)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-green-600 font-medium">
                    <span>{t({ ID: 'Diskon Voucher', EN: 'Voucher Discount' })}</span>
                    <span>-{formatRupiah(discount)}</span>
                  </div>
                )}
              </div>

              {/* Pilihan Pembayaran */}
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs flex items-center justify-between">
                <span className="text-gray-500">{t({ ID: 'Metode Bayar', EN: 'Method' })}</span>
                <span className="font-bold text-blue-700 truncate max-w-[160px]">
                  {step === 1 ? t({ ID: 'Pilih di langkah 2', EN: 'Select in step 2' }) : (selectedMethodObj?.name || 'QRIS')}
                </span>
              </div>

              {/* Total Tagihan */}
              <div className="flex justify-between items-center pt-1">
                <span className="text-sm font-medium text-gray-900">{t({ ID: 'Total Tagihan', EN: 'Total Bill' })}</span>
                <span className="text-xl font-extrabold text-blue-600">{formatRupiah(total)}</span>
              </div>

              {payError && (
                <p className="text-xs text-red-600 bg-red-50 p-3 rounded-xl border border-red-200 leading-relaxed">
                  {payError}
                </p>
              )}

              {/* Tombol Aksi */}
              {directPaymentData ? (
                <button
                  type="button"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>{t({ ID: 'Menunggu Pembayaran...', EN: 'Waiting for Payment...' })}</span>
                </button>
              ) : step === 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    setStep(2)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  disabled={expired}
                  className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-medium py-3.5 rounded-xl disabled:from-gray-200 disabled:to-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  {expired ? t({ ID: 'Waktu Habis', EN: 'Time Expired' }) : t({ ID: 'Pilih Metode Pembayaran →', EN: 'Select Payment Method →' })}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleBayar}
                  disabled={expired || isPaying}
                  className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-medium py-3.5 rounded-xl disabled:from-gray-200 disabled:to-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  {isPaying ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      <span>{t({ ID: 'Menyiapkan Pembayaran...', EN: 'Preparing Payment...' })}</span>
                    </>
                  ) : expired ? (
                    t({ ID: 'Waktu Habis', EN: 'Time Expired' })
                  ) : (
                    t({ ID: `Bayar via ${selectedMethodObj?.name || 'Metode Ini'}`, EN: `Pay via ${selectedMethodObj?.name || 'This Method'}` })
                  )}
                </button>
              )}

              <div className="pt-2 text-[11px] text-gray-400 text-center flex items-center justify-center gap-1.5 leading-relaxed">
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>{t({ ID: 'Enkripsi transaksi standar Midtrans PCI-DSS', EN: 'Encrypted via Midtrans PCI-DSS standard' })}</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Sticky bottom bar HP */}
      <StickyBottomBar
        label={t({ ID: 'Total Tagihan', EN: 'Total Bill' })}
        value={formatRupiah(total)}
      >
        {directPaymentData ? (
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="inline-flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-medium px-6 py-3 rounded-full shadow-md"
          >
            <span>{t({ ID: 'Lihat Instruksi Bayar', EN: 'View Payment Instructions' })}</span>
          </button>
        ) : step === 1 ? (
          <button
            type="button"
            onClick={() => {
              setStep(2)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            disabled={expired}
            className="inline-flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-medium px-6 py-3 rounded-full disabled:from-gray-200 disabled:to-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed shadow-md"
          >
            {expired ? t({ ID: 'Waktu Habis', EN: 'Time Expired' }) : t({ ID: 'Pilih Metode Pembayaran →', EN: 'Select Payment Method →' })}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleBayar}
            disabled={expired || isPaying}
            className="inline-flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-medium px-6 py-3 rounded-full disabled:from-gray-200 disabled:to-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed shadow-md"
          >
            {isPaying ? (
              <span>{t({ ID: 'Memproses...', EN: 'Processing...' })}</span>
            ) : expired ? (
              t({ ID: 'Waktu Habis', EN: 'Time Expired' })
            ) : (
              t({ ID: 'Bayar Sekarang', EN: 'Pay Now' })
            )}
          </button>
        )}
      </StickyBottomBar>

      <PaymentStatusModal
        open={expired}
        tone="warning"
        title={t({ ID: 'Waktu Habis', EN: 'Time Expired' })}
        message={t({ ID: 'Waktu 10 menit untuk pembayaran kamu telah habis. Silakan mulai pemesanan ulang.', EN: 'Your 10-minute payment window has expired. Please start a new booking.' })}
        actionLabel={t({ ID: 'Ulangi Pesanan', EN: 'Repeat Order' })}
        onAction={() => router.push('/tiket')}
      />
    </div>
  )
}

export default function PilihMetodePembayaran() {
  const { t } = useLang()
  return (
    <Suspense fallback={<LoadingSpinner label={t({ ID: 'Memuat...', EN: 'Loading...' })} />}>
      <PaymentContent />
    </Suspense>
  )
}
