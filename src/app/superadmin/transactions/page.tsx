
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import SuperAdminSidebar from '@/components/layout/SuperAdminSidebar'
import DashboardHeader from '@/components/layout/DashboardHeader'
import Pagination from '@/components/Pagination'
import EventSelector from '@/components/EventSelector'
import { getAdminSession, useAdminName, adminFetch } from '@/lib/adminAuth'
import { useSelectedEventId } from '@/lib/eventStore'
import { useSelectedEventStatus } from '@/lib/useEventStatus'
import { useLang } from '@/lib/i18n'
import { friendlyError } from '@/app/lib/fetchError'
import { labelMetode } from '@/app/lib/paymentMethod'
import { buildExcelXml, autoSaveXls } from '@/app/lib/excel'
import Toast from '@/components/Toast'
import LoadingDots from '@/components/LoadingDots'

interface TiketTransaksi {
  id: string
  booking_id: string
  jumlah: number
  source: string
  status_bayar: string
  status_check_in: string
  tanggal_pesan: string
  metode_pembayaran?: string | null
  nama_pemesan?: string | null
  email_pemesan?: string | null
  customers: { nama: string; email: string; no_hp?: string | null } | null
  tiket: { kategori: string; harga: number } | null
  voucher: { kode_voucher: string; nominal_diskon: number } | null
  pembayaran: { metode_pembayaran?: string | null; total_bayar?: number | null } | null
}

interface MerchTransaksi {
  id: string
  kode_pengambilan: string
  kode_pesanan: string | null
  jumlah: number
  ukuran: string | null
  total_harga: number
  status_bayar: string
  status_pengambilan: string
  tanggal_pesan: string
  metode_pembayaran?: string | null
  nama_pemesan?: string | null
  email_pemesan?: string | null
  customers: { nama: string; email: string; no_hp?: string | null } | null
  merchandise: { nama_merch: string; harga: number } | null
}

type Row = {
  id: string
  tipe: 'tiket' | 'merch'
  kode: string
  nama: string
  email: string
  noHp: string
  item: string
  total: number
  metode: string
  voucher: string | null
  status: 'berhasil' | 'pending' | 'gagal'
  statusLain: string | null
  sumber?: 'online' | 'offline'
  waktu: string
  tanggalRaw: string
}

type SortKey = 'kode' | 'tipe' | 'nama' | 'total' | 'metode' | 'status' | 'waktu'

