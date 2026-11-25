'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import SuperAdminSidebar from '@/components/layout/SuperAdminSidebar'
import DashboardHeader from '@/components/layout/DashboardHeader'
import { getAdminSession, useAdminName, adminFetch } from '@/lib/adminAuth'
import { useLang } from '@/lib/i18n'
import { friendlyError } from '@/app/lib/fetchError'
import { useSelectedEventId } from '@/lib/eventStore'
import Toast from '@/components/Toast'
import LoadingDots from '@/components/LoadingDots'

interface Panitia {
  id: string
  nama: string
  username: string
  role: 'admin' | 'superadmin'
  status?: 'aktif' | 'nonaktif'
  created_at: string
}

interface ManualOrderRow {
  id: string
  booking_id: string
  tanggal_pesan: string
  jumlah: number
  status_bayar: string
  kategori: string
  customer_nama: string
  customer_email: string
  metode_pembayaran: string | null
  total_bayar: number
}

interface MonitorData {
  admin: Panitia
  event_id: string | null
  manual: {
    summary: { totalOrders: number; berhasil: number; pending: number; gagal: number; totalTiket: number; totalRevenue: number }
    orders: ManualOrderRow[]
  }
  checkin: {
    summary: { totalTiketMasuk: number; transaksi: number }
    items: { booking_id: string; kategori: string; customer_nama: string; tiket_masuk: number; source: string }[]
  }
  merch: {
    summary: { totalVerifikasi: number; totalItem: number }
    items: { kode: string; nama_merch: string; jumlah: number; customer_nama: string; status_pengambilan: string; waktu: string | null }[]
  }
  flags: { level: 'warning' | 'info'; text: string }[]
}

type Form = { id?: string; nama: string; username: string; password: string }
const EMPTY: Form = { nama: '', username: '', password: '' }

