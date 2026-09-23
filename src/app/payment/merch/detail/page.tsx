'use client'

import { Suspense, useState, useEffect } from 'react'
import Image from 'next/image'
import { useSearchParams, useRouter } from 'next/navigation'
import { usePaymentCountdown, syncPaymentDeadline, clearPaymentCountdown } from '../../../lib/paymentTimer'
import { usePreventHistoryBack } from '../../../lib/historyGuard'
import PaymentTimerBanner from '@/components/PaymentTimerBanner'
import LoadingSpinner from '@/components/LoadingSpinner'
import PaymentStatusModal from '@/components/PaymentStatusModal'
import { useLang } from '@/lib/i18n'
import { friendlyError } from '@/app/lib/fetchError'
import { labelMetode } from '@/app/lib/paymentMethod'

const GUIDE_TABS = {
  qris: {
    label: 'QRIS (Semua E-Wallet)',
    steps: [
      'Buka aplikasi e-wallet (GoPay, OVO, ShopeePay) atau m-Banking pilihan Anda yang mendukung QRIS.',
      'Pilih menu "Bayar" atau "Scan QR" pada layar utama aplikasi.',
      'Arahkan kamera smartphone ke QR Code di atas atau unggah gambar QR jika memindai tangkapan layar.',
      'Pastikan nominal tertera sesuai total tagihan.',
      'Masukkan PIN transaksi Anda dan simpan bukti konfirmasi sukses pembayaran.',
    ],
  },
  bca: {
    label: 'BCA Mobile / myBCA',
    steps: [
      'Buka aplikasi BCA Mobile atau myBCA, login dengan PIN Anda.',
      'Pilih menu m-Transfer > BCA Virtual Account.',
      'Masukkan nomor Virtual Account yang tertera di atas.',
      'Periksa detail tagihan, pastikan nominal sudah sesuai.',
      'Masukkan PIN untuk menyelesaikan transaksi.',
    ],
  },
  atm: {
    label: 'ATM & Bank Lain',
    steps: [
      'Masukkan kartu ATM dan PIN Anda.',
      'Pilih menu Transfer > Ke Rek Bank Lain / Virtual Account.',
      'Masukkan nomor Virtual Account yang tertera di atas.',
      'Periksa dan konfirmasi nominal tagihan.',
      'Selesaikan transaksi dan simpan struk sebagai bukti pembayaran.',
    ],
  },
}

interface MerchItem {
  kode_pengambilan: string
  jumlah: number
  ukuran: string | null
  total_harga: number
  status_pengambilan: string
  merchandise: { nama_merch: string; harga: number } | null
}

interface Pesanan {
  kode_pesanan: string
  kode_pengambilan: string
  jumlah_total: number
  subtotal: number
  admin_fee: number
  total_harga: number
  status_bayar: string
  status_pengambilan: string
  tanggal_pesan: string
  alamat: string | null
  customers: { nama: string; email: string; no_hp: string | null; no_identitas: string | null } | null
  items: MerchItem[]
  event: { nama_event: string; tanggal: string; jam: string; lokasi: string; gambar: string | null } | null
}

function formatRupiah(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID')
}

function DetailPembayaranMerchContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { t } = useLang()
  const booking = searchParams.get('booking') || ''
  // Metode yang dipilih di halaman sebelumnya — ditampilkan & disimpan saat konfirmasi.
  const methodParam = searchParams.get('method') || 'qris'
  const metodeLabel = labelMetode(methodParam)
  const [guideTab, setGuideTab] = useState<keyof typeof GUIDE_TABS>('qris')
  const { remaining, isExpired } = usePaymentCountdown(false, false)

  const guideTabs: Record<keyof typeof GUIDE_TABS, { label: string; steps: string[] }> = {
    qris: {
      label: t({ ID: 'QRIS (Semua E-Wallet)', EN: 'QRIS (All E-Wallets)' }),
      steps: [
        t({ ID: 'Buka aplikasi e-wallet (GoPay, OVO, ShopeePay) atau m-Banking pilihan Anda yang mendukung QRIS.', EN: 'Open your e-wallet app (GoPay, OVO, ShopeePay) or mobile banking app that supports QRIS.' }),
        t({ ID: 'Pilih menu "Bayar" atau "Scan QR" pada layar utama aplikasi.', EN: 'Choose "Pay" or "Scan QR" on the app\'s home screen.' }),
        t({ ID: 'Arahkan kamera smartphone ke QR Code di atas atau unggah gambar QR jika memindai tangkapan layar.', EN: 'Point your phone camera at the QR Code above, or upload the QR image if scanning a screenshot.' }),
        t({ ID: 'Pastikan nominal tertera sesuai total tagihan.', EN: 'Make sure the amount matches your total bill.' }),
        t({ ID: 'Masukkan PIN transaksi Anda dan simpan bukti konfirmasi sukses pembayaran.', EN: 'Enter your transaction PIN and keep the successful payment confirmation.' }),
      ],
    },
    bca: {
      label: t({ ID: 'BCA Mobile / myBCA', EN: 'BCA Mobile / myBCA' }),
      steps: [
        t({ ID: 'Buka aplikasi BCA Mobile atau myBCA, login dengan PIN Anda.', EN: 'Open BCA Mobile or myBCA and log in with your PIN.' }),
        t({ ID: 'Pilih menu m-Transfer > BCA Virtual Account.', EN: 'Choose m-Transfer > BCA Virtual Account.' }),
        t({ ID: 'Masukkan nomor Virtual Account yang tertera di atas.', EN: 'Enter the Virtual Account number shown above.' }),
        t({ ID: 'Periksa detail tagihan, pastikan nominal sudah sesuai.', EN: 'Check the bill details and make sure the amount is correct.' }),
        t({ ID: 'Masukkan PIN untuk menyelesaikan transaksi.', EN: 'Enter your PIN to complete the transaction.' }),
      ],
    },
    atm: {
      label: t({ ID: 'ATM & Bank Lain', EN: 'ATM & Other Banks' }),
      steps: [
        t({ ID: 'Masukkan kartu ATM dan PIN Anda.', EN: 'Insert your ATM card and enter your PIN.' }),
        t({ ID: 'Pilih menu Transfer > Ke Rek Bank Lain / Virtual Account.', EN: 'Choose Transfer > To Other Bank / Virtual Account.' }),
        t({ ID: 'Masukkan nomor Virtual Account yang tertera di atas.', EN: 'Enter the Virtual Account number shown above.' }),
        t({ ID: 'Periksa dan konfirmasi nominal tagihan.', EN: 'Review and confirm the bill amount.' }),
        t({ ID: 'Selesaikan transaksi dan simpan struk sebagai bukti pembayaran.', EN: 'Complete the transaction and keep the receipt as proof of payment.' }),
      ],
    },
  }

  const [pesanan, setPesanan] = useState<Pesanan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [paid, setPaid] = useState(false)
  const [confirmFailed, setConfirmFailed] = useState(false)
  const [orderExpired, setOrderExpired] = useState(false)
  const [retryTick, setRetryTick] = useState(0)

  usePreventHistoryBack(paid)

  useEffect(() => {
    if (!booking) return
    fetch(`/api/merch/orders/${encodeURIComponent(booking)}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.error) throw new Error(res.error)
        setPesanan(res.data)
        if (res.data?.status_bayar === 'berhasil') setPaid(true)
        if (res.data?.status_bayar === 'gagal') setOrderExpired(true)
        if (res.data?.tanggal_pesan) syncPaymentDeadline(res.data.tanggal_pesan)
      })
      .catch((e) => setError(friendlyError(e)))
      .finally(() => setLoading(false))
  }, [booking])

  // Setelah berhasil, bersihkan batas waktu lama agar booking berikutnya mulai dari nol.
  useEffect(() => {
    if (paid) clearPaymentCountdown()
  }, [paid])

  const handleConfirmPaid = async () => {
    try {
      const res = await fetch('/api/payment/merch-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kode_pengambilan: booking, metode_pembayaran: methodParam }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        if (res.status === 410) {
          setOrderExpired(true)
          return
        }
        throw new Error(data.error || t({ ID: 'Gagal mengonfirmasi pembayaran', EN: 'Failed to confirm payment' }))
      }
      setPaid(true)
    } catch {
      setConfirmFailed(true)
    }
  }

  // Deteksi pembayaran otomatis: sistem memverifikasi pembayaran setelah beberapa detik.
  useEffect(() => {
    if (!pesanan || paid || pesanan.status_bayar !== 'pending') return
    const timer = setTimeout(handleConfirmPaid, 10000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pesanan, paid, booking, retryTick])

  const expired = isExpired || orderExpired
  useEffect(() => {
    if (!isExpired || paid) return
    fetch('/api/payment/merch-confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kode_pengambilan: booking, metode_pembayaran: methodParam }),
    })
      .then((res) => {
        if (res.status === 410 && !paid) setOrderExpired(true)
      })
      .catch(() => {})
  }, [isExpired, paid, booking, methodParam])

  const retry = () => {
    setConfirmFailed(false)
    setRetryTick((n) => n + 1)
  }

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

  const subtotal = pesanan.subtotal
  const adminFee = pesanan.admin_fee
  const total = pesanan.total_harga
  const cust = pesanan.customers

  if (paid) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16">
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center shadow-sm">
          <div className="w-14 h-14 rounded-full bg-green-50 border border-green-200 flex items-center justify-center mx-auto mb-5 text-2xl">
            ✅
          </div>
          <h1 className="text-lg font-bold text-gray-900">{t({ ID: 'Pembayaran Berhasil', EN: 'Payment Successful' })}</h1>

          <div className="mt-5 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3.5 flex items-center gap-3 text-left">
            <span className="text-base shrink-0">📦</span>
            <div>
              <p className="text-sm font-semibold text-emerald-800">
                {t({ ID: 'Kode pengambilan merchandise berhasil terkirim ke Gmail!', EN: 'Merchandise pickup code successfully sent to Gmail!' })}
              </p>
              <p className="text-xs text-emerald-700 mt-0.5">{cust?.email}</p>
            </div>
          </div>

          <button
            onClick={() => router.push(`/merch-saya/${encodeURIComponent(pesanan.kode_pengambilan)}`)}
            className="mt-6 w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold py-3 px-4 rounded-lg text-sm transition-colors cursor-pointer"
          >
            {t({ ID: 'Lihat E-Merch', EN: 'View E-Merch' })}
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <PaymentTimerBanner remaining={remaining} label={t({ ID: 'Sisa waktu untuk menyelesaikan pembayaran', EN: 'Time left to complete your payment' })} />
      <div className="min-h-screen bg-[#f9fafc] pb-20">
        <div className="max-w-6xl mx-auto px-4 pt-6">

          {/* Header */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-6">
            <h1 className="text-lg font-bold text-gray-900">{t({ ID: 'Detail Pembayaran', EN: 'Payment Details' })}</h1>
            <span className="text-[10px] font-medium bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100">
              {t({ ID: 'Menunggu Pembayaran', EN: 'Awaiting Payment' })}
            </span>
            <span className="text-[10px] font-semibold bg-slate-900 text-white px-2 py-0.5 rounded-full">
              {t({ ID: 'Metode', EN: 'Method' })}: {metodeLabel}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

            {/* LEFT — QRIS + Guide */}
            <div className="lg:col-span-8 space-y-4">

              {/* QRIS Card */}
              <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  <span className="font-medium text-gray-900 text-sm">{t({ ID: 'QRIS Standar Nasional', EN: 'National Standard QRIS' })}</span>
                </div>

                <div className="px-6 py-6 flex flex-col items-center">
                  <p className="text-xs text-gray-400 mb-5">{t({ ID: 'Scan via GoPay, OVO, DANA, BCA, Mandiri, dll', EN: 'Scan via GoPay, OVO, DANA, BCA, Mandiri, etc' })}</p>

                  <div className="w-44 h-44 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-center text-5xl">
                    🔳
                  </div>

                  <div className="text-xs text-gray-400 mt-3 space-y-0.5 text-center">
                    <p>NMID · ID1029384756 &nbsp;·&nbsp; PT ENCORETIX KREATIF INDONESIA</p>
                  </div>

                  <p className="text-[11px] text-gray-400 mt-4">{t({ ID: 'Total Transfer Tepat', EN: 'Transfer the exact total amount' })}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{formatRupiah(total)}</p>

                  {/* Waiting badge */}
                  <div className="mt-5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-center gap-3 w-full max-w-sm">
                    <span className="loading-dots"><span /></span>
                    <div>
                      <p className="text-sm font-semibold text-blue-800">{t({ ID: 'Menunggu konfirmasi', EN: 'Awaiting confirmation' })}</p>
                      <p className="text-[11px] text-blue-600 mt-0.5">{t({ ID: 'Sistem memverifikasi pembayaran dari bank.', EN: 'System is verifying payment with the bank.' })}</p>
                    </div>
                  </div>
                </div>

                {/* Virtual Account */}
                <div className="mx-4 sm:mx-6 mb-6 bg-gray-50 border border-gray-100 rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-400 mb-0.5">{t({ ID: 'Alternatif Virtual Account', EN: 'Alternative Virtual Account' })}</p>
                    <p className="text-sm font-mono font-semibold text-gray-900">8277 0812 3456 7890</p>
                    <p className="text-[10px] text-gray-400">a.n. ENCORETIX</p>
                  </div>
                  <button className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors">
                    {t({ ID: 'Salin', EN: 'Copy' })}
                  </button>
                </div>
              </div>

              {/* Kode Pengambilan Notice */}
              <div className="bg-white border border-gray-100 rounded-xl shadow-sm px-5 py-4 flex items-center gap-3">
                <span className="text-base shrink-0">📦</span>
                <p className="text-xs text-gray-600 leading-relaxed">
                  <span className="font-semibold text-gray-800">{t({ ID: 'Kode pengambilan terkirim otomatis', EN: 'Pickup code sent automatically' })}</span>
                  {' '}{t({ ID: 'setelah pembayaran terverifikasi ke', EN: 'after payment is verified to' })}{' '}
                  <span className="font-medium text-gray-900">{cust?.email}</span>.
                </p>
              </div>

              {/* Payment Guide */}
              <div className="bg-white border border-gray-100 rounded-xl shadow-sm px-6 py-5">
                <h3 className="font-semibold text-gray-900 text-sm mb-4">{t({ ID: 'Panduan Pembayaran', EN: 'Payment Guide' })}</h3>
                <div className="flex gap-2 mb-4 flex-wrap">
                  {(Object.keys(GUIDE_TABS) as (keyof typeof GUIDE_TABS)[]).map((key) => (
                    <button
                      key={key}
                      onClick={() => setGuideTab(key)}
                      className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                        guideTab === key ? 'bg-gray-900 text-white border-gray-900' : 'text-gray-500 border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      {guideTabs[key].label}
                    </button>
                  ))}
                </div>
                <ol className="space-y-2.5 text-xs text-gray-600">
                  {guideTabs[guideTab].steps.map((step, i) => (
                    <li key={i} className="flex gap-2.5">
                      <span className="w-4 h-4 rounded-full bg-gray-100 text-gray-500 text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {/* RIGHT — Order Summary */}
            <div className="lg:col-span-4">
              <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden lg:sticky lg:top-20">
                {/* Event poster */}
                <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-indigo-950 to-black overflow-hidden">
                  {pesanan.event?.gambar ? (
                    <Image
                      src={pesanan.event.gambar}
                      alt={pesanan.event.nama_event}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 380px"
                    />
                  ) : null}
                  <span className="absolute top-2 left-2 text-[9px] font-medium bg-black/40 text-white px-1.5 py-0.5 rounded backdrop-blur-sm">
                    {t({ ID: 'Official Merchandise', EN: 'Official Merchandise' })}
                  </span>
                </div>

                <div className="p-5">
                  <p className="text-sm font-semibold text-gray-900">{pesanan.event?.nama_event || '-'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{pesanan.event?.tanggal || '-'}</p>

                  <div className="border-t border-gray-100 mt-4 pt-4">
                    <p className="text-[11px] font-semibold text-gray-900 uppercase tracking-wide">
                      {t({ ID: 'Rincian Item', EN: 'Item Details' })} ({pesanan.jumlah_total} {t({ ID: 'Item', EN: 'Items' })})
                    </p>
                    <div className="text-xs text-gray-500 mt-1.5 space-y-1">
                      {pesanan.items.map((it) => (
                        <div key={it.kode_pengambilan} className="flex justify-between gap-2">
                          <span className="min-w-0 truncate">
                            {it.merchandise?.nama_merch} {it.ukuran && `(${it.ukuran})`} × {it.jumlah}
                          </span>
                          <span className="text-gray-900 whitespace-nowrap">{formatRupiah(it.total_harga)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs mt-4 pt-4 border-t border-gray-100">
                    <div className="flex justify-between text-gray-500">
                      <span>{t({ ID: 'Subtotal Merchandise', EN: 'Merchandise Subtotal' })}</span>
                      <span className="text-gray-900">{formatRupiah(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>{t({ ID: 'Biaya Admin (4%)', EN: 'Admin Fee (4%)' })}</span>
                      <span className="text-gray-900">{formatRupiah(adminFee)}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-4 mt-1 border-t border-gray-100">
                    <span className="text-sm font-medium text-gray-900">{t({ ID: 'Total', EN: 'Total' })}</span>
                    <span className="text-base font-bold text-blue-600">{formatRupiah(total)}</span>
                  </div>

                  {/* Customer data */}
                  <div className="mt-4 pt-4 border-t border-gray-100 space-y-2 text-[11px]">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{t({ ID: 'Pemesan', EN: 'Orderer' })}</p>
                    <div className="flex flex-col gap-1 text-gray-700">
                      <span className="font-medium">{cust?.nama}</span>
                      <span className="text-gray-400">{cust?.email}</span>
                      {cust?.no_hp && <span className="text-gray-400">{cust.no_hp}</span>}
                      {pesanan.alamat && <span className="text-gray-400">{pesanan.alamat}</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        <PaymentStatusModal
          open={confirmFailed && !expired && !paid}
          tone="danger"
          title={t({ ID: 'Pembayaran Gagal', EN: 'Payment Failed' })}
          message={t({ ID: 'Pembayaran tidak dapat diverifikasi. Silakan coba dengan metode pembayaran lain.', EN: 'The payment could not be verified. Please try another payment method.' })}
          actionLabel={t({ ID: 'Pilih Metode Lain', EN: 'Choose Another Method' })}
          onAction={() => router.push(`/payment/merch?booking=${encodeURIComponent(booking)}`)}
          secondaryLabel={t({ ID: 'Coba Lagi', EN: 'Try Again' })}
          onSecondary={retry}
        />

        <PaymentStatusModal
          open={expired && !paid}
          tone="warning"
          title={t({ ID: 'Waktu Habis', EN: 'Time Expired' })}
          message={t({ ID: 'Waktu 10 menit untuk pembayaran kamu telah habis. Silakan mulai pemesanan ulang.', EN: 'Your 10-minute payment window has expired. Please start a new booking.' })}
          actionLabel={t({ ID: 'Ulangi Pesanan', EN: 'Repeat Order' })}
          onAction={() => router.push('/merchandise')}
        />
      </div>
    </>
  )
}

export default function DetailPembayaranMerch() {
  const { t } = useLang()
  return (
    <Suspense fallback={<LoadingSpinner label={t({ ID: 'Memuat...', EN: 'Loading...' })} />}>
      <DetailPembayaranMerchContent />
    </Suspense>
  )
}