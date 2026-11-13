'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AdminSidebar from '@/components/layout/AdminSidebar'
import DashboardHeader from '@/components/layout/DashboardHeader'
import Pagination from '@/components/Pagination'
import { getAdminSession, useAdminName } from '@/lib/adminAuth'
import { useLang } from '@/lib/i18n'
import { friendlyError } from '@/app/lib/fetchError'
import { labelMetode } from '@/app/lib/paymentMethod'
import Toast from '@/components/Toast'
import LoadingDots from '@/components/LoadingDots'

interface TiketTransaksi {
  id: string
  booking_id: string
  jumlah: number
  status_bayar: string
  tanggal_pesan: string
  metode_pembayaran?: string | null
  nama_pemesan?: string | null
  email_pemesan?: string | null
  customers: { nama: string; email: string } | null
  tiket: { kategori: string; harga: number } | null
  voucher: { kode_voucher: string; nominal_diskon: number } | null
  pembayaran: { metode_pembayaran?: string | null; total_bayar?: number | null } | null
}

type Row = {
  id: string
  nama: string
  email: string
  item: string
  total: number
  metode: string
  status: 'berhasil' | 'pending' | 'gagal'
  waktu: string
}

type SortKey = 'nama' | 'total' | 'metode' | 'status' | 'waktu'

