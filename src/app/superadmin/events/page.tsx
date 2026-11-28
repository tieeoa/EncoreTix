'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import SuperAdminSidebar from '@/components/layout/SuperAdminSidebar'
import DashboardHeader from '@/components/layout/DashboardHeader'
import { getAdminSession, useAdminName, adminFetch } from '@/lib/adminAuth'
import { selectEventId } from '@/lib/eventStore'
import { useLang } from '@/lib/i18n'
import { friendlyError } from '@/app/lib/fetchError'
import { todayISO } from '@/app/lib/events'
import Toast from '@/components/Toast'
import LoadingDots from '@/components/LoadingDots'

interface EventRow {
  id: string
  nama_event: string
  slug: string | null
  tanggal: string | null
  waktu: string | null
  venue: string | null
  alamat: string | null
  deskripsi: string | null
  syarat_ketentuan: string | null
  status: string
  gambar: string | null
}

const EMPTY_FORM: Partial<EventRow> = {
  nama_event: '',
  slug: '',
  tanggal: '',
  waktu: '',
  venue: '',
  alamat: '',
  deskripsi: '',
  syarat_ketentuan: '',
  gambar: '',
}

export default function SuperAdminEventsPage() {
  const { t } = useLang()
  const router = useRouter()
  const adminName = useAdminName()
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<EventRow>>(EMPTY_FORM)
  const [posterFile, setPosterFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [statusBusy, setStatusBusy] = useState<string | null>(null)
  const [finishTarget, setFinishTarget] = useState<EventRow | null>(null)
  const [finishing, setFinishing] = useState(false)

  const load = () => {
    adminFetch('/api/events')
      .then((r) => r.json())
      .then((res) => {
        if (res.error) throw new Error(res.error)
        setEvents(res.data || [])
        if (Array.isArray(res.autoClosed) && res.autoClosed.length > 0) {
          setNotice(
            t({
              ID: `Otomatis ditandai selesai (tanggal sudah lewat): ${res.autoClosed.join(', ')}`,
              EN: `Automatically marked as finished (date passed): ${res.autoClosed.join(', ')}`,
            })
          )
        }
      })
      .catch((e) => setError(friendlyError(e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const session = getAdminSession('superadmin')
    if (!session || session.role !== 'superadmin') {
      router.replace('/superadmin/login')
      return
    }
    load()
  }, [router])

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setEditing(null)
    setShowForm(false)
    setPosterFile(null)
  }

  const startEdit = (e: EventRow) => {
    setForm({
      ...e,
      tanggal: e.tanggal || '',
      waktu: e.waktu || '',
      venue: e.venue || '',
      alamat: e.alamat || '',
      deskripsi: e.deskripsi || '',
      syarat_ketentuan: e.syarat_ketentuan || '',
      gambar: e.gambar || '',
      slug: e.slug || '',
    })
    setEditing(e.id)
    setShowForm(true)
    setPosterFile(null)
  }

  const uploadPoster = async (): Promise<string | null> => {
    if (!posterFile) return form.gambar || null
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', posterFile)
      fd.append('bucket', 'event-posters')
      const res = await adminFetch('/api/uploads', { method: 'POST', body: fd })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || t({ ID: 'Gagal upload poster', EN: 'Failed to upload poster' }))
      return result.url as string
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nama_event?.trim()) {
      setError(t({ ID: 'Nama event wajib diisi', EN: 'Event name is required' }))
      return
    }
    setBusy(true)
    setError('')
    try {
      const posterUrl = await uploadPoster()
      const payload = {
        nama_event: form.nama_event.trim(),
        slug: form.slug?.trim() || null,
        tanggal: form.tanggal || null,
        waktu: form.waktu || null,
        venue: form.venue || null,
        alamat: form.alamat || null,
        deskripsi: form.deskripsi || null,
        syarat_ketentuan: form.syarat_ketentuan || null,
        gambar: posterUrl,
      }

      let res: Response
      if (editing) {
        // Status event diubah lewat tombol, bukan form — jangan sentuh saat edit.
        res = await adminFetch(`/api/events/${editing}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await adminFetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, status: 'paused' }),
        })
      }
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || t({ ID: 'Gagal menyimpan event', EN: 'Failed to save event' }))
      load()
      resetForm()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  const handleFinish = (ev: EventRow) => {
    setFinishTarget(ev)
  }

  const confirmFinish = async () => {
    if (!finishTarget) return
    const ev = finishTarget
    setFinishing(true)
    setError('')
    try {
      const res = await adminFetch(`/api/events/${ev.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'closed' }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || t({ ID: 'Gagal menyelesaikan event', EN: 'Failed to finish event' }))
      setFinishTarget(null)
      load()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setFinishing(false)
    }
  }

  const handleToggleStatus = async (ev: EventRow) => {
    const next = ev.status === 'active' ? 'paused' : 'active'
    setStatusBusy(ev.id)
    setError('')
    try {
      const res = await adminFetch(`/api/events/${ev.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || t({ ID: 'Gagal ubah status event', EN: 'Failed to change event status' }))
      load()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setStatusBusy(null)
    }
  }

  const handleDelete = async (ev: EventRow) => {
    if (!confirm(`${t({ ID: 'Hapus event', EN: 'Delete event' })} "${ev.nama_event}"?`)) return
    setError('')
    try {
      const res = await adminFetch(`/api/events/${ev.id}`, { method: 'DELETE' })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || t({ ID: 'Gagal menghapus event', EN: 'Failed to delete event' }))
      load()
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  // Event dianggap "selesai" bila statusnya 'closed' ATAU tanggal sudah lewat.
  const isFinishedEvent = (ev: EventRow) =>
    ev.status === 'closed' || (!!ev.tanggal && ev.tanggal < todayISO())

  const statusBadge = (status: string) => {
    if (status === 'active') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {t({ ID: 'Aktif', EN: 'Active' })}
        </span>
      )
    }
    if (status === 'paused') {
      return (
        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
          {t({ ID: 'Paused', EN: 'Paused' })}
        </span>
      )
    }
    return (
      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
        {t({ ID: 'Selesai', EN: 'Finished' })}
      </span>
    )
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
          searchPlaceholder={t({ ID: 'Cari event...', EN: 'Search events...' })}
          userName={adminName || 'Super Admin'}
          userRole="Super Admin"
        />

        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto overflow-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t({ ID: 'Kelola Event', EN: 'Manage Events' })}</h1>
              <p className="text-sm text-slate-500 mt-1">{t({ ID: 'Buat & kelola edisi event (Vol.1, Vol.2, dst). Event dengan status aktif tampil sebagai event utama di web.', EN: 'Create and manage event editions (Vol.1, Vol.2, etc). Active event appears as the main event on the website.' })}</p>
              {error && <Toast ok={false} text={error} onClose={() => setError('')} className="mt-2" />}
              {notice && <Toast ok={true} text={notice} onClose={() => setNotice('')} className="mt-2" />}
            </div>
            <button onClick={() => (showForm ? resetForm() : setShowForm(true))} className="px-5 py-2.5 rounded-xl bg-[#0057e7] hover:bg-[#0048c2] text-white text-sm font-semibold transition-all shadow-sm flex items-center gap-1.5 shrink-0">
              <span>+</span>
              <span>{t({ ID: 'Tambah Event', EN: 'Add Event' })}</span>
            </button>
          </div>

          {showForm && (
            <form onSubmit={handleSave} className="bg-white border border-slate-200/90 rounded-2xl p-6 mb-8 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-bold text-slate-900">{editing ? t({ ID: 'Edit Event', EN: 'Edit Event' }) : t({ ID: 'Tambah Event Baru', EN: 'Add New Event' })}</h3>
                <button type="button" onClick={resetForm} className="text-xs font-medium text-slate-400 hover:text-slate-600">✕ {t({ ID: 'Tutup', EN: 'Close' })}</button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t({ ID: 'Nama Event', EN: 'Event Name' })} *</label>
                  <input value={form.nama_event || ''} onChange={(e) => setForm({ ...form, nama_event: e.target.value })} placeholder={t({ ID: 'cth. CoravFest Vol.2', EN: 'e.g. CoravFest Vol.2' })}
                    className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all" />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t({ ID: 'Tanggal', EN: 'Date' })}</label>
                  <input type="date" value={form.tanggal || ''} onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
                    className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all" />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t({ ID: 'Waktu', EN: 'Time' })}</label>
                  <input value={form.waktu || ''} onChange={(e) => setForm({ ...form, waktu: e.target.value })} placeholder="15.00 - 22.00 WIB"
                    className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all" />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t({ ID: 'Venue', EN: 'Venue' })}</label>
                  <input value={form.venue || ''} onChange={(e) => setForm({ ...form, venue: e.target.value })} placeholder={t({ ID: 'cth. SM Boomi Carnival', EN: 'e.g. SM Boomi Carnival' })}
                    className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all" />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t({ ID: 'Alamat', EN: 'Address' })}</label>
                  <input value={form.alamat || ''} onChange={(e) => setForm({ ...form, alamat: e.target.value })} placeholder={t({ ID: 'cth. Jl. Raya Boomi No.12', EN: 'e.g. Jl. Raya Boomi No.12' })}
                    className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all" />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t({ ID: 'Slug (opsional)', EN: 'Slug (optional)' })}</label>
                  <input value={form.slug || ''} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="coravfest-vol-2"
                    className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all" />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t({ ID: 'Poster', EN: 'Poster' })}</label>
                  <div className="flex flex-col sm:flex-row items-start gap-4">
                    {form.gambar && !posterFile ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={form.gambar} alt={t({ ID: 'Poster saat ini', EN: 'Current poster' })} className="w-28 h-36 rounded-xl object-cover border border-slate-200 shrink-0" />
                    ) : posterFile ? (
                      <div className="w-28 h-36 rounded-xl border border-slate-200 overflow-hidden shrink-0">
                        <img src={URL.createObjectURL(posterFile)} alt={t({ ID: 'Pratinjau poster', EN: 'Poster preview' })} className="h-full w-full object-cover" />
                      </div>
                    ) : null}
                    <div className="flex-1">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/jpg"
                        onChange={(e) => {
                          const f = e.target.files?.[0] || null
                          setPosterFile(f)
                          if (!f) setForm({ ...form, gambar: form.gambar })
                        }}
                        className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-slate-700 cursor-pointer"
                      />
                      <p className="text-[11px] text-slate-400 mt-1.5">
                        {t({ ID: 'Maksimal 6MB · PNG/JPG/WebP. Pilih file poster dari perangkat.', EN: 'Max 6MB · PNG/JPG/WebP. Choose a poster file from your device.' })}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t({ ID: 'Deskripsi', EN: 'Description' })}</label>
                  <textarea rows={4} value={form.deskripsi || ''} onChange={(e) => setForm({ ...form, deskripsi: e.target.value })} placeholder={t({ ID: 'Deskripsi event (ditampilkan di halaman awal & halaman tentang event)', EN: 'Event description (shown on home page & about event page)' })}
                    className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all resize-none" />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t({ ID: 'Syarat & Ketentuan', EN: 'Terms & Conditions' })}</label>
                  <textarea rows={4} value={form.syarat_ketentuan || ''} onChange={(e) => setForm({ ...form, syarat_ketentuan: e.target.value })}
                    className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all resize-none" />
                </div>
              </div>

              <div className="flex gap-2">
                <button type="submit" disabled={busy || uploading} className="px-5 py-2.5 rounded-xl bg-[#0057e7] hover:bg-[#0048c2] text-white text-sm font-semibold transition-all shadow-sm disabled:opacity-50">
                  {busy || uploading ? <>{t({ ID: 'Menyimpan', EN: 'Saving' })}<LoadingDots /></> : editing ? t({ ID: 'Simpan', EN: 'Save' }) : t({ ID: 'Tambah', EN: 'Add' })}
                </button>
                <button type="button" onClick={resetForm} className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-colors">{t({ ID: 'Batal', EN: 'Cancel' })}</button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {events.length === 0 && (
              <div className="col-span-full bg-white border border-slate-200/90 rounded-2xl text-center py-16 text-slate-400 text-sm">
                {t({ ID: 'Belum ada event. Tambahkan event pertama.', EN: 'No events yet. Add your first event.' })}
              </div>
            )}
            {events.map((ev) => (
              <div key={ev.id} className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-sm hover:border-blue-200 hover:shadow-md hover:shadow-blue-900/[0.06] hover:-translate-y-0.5 transition-all duration-200">
                <div className="relative h-36 bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-800">
                  {ev.gambar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ev.gambar} alt={ev.nama_event} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center opacity-40">
                      <svg className="w-14 h-14 text-slate-300" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  <div className="absolute top-3 right-3">{statusBadge(ev.status)}</div>
                  <div className="absolute bottom-3 left-4 right-4">
                    <h3 className="text-base font-bold text-white drop-shadow">{ev.nama_event}</h3>
                    {ev.tanggal && (
                      <p className="text-[11px] text-slate-200 mt-0.5">
                        {new Date(`${ev.tanggal}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                        {ev.venue ? ` · ${ev.venue}` : ''}
                      </p>
                    )}
                  </div>
                </div>
                <div className="p-4">
                  {ev.deskripsi ? (
                    <p className="text-xs text-slate-500 line-clamp-2 mb-3">{ev.deskripsi}</p>
                  ) : (
                    <p className="text-xs text-slate-400 mb-3">{t({ ID: 'Belum ada deskripsi.', EN: 'No description yet.' })}</p>
                  )}
                  {isFinishedEvent(ev) ? (
                    <button
                      onClick={() => {
                        selectEventId(ev.id)
                        router.push('/superadmin/reports')
                      }}
                      className="w-full mb-3 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-all shadow-sm"
                    >
                      <svg className="w-3.5 h-3.5 inline-block -mt-0.5 mr-1" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      {t({ ID: 'Lihat Analisis', EN: 'View Analysis' })}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleToggleStatus(ev)}
                      disabled={statusBusy === ev.id}
                      className={`w-full mb-3 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-sm disabled:opacity-50 ${
                        ev.status === 'active'
                          ? 'bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      {statusBusy === ev.id
                        ? <>{t({ ID: 'Memproses', EN: 'Processing' })}<LoadingDots /></>
                        : ev.status === 'active'
                          ? '■ ' + t({ ID: 'Jeda Event', EN: 'Pause Event' })
                          : '▶ ' + t({ ID: 'Aktifkan Event', EN: 'Activate Event' })}
                    </button>
                  )}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-slate-100 pt-3">
                    <span className="text-[11px] font-mono text-slate-400 break-all min-w-0">{ev.id}</span>
                    <div className="flex gap-3">
                      {ev.status !== 'closed' && (
                        <button onClick={() => handleFinish(ev)} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline">
                          {t({ ID: 'Selesaikan', EN: 'Finish' })}
                        </button>
                      )}
                      {!isFinishedEvent(ev) && (
                        <>
                          <button onClick={() => startEdit(ev)} className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline">{t({ ID: 'Edit', EN: 'Edit' })}</button>
                          <button onClick={() => handleDelete(ev)} className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline">{t({ ID: 'Hapus', EN: 'Delete' })}</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Modal peringatan Selesaikan Event */}
          {finishTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
              <div
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]"
                onClick={() => !finishing && setFinishTarget(null)}
              />
              <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-fade-fast">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0">
                    <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-slate-900">
                      {t({ ID: 'Selesaikan Event?', EN: 'Finish Event?' })}
                    </h3>
                    <p className="text-sm text-slate-500 mt-0.5 break-words">
                      &quot;{finishTarget.nama_event}&quot;
                    </p>
                  </div>
                </div>
                <ul className="mt-4 space-y-2 text-[13px] text-slate-600 bg-amber-50 border border-amber-200/70 rounded-xl px-4 py-3">
                  <li>• {t({ ID: 'Status event berubah menjadi Selesai dan tidak bisa dibatalkan.', EN: 'The event status will become Finished and cannot be undone.' })}</li>
                  <li>• {t({ ID: 'Tombol Edit, Hapus, dan Aktifkan/Jeda akan hilang.', EN: 'The Edit, Delete, and Activate/Pause buttons will disappear.' })}</li>
                  <li>• {t({ ID: 'Event pindah ke daftar Event Sebelumnya di halaman utama.', EN: 'The event will move to the Past Events list on the home page.' })}</li>
                </ul>
                <div className="mt-5 flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setFinishTarget(null)}
                    disabled={finishing}
                    className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {t({ ID: 'Batal', EN: 'Cancel' })}
                  </button>
                  <button
                    type="button"
                    onClick={confirmFinish}
                    disabled={finishing}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-all shadow-sm disabled:opacity-50"
                  >
                    {finishing ? <>{t({ ID: 'Memproses', EN: 'Processing' })}<LoadingDots /></> : t({ ID: 'Ya, Selesaikan', EN: 'Yes, Finish' })}
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}