'use client'

import { useState, useEffect } from 'react'
import AdminSidebar from '@/components/layout/AdminSidebar'
import DashboardHeader from '@/components/layout/DashboardHeader'
import { getAdminSession, useAdminName } from '@/lib/adminAuth'
import { useRouter } from 'next/navigation'
import { useLang } from '@/lib/i18n'
import { friendlyError } from '@/app/lib/fetchError'
import { labelMetode } from '@/app/lib/paymentMethod'
import Toast from '@/components/Toast'
import LoadingDots from '@/components/LoadingDots'

interface Stats {
  totalKuota: number
  tiketTerjual: number
  tiketLunas: number
  checkin: number
  manualOrders: number
  revenueTiket: number
  merchBelum: number
  merchDiambil: number
  totalRevenue: number
}

interface Pesanan {
  id: string
  booking_id: string
  jumlah: number
  source: string
  status_bayar: string
  status_check_in: string
  tanggal_pesan: string
  metode_pembayaran?: string | null
  customers: { nama: string } | null
  tiket: { kategori: string; harga: number } | null
}

function formatRupiah(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID')
}

export default function AdminDashboardPage() {
  const { t } = useLang()
  const router = useRouter()
  const adminName = useAdminName()
  const [stats, setStats] = useState<Stats | null>(null)
  const [orders, setOrders] = useState<Pesanan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [activeEvent, setActiveEvent] = useState<{ id: string; nama_event: string } | null>(null)

  useEffect(() => {
    const session = getAdminSession('admin')
    if (!session || session.role !== 'admin') {
      router.replace('/admin/login')
      return
    }
    ;(async () => {
      try {
        const evRes = await fetch('/api/events?active=true').then((r) => r.json())
        if (evRes.error) throw new Error(evRes.error)
        const active = evRes.data as { id: string; nama_event: string } | null
        setActiveEvent(active)

        if (!active) {
          setStats(null)
          setOrders([])
          return
        }

        const q = `event=${encodeURIComponent(active.id)}`
        const [statsRes, statsAllRes, ordersRes] = await Promise.all([
          // Tiket terjual + tabel tetap khusus manual/offline.
          fetch(`/api/dashboard/stats?${q}&source=offline`).then((r) => r.json()),
          // Angka check-in dari SEMUA tiket (online + offline) yang sudah masuk.
          fetch(`/api/dashboard/stats?${q}`).then((r) => r.json()),
          fetch(`/api/transactions?${q}&source=offline`).then((r) => r.json()),
        ])
        if (statsRes.error) throw new Error(statsRes.error)
        if (ordersRes.error) throw new Error(ordersRes.error)
        setStats({
          ...statsRes.data,
          // Override hanya angka check-in dengan hitungan semua sumber.
          checkin: statsAllRes.data?.checkin ?? statsRes.data?.checkin ?? 0,
        })
        setOrders((ordersRes.data || []).slice(0, 8))
      } catch (e) {
        setError(friendlyError(e))
      } finally {
        setLoading(false)
      }
    })()
  }, [router])

  const tiketTerjual = stats?.tiketTerjual ?? 0
  const totalKuota = stats?.totalKuota ?? 0
  const persen = totalKuota > 0 ? Math.round((tiketTerjual / totalKuota) * 100) : 0

  const STATS_CARDS = stats
    ? [
        {
          label: t({ ID: 'Tiket Terjual Manual', EN: 'Manual Tickets Sold' }),
          value: tiketTerjual.toLocaleString('id-ID'),
          sub: t({ ID: 'Dari input manual (offline)', EN: 'From manual (offline) input' }),
          iconColor: 'bg-blue-50 text-blue-600',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
          ),
          trend: `${stats.tiketLunas.toLocaleString('id-ID')} ${t({ ID: 'lunas', EN: 'paid' })}`,
          trendColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        },
        {
          label: t({ ID: 'Sudah Check-In', EN: 'Checked In' }),
          value: stats.checkin.toLocaleString('id-ID'),
          sub: t({ ID: 'Dari semua tiket (online + offline)', EN: 'From all tickets (online + offline)' }),
          iconColor: 'bg-emerald-50 text-emerald-600',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          trend: `${persen}% ${t({ ID: 'kehadiran', EN: 'attendance' })}`,
          trendColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        },
        {
          label: t({ ID: 'Total Manual Order', EN: 'Total Manual Orders' }),
          value: stats.manualOrders.toLocaleString('id-ID'),
          sub: t({ ID: 'Diproses oleh admin', EN: 'Processed by admin' }),
          iconColor: 'bg-indigo-50 text-indigo-600',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          ),
          trend: 'offline orders',
          trendColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        },
        {
          label: t({ ID: 'Merch Belum Diambil', EN: 'Merch Not Picked Up' }),
          value: stats.merchBelum.toLocaleString('id-ID'),
          sub: t({ ID: 'Menunggu pengambilan', EN: 'Awaiting pickup' }),
          iconColor: 'bg-amber-50 text-amber-600',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          ),
          trend: `${stats.merchDiambil} ${t({ ID: 'diambil', EN: 'picked up' })}`,
          trendColor: 'bg-amber-50 text-amber-700 border-amber-200',
        },
      ]
    : []

  const TABLE_HEADERS = [
    { key: 'ID', label: t({ ID: 'ID Pesanan', EN: 'Order ID' }) },
    { key: 'Nama', label: t({ ID: 'Nama Pemesan', EN: 'Booker Name' }) },
    { key: 'Tiket', label: t({ ID: 'Kategori Tiket', EN: 'Ticket Tier' }) },
    { key: 'Jumlah', label: t({ ID: 'Jumlah', EN: 'Qty' }) },
    { key: 'Total', label: t({ ID: 'Total Pembayaran', EN: 'Total Paid' }) },
    { key: 'Metode', label: t({ ID: 'Metode', EN: 'Method' }) },
    { key: 'Status', label: t({ ID: 'Status', EN: 'Status' }) },
  ]

  const filteredOrders = orders.filter((o) => {
    const q = search.toLowerCase()
    return (
      !q ||
      o.id.toLowerCase().includes(q) ||
      (o.customers?.nama || '').toLowerCase().includes(q) ||
      (o.tiket?.kategori || '').toLowerCase().includes(q)
    )
  })

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#f8fafc]">
        <AdminSidebar />
        <main className="flex-1 p-8 flex items-center justify-center text-slate-400 text-sm">
          {t({ ID: 'Memuat dashboard', EN: 'Loading dashboard' })}<LoadingDots />
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search order or customer..."
          userName={adminName || 'Panitia'}
          userRole="Admin Panitia"
        />

        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto overflow-auto">
          {/* Header Title */}
          <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {t({ ID: 'Dashboard Operasional', EN: 'Operational Dashboard' })}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {activeEvent
                  ? `${activeEvent.nama_event} · ${t({ ID: 'Event Operations Center', EN: 'Event Operations Center' })}`
                  : t({ ID: 'Belum ada event aktif', EN: 'No active event' })}
              </p>
              {error && <Toast ok={false} text={error} onClose={() => setError('')} className="mt-2" />}
            </div>

            {activeEvent ? (
              <div className="flex items-center gap-2 bg-white border border-slate-200/90 rounded-xl px-4 py-2 shadow-sm text-xs font-medium text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>{t({ ID: 'Event Sedang Berlangsung', EN: 'Event Active' })}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-white border border-slate-200/90 rounded-xl px-4 py-2 shadow-sm text-xs font-medium text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                <span>{t({ ID: 'Tidak Ada Event Aktif', EN: 'No Active Event' })}</span>
              </div>
            )}
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

          {/* Ticket Capacity Progress Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm mb-8">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {t({ ID: 'Kapasitas Tiket Manual', EN: 'Manual Ticket Capacity' })}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {tiketTerjual.toLocaleString('id-ID')} / {totalKuota.toLocaleString('id-ID')} {t({ ID: 'tiket terjual manual', EN: 'manual tickets sold' })}
                </p>
              </div>
              <span className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                {persen}%
              </span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-500"
                style={{ width: `${persen}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-400 mt-2">
              <span>{t({ ID: 'Sisa Kuota', EN: 'Remaining Quota' })}: {(totalKuota - tiketTerjual).toLocaleString('id-ID')}</span>
              <span>{t({ ID: 'Total Pendapatan Tiket', EN: 'Total Ticket Revenue' })}: {formatRupiah(stats?.revenueTiket ?? 0)}</span>
            </div>
          </div>

          {/* Recent Orders Table */}
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {t({ ID: 'Transaksi Manual (Offline) Terbaru', EN: 'Recent Offline Manual Orders' })}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {t({ ID: 'Daftar transaksi on-the-spot oleh panitia', EN: 'On-the-spot orders by staff' })}
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                {filteredOrders.length} {t({ ID: 'transaksi', EN: 'transactions' })}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {TABLE_HEADERS.map((h) => (
                      <th key={h.key} className="text-left px-6 py-3.5">{h.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-slate-400 text-xs">
                        {t({ ID: 'Belum ada transaksi manual.', EN: 'No manual transactions yet.' })}
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => (
                      <tr key={order.booking_id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs font-medium text-blue-600">{order.id}</td>
                        <td className="px-6 py-4 font-medium text-slate-900">{order.customers?.nama || '-'}</td>
                        <td className="px-6 py-4 text-slate-600 text-xs">{order.tiket?.kategori || '-'}</td>
                        <td className="px-6 py-4 text-slate-600">{order.jumlah}</td>
                        <td className="px-6 py-4 font-semibold text-slate-900">
                          {formatRupiah(Number(order.tiket?.harga || 0) * order.jumlah)}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full border bg-slate-50 text-slate-700 border-slate-200">
                            {labelMetode(order.metode_pembayaran)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                              title={
                                order.status_bayar === 'pending'
                                  ? t({ ID: 'Pembayaran belum selesai dalam 10 menit sejak pesanan dibuat', EN: 'Payment not completed within 10 minutes of order creation' })
                                  : undefined
                              }
                              className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                              order.status_bayar === 'berhasil'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : order.status_bayar === 'gagal'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {order.status_bayar === 'berhasil'
                              ? t({ ID: 'Lunas', EN: 'Paid' })
                              : order.status_bayar === 'gagal'
                                ? t({ ID: 'Gagal', EN: 'Failed' })
                                : t({ ID: 'Pending', EN: 'Pending' })}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
