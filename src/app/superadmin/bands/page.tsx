'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import SuperAdminSidebar from '@/components/layout/SuperAdminSidebar'
import DashboardHeader from '@/components/layout/DashboardHeader'
import EventSelector from '@/components/EventSelector'
import { getAdminSession, useAdminName } from '@/lib/adminAuth'
import { useSelectedEventId } from '@/lib/eventStore'
import { useSelectedEventStatus } from '@/lib/useEventStatus'
import { useLang } from '@/lib/i18n'
import { friendlyError } from '@/app/lib/fetchError'
import Toast from '@/components/Toast'
import LoadingDots from '@/components/LoadingDots'

interface Band {
  id: string
  nama_band: string
  deskripsi: string | null
  gambar: string | null
}

const EMPTY_FORM = { nama_band: '', deskripsi: '', gambar: '' }

export default function SuperAdminBandsPage() {
  const { t } = useLang()
  const router = useRouter()
  const [bands, setBands] = useState<Band[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const eventId = useSelectedEventId()
  const { finished: eventFinished } = useSelectedEventStatus()
  const readOnly = eventFinished

  const load = () => {
    const url = eventId ? `/api/bands?event=${encodeURIComponent(eventId)}` : '/api/bands'
    fetch(url)
      .then((r) => r.json())
      .then((res) => {
        if (res.error) throw new Error(res.error)
        setBands(res.data || [])
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
  }, [router, eventId])

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setEditing(null)
    setFile(null)
    setPreview(null)
    setShowForm(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const startEdit = (b: Band) => {
    setForm({ nama_band: b.nama_band, deskripsi: b.deskripsi || '', gambar: b.gambar || '' })
    setEditing(b.id)
    setFile(null)
    setPreview(null)
    setShowForm(true)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null
    setFile(f)
    setPreview(f ? URL.createObjectURL(f) : null)
  }

  const uploadGambar = async (): Promise<string | null> => {
    if (!file) return null
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/uploads', { method: 'POST', body: fd })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || t({ ID: 'Gagal upload gambar', EN: 'Failed to upload image' }))
      return result.url as string
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nama_band.trim()) {
      setError(t({ ID: 'Nama band wajib diisi', EN: 'Band name is required' }))
      return
    }
    if (readOnly) {
      setError(t({ ID: 'Event sudah selesai — mode hanya lihat.', EN: 'Event is finished — view-only mode.' }))
      return
    }
    setBusy(true)
    setError('')
    try {
      const gambar = (await uploadGambar()) ?? (form.gambar || null)
      const payload = { nama_band: form.nama_band.trim(), deskripsi: form.deskripsi.trim() || null, gambar, event: eventId || null }

      if (editing) {
        const res = await fetch(`/api/bands/${editing}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const result = await res.json()
        if (!res.ok) throw new Error(result.error || t({ ID: 'Gagal menyimpan band', EN: 'Failed to save band' }))
      } else {
        const res = await fetch('/api/bands', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const result = await res.json()
        if (!res.ok) throw new Error(result.error || t({ ID: 'Gagal menambah band', EN: 'Failed to add band' }))
      }
      load()
      resetForm()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (b: Band) => {
    if (readOnly) {
      setError(t({ ID: 'Event sudah selesai — mode hanya lihat.', EN: 'Event is finished — view-only mode.' }))
      return
    }
    if (!confirm(`${t({ ID: 'Hapus band', EN: 'Delete band' })} "${b.nama_band}"?`)) return
    setError('')
    try {
      const res = await fetch(`/api/bands/${b.id}`, { method: 'DELETE' })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || t({ ID: 'Gagal menghapus band', EN: 'Failed to delete band' }))
      load()
    } catch (err) {
      setError(friendlyError(err))
    }
  }

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
          searchPlaceholder="Search bands..."
          userName={adminName || 'Super Admin'}
          userRole="Super Admin"
        />

        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto overflow-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t({ ID: 'Kelola Band', EN: 'Manage Bands' })}</h1>
              <p className="text-sm text-slate-500 mt-1">{t({ ID: 'Tambah, edit, dan hapus lineup band sesuai event terpilih', EN: 'Add, edit, and delete the band lineup for the selected event' })}</p>
              {error && <Toast ok={false} text={error} onClose={() => setError('')} className="mt-2" />}
              {readOnly && (
                <p className="text-xs text-amber-600 mt-2">
                  {t({ ID: 'Event sudah selesai — mode hanya lihat. Menambah & mengedit dinonaktifkan.', EN: 'Event is finished — view-only mode. Adding & editing is disabled.' })}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <EventSelector />
              <button onClick={() => (showForm && !editing ? resetForm() : (setShowForm(true), setEditing(null), setForm(EMPTY_FORM)))} disabled={readOnly}
                title={readOnly ? t({ ID: 'Event sudah selesai — mode hanya lihat', EN: 'Event is finished — view-only mode' }) : undefined}
                className="px-5 py-2.5 rounded-xl bg-[#0057e7] hover:bg-[#0048c2] text-white text-sm font-semibold transition-all shadow-sm flex items-center gap-1.5 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed">
                <span>+</span>
                <span>{t({ ID: 'Tambah Band', EN: 'Add Band' })}</span>
              </button>
            </div>
          </div>

          {showForm && (
            <form onSubmit={handleSave} className="bg-white border border-slate-200/90 rounded-2xl p-6 mb-8 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-bold text-slate-900">{editing ? t({ ID: 'Edit Band', EN: 'Edit Band' }) : t({ ID: 'Tambah Band Baru', EN: 'Add New Band' })}</h3>
                <p className="text-[11px] text-slate-400">{t({ ID: 'Gambar berupa file PNG/JPG, maks 6MB', EN: 'PNG/JPG image file, max 6MB' })}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t({ ID: 'Nama Band', EN: 'Band Name' })} *</label>
                  <input value={form.nama_band} onChange={(e) => setForm({ ...form, nama_band: e.target.value })} placeholder={t({ ID: 'cth. Aurora Echoes', EN: 'e.g. Aurora Echoes' })}
                    className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t({ ID: 'Foto Band', EN: 'Band Photo' })}</label>
                  <div className="flex items-center gap-3">
                    <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.webp" onChange={handleFileChange}
                      className="w-full text-xs text-slate-500 file:mr-3 file:px-3 file:py-1.5 file:rounded-xl file:border-0 file:bg-blue-50 file:text-blue-700 file:text-xs file:font-semibold file:cursor-pointer focus:outline-none" />
                    {(file || form.gambar) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={preview || form.gambar || undefined}
                        alt="Preview band"
                        className="w-12 h-12 object-cover rounded-xl shrink-0 border border-slate-200 shadow-sm"
                      />
                    )}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t({ ID: 'Deskripsi', EN: 'Description' })}</label>
                  <textarea rows={3} value={form.deskripsi} onChange={(e) => setForm({ ...form, deskripsi: e.target.value })} placeholder={t({ ID: 'Deskripsi singkat band (muncul di lineup halaman utama)', EN: 'Short band description (shown in the lineup on the home page)' })}
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

          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">{t({ ID: 'Daftar Lineup Band', EN: 'Band Lineup List' })}</h3>
              <span className="text-xs text-slate-400">{bands.length} {t({ ID: 'band', EN: 'bands' })}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {[
                      t({ ID: 'Band', EN: 'Band' }),
                      t({ ID: 'Foto / Visual', EN: 'Photo' }),
                      t({ ID: 'Deskripsi', EN: 'Description' }),
                      t({ ID: 'Aksi', EN: 'Actions' }),
                    ].map((h) => (
                      <th key={h} className="text-left px-6 py-3.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bands.length === 0 && (
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400 text-xs">{t({ ID: 'Belum ada band. Tambahkan lewat tombol + Tambah Band.', EN: 'No bands yet. Add one via the + Add Band button.' })}</td></tr>
                  )}
                  {bands.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4 text-slate-900 font-semibold">{b.nama_band}</td>
                      <td className="px-6 py-4">
                        {b.gambar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={b.gambar} alt={b.nama_band} className="w-14 h-10 object-cover rounded-lg border border-slate-200 shadow-sm" />
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-600 text-xs max-w-xs">{b.deskripsi ? <p className="line-clamp-2">{b.deskripsi}</p> : <span className="text-slate-400">-</span>}</td>
                      <td className="px-6 py-4">
                        {readOnly ? (
                          <span className="text-xs text-slate-300">-</span>
                        ) : (
                          <div className="flex gap-3">
                            <button onClick={() => startEdit(b)} className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline">{t({ ID: 'Edit', EN: 'Edit' })}</button>
                            <button onClick={() => handleDelete(b)} className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline">{t({ ID: 'Hapus', EN: 'Delete' })}</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}