const STATUS_CONFIG = {
  berhasil: { label: 'Berhasil', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  pending: { label: 'Pending', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  gagal: { label: 'Gagal', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
}

function formatRupiah(n: number) { return 'Rp ' + n.toLocaleString('id-ID') }
function formatWaktu(iso: string) {
  try {
    // Tanggal disimpan sebagai WIB (tanpa offset). Jika string sudah punya
    // offset/Z, pakai asli. Jika tidak, tambahkan +07:00 agar JS tidak
    // mencoba mengonversi dari UTC ke WIB (yang membuat tanggal/jam melenceng).
    let d: Date
    if (/[+-]\d{2}:?\d{2}$|Z$/i.test(iso)) {
      d = new Date(iso)
    } else {
      d = new Date(iso.replace(' ', 'T') + '+07:00')
    }
    return d.toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
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

export default function SuperAdminTransactionsPage() {
  const { t } = useLang()
  const router = useRouter()
  const adminName = useAdminName()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [sortKey, setSortKey] = useState<SortKey>('waktu')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10
  const [sendingId, setSendingId] = useState('')
  const [resendMsg, setResendMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const eventId = useSelectedEventId()
  const { finished: eventFinished } = useSelectedEventStatus()
  const readOnly = eventFinished

  const statusLabel = (label: string) =>
    label === 'Berhasil' ? t({ ID: 'Berhasil', EN: 'Successful' }) : label === 'Gagal' ? t({ ID: 'Gagal', EN: 'Failed' }) : t({ ID: 'Pending', EN: 'Pending' })

  useEffect(() => {
    const session = getAdminSession('superadmin')
    if (!session || session.role !== 'superadmin') {
      router.replace('/superadmin/login')
      return
    }
    const ev = eventId ? `event=${encodeURIComponent(eventId)}` : ''
    const q = ev ? `?${ev}` : ''
    Promise.all([
      adminFetch(`/api/transactions${q}`).then((r) => r.json()),
      adminFetch(`/api/merch/orders${q}`).then((r) => r.json()),
    ])
      .then(([tiketRes, merchRes]) => {
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
            tipe: 'tiket',
            kode: tr.booking_id,
            nama: tr.nama_pemesan || tr.customers?.nama || '-',
            email: tr.email_pemesan || tr.customers?.email || '-',
            noHp: tr.customers?.no_hp || '-',
            item: `${tr.tiket?.kategori || '-'} x${tr.jumlah}`,
            total,
            metode: labelMetode(tr.metode_pembayaran),
            voucher: tr.voucher?.kode_voucher || null,
            status: tr.status_bayar === 'berhasil' ? 'berhasil' : tr.status_bayar === 'gagal' ? 'gagal' : 'pending',
            statusLain: tr.status_check_in || null,
            sumber: tr.source === 'offline' ? 'offline' : 'online',
            waktu: formatWaktu(tr.tanggal_pesan),
            tanggalRaw: tr.tanggal_pesan,
          }
        })
        // Kelompokkan baris merch per kode_pesanan: satu checkout berisi beberapa item.
        const merchGroups = new Map<string, MerchTransaksi[]>()
        for (const m of (merchRes.data || []) as MerchTransaksi[]) {
          const key = m.kode_pesanan || m.kode_pengambilan || m.id
          const hit = merchGroups.get(key) ?? []
          hit.push(m)
          merchGroups.set(key, hit)
        }
        const merchRows: Row[] = [...merchGroups.entries()].map(([key, group]) => {
          const first = group[0]
          const itemLabel =
            group.length === 1
              ? `${first.merchandise?.nama_merch || '-'}${first.ukuran ? ` (${first.ukuran})` : ''} x${first.jumlah}`
              : `${group.length} item merch`
          const earliest = group.map((m) => m.tanggal_pesan).filter(Boolean).sort()[0] || first.tanggal_pesan
          const metode = group.map((m) => m.metode_pembayaran).find((v) => !!v) || null
          return {
            id: first.id,
            tipe: 'merch',
            kode: key,
            nama: first.nama_pemesan || first.customers?.nama || '-',
            email: first.email_pemesan || first.customers?.email || '-',
            noHp: first.customers?.no_hp || '-',
            item: itemLabel,
            total: group.reduce((sum, m) => sum + Number(m.total_harga || 0), 0),
            metode: labelMetode(metode),
            voucher: null,
            status: first.status_bayar === 'berhasil' ? 'berhasil' : first.status_bayar === 'gagal' ? 'gagal' : 'pending',
            statusLain: first.status_pengambilan || null,
            waktu: formatWaktu(earliest),
            tanggalRaw: earliest,
          }
        })
        setRows([...tiketRows, ...merchRows].sort((a, b) => (a.tanggalRaw < b.tanggalRaw ? 1 : -1)))
      })
      .catch((e) => setError(friendlyError(e)))
      .finally(() => setLoading(false))
  }, [router, eventId])

  const filtered = rows.filter((row) => {
    const matchSearch =
      row.kode.toLowerCase().includes(search.toLowerCase()) || row.nama.toLowerCase().includes(search.toLowerCase()) || row.noHp.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || row.status === filterStatus
    return matchSearch && matchStatus
  })

  // Reset halaman ketika pencarian / filter / urutan berubah.
  const toggleSort = (k: SortKey) => {
    if (sortKey === k) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(k)
      setSortDir(k === 'total' ? 'desc' : 'asc')
    }
    setPage(1)
  }

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'kode') cmp = a.kode.localeCompare(b.kode)
    else if (sortKey === 'tipe') cmp = a.tipe.localeCompare(b.tipe)
    else if (sortKey === 'nama') cmp = a.nama.localeCompare(b.nama)
    else if (sortKey === 'total') cmp = a.total - b.total
    else if (sortKey === 'metode') cmp = a.metode.localeCompare(b.metode)
    else if (sortKey === 'status') cmp = a.status.localeCompare(b.status)
    else cmp = a.tanggalRaw.localeCompare(b.tanggalRaw)
    return sortDir === 'asc' ? cmp : -cmp
  })

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const startIndex = (safePage - 1) * PAGE_SIZE
  const paginated = sorted.slice(startIndex, startIndex + PAGE_SIZE)

  const resendEmail = async (row: Row) => {
    if (readOnly) {
      setResendMsg({ ok: false, text: t({ ID: 'Event sudah selesai — kirim ulang dinonaktifkan.', EN: 'Event is finished — resend is disabled.' }) })
      return
    }
    setSendingId(row.kode)
    setResendMsg(null)
    try {
      const url =
        row.tipe === 'tiket'
          ? `/api/transactions/${encodeURIComponent(row.kode)}`
          : `/api/merch/orders/${encodeURIComponent(row.kode)}`
      const res = await adminFetch(url, { method: 'POST' })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || t({ ID: 'Gagal kirim ulang', EN: 'Failed to resend' }))
      const label = row.tipe === 'tiket' ? t({ ID: 'E-tiket', EN: 'E-ticket' }) : t({ ID: 'Bukti pengambilan', EN: 'Pickup proof' })
      setResendMsg({ ok: true, text: `${label} ${row.kode} ${t({ ID: 'dikirim ulang ke', EN: 'resent to' })} ${row.email}` })
    } catch (e) {
      setResendMsg({ ok: false, text: friendlyError(e) })
    } finally {
      setSendingId('')
    }
  }

  const totalRevenue = rows.filter((row) => row.status === 'berhasil').reduce((sum, row) => sum + row.total, 0)

  // Data ekspor dipakai oleh fitur Export Excel.
  const buildExportData = () => {
    const header = t({
      ID: 'Kode;Tipe;Nama;Email;No HP;Item;Total (Rp);Voucher;Metode;Status;Cek In/Ambil;Sumber;Waktu',
      EN: 'Code;Type;Name;Email;Phone;Item;Total (Rp);Voucher;Method;Status;Check-in/Pickup;Source;Time',
    }).split(';')
    const data: (string | number)[][] = rows.map((r) => [
      r.kode,
      r.tipe,
      r.nama,
      r.email,
      r.noHp,
      r.item,
      r.total,
      r.voucher || '-',
      r.metode,
      r.status,
      r.statusLain || '-',
      r.sumber || 'online',
      r.waktu,
    ])
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
    return { header, data, stamp }
  }

  // Ekspor Excel: kolom sudah terstruktur, langsung rapi saat dibuka.
  const exportExcel = () => {
    if (rows.length === 0) return
    const { header, data, stamp } = buildExportData()
    autoSaveXls(`transaksi-encoretix-${stamp}.xls`, buildExcelXml('Transaksi', header, data))
  }

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#f8fafc]">
        <SuperAdminSidebar />
        <main className="flex-1 p-8 flex items-center justify-center text-slate-400 text-sm">{t({ ID: 'Memuat data', EN: 'Loading data' })}<LoadingDots /></main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      <SuperAdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader
          searchValue={search}
          onSearchChange={(val) => { setSearch(val); setPage(1) }}
          searchPlaceholder={t({ ID: 'Cari ID transaksi atau nama...', EN: 'Search transaction ID or name...' })}
          userName={adminName || 'Super Admin'}
          userRole="Super Admin"
        />
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto overflow-auto">
          <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t({ ID: 'Transaksi', EN: 'Transactions' })}</h1>
              <p className="text-sm text-slate-500 mt-1">{t({ ID: 'Semua transaksi tiket & merchandise sesuai event terpilih', EN: 'All ticket & merchandise transactions for the selected event' })}</p>
              {error && <Toast ok={false} text={error} onClose={() => setError('')} className="mt-2" />}
              {readOnly && (
                <p className="text-xs text-amber-600 mt-2">
                  {t({ ID: 'Event sudah selesai — mode hanya lihat.', EN: 'Event is finished — view-only mode.' })}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={exportExcel}
                disabled={rows.length === 0}
                title={rows.length === 0 ? t({ ID: 'Belum ada data transaksi', EN: 'No transaction data yet' }) : undefined}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-colors bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 hover:border-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.6 6.4a9 9 0 11-12.8 0M12 3v12" />
                </svg>
                {t({ ID: 'Export Excel', EN: 'Export Excel' })}
              </button>
              <EventSelector />
            </div>
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

          {/* Resend feedback */}
          {resendMsg && (
            <Toast ok={resendMsg.ok} text={resendMsg.text} onClose={() => setResendMsg(null)} className="mb-4" />
          )}

          {/* Filter */}
          <div className="flex flex-wrap gap-2 mb-4">
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

          {/* Table */}
          <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="w-10 px-5 py-3.5">#</th>
                    <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-left">{t({ ID: 'ID Pesanan', EN: 'Order ID' })}</th>
                    <SortTh label={t({ ID: 'Booking ID', EN: 'Booking ID' })} k="kode" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortTh label={t({ ID: 'Tipe', EN: 'Type' })} k="tipe" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-left">{t({ ID: 'Sumber', EN: 'Source' })}</th>
                    <SortTh label={t({ ID: 'Pemesan', EN: 'Booker' })} k="nama" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-left">{t({ ID: 'No HP', EN: 'Phone' })}</th>
                    <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-left">{t({ ID: 'Item', EN: 'Item' })}</th>
                    <SortTh label={t({ ID: 'Total', EN: 'Total' })} k="total" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-left">{t({ ID: 'Voucher', EN: 'Voucher' })}</th>
                    <SortTh label={t({ ID: 'Metode', EN: 'Method' })} k="metode" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortTh label={t({ ID: 'Status', EN: 'Status' })} k="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-left">{t({ ID: 'Cek In / Ambil', EN: 'Check-in / Pickup' })}</th>
                    <SortTh label={t({ ID: 'Waktu', EN: 'Time' })} k="waktu" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-left">{t({ ID: 'Aksi', EN: 'Actions' })}</th>
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
                        <td className="px-5 py-3.5 font-mono text-xs text-blue-600">{row.kode}</td>
                        <td className="px-5 py-3.5">
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                            row.tipe === 'tiket' ? 'text-blue-700 bg-blue-50 border-blue-200' : 'text-amber-700 bg-amber-50 border-amber-200'
                          }`}>
                            {row.tipe === 'tiket' ? t({ ID: 'Tiket', EN: 'Ticket' }) : t({ ID: 'Merch', EN: 'Merch' })}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          {row.tipe === 'tiket' && row.sumber === 'offline' ? (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200">
                              {t({ ID: 'Offline (Manual)', EN: 'Offline (Manual)' })}
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-sky-50 text-sky-700 border-sky-200">
                              {t({ ID: 'Online', EN: 'Online' })}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="text-slate-900 font-semibold text-sm">{row.nama}</p>
                          <p className="text-slate-400 text-xs">{row.email}</p>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 text-xs font-mono">{row.noHp}</td>
                        <td className="px-5 py-3.5 text-slate-600 text-xs max-w-[160px]">{row.item}</td>
                        <td className="px-5 py-3.5 text-slate-900 font-semibold">{formatRupiah(row.total)}</td>
                        <td className="px-5 py-3.5 text-slate-600 text-xs">{row.voucher ? row.voucher : '-'}</td>
                        <td className="px-5 py-3.5">
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-slate-50 text-slate-700 border-slate-200">
                            {row.metode}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            title={
                              row.status === 'pending'
                                ? t({ ID: 'Pembayaran belum selesai dalam 10 menit sejak pesanan dibuat', EN: 'Payment not completed within 10 minutes of order creation' })
                                : undefined
                            }
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${s.color} ${s.bg} ${s.border}`}
                          >
                            {statusLabel(s.label)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 text-xs">
                          {row.statusLain ? (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-slate-50 text-slate-700 border-slate-200">
                              {row.statusLain === 'sudah_check_in' || row.statusLain === 'sudah_diambil'
                                ? t({ ID: 'Selesai', EN: 'Done' })
                                : row.statusLain}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-slate-400 text-xs">{row.waktu}</td>
                        <td className="px-5 py-3.5">
                          {(row.tipe === 'tiket' || row.tipe === 'merch') && row.status === 'berhasil' && (
                            <button
                              onClick={() => resendEmail(row)}
                              disabled={sendingId === row.kode || readOnly}
                              title={readOnly ? t({ ID: 'Event sudah selesai — hanya lihat', EN: 'Event is finished — view only' }) : undefined}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {sendingId === row.kode ? <>{t({ ID: 'Mengirim', EN: 'Sending' })}<LoadingDots /></> : t({ ID: 'Kirim Ulang', EN: 'Resend' })}
                            </button>
                          )}
                        </td>
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
