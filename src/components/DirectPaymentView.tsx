'use client'

import { useState, useEffect, useCallback } from 'react'
import RealQR from '@/components/RealQR'

export interface DirectPaymentData {
  order_id: string
  transaction_id?: string
  payment_type: string
  payment_method: string
  gross_amount: number
  transaction_status?: string
  expiry_time?: string | null
  qr_url?: string | null
  qr_string?: string | null
  deeplink_url?: string | null
  va_number?: string | null
  bank?: string | null
  bill_key?: string | null
  biller_code?: string | null
  payment_code?: string | null
}

interface DirectPaymentViewProps {
  data: DirectPaymentData
  bookingCode: string
  isMerch?: boolean
  onSuccess: () => void
  onChangeMethod: () => void
}

function formatRupiah(n: number) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID')
}

export default function DirectPaymentView({
  data,
  bookingCode,
  isMerch = false,
  onSuccess,
  onChangeMethod,
}: DirectPaymentViewProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [isPaid, setIsPaid] = useState(false)

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => {
      setCopiedKey(null)
    }, 2000)
  }

  // Polling status pesanan
  const checkPaymentStatus = useCallback(async () => {
    if (isPaid || !bookingCode) return
    setChecking(true)
    try {
      const endpoint = isMerch
        ? `/api/merch/orders/${encodeURIComponent(bookingCode)}`
        : `/api/transactions/${encodeURIComponent(bookingCode)}`

      const res = await fetch(endpoint)
      const json = await res.json()
      const status = json.data?.status_bayar

      if (status === 'berhasil') {
        setIsPaid(true)
        setTimeout(() => {
          onSuccess()
        }, 1200)
      }
    } catch {
      // ignore network glitch
    } finally {
      setChecking(false)
    }
  }, [bookingCode, isMerch, isPaid, onSuccess])

  useEffect(() => {
    if (isPaid) return
    const interval = setInterval(() => {
      checkPaymentStatus()
    }, 4000)
    return () => clearInterval(interval)
  }, [checkPaymentStatus, isPaid])

  const isQris = data.payment_method === 'qris' || data.payment_type === 'qris'
  const isShopeepay = data.payment_method === 'shopeepay' || data.payment_type === 'shopeepay'
  const isCStore =
    data.payment_method === 'indomaret' ||
    data.payment_method === 'alfamart' ||
    data.payment_type === 'cstore'
  const isEChannel =
    data.payment_method === 'echannel' ||
    data.payment_method === 'mandiri' ||
    data.payment_type === 'echannel'
  const isBankTransfer = !isQris && !isShopeepay && !isCStore && !isEChannel

  const bankName = (data.bank || data.payment_method.replace('_va', '')).toUpperCase()

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Top Header Minimalis */}
      <div className="px-6 sm:px-8 py-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Instruksi Pembayaran
          </span>
          <h2 className="text-xl font-bold text-gray-900 mt-1">
            {isQris && 'Pembayaran QRIS'}
            {isShopeepay && 'Pembayaran ShopeePay'}
            {isBankTransfer && `Virtual Account ${bankName}`}
            {isEChannel && 'Mandiri Bill Payment'}
            {isCStore && `Gerai ${data.payment_method.toUpperCase()}`}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Selesaikan transaksi sebelum batas waktu berakhir.
          </p>
        </div>

        <div className="sm:text-right">
          <span className="text-[11px] text-gray-400 block">Total Tagihan</span>
          <span className="text-2xl font-bold text-gray-900 tracking-tight">
            {formatRupiah(data.gross_amount)}
          </span>
        </div>
      </div>

      <div className="p-6 sm:p-8 space-y-8">
        {/* Status Bar Clean */}
        <div className="flex items-center justify-between gap-4 p-3.5 bg-gray-50 rounded-xl border border-gray-100 text-xs">
          <div className="flex items-center gap-2.5">
            {isPaid ? (
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            ) : (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
            )}
            <span className="text-gray-600 font-medium">
              {isPaid ? 'Pembayaran berhasil dikonfirmasi' : 'Menunggu pembayaran...'}
            </span>
          </div>

          <button
            type="button"
            onClick={checkPaymentStatus}
            disabled={checking || isPaid}
            className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white disabled:from-gray-200 disabled:to-gray-200 disabled:text-gray-400 transition shadow-sm cursor-pointer disabled:cursor-not-allowed"
          >
            {checking ? 'Memeriksa...' : 'Cek Status'}
          </button>
        </div>

        {/* 1. KONTEN QRIS */}
        {isQris && (
          <div className="flex flex-col items-center">
            {/* Frame QRIS Clean Monochrome */}
            <div className="w-full max-w-xs bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col items-center text-center">
              <div className="w-full flex items-center justify-between pb-3 border-b border-gray-100">
                <span className="text-xs font-black tracking-widest text-gray-900">QRIS</span>
                <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                  GPN
                </span>
              </div>

              <div className="py-2">
                <p className="text-xs font-semibold text-gray-800">EncoreTix Event</p>
                <p className="text-[10px] text-gray-400">NMID: ID102026111200000</p>
              </div>

              <div className="my-2 p-2 bg-white rounded-lg border border-gray-100 flex items-center justify-center">
                {data.qr_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={data.qr_url}
                    alt="QRIS"
                    className="w-52 h-52 object-contain"
                  />
                ) : data.qr_string ? (
                  <RealQR value={data.qr_string} size={208} />
                ) : (
                  <div className="w-52 h-52 bg-gray-50 flex items-center justify-center text-gray-400 text-xs">
                    Memuat QRIS...
                  </div>
                )}
              </div>

              <div className="w-full pt-3 border-t border-gray-100">
                <span className="text-[11px] text-gray-400 block">Nominal Pembayaran</span>
                <span className="text-base font-bold text-gray-900">
                  {formatRupiah(data.gross_amount)}
                </span>
              </div>
            </div>

            {/* Aksi Unduh QR */}
            {(data.qr_url || data.qr_string) && (
              <a
                href={data.qr_url || '#'}
                target="_blank"
                rel="noreferrer"
                download={`QRIS-EncoreTix-${bookingCode}.png`}
                className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-gray-600 hover:text-gray-900 transition"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Unduh Kode QR
              </a>
            )}

            {/* Panduan Ringkas */}
            <div className="w-full max-w-md mt-6 pt-6 border-t border-gray-100">
              <h4 className="text-xs font-semibold text-gray-900 mb-3 uppercase tracking-wider">
                Langkah Pembayaran
              </h4>
              <ol className="space-y-2 text-xs text-gray-500 leading-relaxed list-decimal list-inside">
                <li>Buka aplikasi m-Banking atau e-Wallet pendukung QRIS.</li>
                <li>Pilih fitur <strong>Scan</strong> dan arahkan kamera ke kode QR.</li>
                <li>Periksa nominal tagihan dan konfirmasi pembayaran.</li>
              </ol>
            </div>
          </div>
        )}

        {/* 2. KONTEN SHOPEEPAY */}
        {isShopeepay && (
          <div className="max-w-lg mx-auto space-y-6">
            <div className="p-6 bg-gray-50 border border-gray-200 rounded-xl text-center">
              <span className="text-[11px] text-gray-400 uppercase tracking-wider block">
                Total pembayaran
              </span>
              <p className="text-2xl font-bold text-gray-900 my-2">
                {formatRupiah(data.gross_amount)}
              </p>
              <span className="text-[11px] text-gray-400 block">
                Bayar langsung melalui aplikasi Shopee
              </span>
            </div>

            {data.deeplink_url ? (
              <a
                href={data.deeplink_url}
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white shadow-sm transition"
              >
                Buka Aplikasi Shopee
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            ) : (
              <p className="text-center text-xs text-gray-400">
                Menyiapkan tautan pembayaran ShopeePay...
              </p>
            )}

            <div className="pt-4 border-t border-gray-100">
              <h4 className="text-xs font-semibold text-gray-900 mb-3 uppercase tracking-wider">
                Langkah Pembayaran
              </h4>
              <ol className="space-y-1.5 text-xs text-gray-500 leading-relaxed list-decimal list-inside">
                <li>Tekan tombol <strong>Buka Aplikasi Shopee</strong> di atas.</li>
                <li>Periksa detail dan nominal tagihan di aplikasi Shopee.</li>
                <li>Konfirmasi pembayaran dengan PIN ShopeePay.</li>
                <li>Kembali ke halaman ini; status tiket akan diperbarui otomatis.</li>
              </ol>
            </div>
          </div>
        )}

        {/* 3. KONTEN VIRTUAL ACCOUNT */}
        {isBankTransfer && (
          <div className="max-w-lg mx-auto space-y-6">
            <div className="p-5 bg-gray-50 border border-gray-200 rounded-xl">
              <span className="text-[11px] text-gray-400 uppercase tracking-wider block">
                Nomor Virtual Account {bankName}
              </span>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-2xl font-mono font-bold text-gray-900 tracking-wider">
                  {data.va_number || '-'}
                </span>
                {data.va_number && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(data.va_number!, 'va')}
                    className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 transition shadow-sm"
                  >
                    {copiedKey === 'va' ? 'Tersalin' : 'Salin'}
                  </button>
                )}
              </div>
            </div>

            <div className="p-4 rounded-xl border border-gray-100 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-gray-400 block">Jumlah Transfer</span>
                <span className="text-lg font-bold text-gray-900">{formatRupiah(data.gross_amount)}</span>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(String(data.gross_amount), 'nominal')}
                className="text-xs text-gray-500 hover:text-gray-900 font-medium underline underline-offset-2"
              >
                {copiedKey === 'nominal' ? 'Tersalin' : 'Salin Nominal'}
              </button>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <h4 className="text-xs font-semibold text-gray-900 mb-3 uppercase tracking-wider">
                Petunjuk Transfer
              </h4>
              <ol className="space-y-1.5 text-xs text-gray-500 leading-relaxed list-decimal list-inside">
                <li>Buka aplikasi mobile banking {bankName}.</li>
                <li>Pilih menu <strong>Transfer &gt; Virtual Account</strong>.</li>
                <li>Masukkan nomor Virtual Account di atas.</li>
                <li>Konfirmasi transaksi dan simpan bukti transfer.</li>
              </ol>
            </div>
          </div>
        )}

        {/* 4. KONTEN MANDIRI E-CHANNEL */}
        {isEChannel && (
          <div className="max-w-lg mx-auto space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                <span className="text-[11px] text-gray-400 uppercase tracking-wider block">Biller Code</span>
                <span className="text-lg font-mono font-bold text-gray-900 mt-1 block">
                  {data.biller_code || '70012'}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(data.biller_code || '70012', 'biller')}
                  className="mt-2 text-xs text-gray-500 hover:text-gray-900 font-medium underline underline-offset-2"
                >
                  {copiedKey === 'biller' ? 'Tersalin' : 'Salin'}
                </button>
              </div>

              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                <span className="text-[11px] text-gray-400 uppercase tracking-wider block">Bill Key</span>
                <span className="text-lg font-mono font-bold text-gray-900 mt-1 block">
                  {data.bill_key || '-'}
                </span>
                {data.bill_key && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(data.bill_key!, 'billkey')}
                    className="mt-2 text-xs text-gray-500 hover:text-gray-900 font-medium underline underline-offset-2"
                  >
                    {copiedKey === 'billkey' ? 'Tersalin' : 'Salin'}
                  </button>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <h4 className="text-xs font-semibold text-gray-900 mb-3 uppercase tracking-wider">
                Petunjuk Bayar Livin&apos; by Mandiri
              </h4>
              <ol className="space-y-1.5 text-xs text-gray-500 leading-relaxed list-decimal list-inside">
                <li>Buka aplikasi Livin&apos; by Mandiri &gt; menu <strong>Bayar</strong>.</li>
                <li>Cari penyedia jasa sesuai Biller Code: <strong className="font-mono">{data.biller_code}</strong>.</li>
                <li>Masukkan Bill Key: <strong className="font-mono">{data.bill_key}</strong>.</li>
                <li>Konfirmasi detail tagihan dan masukkan PIN.</li>
              </ol>
            </div>
          </div>
        )}

        {/* 5. KONTEN RETAIL */}
        {isCStore && (
          <div className="max-w-lg mx-auto space-y-6">
            <div className="p-5 bg-gray-50 border border-gray-200 rounded-xl text-center">
              <span className="text-[11px] text-gray-400 uppercase tracking-wider block">
                Kode Pembayaran {data.payment_method.toUpperCase()}
              </span>
              <p className="text-2xl font-mono font-bold text-gray-900 tracking-wider my-2">
                {data.payment_code || '-'}
              </p>
              {data.payment_code && (
                <button
                  type="button"
                  onClick={() => copyToClipboard(data.payment_code!, 'code')}
                  className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 transition shadow-sm"
                >
                  {copiedKey === 'code' ? 'Tersalin' : 'Salin Kode'}
                </button>
              )}
            </div>

            <div className="pt-4 border-t border-gray-100">
              <h4 className="text-xs font-semibold text-gray-900 mb-3 uppercase tracking-wider">
                Cara Bayar di Kasir
              </h4>
              <ol className="space-y-1.5 text-xs text-gray-500 leading-relaxed list-decimal list-inside">
                <li>Kunjungi gerai {data.payment_method.toUpperCase()} terdekat.</li>
                <li>Sampaikan ke kasir pembayaran untuk <strong>EncoreTix</strong>.</li>
                <li>Tunjukkan kode pembayaran di atas dan bayar sesuai nominal.</li>
              </ol>
            </div>
          </div>
        )}

        {/* Navigasi Balik */}
        <div className="pt-6 border-t border-gray-100 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={onChangeMethod}
            className="inline-flex items-center gap-1 px-3.5 py-2 text-xs font-medium rounded-lg text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition cursor-pointer"
          >
            ← Ubah metode pembayaran
          </button>
          <span className="text-gray-400">Verifikasi otomatis</span>
        </div>
      </div>
    </div>
  )
}
