'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import SuperAdminSidebar from '@/components/layout/SuperAdminSidebar'
import DashboardHeader from '@/components/layout/DashboardHeader'
import EventSelector from '@/components/EventSelector'
import { getAdminSession, useAdminName, adminFetch } from '@/lib/adminAuth'
import { useSelectedEventId } from '@/lib/eventStore'
import { useSelectedEventStatus } from '@/lib/useEventStatus'
import { useLang } from '@/lib/i18n'
import { friendlyError } from '@/app/lib/fetchError'
import { parseRupiah } from '@/app/lib/rupiah'
import Toast from '@/components/Toast'
import LoadingDots from '@/components/LoadingDots'

interface Ticket {
  id: string
  kategori: string
  harga: number
  periode_penjualan: string | null
  deskripsi: string | null
  kuota: number
  sisa_kuota: number
  status?: 'aktif' | 'nonaktif' | string | null
}

function formatRupiah(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID')
}

function statusOf(t: Ticket): 'active' | 'soldout' | 'inactive' {
  if ((t.status ?? 'aktif') === 'nonaktif') return 'inactive'
  return t.sisa_kuota <= 0 ? 'soldout' : 'active'
}

const STATUS_CONFIG = {
  active: { label: 'Aktif', color: 'text-green-400', bg: 'bg-green-900/20', border: 'border-green-800/50' },
  soldout: { label: 'Sold Out', color: 'text-red-400', bg: 'bg-red-900/20', border: 'border-red-800/50' },
  inactive: { label: 'Nonaktif', color: 'text-slate-400', bg: 'bg-slate-900/10', border: 'border-slate-800/50' },
}

