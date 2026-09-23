'use client'

import { Suspense, useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { usePaymentCountdown, syncPaymentDeadline } from '../lib/paymentTimer'
import LoadingSpinner from '@/components/LoadingSpinner'
import PaymentStatusModal from '@/components/PaymentStatusModal'
import StickyBottomBar from '@/components/StickyBottomBar'
import { useLang } from '@/lib/i18n'
import { friendlyError } from '@/app/lib/fetchError'

// DUMMY DATA BANK UNTUK UI KIRI
const BANK_TRANSFER = [
  { id: 'bca', name: 'BCA', logo: 'BCA' },
  { id: 'bri', name: 'BANK BRI', logo: 'BANK BRI' },
  { id: 'mandiri', name: 'mandiri', logo: 'mandiri' },
  { id: 'bni', name: 'BNI', logo: 'BNI' },
  { id: 'cimb', name: 'CIMB NIAGA', logo: 'CIMB NIAGA' },
  { id: 'danamon', name: 'Danamon', logo: 'Danamon' },
  { id: 'bsi', name: 'BSI', logo: 'BSI' },
  { id: 'sampoerna', name: 'Bank Sampoerna', logo: 'Bank Sampoerna' },
  { id: 'sinarmas', name: 'Sinarmas', logo: 'Sinarmas' },
  { id: 'maybank', name: 'Maybank', logo: 'Maybank' },
  { id: 'permata', name: 'Permata Bank', logo: 'Permata Bank' },
]

interface Pesanan {
  booking_id: string
  jumlah: number
  status_bayar: string
  tanggal_pesan: string
  customers: { nama: string } | null
  tiket: { kategori: string; harga: number } | null
  voucher: { kode_voucher: string; nominal_diskon: number } | null
  event: { nama_event: string; tanggal: string; jam: string; lokasi: string; gambar: string | null } | null
}

function formatRupiah(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID')
}

function formatTime(seconds: number) {
  if (!seconds || seconds < 0) return '00:00'
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function PaymentContent() {
  const router = useRouter()
  const { t } = useLang()
  const searchParams = useSearchParams()
  const booking = searchParams.get('booking') || ''
  
  // States
  const [selected, setSelected] = useState('bca')
  const [openBankAccordion, setOpenBankAccordion] = useState(true)
  const [openEwalletAccordion, setOpenEwalletAccordion] = useState(false)
  
  const { remaining, isExpired } = usePaymentCountdown(false, false)
  const [pesanan, setPesanan] = useState<Pesanan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [orderExpired, setOrderExpired] = useState(false)

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

  // Perhitungan kembali menggunakan original code Anda
  const hargaTiket = pesanan?.tiket ? Number(pesanan.tiket.harga) : 0
  const subtotal = hargaTiket * (pesanan?.jumlah || 0)
  const adminFee = Math.round(subtotal * 0.04)
  const discount = pesanan?.voucher ? Number(pesanan.voucher.nominal_diskon) : 0
  const total = Math.max(0, subtotal + adminFee - discount)

  const handleBayar = () => {
    router.push(`/payment/detail?booking=${encodeURIComponent(booking)}&method=${selected}`)
  }

  const expired = isExpired || orderExpired

  // Saat waktu habis, tandai pesanan gagal di server (jika masih pending).
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

  return (
    <div className="min-h-screen bg-[#f9fafc] pb-20">
      {/* Timer Banner */}
      <div className="w-full bg-[#ccff00] py-2.5 text-center text-[13px] font-medium text-black">
        {formatTime(remaining)} | {t({ ID: 'Sisa waktu untuk memesan tiket', EN: 'Time left to book your ticket' })}
      </div>

      <div className="max-w-6xl mx-auto px-4 pt-6">
        {/* Tombol Kembali */}
        <button 
          onClick={() => router.back()}
          className="flex items-center text-sm text-gray-700 hover:text-gray-900 mb-6"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          {t({ ID: 'Kembali', EN: 'Back' })}
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* KOLOM KIRI - Metode Pembayaran (Desain Baru) */}
          <div className="lg:col-span-8 space-y-4">
            
            {/* Accordion Transfer Bank */}
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
              <button 
                onClick={() => setOpenBankAccordion(!openBankAccordion)}
                className="w-full flex items-center justify-between px-4 sm:px-6 py-4 bg-white"
              >
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                  <span className="font-medium text-gray-900 text-sm">{t({ ID: 'Transfer Bank', EN: 'Bank Transfer' })}</span>
                </div>
                <svg className={`w-5 h-5 text-gray-400 transform transition-transform ${openBankAccordion ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              
              {openBankAccordion && (
                <div className="px-4 sm:px-6 pb-6 pt-2">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {BANK_TRANSFER.map((bank) => (
                      <button
                        key={bank.id}
                        onClick={() => setSelected(bank.id)}
                        className={`h-16 flex items-center justify-center border rounded-lg p-2 transition-all bg-white ${
                          selected === bank.id 
                            ? 'border-blue-600 ring-1 ring-blue-600' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <span className={`text-xs font-bold ${selected === bank.id ? 'text-blue-700' : 'text-gray-600'}`}>
                          {bank.logo}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Accordion E-Wallet / QRIS */}
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
              <button 
                onClick={() => setOpenEwalletAccordion(!openEwalletAccordion)}
                className="w-full flex items-center justify-between px-4 sm:px-6 py-4 bg-white"
              >
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                  <span className="font-medium text-gray-900 text-sm">{t({ ID: 'E-Wallet / QRIS', EN: 'E-Wallet / QRIS' })}</span>
                </div>
                <svg className={`w-5 h-5 text-gray-400 transform transition-transform ${openEwalletAccordion ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              
              {openEwalletAccordion && (
                <div className="px-4 sm:px-6 pb-6 pt-2">
                  <button
                    onClick={() => setSelected('qris')}
                    className={`w-full h-16 flex items-center justify-center border rounded-lg p-2 transition-all bg-white ${
                      selected === 'qris' 
                        ? 'border-blue-600 ring-1 ring-blue-600' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-sm font-bold text-gray-700">{t({ ID: 'QRIS / E-Wallet', EN: 'QRIS / E-Wallet' })}</span>
                  </button>
                </div>
              )}
            </div>
            
          </div>

          {/* KOLOM KANAN - Sidebar Asli Anda */}
          <div className="lg:col-span-4">
            <div className="border border-gray-200 bg-white rounded-xl p-5 lg:sticky lg:top-20 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-4">{t({ ID: 'Ringkasan Pesanan', EN: 'Order Summary' })}</h3>
              <div className="flex gap-3 pb-4 border-b border-gray-100">
                <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-indigo-950 to-black shrink-0 relative overflow-hidden">
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
                  <p className="text-sm font-medium text-gray-900">{pesanan.event?.nama_event || '-'}</p>
                  <p className="text-xs text-gray-400">{pesanan.event?.tanggal || '-'}</p>
                </div>
              </div>
              <div className="space-y-1.5 text-sm py-4 border-b border-gray-100">
                <div className="flex justify-between text-gray-500">
                  <span>{pesanan.tiket?.kategori} x{pesanan.jumlah}</span>
                  <span className="text-gray-900">{formatRupiah(subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>{t({ ID: 'Biaya Admin (4%)', EN: 'Admin Fee (4%)' })}</span>
                  <span className="text-gray-900">{formatRupiah(adminFee)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-green-600 font-medium">
                    <span>{t({ ID: 'Diskon Voucher', EN: 'Voucher Discount' })}</span>
                    <span>-{formatRupiah(discount)}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center py-4">
                <span className="text-sm font-medium text-gray-900">{t({ ID: 'Total Tagihan', EN: 'Total Bill' })}</span>
                <span className="text-lg font-bold text-blue-600">{formatRupiah(total)}</span>
              </div>
              <button
                onClick={handleBayar}
                disabled={expired}
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-medium py-3 rounded-lg disabled:from-gray-200 disabled:to-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed"
              >
                {expired ? t({ ID: 'Waktu Habis', EN: 'Time Expired' }) : t({ ID: 'Bayar Sekarang →', EN: 'Pay Now →' })}
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Sticky bottom bar HP: total + bayar */}
      <StickyBottomBar
        label={t({ ID: 'Total Tagihan', EN: 'Total Bill' })}
        value={formatRupiah(total)}
      >
        <button
          onClick={handleBayar}
          disabled={expired}
          className="inline-flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-medium px-6 py-3 rounded-full disabled:from-gray-200 disabled:to-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed"
        >
          {expired ? t({ ID: 'Waktu Habis', EN: 'Time Expired' }) : t({ ID: 'Bayar →', EN: 'Pay →' })}
        </button>
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