function formatRupiah(n: number) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID')
}
function formatDate(s?: string | null) {
  if (!s) return '-'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function SuperAdminAdminsPage() {
  const { t } = useLang()
  const router = useRouter()
  const adminName = useAdminName('superadmin')
  const eventId = useSelectedEventId()
  const [rows, setRows] = useState<Panitia[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<Form>(EMPTY)
  const [monitor, setMonitor] = useState<Panitia | null>(null)
  const [monitorData, setMonitorData] = useState<MonitorData | null>(null)
  const [monitorLoading, setMonitorLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await adminFetch('/api/panitia')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal memuat')
      setRows(json.data || [])
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const session = getAdminSession('superadmin')
    if (!session || session.role !== 'superadmin') {
      router.replace('/superadmin/login')
      return
    }
    load()
  }, [router])

  const openAdd = () => { setForm(EMPTY); setShowForm(true) }
  const openEdit = (p: Panitia) => { setForm({ id: p.id, nama: p.nama, username: p.username, password: '' }); setShowForm(true) }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setError(''); setNotice('')
    try {
      const payload: Record<string, unknown> = { nama: form.nama, username: form.username }
      if (form.password) payload.password = form.password
      const url = form.id ? `/api/panitia/${form.id}` : '/api/panitia'
      const method = form.id ? 'PATCH' : 'POST'
      if (!form.id && !form.password) throw new Error('Password wajib diisi untuk akun baru')
      const res = await adminFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal menyimpan')
      setNotice(form.id ? t({ ID: 'Akun diperbarui.', EN: 'Account updated.' }) : t({ ID: 'Akun admin dibuat.', EN: 'Admin account created.' }))
      setShowForm(false)
      await load()
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  const openMonitor = async (p: Panitia) => {
    setMonitor(p); setMonitorData(null); setMonitorLoading(true)
    try {
      const ev = eventId ? `?event=${encodeURIComponent(eventId)}` : ''
      const res = await adminFetch(`/api/panitia/${p.id}/monitor${ev}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal memuat data pantau')
      setMonitorData(json.data)
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setMonitorLoading(false)
    }
  }

  const toggleStatus = async (p: Panitia) => {
    const next = (p.status || 'aktif') === 'aktif' ? 'nonaktif' : 'aktif'
    setBusy(true); setError(''); setNotice('')
    try {
      const res = await adminFetch(`/api/panitia/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal mengubah status')
      const updatedStatus = (json.data?.status as 'aktif' | 'nonaktif' | undefined) || next
      setRows((rs) => rs.map((r) => (r.id === p.id ? { ...r, status: updatedStatus } : r)))
      setNotice(updatedStatus === 'aktif'
        ? t({ ID: `Akun ${p.nama} diaktifkan.`, EN: `Account ${p.nama} activated.` })
        : t({ ID: `Akun ${p.nama} dinonaktifkan.`, EN: `Account ${p.nama} deactivated.` }))
      if (monitor?.id === p.id) {
        setMonitor((m) => (m ? { ...m, status: updatedStatus } : m))
        await openMonitor({ ...p, status: updatedStatus })
      }
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  const filtered = rows.filter((r) => {
    const q = search.toLowerCase()
    return !q || r.nama.toLowerCase().includes(q) || r.username.toLowerCase().includes(q)
  })

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#f8fafc]"><SuperAdminSidebar />
        <main className="flex-1 p-8 flex items-center justify-center text-slate-400 text-sm">{t({ ID: 'Memuat data', EN: 'Loading data' })}<LoadingDots /></main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      <SuperAdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader searchValue={search} onSearchChange={setSearch} searchPlaceholder={t({ ID: 'Cari nama / username...', EN: 'Search name / username...' })} userName={adminName || 'Super Admin'} userRole="Super Admin" />
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto overflow-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t({ ID: 'Kelola Admin', EN: 'Manage Admins' })}</h1>
              <p className="text-sm text-slate-500 mt-1">{t({ ID: 'Buat, ubah, nonaktifkan, dan pantau aktivitas akun admin.', EN: 'Create, edit, deactivate, and monitor admin account activity.' })}</p>
            </div>
            <button onClick={openAdd} className="px-4 py-2.5 rounded-xl bg-[#0057e7] hover:bg-[#0048c2] text-white text-sm font-semibold shadow-sm">{t({ ID: '+ Tambah Admin', EN: '+ Add Admin' })}</button>
          </div>

          {error && <Toast ok={false} text={error} onClose={() => setError('')} className="mb-4" />}
          {notice && <Toast ok text={notice} onClose={() => setNotice('')} className="mb-4" />}

          <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-sm mb-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-50/70 border-b border-slate-200/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-5 py-3.5 text-left">{t({ ID: 'Nama', EN: 'Name' })}</th>
                  <th className="px-5 py-3.5 text-left">Username</th>
                  <th className="px-5 py-3.5 text-left">Status</th>
                  <th className="px-5 py-3.5 text-left">{t({ ID: 'Aksi', EN: 'Actions' })}</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((p) => {
                    const aktif = (p.status || 'aktif') === 'aktif'
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/70">
                        <td className="px-5 py-3.5 font-semibold text-slate-900">{p.nama}</td>
                        <td className="px-5 py-3.5 text-slate-600">{p.username}</td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${aktif ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                            {aktif ? t({ ID: 'Aktif', EN: 'Active' }) : t({ ID: 'Nonaktif', EN: 'Inactive' })}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => openMonitor(p)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100">{t({ ID: 'Pantau', EN: 'Monitor' })}</button>
                            <button onClick={() => openEdit(p)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50">{t({ ID: 'Ubah', EN: 'Edit' })}</button>
                            <button onClick={() => toggleStatus(p)} disabled={busy} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border disabled:opacity-50 ${aktif ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'}`}>
                              {aktif ? t({ ID: 'Nonaktifkan', EN: 'Deactivate' }) : t({ ID: 'Aktifkan', EN: 'Activate' })}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {filtered.length === 0 && <tr><td colSpan={4} className="px-5 py-10 text-center text-slate-400 text-sm">{t({ ID: 'Tidak ada akun.', EN: 'No accounts.' })}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {monitor && (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm mb-6">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-bold text-slate-900">{t({ ID: 'Pantau Aktivitas', EN: 'Activity Monitor' })}: {monitor.nama}</h2>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${(monitorData?.admin.status || monitor.status || 'aktif') === 'aktif' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                      {(monitorData?.admin.status || monitor.status || 'aktif') === 'aktif' ? t({ ID: 'Aktif', EN: 'Active' }) : t({ ID: 'Nonaktif', EN: 'Inactive' })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">@{monitor.username} · {t({ ID: 'Data per event terpilih. Pantau order manual, check-in, dan verifikasi merch yang dilakukan akun ini.', EN: 'Per selected event. Monitor manual orders, check-ins, and merch verifications performed by this account.' })}</p>
                </div>
                <button onClick={() => { setMonitor(null); setMonitorData(null) }} className="text-slate-400 hover:text-slate-600 text-lg leading-none px-2">×</button>
              </div>

              {monitorLoading ? (
                <div className="text-slate-400 text-sm py-6">{t({ ID: 'Memuat data pantau', EN: 'Loading monitor data' })}<LoadingDots /></div>
              ) : monitorData ? (
                <div className="space-y-5">
                  {monitorData.flags.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">{t({ ID: 'Peringatan / Indikasi', EN: 'Warnings / Indicators' })}</p>
                      {monitorData.flags.map((f, i) => (
                        <div key={i} className={`text-sm px-4 py-2.5 rounded-xl border ${f.level === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
                          {f.level === 'warning' ? '⚠ ' : 'ℹ '}{f.text}
                        </div>
                      ))}
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">{t({ ID: 'Ringkasan Order Manual (dibuat akun ini)', EN: 'Manual Order Summary (created by this account)' })}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                      <div className="border border-slate-200 rounded-xl p-3"><p className="text-[11px] text-slate-500">{t({ ID: 'Total Order', EN: 'Total Orders' })}</p><p className="text-lg font-bold text-slate-900">{monitorData.manual.summary.totalOrders}</p></div>
                      <div className="border border-slate-200 rounded-xl p-3"><p className="text-[11px] text-slate-500">{t({ ID: 'Berhasil', EN: 'Successful' })}</p><p className="text-lg font-bold text-emerald-700">{monitorData.manual.summary.berhasil}</p></div>
                      <div className="border border-slate-200 rounded-xl p-3"><p className="text-[11px] text-slate-500">Pending</p><p className="text-lg font-bold text-amber-700">{monitorData.manual.summary.pending}</p></div>
                      <div className="border border-slate-200 rounded-xl p-3"><p className="text-[11px] text-slate-500">{t({ ID: 'Gagal', EN: 'Failed' })}</p><p className="text-lg font-bold text-rose-700">{monitorData.manual.summary.gagal}</p></div>
                      <div className="border border-slate-200 rounded-xl p-3"><p className="text-[11px] text-slate-500">{t({ ID: 'Tiket (Lunas)', EN: 'Tickets (Paid)' })}</p><p className="text-lg font-bold text-slate-900">{monitorData.manual.summary.totalTiket}</p></div>
                      <div className="border border-slate-200 rounded-xl p-3"><p className="text-[11px] text-slate-500">{t({ ID: 'Pendapatan', EN: 'Revenue' })}</p><p className="text-sm font-bold text-slate-900">{formatRupiah(monitorData.manual.summary.totalRevenue)}</p></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="border border-slate-200 rounded-xl p-4">
                      <p className="text-xs font-semibold text-slate-700 mb-1">{t({ ID: 'Aksi Check-in (oleh akun ini)', EN: 'Check-in Actions (by this account)' })}</p>
                      <p className="text-xl font-bold text-slate-900">{monitorData.checkin.summary.totalTiketMasuk} <span className="text-sm font-medium text-slate-500">{t({ ID: 'tiket', EN: 'tickets' })}</span></p>
                      <p className="text-xs text-slate-500">{monitorData.checkin.summary.transaksi} {t({ ID: 'transaksi', EN: 'transactions' })}</p>
                    </div>
                    <div className="border border-slate-200 rounded-xl p-4">
                      <p className="text-xs font-semibold text-slate-700 mb-1">{t({ ID: 'Verifikasi Pengambilan Merch', EN: 'Merch Pickup Verifications' })}</p>
                      <p className="text-xl font-bold text-slate-900">{monitorData.merch.summary.totalVerifikasi} <span className="text-sm font-medium text-slate-500">{t({ ID: 'verifikasi', EN: 'verifications' })}</span></p>
                      <p className="text-xs text-slate-500">{monitorData.merch.summary.totalItem} {t({ ID: 'item', EN: 'items' })}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">{t({ ID: 'Riwayat Order Manual Terbaru', EN: 'Recent Manual Orders' })}</p>
                    {monitorData.manual.orders.length === 0 ? (
                      <p className="text-sm text-slate-400">{t({ ID: 'Belum ada order manual tercatat.', EN: 'No manual orders recorded.' })}</p>
                    ) : (
                      <div className="overflow-x-auto border border-slate-200 rounded-xl">
                        <table className="w-full text-xs">
                          <thead><tr className="bg-slate-50 text-slate-500 text-left">
                            <th className="px-3 py-2 font-semibold">{t({ ID: 'Waktu', EN: 'Time' })}</th>
                            <th className="px-3 py-2 font-semibold">Booking</th>
                            <th className="px-3 py-2 font-semibold">{t({ ID: 'Pemesan', EN: 'Customer' })}</th>
                            <th className="px-3 py-2 font-semibold">{t({ ID: 'Tiket', EN: 'Ticket' })}</th>
                            <th className="px-3 py-2 font-semibold">Qty</th>
                            <th className="px-3 py-2 font-semibold">Total</th>
                            <th className="px-3 py-2 font-semibold">{t({ ID: 'Metode', EN: 'Method' })}</th>
                            <th className="px-3 py-2 font-semibold">Status</th>
                          </tr></thead>
                          <tbody className="divide-y divide-slate-100">
                            {monitorData.manual.orders.map((o) => (
                              <tr key={o.id} className="hover:bg-slate-50/60">
                                <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{formatDate(o.tanggal_pesan)}</td>
                                <td className="px-3 py-2 font-mono text-slate-800">{o.booking_id}</td>
                                <td className="px-3 py-2 text-slate-800"><div className="font-medium">{o.customer_nama}</div><div className="text-slate-400">{o.customer_email}</div></td>
                                <td className="px-3 py-2 text-slate-700">{o.kategori}</td>
                                <td className="px-3 py-2 text-slate-700">{o.jumlah}</td>
                                <td className="px-3 py-2 text-slate-800 font-medium whitespace-nowrap">{formatRupiah(o.total_bayar)}</td>
                                <td className="px-3 py-2 text-slate-700">{o.metode_pembayaran || '-'}</td>
                                <td className="px-3 py-2">
                                  <span className={`inline-flex px-2 py-0.5 rounded-full font-semibold ${o.status_bayar === 'berhasil' ? 'bg-emerald-50 text-emerald-700' : o.status_bayar === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>{o.status_bayar}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {monitorData.checkin.items.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">{t({ ID: 'Riwayat Check-in Dilakukan', EN: 'Check-in Actions Performed' })}</p>
                      <div className="overflow-x-auto border border-slate-200 rounded-xl">
                        <table className="w-full text-xs">
                          <thead><tr className="bg-slate-50 text-slate-500 text-left">
                            <th className="px-3 py-2 font-semibold">Booking</th>
                            <th className="px-3 py-2 font-semibold">{t({ ID: 'Pemesan', EN: 'Customer' })}</th>
                            <th className="px-3 py-2 font-semibold">{t({ ID: 'Tiket', EN: 'Ticket' })}</th>
                            <th className="px-3 py-2 font-semibold">{t({ ID: 'Tiket Masuk', EN: 'Tickets In' })}</th>
                            <th className="px-3 py-2 font-semibold">Source</th>
                          </tr></thead>
                          <tbody className="divide-y divide-slate-100">
                            {monitorData.checkin.items.map((c, i) => (
                              <tr key={i} className="hover:bg-slate-50/60">
                                <td className="px-3 py-2 font-mono text-slate-800">{c.booking_id}</td>
                                <td className="px-3 py-2 text-slate-700">{c.customer_nama}</td>
                                <td className="px-3 py-2 text-slate-700">{c.kategori}</td>
                                <td className="px-3 py-2 text-slate-800 font-medium">{c.tiket_masuk}</td>
                                <td className="px-3 py-2 text-slate-600">{c.source}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {monitorData.merch.items.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">{t({ ID: 'Riwayat Verifikasi Merch', EN: 'Merch Verification History' })}</p>
                      <div className="overflow-x-auto border border-slate-200 rounded-xl">
                        <table className="w-full text-xs">
                          <thead><tr className="bg-slate-50 text-slate-500 text-left">
                            <th className="px-3 py-2 font-semibold">Kode</th>
                            <th className="px-3 py-2 font-semibold">Merch</th>
                            <th className="px-3 py-2 font-semibold">{t({ ID: 'Pemesan', EN: 'Customer' })}</th>
                            <th className="px-3 py-2 font-semibold">Qty</th>
                            <th className="px-3 py-2 font-semibold">Status</th>
                            <th className="px-3 py-2 font-semibold">{t({ ID: 'Waktu', EN: 'Time' })}</th>
                          </tr></thead>
                          <tbody className="divide-y divide-slate-100">
                            {monitorData.merch.items.map((m, i) => (
                              <tr key={i} className="hover:bg-slate-50/60">
                                <td className="px-3 py-2 font-mono text-slate-800">{m.kode}</td>
                                <td className="px-3 py-2 text-slate-700">{m.nama_merch}</td>
                                <td className="px-3 py-2 text-slate-700">{m.customer_nama}</td>
                                <td className="px-3 py-2 text-slate-800">{m.jumlah}</td>
                                <td className="px-3 py-2 text-slate-700">{m.status_pengambilan}</td>
                                <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{formatDate(m.waktu)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-400">{t({ ID: 'Data tidak tersedia.', EN: 'Data unavailable.' })}</p>
              )}
            </div>
          )}

          {showForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-900/40" onClick={() => !busy && setShowForm(false)} />
              <form onSubmit={save} className="relative w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-xl p-6 space-y-4">
                <h3 className="text-lg font-bold text-slate-900">{form.id ? t({ ID: 'Ubah Akun', EN: 'Edit Account' }) : t({ ID: 'Tambah Admin', EN: 'Add Admin' })}</h3>
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">{t({ ID: 'Nama', EN: 'Name' })}</label>
                  <input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} required className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">Username</label>
                  <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">{form.id ? t({ ID: 'Password baru (kosongkan jika tidak diubah)', EN: 'New password (leave blank to keep)' }) : t({ ID: 'Password', EN: 'Password' })}</label>
                  <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm" minLength={form.password ? 6 : undefined} />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowForm(false)} disabled={busy} className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold">{t({ ID: 'Batal', EN: 'Cancel' })}</button>
                  <button type="submit" disabled={busy} className="px-4 py-2.5 rounded-xl bg-[#0057e7] hover:bg-[#0048c2] text-white text-sm font-semibold disabled:opacity-60">{busy ? <>{t({ ID: 'Menyimpan', EN: 'Saving' })}<LoadingDots /></> : t({ ID: 'Simpan', EN: 'Save' })}</button>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
