'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import SuperAdminSidebar from '@/components/layout/SuperAdminSidebar'
import DashboardHeader from '@/components/layout/DashboardHeader'
import EventSelector from '@/components/EventSelector'
import { getAdminSession, useAdminName, adminFetch } from '@/lib/adminAuth'
import { useLang } from '@/lib/i18n'
import { useSelectedEventId } from '@/lib/eventStore'
import { useSelectedEventStatus } from '@/lib/useEventStatus'
import { friendlyError } from '@/app/lib/fetchError'
import { parseRupiah } from '@/app/lib/rupiah'
import Toast from '@/components/Toast'
import LoadingDots from '@/components/LoadingDots'

interface Voucher {
  id: string
  kode_voucher: string
  nominal_diskon: number
  jumlah_digunakan: number
  kuota_penggunaan: number
  status: 'aktif' | 'nonaktif'
  id_event: string | null
  created_at: string
}

interface EventLite {
  id: string
  nama_event: string
}

function formatRupiah(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID')
}

function StatIcon({ path }: { path: string }) {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  )
}

export default function SuperAdminVouchersPage() {
  const { t } = useLang()
  const router = useRouter()
  const adminName = useAdminName()
  const selectedEventId = useSelectedEventId()
  const { id: activeId, loading: statusLoading, finished: eventFinished } = useSelectedEventStatus()
  const effectiveEventId = selectedEventId || activeId || ''
  const readOnly = eventFinished
  const [events, setEvents] = useState<EventLite[]>([])
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [notif, setNotif] = useState<{ ok: boolean; text: string } | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newForm, setNewForm] = useState({ kode: '', nominal: '', kuota: '' })
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{ nominal: string; kuota: string }>({ nominal: '', kuota: '' })

  const notify = useCallback((ok: boolean, text: string) => {
    setNotif({ ok, text })
  }, [])

  const load = () => {
    const q = effectiveEventId ? `?event=${encodeURIComponent(effectiveEventId)}` : ''
    adminFetch(`/api/vouchers${q}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.error) throw new Error(res.error)
        setVouchers(res.data || [])
        if (res.events) setEvents(res.events)
      })
      .catch((e) => notify(false, friendlyError(e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const session = getAdminSession('superadmin') || getAdminSession('admin')
    if (!session || (session.role !== 'superadmin' && session.role !== 'admin')) {
      router.replace('/superadmin/login')
      return
    }
    load()
  }, [router, effectiveEventId])

  const currentEventName = effectiveEventId ? events.find((e) => e.id === effectiveEventId)?.nama_event : ''

  const handleAdd = async () => {
    if (!effectiveEventId) {
      notify(false, t({ ID: 'Pilih event dulu sebelum membuat voucher.', EN: 'Select an event first before creating a voucher.' }))
      return
    }
    const kode = newForm.kode.trim().toUpperCase()
    const nominal = parseRupiah(newForm.nominal)
    const kuota = Number(newForm.kuota)
    if (!kode || !Number.isFinite(nominal) || nominal < 0 || !Number.isInteger(kuota) || kuota < 1) {
      notify(false, t({ ID: 'Isi kode, nominal diskon, dan kuota dengan benar.', EN: 'Fill in code, discount amount, and quota correctly.' }))
      return
    }
    setBusy(true)
    try {
      const res = await adminFetch('/api/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kode_voucher: kode, nominal_diskon: nominal, kuota_penggunaan: kuota, id_event: effectiveEventId }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || t({ ID: 'Gagal membuat voucher', EN: 'Failed to create voucher' }))
      notify(true, `${kode} ${t({ ID: 'berhasil dibuat untuk', EN: 'created successfully for' })} ${currentEventName || effectiveEventId}.`)
      setNewForm({ kode: '', nominal: '', kuota: '' })
      setShowAdd(false)
      load()
    } catch (err) {
      notify(false, friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  const handleToggleStatus = async (v: Voucher) => {
    const next = v.status === 'aktif' ? 'nonaktif' : 'aktif'
    setBusy(true)
    try {
      const res = await adminFetch(`/api/vouchers/${v.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || t({ ID: 'Gagal mengubah status', EN: 'Failed to change status' }))
      notify(true, `${v.kode_voucher} ${t({ ID: 'kini', EN: 'now' })} ${next === 'aktif' ? t({ ID: 'Aktif', EN: 'active' }) : t({ ID: 'Nonaktif', EN: 'inactive' })}.`)
      load()
    } catch (err) {
      notify(false, friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  const handleStartEdit = (v: Voucher) => {
    setEditId(v.id)
    setEditForm({ nominal: String(v.nominal_diskon), kuota: String(v.kuota_penggunaan) })
  }

  const handleSaveEdit = async (v: Voucher) => {
    const nominal = parseRupiah(editForm.nominal)
    const kuota = Number(editForm.kuota)
    if (!Number.isFinite(nominal) || nominal < 0 || !Number.isInteger(kuota) || kuota < 1) {
      notify(false, t({ ID: 'Nominal dan kuota tidak valid.', EN: 'Invalid amount or quota.' }))
      return
    }
    setBusy(true)
    try {
      const res = await adminFetch(`/api/vouchers/${v.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nominal_diskon: nominal, kuota_penggunaan: kuota }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || t({ ID: 'Gagal menyimpan', EN: 'Failed to save' }))
      notify(true, `${v.kode_voucher} ${t({ ID: 'disimpan.', EN: 'saved.' })}`)
      setEditId(null)
      setEditForm({ nominal: '', kuota: '' })
      load()
    } catch (err) {
      notify(false, friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (v: Voucher) => {
    if (!confirm(`${t({ ID: 'Hapus voucher', EN: 'Delete voucher' })} ${v.kode_voucher}?`)) return
    setBusy(true)
    try {
      const res = await adminFetch(`/api/vouchers/${v.id}`, { method: 'DELETE' })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || t({ ID: 'Gagal menghapus', EN: 'Failed to delete' }))
      notify(true, `${v.kode_voucher} ${t({ ID: 'dihapus.', EN: 'deleted.' })}`)
      load()
    } catch (err) {
      notify(false, friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  const aktif = vouchers.filter((v) => v.status === 'aktif').length
  const totalTerpakai = vouchers.reduce((sum, v) => sum + Number(v.jumlah_digunakan), 0)
  const totalTerdiskon = vouchers.reduce((sum, v) => sum + Number(v.nominal_diskon) * Number(v.jumlah_digunakan), 0)

  const STAT_CARDS = [
    { label: t({ ID: 'Total Voucher', EN: 'Total Vouchers' }), value: vouchers.length.toLocaleString('id-ID'), sub: '', iconColor: 'bg-blue-50 text-blue-600', path: 'M9 14l6-6m-6 0h6v6' },
    { label: t({ ID: 'Voucher Aktif', EN: 'Active Vouchers' }), value: aktif.toLocaleString('id-ID'), sub: '', iconColor: 'bg-emerald-50 text-emerald-600', path: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
    { label: t({ ID: 'Total Terpakai', EN: 'Total Redeemed' }), value: totalTerpakai.toLocaleString('id-ID'), sub: '', iconColor: 'bg-amber-50 text-amber-600', path: 'M5 5h14l-1.5 14H6.5L5 5z' },
    { label: t({ ID: 'Total Diskon Tersalur', EN: 'Total Discount Issued' }), value: formatRupiah(totalTerdiskon), sub: '', iconColor: 'bg-indigo-50 text-indigo-600', path: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1' },
  ]

  const filtered = vouchers.filter((v) => {
    const q = search.toLowerCase()
    return !q || v.kode_voucher.toLowerCase().includes(q)
  })

  if (loading || statusLoading) {
    return (
      <div className="flex min-h-screen bg-[#f8fafc]">
        <SuperAdminSidebar />
        <main className="flex-1 p-8 flex items-center justify-center text-slate-400 text-sm">
          {t({ ID: 'Memuat data voucher', EN: 'Loading voucher data' })}<LoadingDots />
        </main>
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
          searchPlaceholder={t({ ID: 'Cari kode voucher...', EN: 'Search voucher code...' })}
          userName={adminName || 'Super Admin'}
          userRole="Super Admin"
        />

        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto overflow-auto">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t({ ID: 'Kelola Voucher', EN: 'Manage Vouchers' })}</h1>
              <p className="text-sm text-slate-500 mt-1">
                {effectiveEventId && currentEventName
                  ? `${t({ ID: 'Voucher untuk', EN: 'Vouchers for' })} ${currentEventName}`
                  : t({ ID: 'Buat, aktifkan/nonaktifkan, dan pantau kuota voucher promo per event', EN: 'Create, activate/deactivate, and monitor promo voucher quotas per event' })}
              </p>
              {notif && (
                <Toast ok={notif.ok} text={notif.text} onClose={() => setNotif(null)} className="mt-3" />
              )}
              {readOnly && (
                <p className="text-xs text-amber-600 mt-2">
                  {t({ ID: 'Event sudah selesai — mode hanya lihat. Membuat & mengedit voucher dinonaktifkan.', EN: 'Event is finished — view-only mode. Creating & editing vouchers is disabled.' })}
                </p>
              )}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
              <EventSelector />
              <button
                type="button"
                onClick={() => setShowAdd((v) => !v)}
                disabled={!effectiveEventId || readOnly}
                title={readOnly
                  ? t({ ID: 'Event sudah selesai — mode hanya lihat', EN: 'Event is finished — view-only mode' })
                  : effectiveEventId ? undefined : t({ ID: 'Pilih event dulu melalui sidebar/selector', EN: 'Select an event first via sidebar/selector' })}
                className="inline-flex items-center gap-2 bg-[#0057e7] hover:bg-[#0048c2] text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span>{t({ ID: 'Tambah Voucher', EN: 'Add Voucher' })}</span>
              </button>
            </div>
          </div>

          {/* Form tambah voucher */}
          {showAdd && (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm mb-8">
              {readOnly ? (
                <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm px-4 py-3">
                  {t({ ID: 'Event sudah selesai — voucher tidak dapat dibuat/diubah.', EN: 'Event is finished — vouchers cannot be created or edited.' })}
                </div>
              ) : !effectiveEventId ? (
                <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm px-4 py-3">
                  {t({ ID: 'Pilih satu event terlebih dahulu (menu Edisi Event di sidebar). Voucher harus terikat ke satu event.', EN: 'Select an event first (Event Editions menu in the sidebar). Vouchers must be tied to one event.' })}
                </div>
              ) : (
                <>
                  <h3 className="text-sm font-bold text-slate-900 mb-1">{t({ ID: 'Voucher Baru', EN: 'New Voucher' })}</h3>
                  <p className="text-xs text-slate-500 mb-4">
                    {t({ ID: 'Event', EN: 'Event' })}: <span className="font-semibold text-slate-700">{currentEventName || effectiveEventId}</span>
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t({ ID: 'Kode Voucher', EN: 'Voucher Code' })}</label>
                      <input
                        type="text"
                        placeholder="PROMO50"
                        value={newForm.kode}
                        onChange={(e) => setNewForm({ ...newForm, kode: e.target.value.toUpperCase() })}
                        className="w-full bg-[#f1f5f9] border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-mono uppercase focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t({ ID: 'Nominal Diskon (Rp)', EN: 'Discount Amount (Rp)' })}</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder={t({ ID: 'cth. 50.000', EN: 'e.g. 50.000' })}
                        value={newForm.nominal}
                        onChange={(e) => setNewForm({ ...newForm, nominal: e.target.value })}
                        className="w-full bg-[#f1f5f9] border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all"
                      />
                      {newForm.nominal.trim() !== '' && (
                        <p className="text-[11px] text-slate-500 mt-1">= {formatRupiah(parseRupiah(newForm.nominal))}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t({ ID: 'Kuota Penggunaan', EN: 'Usage Quota' })}</label>
                      <input
                        type="number"
                        min={1}
                        placeholder="100"
                        value={newForm.kuota}
                        onChange={(e) => setNewForm({ ...newForm, kuota: e.target.value })}
                        className="w-full bg-[#f1f5f9] border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAdd}
                    disabled={busy}
                    className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {busy ? <>{t({ ID: 'Menyimpan', EN: 'Saving' })}<LoadingDots /></> : t({ ID: 'Buat Voucher', EN: 'Create Voucher' })}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
            {STAT_CARDS.map((s) => (
              <div key={s.label} className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${s.iconColor}`}>
                    <StatIcon path={s.path} />
                  </div>
                </div>
                <p className="text-2xl md:text-3xl font-bold text-slate-900 mb-1">{s.value}</p>
                <p className="text-xs font-semibold text-slate-600">{s.label}</p>
                {s.sub && <p className="text-[11px] text-slate-400 mt-0.5">{s.sub}</p>}
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">{t({ ID: 'Daftar Voucher', EN: 'Voucher List' })}</h3>
              <span className="text-xs text-slate-400">
                {filtered.length} {t({ ID: 'voucher', EN: 'vouchers' })}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="text-left px-6 py-3.5">{t({ ID: 'Kode', EN: 'Code' })}</th>
                    <th className="text-left px-6 py-3.5">{t({ ID: 'Event', EN: 'Event' })}</th>
                    <th className="text-left px-6 py-3.5">{t({ ID: 'Diskon', EN: 'Discount' })}</th>
                    <th className="text-left px-6 py-3.5">{t({ ID: 'Pemakaian', EN: 'Usage' })}</th>
                    <th className="text-left px-6 py-3.5">{t({ ID: 'Status', EN: 'Status' })}</th>
                    <th className="text-right px-6 py-3.5">{t({ ID: 'Aksi', EN: 'Action' })}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-slate-400 text-xs">
                        {effectiveEventId
                          ? t({ ID: 'Belum ada voucher untuk event ini. Buat melalui tombol "Tambah Voucher".', EN: 'No vouchers for this event yet. Create one via the "Add Voucher" button.' })
                          : t({ ID: 'Pilih event untuk melihat voucher miliknya.', EN: 'Select an event to see its vouchers.' })}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((v) => {
                      const used = Number(v.jumlah_digunakan)
                      const quota = Number(v.kuota_penggunaan)
                      const pct = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0
                      const full = used >= quota
                      const editing = editId === v.id
                      return (
                        <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-mono text-xs font-semibold text-blue-600">{v.kode_voucher}</p>
                          </td>
                          <td className="px-6 py-4">
                            {v.id_event ? (
                              <span className="text-xs text-slate-600">{events.find((e) => e.id === v.id_event)?.nama_event || v.id_event}</span>
                            ) : (
                              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                {t({ ID: 'Tanpa event', EN: 'No event set' })}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {editing ? (
                              <input
                                type="text"
                                inputMode="numeric"
                                value={editForm.nominal}
                                onChange={(e) => setEditForm({ ...editForm, nominal: e.target.value })}
                                className="w-28 bg-[#f1f5f9] border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-600"
                              />
                            ) : (
                              <span className="font-semibold text-slate-900">-{formatRupiah(Number(v.nominal_diskon))}</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {editing ? (
                              <input
                                type="number"
                                min={1}
                                value={editForm.kuota}
                                onChange={(e) => setEditForm({ ...editForm, kuota: e.target.value })}
                                className="w-24 bg-[#f1f5f9] border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-600"
                              />
                            ) : (
                              <div className="flex items-center gap-3">
                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden min-w-[80px]">
                                  <div
                                    className={`h-full rounded-full ${full ? 'bg-rose-500' : pct > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-xs text-slate-500 font-mono shrink-0">
                                  {used}/{quota}
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                              v.status === 'aktif'
                                ? (full ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200')
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                              {v.status === 'aktif'
                                ? (full ? t({ ID: 'Habis', EN: 'Used Up' }) : t({ ID: 'Aktif', EN: 'Active' }))
                                : t({ ID: 'Nonaktif', EN: 'Inactive' })}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
{readOnly ? (
                              <span className="text-xs text-slate-300">{t({ ID: 'Hanya lihat', EN: 'View only' })}</span>
                            ) : (
                              editing ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEdit(v)}
                                    disabled={busy}
                                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                                  >
                                    {t({ ID: 'Simpan', EN: 'Save' })}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => { setEditId(null); setEditForm({ nominal: '', kuota: '' }) }}
                                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors"
                                  >
                                    {t({ ID: 'Batal', EN: 'Cancel' })}
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleStartEdit(v)}
                                    disabled={busy || !!editId}
                                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors disabled:opacity-50"
                                  >
                                    <svg className="w-3.5 h-3.5 inline-block -mt-0.5 mr-1" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    {t({ ID: 'Edit', EN: 'Edit' })}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleStatus(v)}
                                    disabled={busy}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
                                      v.status === 'aktif'
                                        ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                    }`}
                                  >
                                    {v.status === 'aktif' ? t({ ID: 'Nonaktifkan', EN: 'Deactivate' }) : t({ ID: 'Aktifkan', EN: 'Activate' })}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(v)}
                                    disabled={busy}
                                    className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold transition-colors disabled:opacity-50"
                                  >
                                    <svg className="w-3.5 h-3.5 inline-block -mt-0.5 mr-1" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    {t({ ID: 'Hapus', EN: 'Delete' })}
                                  </button>
                                </>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )
                    })
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