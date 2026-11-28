'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import SuperAdminSidebar from '@/components/layout/SuperAdminSidebar'
import DashboardHeader from '@/components/layout/DashboardHeader'
import EventSelector from '@/components/EventSelector'
import LoadingDots from '@/components/LoadingDots'
import { getAdminSession, useAdminName, adminFetch } from '@/lib/adminAuth'
import { useSelectedEventId } from '@/lib/eventStore'
import { useSelectedEventStatus } from '@/lib/useEventStatus'
import { useLang } from '@/lib/i18n'
import { friendlyError } from '@/app/lib/fetchError'

function formatRupiah(n: number) { return 'Rp ' + n.toLocaleString('id-ID') }

function StatIcon({ path }: { path: string }) {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  )
}

interface Stats {
  totalKuota: number
  tiketTerjual: number
  tiketLunas: number
  checkin: number
  manualOrders: number
  merchBelum: number
  merchDiambil: number
  merchTerjual: number
  revenueTiket: number
  revenueMerch: number
  totalRevenue: number
  transaksiBerhasil: number
  transaksiPending: number
  totalTransaksi: number
  paymentBreakdown?: { metode: string; label: string; transaksi: number; revenue: number }[]
  manualSummary?: { orders: number; tiket: number; revenue: number; onlineOrders: number; onlineTiket: number; onlineRevenue: number; sharePct: number }
  revenueTrend?: { daily: TrendPoint[]; weekly: TrendPoint[]; monthly: TrendPoint[] }
  tiketBreakdown: { id: string; kategori: string; periode: string | null; terjual: number; total: number; sisa: number; harga: number; persen: number; revenue: number }[]
  merchBreakdown: { id: string; nama: string; harga: number; stok: number; terjual: number; revenue: number }[]
}

interface TrendPoint {
  key: string
  label: string
  tiket: number
  merch: number
  total: number
}

type TrendMode = 'daily' | 'weekly' | 'monthly'

function formatShortRp(n: number) {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })}M`
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })}jt`
  if (n >= 1_000) return `Rp ${Math.round(n / 1_000)}rb`
  return 'Rp ' + n.toLocaleString('id-ID')
}