export default function SuperAdminTicketsPage() {
  const { t } = useLang()
  const router = useRouter()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Ticket | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newTicket, setNewTicket] = useState({ kategori: '', harga: '', kuota: '', periode_penjualan: '', deskripsi: '' })
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const eventId = useSelectedEventId()
  const { finished: eventFinished } = useSelectedEventStatus()
  const readOnly = eventFinished

  const load = () => {
    const url = eventId ? `/api/tickets?event=${encodeURIComponent(eventId)}` : '/api/tickets'
    adminFetch(url)
      .then((r) => r.json())
      .then((res) => {
        if (res.error) throw new Error(res.error)
        setTickets(res.data || [])
      })
      .catch((e) => setError(friendlyError(e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const session = getAdminSession('superadmin') || getAdminSession('admin')
    if (!session || (session.role !== 'superadmin' && session.role !== 'admin')) {
      router.replace('/superadmin/login')
      return
    }
    load()
  }, [router, eventId])

  const handleEdit = (tk: Ticket) => {
    setEditId(tk.id)
    setEditForm({ ...tk })
  }

  const handleSave = async () => {
    if (!editForm || busy) return
    if (readOnly) {
      setError(t({ ID: 'Event sudah selesai — mode hanya lihat.', EN: 'Event is finished — view-only mode.' }))
      return
    }
    setBusy(true)
    try {
      const res = await adminFetch(`/api/tickets/${editForm.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kategori: editForm.kategori,
          harga: editForm.harga,
          kuota: editForm.kuota,
          periode_penjualan: editForm.periode_penjualan,
          deskripsi: editForm.deskripsi,
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || t({ ID: 'Gagal menyimpan', EN: 'Failed to save' }))
      load()
      setEditId(null)
      setEditForm(null)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (tk: Ticket) => {
    if (readOnly) {
      setError(t({ ID: 'Event sudah selesai — mode hanya lihat.', EN: 'Event is finished — view-only mode.' }))
      return
    }
    if (!confirm(`${t({ ID: 'Hapus tiket', EN: 'Delete ticket' })} ${tk.kategori}?`)) return
    try {
      const res = await adminFetch(`/api/tickets/${tk.id}`, { method: 'DELETE' })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || t({ ID: 'Gagal menghapus', EN: 'Failed to delete' }))
      load()
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  const handleToggleStatus = async (tk: Ticket) => {
    if (readOnly || busy) return
    const next = (tk.status ?? 'aktif') === 'aktif' ? 'nonaktif' : 'aktif'
    setBusy(true)
    try {
      const res = await adminFetch(`/api/tickets/${tk.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || t({ ID: 'Gagal mengubah status', EN: 'Failed to change status' }))
      load()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  const handleAddTicket = async () => {
    if (!newTicket.kategori || !newTicket.harga || !newTicket.kuota || busy) return
    const harga = parseRupiah(newTicket.harga)
    const kuota = Math.max(1, Math.round(parseRupiah(newTicket.kuota)))
    if (harga <= 0) {
      setError(t({ ID: 'Harga harus lebih dari Rp 0. Contoh: 100.000', EN: 'Price must be more than Rp 0. Example: 100.000' }))
      return
    }
    if (readOnly) {
      setError(t({ ID: 'Event sudah selesai — mode hanya lihat.', EN: 'Event is finished — view-only mode.' }))
      return
    }
    setBusy(true)
    try {
      const res = await adminFetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kategori: newTicket.kategori,
          harga,
          kuota,
          periode_penjualan: newTicket.periode_penjualan || null,
          deskripsi: newTicket.deskripsi || null,
          event: eventId || null,
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || t({ ID: 'Gagal menambah tiket', EN: 'Failed to add ticket' }))
      load()
      setNewTicket({ kategori: '', harga: '', kuota: '', periode_penjualan: '', deskripsi: '' })
      setShowAdd(false)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  const statusLabel = (label: string) =>
    label === 'Aktif'
      ? t({ ID: 'Aktif', EN: 'Active' })
      : label === 'Nonaktif'
        ? t({ ID: 'Nonaktif', EN: 'Inactive' })
        : t({ ID: 'Sold Out', EN: 'Sold Out' })

  const filteredTickets = tickets.filter((tk) => {
    const q = search.toLowerCase()
    return (
      tk.kategori.toLowerCase().includes(q) ||
      (tk.periode_penjualan || '').toLowerCase().includes(q) ||
      (tk.deskripsi || '').toLowerCase().includes(q)
    )
  })

  const adminName = useAdminName()

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
          onSearchChange={setSearch}
          searchPlaceholder={t({ ID: 'Cari tiket...', EN: 'Search tickets...' })}
          userName={adminName || 'Super Admin'}
          userRole="Super Admin"
        />

        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto overflow-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t({ ID: 'Kelola Tiket', EN: 'Manage Tickets' })}</h1>
              <p className="text-sm text-slate-500 mt-1">{t({ ID: 'Manage kategori, kuota, dan harga tiket sesuai event terpilih', EN: 'Manage ticket categories, quota, and prices for the selected event' })}</p>
              {error && <Toast ok={false} text={error} onClose={() => setError('')} className="mt-2" />}
              {readOnly && (
                <p className="text-xs text-amber-600 mt-2">
                  {t({ ID: 'Event sudah selesai — mode hanya lihat. Menambah & mengedit dinonaktifkan.', EN: 'Event is finished — view-only mode. Adding & editing is disabled.' })}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <EventSelector />
              <button onClick={() => setShowAdd(!showAdd)} disabled={readOnly}
                title={readOnly ? t({ ID: 'Event sudah selesai — mode hanya lihat', EN: 'Event is finished — view-only mode' }) : undefined}
                className="px-5 py-2.5 rounded-xl bg-[#0057e7] hover:bg-[#0048c2] text-white text-sm font-semibold transition-all shadow-sm flex items-center gap-1.5 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed">
                <span>+</span>
                <span>{t({ ID: 'Tambah Tiket', EN: 'Add Ticket' })}</span>
              </button>
            </div>
          </div>

          {showAdd && (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 mb-6 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 mb-4">{t({ ID: 'Tambah Kategori Tiket Baru', EN: 'Add New Ticket Category' })}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                {[
                  { label: t({ ID: 'Nama Kategori', EN: 'Category Name' }), key: 'kategori', placeholder: t({ ID: 'cth. VIP Premium', EN: 'e.g. VIP Premium' }) },
                  { label: t({ ID: 'Harga (Rp)', EN: 'Price (Rp)' }), key: 'harga', placeholder: t({ ID: 'cth. 100.000', EN: 'e.g. 100.000' }) },
                  { label: t({ ID: 'Total Kuota', EN: 'Total Quota' }), key: 'kuota', placeholder: '100', type: 'number' },
                  { label: t({ ID: 'Periode Penjualan', EN: 'Sales Period' }), key: 'periode_penjualan', placeholder: t({ ID: 'cth. 1-17 Sept 2026', EN: 'e.g. 1-17 Sept 2026' }) },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">{f.label}</label>
                    <input type={f.type || 'text'} inputMode={f.key === 'harga' ? 'numeric' : undefined} placeholder={f.placeholder}
                      value={newTicket[f.key as keyof typeof newTicket]}
                      onChange={(e) => setNewTicket({ ...newTicket, [f.key]: e.target.value })}
                      className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all" />
                    {f.key === 'harga' && newTicket.harga.trim() !== '' && (
                      <p className="text-[11px] text-slate-500 mt-1">= {formatRupiah(parseRupiah(newTicket.harga))}</p>
                    )}
                  </div>
                ))}
              </div>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t({ ID: 'Deskripsi', EN: 'Description' })}</label>
                <textarea
                  rows={4}
                  placeholder={t({ ID: 'Deskripsi tiket (muncul di halaman pilih tiket pembeli)', EN: 'Ticket description (shown on buyer ticket selection page)' })}
                  value={newTicket.deskripsi}
                  onChange={(e) => setNewTicket({ ...newTicket, deskripsi: e.target.value })}
                  className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleAddTicket} disabled={busy} className="px-5 py-2.5 rounded-xl bg-[#0057e7] hover:bg-[#0048c2] text-white text-sm font-semibold transition-all shadow-sm disabled:opacity-50">{t({ ID: 'Tambah', EN: 'Add' })}</button>
                <button onClick={() => setShowAdd(false)} className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-colors">{t({ ID: 'Batal', EN: 'Cancel' })}</button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {tickets.length === 0 && <div className="bg-white border border-slate-200/90 rounded-2xl text-center py-16 text-slate-400 text-sm">{t({ ID: 'Belum ada tiket. Tambahkan tiket pertama.', EN: 'No tickets yet. Add your first ticket.' })}</div>}
            {tickets.length > 0 && filteredTickets.length === 0 && (
              <div className="bg-white border border-slate-200/90 rounded-2xl text-center py-16 text-slate-400 text-sm">{t({ ID: 'Tidak ada tiket yang cocok dengan pencarian kamu.', EN: 'No tickets match your search.' })}</div>
            )}
            {filteredTickets.map((tk) => {
              const s = STATUS_CONFIG[statusOf(tk)]
              const terjual = tk.kuota - tk.sisa_kuota
              const persen = tk.kuota > 0 ? Math.round((terjual / tk.kuota) * 100) : 0
              const isEditing = editId === tk.id
              const isSoldOut = tk.sisa_kuota <= 0
              const isInactive = (tk.status ?? 'aktif') === 'nonaktif'
              return (
                <div key={tk.id} className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm hover:border-blue-200 hover:shadow-md hover:shadow-blue-900/[0.06] hover:-translate-y-0.5 transition-all duration-200">
                  {isEditing && editForm ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div><label className="text-xs font-semibold text-slate-700 block mb-1">{t({ ID: 'Nama', EN: 'Name' })}</label>
                          <input value={editForm.kategori} onChange={(e) => setEditForm({ ...editForm, kategori: e.target.value })}
                            className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:bg-white focus:border-blue-600" /></div>
                        <div><label className="text-xs font-semibold text-slate-700 block mb-1">{t({ ID: 'Harga', EN: 'Price' })}</label>
                          <input type="text" inputMode="numeric" value={editForm.harga} onChange={(e) => setEditForm({ ...editForm, harga: parseRupiah(e.target.value) })}
                            className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:bg-white focus:border-blue-600" />
                          <p className="text-[11px] text-slate-500 mt-1">= {formatRupiah(Number(editForm.harga) || 0)}</p></div>
                        <div><label className="text-xs font-semibold text-slate-700 block mb-1">{t({ ID: 'Kuota', EN: 'Quota' })}</label>
                          <input type="number" value={editForm.kuota} onChange={(e) => setEditForm({ ...editForm, kuota: Math.max(0, Math.round(parseRupiah(e.target.value))) })}
                            className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:bg-white focus:border-blue-600" /></div>
                      </div>
                      <div><label className="text-xs font-semibold text-slate-700 block mb-1">{t({ ID: 'Periode Penjualan', EN: 'Sales Period' })}</label>
                        <input value={editForm.periode_penjualan || ''} onChange={(e) => setEditForm({ ...editForm, periode_penjualan: e.target.value })}
                          className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:bg-white focus:border-blue-600" /></div>
                      <div><label className="text-xs font-semibold text-slate-700 block mb-1">{t({ ID: 'Deskripsi', EN: 'Description' })}</label>
                        <textarea rows={4} value={editForm.deskripsi || ''} onChange={(e) => setEditForm({ ...editForm, deskripsi: e.target.value })}
                          className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:bg-white focus:border-blue-600" /></div>
                      <div className="flex gap-2">
                        <button onClick={handleSave} disabled={busy} className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-medium disabled:opacity-50">{t({ ID: 'Simpan', EN: 'Save' })}</button>
                        <button onClick={() => { setEditId(null); setEditForm(null) }} className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium">{t({ ID: 'Batal', EN: 'Cancel' })}</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start justify-between mb-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2.5 mb-1">
                            <h3 className="text-lg font-bold text-slate-900">{tk.kategori}</h3>
                            <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                              isInactive ? 'bg-slate-100 text-slate-600 border-slate-200' : isSoldOut ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                              {statusLabel(s.label)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">{tk.periode_penjualan || t({ ID: 'Periode penjualan belum diatur', EN: 'Sales period not set' })}</p>
                          {tk.deskripsi && <p className="text-xs text-slate-600 mt-2 line-clamp-2 max-w-xl">{tk.deskripsi}</p>}
                        </div>
                        <div className="sm:text-right shrink-0 sm:ml-4">
                          <p className="text-xl sm:text-2xl font-bold text-slate-900">{formatRupiah(Number(tk.harga))}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{t({ ID: 'per tiket', EN: 'per ticket' })}</p>
                        </div>
                      </div>
                      <div className="mb-4 pt-3 border-t border-slate-100">
                        <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                          <span>{t({ ID: 'Terjual:', EN: 'Sold:' })} <span className="font-semibold text-slate-800">{terjual} / {tk.kuota}</span> ({tk.sisa_kuota} sisa)</span>
                          <span className="font-bold text-blue-600">{persen}%</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${persen}%` }} />
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {readOnly ? (
                          <span className="text-xs text-slate-300">{t({ ID: 'Hanya lihat', EN: 'View only' })}</span>
                        ) : (
                          <>
                            <button onClick={() => handleEdit(tk)} disabled={busy} className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors disabled:opacity-50">{t({ ID: 'Edit', EN: 'Edit' })}</button>
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(tk)}
                              disabled={busy}
                              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
                                isInactive
                                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                              }`}
                            >
                              {isInactive ? t({ ID: 'Aktifkan', EN: 'Activate' }) : t({ ID: 'Nonaktifkan', EN: 'Deactivate' })}
                            </button>
                            <button onClick={() => handleDelete(tk)} disabled={busy} className="px-3.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition-colors disabled:opacity-50">{t({ ID: 'Hapus', EN: 'Delete' })}</button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </main>
      </div>
    </div>
  )
}