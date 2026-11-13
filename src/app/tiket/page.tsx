'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLang } from '@/lib/i18n'
import { friendlyError } from '@/app/lib/fetchError'
import StickyBottomBar from '@/components/StickyBottomBar'
import { clearPaymentCountdown } from '../lib/paymentTimer'

interface TicketItem {
  id: string
  kategori: string
  harga: number
  periode_penjualan: string | null
  deskripsi: string | null
  kuota: number
  sisa_kuota: number
  status?: string | null
}

const ADMIN_FEE_RATE = 0.04

function formatRupiah(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID')
}

export default function TicketListPage() {
  const router = useRouter()
  const { t } = useLang()
  const [tickets, setTickets] = useState<TicketItem[]>([])
  const [salesClosed, setSalesClosed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [qty, setQty] = useState<Record<string, number>>({})
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    // Bersihkan sesi pemesanan sebelumnya jika user kembali ke halaman tiket
    clearPaymentCountdown()
    try {
      localStorage.removeItem('encoretix_checkout_tiket_data')
      sessionStorage.removeItem('encoretix_checkout_tiket_data')
    } catch {}

    fetch('/api/tickets')
      .then((r) => r.json())
      .then((res) => {
        if (res.error) throw new Error(res.error)
        setTickets(res.data || [])
        setSalesClosed(!!res.sales_closed)
      })
      .catch((e) => setError(friendlyError(e)))
      .finally(() => setLoading(false))
  }, [])

  const handleSelectTicket = (id: string) => {
    setQty((prev) => ({
      ...prev,
      [id]: (prev[id] || 0) + 1,
    }))
  }

  const updateQty = (id: string, delta: number) => {
    setQty((prev) => {
      const current = prev[id] || 0
      const next = Math.max(0, current + delta)
      return { ...prev, [id]: next }
    })
  }

  const { subtotal, adminFee, total, hasItems, selected } = useMemo(() => {
    const selectedRows = tickets.filter((t) => (qty[t.id] || 0) > 0)
    const sub = selectedRows.reduce((sum, t) => sum + (qty[t.id] || 0) * Number(t.harga), 0)
    const fee = Math.round(sub * ADMIN_FEE_RATE)
    return { subtotal: sub, adminFee: fee, total: sub + fee, hasItems: sub > 0, selected: selectedRows }
  }, [qty, tickets])

  const checkoutUrl = selected.length
    ? `/checkout?tiket=${selected[0].id}&qty=${qty[selected[0].id]}`
    : '/checkout'

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-gray-400 text-sm">
        {t({ ID: 'Memuat daftar tiket', EN: 'Loading ticket list' })}<span className="loading-dots"><span /></span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 text-sm font-medium">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          {t({ ID: 'Pilih Tiket Kamu', EN: 'Choose Your Ticket' })}
        </h1>
        <button onClick={() => router.back()} className="text-sm font-medium text-gray-600 mt-2 hover:text-gray-900">
          &lt; {t({ ID: 'Kembali', EN: 'Back' })}
        </button>
      </div>

      {salesClosed && (
        <div className="mb-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 rounded-2xl p-5 flex gap-3">
          <span className="text-xl shrink-0">🔴</span>
          <div>
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">{t({ ID: 'Penjualan Tiket Ditutup', EN: 'Ticket Sales Closed' })}</p>
            <p className="text-xs text-red-600/80 dark:text-red-400 mt-0.5">{t({ ID: 'Penjualan tiket online sudah ditutup karena event telah berlangsung. Untuk pemesanan lebih lanjut, hubungi panitia.', EN: "Online ticket sales are closed as the event has started. For further purchases please contact the committee." })}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Ticket Cards List */}
        <div className="lg:col-span-8 space-y-4">
          {tickets.map((ticket) => {
            const soldOut = ticket.sisa_kuota <= 0
            const inactive = (ticket.status ?? 'aktif') === 'nonaktif'
            const closed = salesClosed || soldOut || inactive
            const closedLabel = salesClosed
              ? t({ ID: 'Ditutup', EN: 'Closed' })
              : inactive
                ? t({ ID: 'Selesai', EN: 'Ended' })
                : t({ ID: 'Sold Out', EN: 'Sold Out' })
            const currentQty = qty[ticket.id] || 0
            const isExpanded = expandedId === ticket.id

            return (
              <div
                key={ticket.id}
                className={`relative bg-white dark:bg-gray-900 border rounded-2xl p-5 sm:p-6 transition-all duration-200 group overflow-hidden ${
                  closed
                    ? 'border-gray-200 dark:border-gray-800 opacity-80'
                    : 'border-gray-200 dark:border-gray-800 hover:border-blue-500 hover:shadow-lg hover:-translate-y-0.5'
                }`}
              >
                {/* Vertical Blue Indicator Pill on the left edge */}
                <div
                  className={`absolute left-0 top-5 w-1.5 h-7 rounded-r-full transition-colors ${
                    closed
                      ? 'bg-gray-300 dark:bg-gray-700'
                      : 'bg-gradient-to-b from-indigo-600 to-violet-600'
                  }`}
                />

                {/* Title */}
                <div className="pl-3 sm:pl-2">
                  <h3 className="font-bold text-gray-900 dark:text-white text-base sm:text-lg tracking-tight uppercase">
                    {ticket.kategori}
                    {ticket.periode_penjualan && (
                      <span className="text-gray-900 dark:text-white-400"> - {ticket.periode_penjualan}</span>
                    )}
                  </h3>

                  {/* Dashed line divider */}
                  <div className="border-b border-dashed border-gray-100 dark:border-gray-800 my-3" />

                  {/* Description */}
                  <p
                    className={`text-xs sm:text-sm text-gray-500 dark:text-gray-400 leading-relaxed ${
                      isExpanded ? '' : 'line-clamp-2'
                    }`}
                  >
                    {ticket.deskripsi || t({ ID: 'Belum ada deskripsi untuk tiket ini.', EN: 'No description for this ticket yet.' })}
                  </p>

                  <button
                    type="button"
                    onClick={() => setExpandedId((prev) => (prev === ticket.id ? null : ticket.id))}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline mt-1.5 cursor-pointer"
                  >
                    {isExpanded ? t({ ID: 'Tutup detail', EN: 'Close detail' }) : t({ ID: 'Lihat detail', EN: 'View detail' })}
                  </button>

                  {/* Bottom Row: Price & Action */}
                  <div className="mt-4 pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                    <p className="text-lg sm:text-xl font-black text-gray-900 dark:text-white tracking-tight">
                      {formatRupiah(Number(ticket.harga))}
                    </p>

                    <div>
                      {closed ? (
                        <span className="inline-flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-400 border border-gray-200 dark:border-gray-700 font-semibold px-6 py-2.5 rounded-xl text-xs sm:text-sm select-none cursor-not-allowed shadow-2xs">
                          {closedLabel}
                        </span>
                      ) : currentQty > 0 ? (
                        <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl p-1 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => updateQty(ticket.id, -1)}
                            className="w-8 h-8 rounded-lg bg-white dark:bg-gray-900 text-blue-600 font-bold hover:bg-blue-100 dark:hover:bg-blue-900/50 flex items-center justify-center transition-colors shadow-2xs cursor-pointer"
                            aria-label={t({ ID: 'Kurangi jumlah', EN: 'Decrease quantity' })}
                          >
                            −
                          </button>
                          <span className="w-8 text-center text-sm font-bold text-blue-950 dark:text-white">
                            {currentQty}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQty(ticket.id, 1)}
                            disabled={currentQty >= ticket.sisa_kuota}
                            className="w-8 h-8 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold flex items-center justify-center transition-colors shadow-2xs cursor-pointer disabled:from-gray-200 disabled:to-gray-200 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
                            aria-label={t({ ID: 'Tambah jumlah', EN: 'Increase quantity' })}
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSelectTicket(ticket.id)}
                          className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold px-6 py-2.5 rounded-xl text-xs sm:text-sm shadow-xs transition-all active:scale-95 cursor-pointer"
                        >
                          {t({ ID: 'Pilih Tiket', EN: 'Choose Ticket' })}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {/* Help box */}
          <div className="flex items-start gap-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 mt-6">
            <span className="text-lg mt-0.5">💬</span>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{t({ ID: 'Butuh Bantuan?', EN: 'Need Help?' })}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {t({ ID: 'Hubungi customer service kami jika kamu mengalami kendala dalam pemilihan tiket.', EN: 'Contact our customer service if you experience any issues choosing your ticket.' })}{' '}
                <a
                  href="https://wa.me/6287763743577"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 font-semibold underline"
                >
                  {t({ ID: 'Customer Service', EN: 'Customer Service' })}
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Order Summary Sidebar */}
        <div className="lg:col-span-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 lg:sticky lg:top-20 shadow-xs">
            <h3 className="font-bold text-gray-900 dark:text-white text-base mb-4">
              {t({ ID: 'Pesanan Kamu', EN: 'Your Order' })}
            </h3>

            {!hasItems ? (
              <div className="text-center py-8">
                <div className="text-3xl mb-2">🎟️</div>
                <p className="text-sm text-gray-400">{t({ ID: 'Belum ada tiket yang dipilih', EN: 'No ticket selected yet' })}</p>
              </div>
            ) : (
              <div className="space-y-2.5 mb-4 max-h-56 overflow-y-auto pr-1">
                {selected.map((s) => (
                  <div key={s.id} className="flex justify-between items-center text-xs sm:text-sm">
                    <span className="text-gray-700 dark:text-gray-300 font-medium truncate max-w-[180px]">
                      {s.kategori} <span className="text-blue-600 font-bold">× {qty[s.id]}</span>
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formatRupiah(Number(s.harga) * (qty[s.id] || 0))}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-gray-100 dark:border-gray-800 pt-3.5 space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between text-gray-500 dark:text-gray-400">
                <span>{t({ ID: 'Subtotal', EN: 'Subtotal' })}</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatRupiah(subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-500 dark:text-gray-400">
                <span>{t({ ID: 'Biaya Admin (4%)', EN: 'Admin Fee (4%)' })}</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatRupiah(adminFee)}</span>
              </div>
              <div className="flex justify-between font-bold text-gray-900 dark:text-white pt-2.5 border-t border-gray-100 dark:border-gray-800 mt-2 text-sm sm:text-base">
                <span>{t({ ID: 'Total Pembayaran', EN: 'Total Payment' })}</span>
                <span className="text-blue-600 dark:text-blue-400 font-black">{formatRupiah(total)}</span>
              </div>
            </div>

            {hasItems ? (
              <Link
                href={checkoutUrl}
                className="block text-center bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-semibold py-3.5 rounded-xl mt-5 shadow-xs transition-colors active:scale-[0.99]"
              >
                {t({ ID: 'Lanjutkan →', EN: 'Continue →' })}
              </Link>
            ) : (
              <button
                disabled
                className="block w-full text-center bg-gray-100 dark:bg-gray-800 text-gray-400 text-sm font-semibold py-3.5 rounded-xl mt-5 cursor-not-allowed"
              >
                {t({ ID: 'Pilih Tiket Terlebih Dahulu', EN: 'Select a Ticket First' })}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sticky bottom bar HP: total + lanjutkan */}
      <StickyBottomBar
        label={t({ ID: 'Total Pembayaran', EN: 'Total Payment' })}
        value={formatRupiah(total)}
      >
        {hasItems ? (
          <Link
            href={checkoutUrl}
            className="inline-flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold px-6 py-3 rounded-full shadow-xs"
          >
            {t({ ID: 'Lanjutkan →', EN: 'Continue →' })}
          </Link>
        ) : (
          <span className="inline-flex items-center bg-gray-100 text-gray-400 text-sm font-semibold px-6 py-3 rounded-full select-none">
            {t({ ID: 'Pilih Tiket', EN: 'Choose Ticket' })}
          </span>
        )}
      </StickyBottomBar>
    </div>
  )
}