// Grafik batang bertumpuk murni (tanpa library): biru = tiket, amber = merch.
// Animasi grow + stagger tiap ganti periode, plus hover highlight.
function RevenueChart({ points, emptyLabel, animKey }: { points: TrendPoint[]; emptyLabel: string; animKey: string }) {
  const max = Math.max(1, ...points.map((p) => p.total))
  const showEvery = points.length > 12 ? 2 : 1
  return (
    <div>
      <style>{`@keyframes encoretix-bar-grow { from { transform: scaleY(0); } to { transform: scaleY(1); } } @keyframes encoretix-fade-up { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      {points.every((p) => p.total === 0) ? (
        <p className="text-xs text-slate-400 py-8 text-center">{emptyLabel}</p>
      ) : (
        <>
          <div key={animKey} className="flex items-end gap-1.5 sm:gap-2 h-44 sm:h-52">
            {points.map((p, i) => {
              const h = Math.max(2, Math.round((p.total / max) * 100))
              const tiketH = p.total > 0 ? Math.round((p.tiket / p.total) * 100) : 0
              return (
                <div key={p.key} className="group flex-1 flex flex-col items-center gap-1.5 min-w-0 h-full justify-end" title={`${p.label}: ${formatRupiah(p.total)} (Tiket ${formatRupiah(p.tiket)} + Merch ${formatRupiah(p.merch)})`}>
                  <span
                    className="text-[10px] font-semibold text-slate-500 hidden sm:block transition-opacity group-hover:text-slate-800 group-hover:opacity-100"
                    style={{ animation: `encoretix-fade-up 0.4s ease-out both`, animationDelay: `${i * 35}ms` }}
                  >
                    {p.total > 0 ? formatShortRp(p.total) : ''}
                  </span>
                  <div
                    className="w-full rounded-t-md overflow-hidden bg-slate-100 flex flex-col justify-end origin-bottom transition-all duration-200 group-hover:brightness-110 group-hover:shadow-md group-hover:shadow-blue-900/10 group-hover:-translate-y-0.5"
                    style={{ height: `${h}%`, animation: `encoretix-bar-grow 0.55s cubic-bezier(0.22, 1, 0.36, 1) both`, animationDelay: `${i * 35}ms` }}
                  >
                    {p.merch > 0 && <div className="w-full bg-gradient-to-t from-amber-500 to-amber-300" style={{ height: `${100 - tiketH}%` }} />}
                    {p.tiket > 0 && <div className="w-full bg-gradient-to-t from-blue-700 to-blue-500" style={{ height: `${tiketH}%` }} />}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex gap-1.5 sm:gap-2 mt-2">
            {points.map((p, i) => (
              <span key={p.key} className="flex-1 text-center text-[9px] sm:text-[10px] text-slate-400 truncate">
                {i % showEvery === 0 ? p.label : ''}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-600 inline-block" />Tiket</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" />Merch</span>
          </div>
        </>
      )}
    </div>
  )
}

export default function SuperAdminReportsPage() {
  const { t } = useLang()
  const router = useRouter()
  const adminName = useAdminName()
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const eventId = useSelectedEventId()
  const { finished } = useSelectedEventStatus()
  const [downloading, setDownloading] = useState(false)
  const [dlError, setDlError] = useState('')
  const [trendMode, setTrendMode] = useState<TrendMode>('daily')

  useEffect(() => {
    const session = getAdminSession('superadmin')
    if (!session || session.role !== 'superadmin') {
      router.replace('/superadmin/login')
      return
    }
    const url = eventId ? `/api/dashboard/stats?event=${encodeURIComponent(eventId)}` : '/api/dashboard/stats'
    adminFetch(url)
      .then((r) => r.json())
      .then((res) => {
        if (res.error) throw new Error(res.error)
        setStats(res.data)
      })
      .catch((e) => setError(friendlyError(e)))
  }, [router, eventId])

  // Unduh laporan PDF secara manual (tersedia untuk event yang sudah selesai).
  const downloadReport = async () => {
    if (!finished) return
    setDownloading(true)
    setDlError('')
    try {
      const url = eventId ? `/api/reports/pdf?event=${encodeURIComponent(eventId)}` : '/api/reports/pdf'
      const res = await adminFetch(url)
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || 'Gagal membuat laporan')
      }
      const blob = await res.blob()
      const cd = res.headers.get('Content-Disposition') || ''
      const m = cd.match(/filename="([^"]+)"/)
      const filename = m?.[1] || 'Laporan-EncoreTix.pdf'
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(link.href)
    } catch (e) {
      setDlError(friendlyError(e))
    } finally {
      setDownloading(false)
    }
  }

  if (!stats) {
    return (
      <div className="flex min-h-screen bg-[#f8fafc]">
        <SuperAdminSidebar />
        <main className="flex-1 p-8 flex items-center justify-center text-slate-400 text-sm">{error || <>{t({ ID: 'Memuat data', EN: 'Loading data' })}<LoadingDots /></>}</main>
      </div>
    )
  }

  const tiketRevenue = stats.tiketBreakdown.reduce((sum, r) => sum + r.revenue, 0)
  const merchRevenue = stats.merchBreakdown.reduce((s, m) => s + m.revenue, 0)
  const totalRevenue = tiketRevenue + merchRevenue
  const payRows = stats.paymentBreakdown || []
  const payTotal = payRows.reduce((s, r) => s + r.revenue, 0)
  const manual = stats.manualSummary || { orders: stats.manualOrders, tiket: 0, revenue: 0, onlineOrders: 0, onlineTiket: 0, onlineRevenue: totalRevenue, sharePct: 0 }
  const trendPoints = stats.revenueTrend?.[trendMode] || []
  const trendPeak = trendPoints.reduce((m, p) => Math.max(m, p.total), 0)

  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      <SuperAdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder={t({ ID: 'Cari laporan...', EN: 'Search reports...' })}
          userName={adminName || 'Super Admin'}
          userRole="Super Admin"
        />
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto overflow-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t({ ID: 'Laporan & Analitik', EN: 'Reports & Analytics' })}</h1>
              <p className="text-sm text-slate-500 mt-1">{t({ ID: 'Ringkasan performa penjualan sesuai event terpilih', EN: 'Sales performance summary for the selected event' })}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                {!finished ? (
                  <p className="text-[11px] text-amber-600">
                    {t({ ID: 'Laporan PDF tersedia setelah event selesai', EN: 'PDF report available after event finishes' })}
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400">
                    {t({ ID: 'Unduh manual laporan event', EN: 'Manually download event report' })}
                  </p>
                )}
                {dlError && <p className="text-[11px] text-rose-600 mt-0.5">{dlError}</p>}
              </div>
              <button
                onClick={downloadReport}
                disabled={downloading || !finished}
                title={!finished ? t({ ID: 'Laporan tersedia setelah event selesai', EN: 'Report available after event finishes' }) : undefined}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-colors bg-white text-slate-700 border-slate-200 hover:text-blue-700 hover:border-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {downloading
                  ? <>{t({ ID: 'Membuat PDF', EN: 'Generating PDF' })}<LoadingDots /></>
                  : t({ ID: 'Download Laporan (PDF)', EN: 'Download Report (PDF)' })}
              </button>
              <EventSelector />
            </div>
          </div>

          {/* Overview Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 mb-6">
            {[
              { label: t({ ID: 'Total Revenue', EN: 'Total Revenue' }), value: formatRupiah(totalRevenue), icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1', iconColor: 'bg-emerald-50 text-emerald-600' },
              { label: t({ ID: 'Tiket Terjual', EN: 'Tickets Sold' }), value: stats.tiketTerjual, icon: 'M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z', iconColor: 'bg-blue-50 text-blue-600' },
              { label: t({ ID: 'Merch Terjual', EN: 'Merch Sold' }), value: stats.merchTerjual, icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z', iconColor: 'bg-amber-50 text-amber-600' },
              { label: t({ ID: 'Transaksi', EN: 'Transactions' }), value: stats.totalTransaksi, icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z', iconColor: 'bg-indigo-50 text-indigo-600' },
            ].map((s) => (
              <div key={s.label} className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm hover:border-blue-200 hover:shadow-md hover:shadow-blue-900/[0.06] hover:-translate-y-0.5 transition-all duration-200">
                <span className={`text-2xl block mb-3 w-11 h-11 flex items-center justify-center rounded-xl ${s.iconColor}`}><StatIcon path={s.icon} /></span>
                <p className="text-2xl font-bold text-slate-900">{s.value}</p>
                <p className="text-xs font-semibold text-slate-600 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Revenue split */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm mb-6">
            <p className="text-sm font-bold text-slate-900 mb-5">{t({ ID: 'Komposisi Revenue', EN: 'Revenue Breakdown' })}</p>
            <div className="space-y-4">
              {[
                { label: t({ ID: 'Revenue Tiket', EN: 'Ticket Revenue' }), value: tiketRevenue, total: totalRevenue, color: 'bg-blue-600' },
                { label: t({ ID: 'Revenue Merchandise', EN: 'Merchandise Revenue' }), value: merchRevenue, total: totalRevenue, color: 'bg-amber-500' },
              ].map((item) => {
                const pct = totalRevenue > 0 ? Math.round((item.value / totalRevenue) * 100) : 0
                return (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-slate-500">{item.label}</span>
                      <span className="text-slate-800 font-semibold">{formatRupiah(item.value)} ({pct}%)</span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${item.color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-5 pt-4 border-t border-slate-100">
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">{t({ ID: 'Total Revenue', EN: 'Total Revenue' })}</span>
                <span className="text-lg font-bold text-slate-900">{formatRupiah(totalRevenue)}</span>
              </div>
            </div>
          </div>

          {/* Grafik pendapatan */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div>
                <p className="text-sm font-bold text-slate-900">{t({ ID: 'Tren Pendapatan', EN: 'Revenue Trend' })}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {trendMode === 'daily'
                    ? t({ ID: '14 hari terakhir (transaksi berhasil)', EN: 'Last 14 days (successful transactions)' })
                    : trendMode === 'weekly'
                      ? t({ ID: '12 minggu terakhir, per pekan (Senin–Minggu)', EN: 'Last 12 weeks, per week (Mon–Sun)' })
                      : t({ ID: '12 bulan terakhir, per bulan', EN: 'Last 12 months, per month' })}
                  {trendPeak > 0 && <> · {t({ ID: 'Puncak', EN: 'Peak' })} {formatRupiah(trendPeak)}</>}
                </p>
              </div>
              <div className="flex gap-1.5 bg-slate-100 rounded-xl p-1 w-fit">
                {([
                  { key: 'daily', label: t({ ID: 'Harian', EN: 'Daily' }) },
                  { key: 'weekly', label: t({ ID: 'Mingguan', EN: 'Weekly' }) },
                  { key: 'monthly', label: t({ ID: 'Bulanan', EN: 'Monthly' }) },
                ] as { key: TrendMode; label: string }[]).map((o) => (
                  <button
                    key={o.key}
                    onClick={() => setTrendMode(o.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${trendMode === o.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <RevenueChart points={trendPoints} emptyLabel={t({ ID: 'Belum ada pendapatan pada periode ini', EN: 'No revenue in this period yet' })} animKey={trendMode} />
          </div>

          {/* Metode pembayaran + input manual */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
              <p className="text-sm font-bold text-slate-900 mb-1">{t({ ID: 'Ringkasan Metode Pembayaran', EN: 'Payment Method Summary' })}</p>
              <p className="text-xs text-slate-500 mb-5">{t({ ID: 'Tiket + merchandise, hanya transaksi berhasil', EN: 'Tickets + merchandise, successful transactions only' })}</p>
              {payRows.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">{t({ ID: 'Belum ada transaksi berhasil', EN: 'No successful transactions yet' })}</p>
              ) : (
                <div className="space-y-4">
                  {payRows.map((r) => {
                    const pct = payTotal > 0 ? Math.round((r.revenue / payTotal) * 100) : 0
                    return (
                      <div key={r.metode}>
                        <div className="flex justify-between text-xs mb-1.5 gap-2">
                          <span className="text-slate-700 font-semibold flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[11px]">{r.label}</span>
                            <span className="text-slate-400 font-normal">{r.transaksi}×</span>
                          </span>
                          <span className="text-slate-800 font-semibold text-right">{formatRupiah(r.revenue)} ({pct}%)</span>
                        </div>
                        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                  <div className="pt-3 border-t border-slate-100 flex justify-between">
                    <span className="text-xs text-slate-500">{t({ ID: 'Total (berhasil)', EN: 'Total (successful)' })}</span>
                    <span className="text-sm font-bold text-slate-900">{formatRupiah(payTotal)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
              <p className="text-sm font-bold text-slate-900 mb-1">{t({ ID: 'Input Manual Panitia', EN: 'Committee Manual Input' })}</p>
              <p className="text-xs text-slate-500 mb-5">{t({ ID: 'Order offline (source manual) vs penjualan online', EN: 'Offline orders (manual source) vs online sales' })}</p>
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  { label: t({ ID: 'Order Manual', EN: 'Manual Orders' }), value: String(manual.orders) },
                  { label: t({ ID: 'Tiket Manual Terjual', EN: 'Manual Tickets Sold' }), value: String(manual.tiket) },
                  { label: t({ ID: 'Revenue Manual', EN: 'Manual Revenue' }), value: formatShortRp(manual.revenue) },
                ].map((s) => (
                  <div key={s.label} className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3 text-center">
                    <p className="text-base font-bold text-slate-900 truncate" title={s.value}>{s.value}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                {[
                  { label: t({ ID: 'Manual (panitia)', EN: 'Manual (committee)' }), value: manual.revenue, color: 'bg-indigo-500' },
                  { label: t({ ID: 'Online (web)', EN: 'Online (web)' }), value: manual.onlineRevenue, color: 'bg-sky-400' },
                ].map((item) => {
                  const tot = manual.revenue + manual.onlineRevenue
                  const pct = tot > 0 ? Math.round((item.value / tot) * 100) : 0
                  return (
                    <div key={item.label}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-slate-500">{item.label}</span>
                        <span className="text-slate-800 font-semibold">{formatRupiah(item.value)} ({pct}%)</span>
                      </div>
                      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full ${item.color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="text-[11px] text-slate-400 mt-4">
                {t({ ID: `Kontribusi manual ${manual.sharePct}% dari total revenue · ${manual.onlineOrders} order online (${manual.onlineTiket} tiket). Merchandise selalu tercatat sebagai online.`, EN: `Manual contributes ${manual.sharePct}% of total revenue · ${manual.onlineOrders} online orders (${manual.onlineTiket} tickets). Merchandise is always recorded as online.` })}
              </p>
            </div>
          </div>

          {/* Ticket detail */}
          <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-sm mb-6">
            <div className="px-6 py-4 border-b border-slate-100">
              <p className="text-sm font-bold text-slate-900">{t({ ID: 'Detail Penjualan Tiket per Kategori', EN: 'Ticket Sales Detail by Category' })}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {[
                      t({ ID: 'Kategori', EN: 'Category' }),
                      t({ ID: 'Periode Penjualan', EN: 'Sales Period' }),
                      t({ ID: 'Harga', EN: 'Price' }),
                      t({ ID: 'Kuota', EN: 'Quota' }),
                      t({ ID: 'Terjual', EN: 'Sold' }),
                      t({ ID: 'Sisa', EN: 'Remaining' }),
                      t({ ID: 'Revenue', EN: 'Revenue' }),
                    ].map((h) => (
                      <th key={h} className="text-left px-6 py-3.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats.tiketBreakdown.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-slate-900 font-semibold">{r.kategori}</p>
                        <div className="h-1.5 bg-slate-100 rounded-full mt-1.5 w-24 overflow-hidden">
                          <div className="h-full bg-blue-600 rounded-full" style={{ width: `${r.persen}%` }} />
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 text-xs max-w-[160px]">{r.periode || '-'}</td>
                      <td className="px-6 py-4 text-slate-600">{formatRupiah(r.harga)}</td>
                      <td className="px-6 py-4 text-slate-600">{r.total}</td>
                      <td className="px-6 py-4 text-emerald-600 font-semibold">{r.terjual}</td>
                      <td className="px-6 py-4 text-slate-400">{r.sisa}</td>
                      <td className="px-6 py-4 text-blue-600 font-semibold">{formatRupiah(r.revenue)}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50/70">
                    <td className="px-6 py-3 text-xs font-bold text-slate-700">TOTAL</td>
                    <td className="px-6 py-3" />
                    <td className="px-6 py-3 font-bold text-slate-800">{stats.tiketBreakdown.reduce((sum, r) => sum + r.total, 0)}</td>
                    <td className="px-6 py-3 font-bold text-emerald-600">{stats.tiketBreakdown.reduce((sum, r) => sum + r.terjual, 0)}</td>
                    <td className="px-6 py-3 font-bold text-slate-500">{stats.tiketBreakdown.reduce((sum, r) => sum + r.sisa, 0)}</td>
                    <td className="px-6 py-3 font-bold text-blue-600">{formatRupiah(tiketRevenue)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Merch detail */}
          <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-100">
              <p className="text-sm font-bold text-slate-900">{t({ ID: 'Detail Penjualan Merchandise', EN: 'Merchandise Sales Detail' })}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {[
                      t({ ID: 'Produk', EN: 'Product' }),
                      t({ ID: 'Harga', EN: 'Price' }),
                      t({ ID: 'Stok', EN: 'Stock' }),
                      t({ ID: 'Terjual', EN: 'Sold' }),
                      t({ ID: 'Revenue', EN: 'Revenue' }),
                    ].map((h) => (
                      <th key={h} className="text-left px-6 py-3.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats.merchBreakdown.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4 text-slate-900 font-semibold">{m.nama}</td>
                      <td className="px-6 py-4 text-slate-600">{formatRupiah(m.harga)}</td>
                      <td className="px-6 py-4 text-slate-400">{m.stok}</td>
                      <td className="px-6 py-4 text-amber-600 font-semibold">{m.terjual}</td>
                      <td className="px-6 py-4 text-blue-600 font-semibold">{formatRupiah(m.revenue)}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50/70">
                    <td className="px-6 py-3 text-xs font-bold text-slate-700">TOTAL</td>
                    <td className="px-6 py-3" />
                    <td className="px-6 py-3" />
                    <td className="px-6 py-3 font-bold text-amber-600">{stats.merchBreakdown.reduce((s, m) => s + m.terjual, 0)}</td>
                    <td className="px-6 py-3 font-bold text-blue-600">{formatRupiah(merchRevenue)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}