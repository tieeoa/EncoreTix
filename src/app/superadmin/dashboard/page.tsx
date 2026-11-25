'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import SuperAdminSidebar from '@/components/layout/SuperAdminSidebar'
import DashboardHeader from '@/components/layout/DashboardHeader'
import EventSelector from '@/components/EventSelector'
import { getAdminSession, useAdminName, adminFetch } from '@/lib/adminAuth'
import { useSelectedEventId } from '@/lib/eventStore'
import { useLang } from '@/lib/i18n'
import { friendlyError } from '@/app/lib/fetchError'
import Toast from '@/components/Toast'
import LoadingDots from '@/components/LoadingDots'

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
  transaksiGagal: number
  totalTransaksi: number
  tiketBreakdown: { kategori: string; terjual: number; total: number; sisa: number; harga: number; persen: number; revenue: number }[]
  merchBreakdown: { nama: string; harga: number; stok: number; terjual: number; revenue: number }[]
}

function formatRupiah(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID')
}

export default function SuperAdminDashboardPage() {
  const { t } = useLang()
  const router = useRouter()
  const adminName = useAdminName()
  const [stats, setStats] = useState<Stats | null>(null)
  const [meta, setMeta] = useState<{ nama_event: string; finished: boolean } | null>(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const eventId = useSelectedEventId()

  useEffect(() => {
    const session = getAdminSession('superadmin')
    if (!session || session.role !== 'superadmin') {
      router.replace('/superadmin/login')
      return
    }
    const ev = eventId ? `event=${encodeURIComponent(eventId)}` : ''
    const q = ev ? `?${ev}` : ''
    adminFetch(`/api/dashboard/stats${q}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.error) throw new Error(res.error)
        setStats(res.data)
      })
      .catch((e) => setError(friendlyError(e)))

    adminFetch('/api/events/summaries')
      .then((r) => r.json())
      .then((res) => {
        if (res.error) return
        const list = res.data || []
        const target = eventId
          ? list.find((s: { id: string }) => s.id === eventId)
          : list.find((s: { status: string }) => s.status === 'active')
        if (target) setMeta({ nama_event: target.nama_event, finished: target.finished })
        else if (list[0]) setMeta({ nama_event: list[0].nama_event, finished: list[0].finished })
      })
      .catch(() => {})
  }, [router, eventId])

  const STATS_CARDS = stats
    ? [
        {
          label: t({ ID: 'Total Pendapatan', EN: 'Total Revenue' }),
          value: formatRupiah(stats.totalRevenue),
          sub: t({ ID: 'Tiket + merchandise', EN: 'Tickets + merchandise' }),
          iconColor: 'bg-emerald-50 text-emerald-600',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          trend: `${stats.transaksiBerhasil} ${t({ ID: 'berhasil', EN: 'successful' })}`,
          trendColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        },
        {
          label: t({ ID: 'Total Tiket Terjual', EN: 'Total Tickets Sold' }),
          value: stats.tiketTerjual.toLocaleString('id-ID'),
          sub: `${t({ ID: 'Dari', EN: 'From' })} ${stats.totalKuota.toLocaleString('id-ID')} ${t({ ID: 'kuota', EN: 'quota' })}`,
          iconColor: 'bg-blue-50 text-blue-600',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
          ),
          trend: `${stats.tiketLunas.toLocaleString('id-ID')} ${t({ ID: 'lunas', EN: 'paid' })}`,
          trendColor: 'bg-blue-50 text-blue-700 border-blue-200',
        },
        {
          label: t({ ID: 'Total Transaksi', EN: 'Total Transactions' }),
          value: stats.totalTransaksi.toLocaleString('id-ID'),
          sub: `${stats.transaksiPending} ${t({ ID: 'pending', EN: 'pending' })} · ${stats.transaksiGagal ?? 0} ${t({ ID: 'gagal', EN: 'failed' })}`,
          iconColor: 'bg-indigo-50 text-indigo-600',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          ),
          trend: `${stats.checkin} check-in`,
          trendColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        },
        {
          label: t({ ID: 'Merchandise Terjual', EN: 'Merchandise Sold' }),
          value: stats.merchTerjual.toLocaleString('id-ID'),
          sub: `${stats.merchDiambil} ${t({ ID: 'sudah diambil', EN: 'picked up' })}`,
          iconColor: 'bg-amber-50 text-amber-600',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          ),
          trend: `${stats.merchBelum} ${t({ ID: 'menunggu', EN: 'awaiting' })}`,
          trendColor: 'bg-amber-50 text-amber-700 border-amber-200',
        },
      ]
    : []

  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      <SuperAdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search dashboard..."
          userName={adminName || 'Super Admin'}
          userRole="Super Admin"
        />

        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto overflow-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {meta?.nama_event || t({ ID: 'Dashboard Utama', EN: 'Main Dashboard' })}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {meta?.finished
                  ? t({ ID: 'Event selesai · ringkasan akhir', EN: 'Event finished · final summary' })
                  : t({ ID: 'Ringkasan Keseluruhan & Eksekutif', EN: 'Overall & Executive Summary' })}
              </p>
              {error && <Toast ok={false} text={error} onClose={() => setError('')} className="mt-2" />}
            </div>
            <div className="flex items-center gap-3">
              {meta?.finished ? (
                <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-4 py-2 shadow-sm text-xs font-medium text-rose-700">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {t({ ID: 'Event Selesai', EN: 'Event Finished' })}
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-white border border-slate-200/90 rounded-xl px-4 py-2 shadow-sm text-xs font-medium text-slate-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  {t({ ID: 'Event Aktif', EN: 'Active Event' })}
                </div>
              )}
              <EventSelector />
            </div>
          </div>

          {/* 4 Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
            {STATS_CARDS.map((stat) => (
              <div
                key={stat.label}
                className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm hover:border-blue-200 hover:shadow-md hover:shadow-blue-900/[0.06] hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${stat.iconColor}`}>
                    {stat.icon}
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${stat.trendColor}`}>
                    {stat.trend}
                  </span>
                </div>
                <p className="text-2xl md:text-3xl font-bold text-slate-900 mb-1">{stat.value}</p>
                <p className="text-xs font-semibold text-slate-600">{stat.label}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{stat.sub}</p>
              </div>
            ))}
          </div>

          {meta?.finished ? (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                <h3 className="text-base font-bold text-slate-900">{t({ ID: 'Ringkasan Akhir Event', EN: 'Final Event Summary' })}</h3>
              </div>
              <p className="text-xs text-slate-400 mb-6">
                {t({ ID: 'Event ini sudah selesai. Datanya tersimpan permanen di database dan hanya ditampilkan sebagai ringkasan.', EN: 'This event has finished. Its data is kept permanently in the database and is shown as a summary only.' })}
              </p>

              {!stats ? (
                <p className="text-sm text-slate-400 py-8 text-center">{t({ ID: 'Memuat ringkasan', EN: 'Loading summary' })}<LoadingDots /></p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  {[
                    { label: t({ ID: 'Total Pendapatan', EN: 'Total Revenue' }), value: formatRupiah(stats.totalRevenue), color: 'text-blue-600' },
                    { label: t({ ID: 'Tiket Terjual', EN: 'Tickets Sold' }), value: stats.tiketTerjual.toLocaleString('id-ID'), color: 'text-emerald-600' },
                    { label: t({ ID: 'Performa Merchandise', EN: 'Merch Performance' }), value: `${stats.merchTerjual.toLocaleString('id-ID')} (${formatRupiah(stats.revenueMerch)})`, color: 'text-amber-600' },
                    { label: t({ ID: 'Total Transaksi', EN: 'Total Transactions' }), value: stats.totalTransaksi.toLocaleString('id-ID'), color: 'text-indigo-600' },
                  ].map((k) => (
                    <div key={k.label} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5">
                      <p className={`text-xl md:text-2xl font-bold ${k.color} mb-1`}>{k.value}</p>
                      <p className="text-xs font-semibold text-slate-600">{k.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
          <>
          {/* Breakdown & Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Left: Breakdown */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-bold text-slate-900">
                  {t({ ID: 'Breakdown Penjualan Tiket', EN: 'Ticket Sales Breakdown' })}
                </h3>
                <Link href="/superadmin/tickets" className="text-xs font-semibold text-blue-600 hover:underline">
                  {t({ ID: 'Lihat Detail →', EN: 'View Details →' })}
                </Link>
              </div>

              {!stats || stats.tiketBreakdown.length === 0 ? (
                <p className="text-sm text-slate-400 py-8 text-center">{t({ ID: 'Belum ada data penjualan.', EN: 'No sales data yet.' })}</p>
              ) : (
                <div className="space-y-5">
                  {stats.tiketBreakdown.map((b, index) => (
                    <div key={`${b.kategori}-${index}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-slate-800">{b.kategori}</span>
                        <span className="text-sm font-bold text-slate-900">{b.terjual} / {b.total}</span>
                      </div>
                      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden mb-1.5">
                        <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${b.persen}%` }} />
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">{b.persen}% {t({ ID: 'terjual', EN: 'sold' })}</span>
                        <span className="font-semibold text-blue-600">{formatRupiah(b.revenue)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Quick Actions */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 mb-5">{t({ ID: 'Aksi Cepat', EN: 'Quick Actions' })}</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5">
                  {[
                    {
                      label: t({ ID: 'Kelola Event', EN: 'Manage Events' }),
                      href: '/superadmin/events',
                      color: 'bg-violet-50 text-violet-700 hover:bg-violet-100 hover:border-violet-300/80 border border-violet-200/60',
                      icon: (
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      ),
                    },
                    {
                      label: t({ ID: 'Kelola Tiket', EN: 'Manage Tickets' }),
                      href: '/superadmin/tickets',
                      color: 'bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-300/80 border border-blue-200/60',
                      icon: (
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                        </svg>
                      ),
                    },
                    {
                      label: t({ ID: 'Kelola Merch', EN: 'Manage Merch' }),
                      href: '/superadmin/merchandise',
                      color: 'bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-300/80 border border-amber-200/60',
                      icon: (
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                      ),
                    },
                    {
                      label: t({ ID: 'Kelola Voucher', EN: 'Manage Vouchers' }),
                      href: '/superadmin/vouchers',
                      color: 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100 hover:border-cyan-300/80 border border-cyan-200/60',
                      icon: (
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                        </svg>
                      ),
                    },
                    {
                      label: t({ ID: 'Lihat Laporan', EN: 'View Reports' }),
                      href: '/superadmin/reports',
                      color: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300/80 border border-emerald-200/60',
                      icon: (
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M7 16v-4M12 16v-8M17 16v-6" />
                        </svg>
                      ),
                    },
                    {
                      label: t({ ID: 'Transaksi', EN: 'Transactions' }),
                      href: '/superadmin/transactions',
                      color: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300/80 border border-indigo-200/60',
                      icon: (
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zM3 11h18" />
                        </svg>
                      ),
                    },
                  ].map((action, index) => (
                    <Link
                      key={`${action.label}-${index}`}
                      href={action.href}
                      className={`flex flex-col items-center justify-center gap-2 rounded-2xl p-5 text-center transition-all shadow-sm ${action.color}`}
                    >
                      <span className="w-10 h-10 flex items-center justify-center">{action.icon}</span>
                      <span className="text-xs font-bold">{action.label}</span>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="mt-5 p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-500 flex items-center justify-between">
                <span>{t({ ID: 'Pembaruan data otomatis realtime', EN: 'Automatic realtime data updates' })}</span>
                <span className="font-semibold text-blue-600 cursor-pointer hover:underline" onClick={() => window.location.reload()}>
                  {t({ ID: 'Refresh Data', EN: 'Refresh Data' })}
                </span>
              </div>
            </div>
          </div>

          {/* Revenue Overview Banner */}
          <div className="bg-gradient-to-r from-blue-700 to-indigo-800 rounded-2xl p-6 md:p-8 text-white shadow-md">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-200 mb-1">
                  {t({ ID: 'Total Revenue Keseluruhan', EN: 'Overall Total Revenue' })}
                </p>
                <p className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight break-words">{formatRupiah(stats?.totalRevenue ?? 0)}</p>
                <p className="text-xs text-blue-100 mt-2">
                  {t({ ID: 'Tiket', EN: 'Tickets' })}: <span className="font-bold">{formatRupiah(stats?.revenueTiket ?? 0)}</span> · {t({ ID: 'Merch', EN: 'Merch' })}: <span className="font-bold">{formatRupiah(stats?.revenueMerch ?? 0)}</span>
                </p>
              </div>
              <div className="sm:text-right bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4">
                <p className="text-xs text-blue-200 mb-1">{t({ ID: 'Total Penonton Check-In', EN: 'Checked In Attendees' })}</p>
                <p className="text-2xl font-bold">{stats?.checkin ?? 0}</p>
                <p className="text-[11px] text-blue-200 mt-0.5">
                  {t({ ID: 'Dari', EN: 'From' })} {stats?.tiketLunas ?? 0} {t({ ID: 'tiket lunas', EN: 'paid tickets' })}
                </p>
              </div>
            </div>
          </div>
          </>
          )}
        </main>
      </div>
    </div>
  )
}