const STATUS_CONFIG = {
  berhasil: { label: 'Berhasil', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  pending: { label: 'Pending', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  gagal: { label: 'Gagal', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
}

function formatRupiah(n: number) { return 'Rp ' + n.toLocaleString('id-ID') }
function formatWaktu(iso: string) {
  try {
    return new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

function SortTh({ label, k, sortKey, sortDir, onSort }: { label: string; k: SortKey; sortKey: SortKey; sortDir: 'asc' | 'desc'; onSort: (k: SortKey) => void }) {
  const active = sortKey === k
  return (
    <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
      <button
        onClick={() => onSort(k)}
        className={`inline-flex items-center gap-1 hover:text-slate-700 transition-colors ${active ? 'text-blue-600' : ''}`}
      >
        {label}
        <span className="text-[9px]">{active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
      </button>
    </th>
  )
}

function StatIcon({ path }: { path: string }) {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  )
}

export default function AdminTransactionsPage() {
  const { t } = useLang()
  const router = useRouter()
  const adminName = useAdminName()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [sortKey, setSortKey] = useState<SortKey>('waktu')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10
  const [activeEvent, setActiveEvent] = useState<{ id: string; nama_event: string } | null>(null)

  const statusLabel = (label: string) =>
    label === 'Berhasil' ? t({ ID: 'Berhasil', EN: 'Successful' }) : label === 'Gagal' ? t({ ID: 'Gagal', EN: 'Failed' }) : t({ ID: 'Pending', EN: 'Pending' })

  useEffect(() => {
    const session = getAdminSession('admin')
    if (!session || session.role !== 'admin') {
      router.replace('/admin/login')
      return
    }
    fetch('/api/events?active=true')
      .then((r) => r.json())
      .then((evRes) => {
        if (evRes.error) throw new Error(evRes.error)
        const active = evRes.data as { id: string; nama_event: string } | null
        setActiveEvent(active)
        const q = active ? `event=${encodeURIComponent(active.id)}&` : ''
        return fetch(`/api/transactions?${q}source=offline`).then((r) => r.json())
      })
      .then((tiketRes) => {
        if (tiketRes.error) throw new Error(tiketRes.error)
        const tiketRows: Row[] = (tiketRes.data || []).map((tr: TiketTransaksi) => {
          const subtotal = Number(tr.tiket?.harga || 0) * tr.jumlah
          const diskon = Number(tr.voucher?.nominal_diskon || 0)
          const paid = tr.pembayaran?.total_bayar
          const total =
            tr.status_bayar === 'berhasil' && paid != null
              ? Number(paid)
              : Math.max(0, subtotal - diskon)
          return {
            id: tr.id,
            nama: tr.nama_pemesan || tr.customers?.nama || '-',
            email: tr.email_pemesan || tr.customers?.email || '-',
            item: `${tr.tiket?.kategori || '-'} x${tr.jumlah}`,
            total,
            metode: labelMetode(tr.metode_pembayaran),
            status: tr.status_bayar === 'berhasil' ? 'berhasil' : tr.status_bayar === 'gagal' ? 'gagal' : 'pending',
            waktu: formatWaktu(tr.tanggal_pesan),
          }
        })
        setRows(tiketRows)
      })
      .catch((e) => setError(friendlyError(e)))
      .finally(() => setLoading(false))
  }, [router])

  const filtered = rows.filter((row) => {
    const matchSearch =
      row.id.toLowerCase().includes(search.toLowerCase()) || row.nama.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || row.status === filterStatus
    return matchSearch && matchStatus
  })

  // Reset halaman ketika pencarian / filter / urutan berubah.
  const toggleSort = (k: SortKey) => {
    if (sortKey === k) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(k)
      setSortDir(k === 'total' || k === 'waktu' ? 'desc' : 'asc')
    }
    setPage(1)
  }

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'nama') cmp = a.nama.localeCompare(b.nama)
    else if (sortKey === 'total') cmp = a.total - b.total
    else if (sortKey === 'metode') cmp = a.metode.localeCompare(b.metode)
    else if (sortKey === 'status') cmp = a.status.localeCompare(b.status)
    else cmp = a.waktu.localeCompare(b.waktu)
    return sortDir === 'asc' ? cmp : -cmp
  })

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const startIndex = (safePage - 1) * PAGE_SIZE
  const paginated = sorted.slice(startIndex, startIndex + PAGE_SIZE)

  const totalRevenue = rows.filter((row) => row.status === 'berhasil').reduce((sum, row) => sum + row.total, 0)

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#f8fafc]">
        <AdminSidebar />
        <main className="flex-1 p-8 flex items-center justify-center text-slate-400 text-sm">{t({ ID: 'Memuat data', EN: 'Loading data' })}<LoadingDots /></main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader
          searchValue={search}
          onSearchChange={(val) => { setSearch(val); setPage(1) }}
          searchPlaceholder={t({ ID: 'Cari ID transaksi atau nama...', EN: 'Search transaction ID or name...' })}
          userName={adminName || 'Panitia'}
          userRole="Admin Panitia"
        />
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto overflow-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t({ ID: 'Transaksi', EN: 'Transactions' })}</h1>
            <p className="text-sm text-slate-500 mt-1">{activeEvent ? t({ ID: `Semua transaksi tiket manual (input panitia) ${activeEvent.nama_event}`, EN: `All manual ticket transactions (staff input) for ${activeEvent.nama_event}` }) : t({ ID: 'Belum ada event aktif', EN: 'No active event' })}</p>
            {error && <Toast ok={false} text={error} onClose={() => setError('')} className="mt-2" />}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            {[
              { label: t({ ID: 'Total Transaksi', EN: 'Total Transactions' }), value: rows.length, icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z', iconColor: 'bg-slate-50 text-slate-600' },
              { label: t({ ID: 'Berhasil', EN: 'Successful' }), value: rows.filter((row) => row.status === 'berhasil').length, icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', iconColor: 'bg-emerald-50 text-emerald-600' },
              { label: t({ ID: 'Pending', EN: 'Pending' }), value: rows.filter((row) => row.status === 'pending').length, icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', iconColor: 'bg-amber-50 text-amber-600' },
              { label: t({ ID: 'Gagal', EN: 'Failed' }), value: rows.filter((row) => row.status === 'gagal').length, icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z', iconColor: 'bg-rose-50 text-rose-600' },
              { label: t({ ID: 'Total Revenue', EN: 'Total Revenue' }), value: formatRupiah(totalRevenue), icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1', iconColor: 'bg-blue-50 text-blue-600' },
            ].map((s) => (
              <div key={s.label} className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm">
                <span className={`text-xl block mb-2 w-9 h-9 flex items-center justify-center rounded-xl ${s.iconColor}`}><StatIcon path={s.icon} /></span>
                <p className="text-xl font-bold text-slate-900">{s.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Filter */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex gap-2">
              {['all', 'berhasil', 'pending', 'gagal'].map((s) => (
                <button
                  key={s}
                  onClick={() => { setFilterStatus(s); setPage(1) }}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                    filterStatus === s ? 'bg-slate-900 text-white border-slate-900' : 'text-slate-600 border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  {s === 'all' ? t({ ID: 'Semua', EN: 'All' }) : s === 'berhasil' ? t({ ID: 'Berhasil', EN: 'Successful' }) : s === 'pending' ? t({ ID: 'Pending', EN: 'Pending' }) : t({ ID: 'Gagal', EN: 'Failed' })}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="w-10 px-5 py-3.5">#</th>
                    <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-left">{t({ ID: 'ID Pesanan', EN: 'Order ID' })}</th>
                    <SortTh label={t({ ID: 'Pemesan', EN: 'Booker' })} k="nama" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-left">{t({ ID: 'Item', EN: 'Item' })}</th>
                    <SortTh label={t({ ID: 'Total', EN: 'Total' })} k="total" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortTh label={t({ ID: 'Metode', EN: 'Method' })} k="metode" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortTh label={t({ ID: 'Status', EN: 'Status' })} k="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortTh label={t({ ID: 'Waktu', EN: 'Time' })} k="waktu" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginated.map((row, i) => {
                    const s = STATUS_CONFIG[row.status]
                    return (
                      <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-3.5 text-slate-400 text-xs">{startIndex + i + 1}</td>
                        <td className="px-5 py-3.5">
                          <p className="font-mono text-[10px] text-slate-400 max-w-[150px] truncate" title={row.id}>{row.id}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="text-slate-900 font-semibold text-sm">{row.nama}</p>
                          <p className="text-slate-400 text-xs">{row.email}</p>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 text-xs max-w-[160px]">{row.item}</td>
                        <td className="px-5 py-3.5 text-slate-900 font-semibold">{formatRupiah(row.total)}</td>
                        <td className="px-5 py-3.5">
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-slate-50 text-slate-700 border-slate-200">
                            {row.metode}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${s.color} ${s.bg} ${s.border}`}>
                            {statusLabel(s.label)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-400 text-xs">{row.waktu}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-slate-400 text-sm">{t({ ID: 'Tidak ada transaksi ditemukan', EN: 'No transactions found' })}</p>
              </div>
            ) : (
              <Pagination
                page={safePage}
                totalPages={totalPages}
                onChange={setPage}
                summary={`${t({ ID: 'Menampilkan', EN: 'Showing' })} ${startIndex + 1}–${Math.min(startIndex + PAGE_SIZE, sorted.length)} ${t({ ID: 'dari', EN: 'of' })} ${sorted.length}`}
                prevLabel={t({ ID: 'Sebelumnya', EN: 'Previous' })}
                nextLabel={t({ ID: 'Berikutnya', EN: 'Next' })}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}