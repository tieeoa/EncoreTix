'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import SuperAdminSidebar from '@/components/layout/SuperAdminSidebar'
import DashboardHeader from '@/components/layout/DashboardHeader'
import Pagination from '@/components/Pagination'
import EventSelector from '@/components/EventSelector'
import { getAdminSession, useAdminName } from '@/lib/adminAuth'
import { useSelectedEventId } from '@/lib/eventStore'
import { useSelectedEventStatus } from '@/lib/useEventStatus'
import { useLang } from '@/lib/i18n'
import { MERCH_SIZES, sizeColumn } from '@/app/lib/merchStok'
import { friendlyError } from '@/app/lib/fetchError'
import { parseRupiah } from '@/app/lib/rupiah'
import Toast from '@/components/Toast'
import LoadingDots from '@/components/LoadingDots'

interface MerchProduct {
  id: string
  nama_merch: string
  foto: string[] | null
  kategori: string | null
  harga: number
  status: string
  stok_s: number
  stok_m: number
  stok_l: number
  stok_xl: number
  stok_xxl: number
  id_band: string
  band: { nama_band: string; gambar: string | null; deskripsi: string | null } | null
}

interface Band {
  id: string
  nama_band: string
}

interface MerchOrder {
  id_merch: string
  jumlah: number
  status_bayar: string
  merchandise: { harga: number } | null
}

const EMPTY_FORM = {
  nama_merch: '',
  kategori: '',
  harga: '',
  stok_s: '',
  stok_m: '',
  stok_l: '',
  stok_xl: '',
  stok_xxl: '',
  id_band: '',
}

type SortKey = 'nama' | 'band' | 'harga' | 'stok_total' | 'terjual' | 'revenue'

function formatRupiah(n: number) { return 'Rp ' + n.toLocaleString('id-ID') }

function SortTh({ label, k, sortKey, sortDir, onSort }: { label: string; k: SortKey; sortKey: SortKey; sortDir: 'asc' | 'desc'; onSort: (k: SortKey) => void }) {
  const active = sortKey === k
  return (
    <th className="px-5 py-3 text-xs font-medium text-gray-400">
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

export default function SuperAdminMerchandisePage() {
  const { t } = useLang()
  const router = useRouter()
  const [products, setProducts] = useState<MerchProduct[]>([])
  const [bands, setBands] = useState<Band[]>([])
  const [orders, setOrders] = useState<MerchOrder[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [photos, setPhotos] = useState<string[]>([])
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [photoUrl, setPhotoUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('all')
  const [sortKey, setSortKey] = useState<SortKey>('nama')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10
  const [salesBusy, setSalesBusy] = useState(false)
  const [salesRemaining, setSalesRemaining] = useState<{ nama: string; sisa: number }[] | null>(null)
  const eventId = useSelectedEventId()
  const { status: eventStatus, finished: eventFinished } = useSelectedEventStatus()

  const load = () => {
    const ev = eventId ? `event=${encodeURIComponent(eventId)}` : ''
    const q = ev ? `?${ev}` : ''
    Promise.all([
      fetch(`/api/merchandise${q}`).then((r) => r.json()),
      fetch(`/api/bands${q}`).then((r) => r.json()),
      fetch(`/api/merch/orders${q}`).then((r) => r.json()),
      fetch(`/api/kategori${q}`).then((r) => r.json()),
    ])
      .then(([merchRes, bandRes, orderRes, catRes]) => {
        if (merchRes.error) throw new Error(merchRes.error)
        setProducts(merchRes.data || [])
        setBands(bandRes.data || [])
        setOrders(orderRes.data || [])
        setCategories(catRes.data || [])
        if (bandRes.data?.[0]) setForm((f) => ({ ...f, id_band: f.id_band || bandRes.data[0].id }))
      })
      .catch((e) => setError(friendlyError(e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!getAdminSession()) {
      router.replace('/admin/login')
      return
    }
    load()
  }, [router, eventId])

  const terjualFor = (id: string) =>
    orders.filter((o) => o.id_merch === id && o.status_bayar === 'berhasil').reduce((s, o) => s + o.jumlah, 0)

  const totalRevenue = products.reduce((sum, p) => sum + Number(p.harga) * terjualFor(p.id), 0)
  const totalTerjual = products.reduce((sum, p) => sum + terjualFor(p.id), 0)

  const productRows = products.map((p) => {
    const terjual = terjualFor(p.id)
    const stokTotal = MERCH_SIZES.reduce((acc, s) => acc + Number((p as unknown as Record<string, number>)[sizeColumn(s)] ?? 0), 0)
    return { ...p, terjual, stokTotal, revenue: Number(p.harga) * terjual }
  })

  const salesClosed = products.length > 0 && products.every((p) => p.status === 'nonaktif')

  const readOnly = eventFinished
  const eventLocked = eventStatus === 'paused' || eventFinished

  const toggleSales = async () => {
    const closing = !salesClosed
    if (readOnly) {
      setError(t({ ID: 'Event sudah selesai — mode hanya lihat.', EN: 'Event is finished — view-only mode.' }))
      return
    }
    if (!closing && eventLocked) {
      setError(t({ ID: 'Penjualan merch tidak dapat dimulai karena event sudah selesai atau di-pause.', EN: 'Merch sales cannot be started because the event is finished or paused.' }))
      return
    }
    setSalesBusy(true)
    setError('')
    try {
      const res = await fetch('/api/merch/sales-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closed: closing, event: eventId || null }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || t({ ID: 'Gagal ubah status', EN: 'Failed to change status' }))
      if (closing) {
        setSalesRemaining(productRows
          .map((p) => ({ nama: p.nama_merch, sisa: p.stokTotal - p.terjual }))
          .filter((r) => r.sisa > 0))
      }
      load()
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setSalesBusy(false)
    }
  }

  const filteredProducts = productRows.filter((p) => {
    const q = search.toLowerCase()
    const matchSearch =
      p.nama_merch.toLowerCase().includes(q) ||
      (p.kategori || '').toLowerCase().includes(q) ||
      (p.band?.nama_band || '').toLowerCase().includes(q)
    const matchCat = filterCat === 'all' || p.kategori === filterCat
    return matchSearch && matchCat
  })

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(k)
      setSortDir(k === 'harga' || k === 'stok_total' || k === 'terjual' || k === 'revenue' ? 'desc' : 'asc')
    }
    setPage(1)
  }

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'nama') cmp = a.nama_merch.localeCompare(b.nama_merch)
    else if (sortKey === 'band') cmp = (a.band?.nama_band || '').localeCompare(b.band?.nama_band || '')
    else if (sortKey === 'harga') cmp = Number(a.harga) - Number(b.harga)
    else if (sortKey === 'stok_total') cmp = a.stokTotal - b.stokTotal
    else if (sortKey === 'terjual') cmp = a.terjual - b.terjual
    else cmp = a.revenue - b.revenue
    return sortDir === 'asc' ? cmp : -cmp
  })

  const totalPages = Math.max(1, Math.ceil(sortedProducts.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const startIndex = (safePage - 1) * PAGE_SIZE
  const paginatedProducts = sortedProducts.slice(startIndex, startIndex + PAGE_SIZE)

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setEditing(null)
    setPhotos([])
    setNewFiles([])
    setPhotoUrl('')
    setShowForm(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const startAdd = () => {
    setForm({ ...EMPTY_FORM, id_band: bands[0]?.id || '' })
    setEditing(null)
    setPhotos([])
    setNewFiles([])
    setPhotoUrl('')
    setShowForm(true)
    if (fileRef.current) fileRef.current.value = ''
  }

  const startEdit = (p: MerchProduct) => {
    setForm({
      nama_merch: p.nama_merch,
      kategori: p.kategori || '',
      harga: String(p.harga),
      stok_s: String(p.stok_s ?? 0),
      stok_m: String(p.stok_m ?? 0),
      stok_l: String(p.stok_l ?? 0),
      stok_xl: String(p.stok_xl ?? 0),
      stok_xxl: String(p.stok_xxl ?? 0),
      id_band: p.id_band || bands[0]?.id || '',
    })
    setEditing(p.id)
    setPhotos(Array.isArray(p.foto) && p.foto.length > 0 ? p.foto : [])
    setNewFiles([])
    setPhotoUrl('')
    setShowForm(true)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) setNewFiles((prev) => [...prev, ...files])
    if (fileRef.current) fileRef.current.value = ''
  }

  const addPhotoUrl = () => {
    const url = photoUrl.trim()
    if (!url) return
    setPhotos((prev) => [...prev, url])
    setPhotoUrl('')
  }

  const removePhotoAt = (i: number) => {
    if (i < photos.length) {
      setPhotos((prev) => prev.filter((_, idx) => idx !== i))
    } else {
      setNewFiles((prev) => prev.filter((_, idx) => idx !== i - photos.length))
    }
  }

  const uploadFotos = async (): Promise<string[]> => {
    const urls: string[] = []
    if (newFiles.length > 0) {
      setUploading(true)
      try {
        for (const file of newFiles) {
          const fd = new FormData()
          fd.append('file', file)
          const res = await fetch('/api/uploads', { method: 'POST', body: fd })
          const result = await res.json()
          if (!res.ok) throw new Error(result.error || t({ ID: 'Gagal upload foto', EN: 'Failed to upload photo' }))
          urls.push(result.url as string)
        }
      } finally {
        setUploading(false)
      }
    }
    return [...photos, ...urls]
  }

  const handleSave = async () => {
    if (!form.nama_merch || !form.harga || busy) return
    if (readOnly) {
      setError(t({ ID: 'Event sudah selesai — mode hanya lihat.', EN: 'Event is finished — view-only mode.' }))
      return
    }
    if (!form.id_band) {
      setError(t({ ID: 'Tambah band terlebih dahulu', EN: 'Add a band first' }))
      return
    }
    const harga = parseRupiah(form.harga)
    if (!harga || harga <= 0) {
      setError(t({ ID: 'Harga harus lebih dari Rp 0. Contoh: 150.000', EN: 'Price must be more than Rp 0. Example: 150.000' }))
      return
    }
    setBusy(true)
    setError('')
    try {
      const fotos = await uploadFotos()
      const payload = {
        nama_merch: form.nama_merch,
        kategori: form.kategori || null,
        harga,
        stok_s: Number(form.stok_s || 0),
        stok_m: Number(form.stok_m || 0),
        stok_l: Number(form.stok_l || 0),
        stok_xl: Number(form.stok_xl || 0),
        stok_xxl: Number(form.stok_xxl || 0),
        id_band: form.id_band,
        foto: fotos,
        event: editing ? undefined : eventId || null,
      }
      if (editing) {
        const res = await fetch(`/api/merchandise/${editing}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const result = await res.json()
        if (!res.ok) throw new Error(result.error || t({ ID: 'Gagal menyimpan produk', EN: 'Failed to save product' }))
      } else {
        const res = await fetch('/api/merchandise', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const result = await res.json()
        if (!res.ok) throw new Error(result.error || t({ ID: 'Gagal menambah produk', EN: 'Failed to add product' }))
      }
      load()
      resetForm()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (p: MerchProduct) => {
    if (readOnly) {
      setError(t({ ID: 'Event sudah selesai — mode hanya lihat.', EN: 'Event is finished — view-only mode.' }))
      return
    }
    if (!confirm(`${t({ ID: 'Hapus produk', EN: 'Delete product' })} "${p.nama_merch}"?`)) return
    setError('')
    try {
      const res = await fetch(`/api/merchandise/${p.id}`, { method: 'DELETE' })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || t({ ID: 'Gagal menghapus produk', EN: 'Failed to delete product' }))
      load()
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  const handleUpdateStok = async (p: MerchProduct, field: 'stok_s' | 'stok_m' | 'stok_l' | 'stok_xl' | 'stok_xxl', value: string) => {
    if (readOnly) {
      setError(t({ ID: 'Event sudah selesai — mode hanya lihat.', EN: 'Event is finished — view-only mode.' }))
      return
    }
    const patch: Record<string, unknown> = {}
    patch[field] = Number(value)
    try {
      const res = await fetch(`/api/merchandise/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || t({ ID: 'Gagal menyimpan', EN: 'Failed to save' }))
      load()
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  const photoCount = photos.length + newFiles.length
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
          onSearchChange={(v) => { setSearch(v); setPage(1) }}
          searchPlaceholder="Search product, category, or band..."
          userName={adminName || 'Super Admin'}
          userRole="Super Admin"
        />

        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto overflow-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t({ ID: 'Kelola Merchandise', EN: 'Manage Merchandise' })}</h1>
              <p className="text-sm text-slate-500 mt-1">{t({ ID: 'Manage produk, foto, stok per ukuran, dan harga merchandise sesuai event terpilih', EN: 'Manage products, photos, stock per size, and merchandise prices for the selected event' })}</p>
              {error && <Toast ok={false} text={error} onClose={() => setError('')} className="mt-2" />}
              {readOnly && (
                <p className="text-xs text-amber-600 mt-2">
                  {t({ ID: 'Event sudah selesai — mode hanya lihat. Menambah & mengedit dinonaktifkan.', EN: 'Event is finished — view-only mode. Adding & editing is disabled.' })}
                </p>
              )}
              {salesClosed && eventLocked && (
                <p className="text-xs text-amber-600 mt-2">
                  {t({ ID: 'Event sudah selesai atau di-pause — penjualan merch tidak dapat dimulai.', EN: 'Event is finished or paused — merch sales cannot be started.' })}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <EventSelector />
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleSales}
                  disabled={salesBusy || readOnly || (salesClosed && eventLocked)}
                  title={readOnly ? t({ ID: 'Event sudah selesai — mode hanya lihat', EN: 'Event is finished — view-only mode' }) : salesClosed && eventLocked ? t({ ID: 'Event sudah selesai atau di-pause, tidak bisa mulai penjualan', EN: 'Event is finished or paused, cannot start sales' }) : undefined}
                  className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm disabled:opacity-50 ${
                    salesClosed
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100'
                  }`}
                >
                  {salesBusy
                    ? <>{t({ ID: 'Memproses', EN: 'Processing' })}<LoadingDots /></>
                    : salesClosed
                      ? '▶ ' + t({ ID: 'Mulai Penjualan Merch', EN: 'Start Merch Sales' })
                      : '■ ' + t({ ID: 'Hentikan Penjualan Merch', EN: 'Stop Merch Sales' })}
                </button>
                <button
                  onClick={() => (showForm && !editing ? resetForm() : startAdd())}
                  disabled={readOnly}
                  title={readOnly ? t({ ID: 'Event sudah selesai — mode hanya lihat', EN: 'Event is finished — view-only mode' }) : undefined}
                  className="px-5 py-2.5 rounded-xl bg-[#0057e7] hover:bg-[#0048c2] text-white text-sm font-semibold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>+</span>
                  <span>{t({ ID: 'Tambah Produk', EN: 'Add Product' })}</span>
                </button>
              </div>
            </div>
          </div>

          {showForm && (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 mb-8 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-bold text-slate-900">{editing ? t({ ID: 'Edit Produk Merchandise', EN: 'Edit Merchandise Product' }) : t({ ID: 'Tambah Produk Merchandise', EN: 'Add Merchandise Product' })}</h3>
                <button onClick={() => router.push('/superadmin/bands')} className="text-xs font-semibold text-blue-600 hover:underline">+ {t({ ID: 'Kelola Band', EN: 'Manage Bands' })}</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">{t({ ID: 'Nama Produk', EN: 'Product Name' })}</label>
                  <input value={form.nama_merch} onChange={(e) => setForm({ ...form, nama_merch: e.target.value })} placeholder={t({ ID: 'cth. T-Shirt Edisi Hitam', EN: 'e.g. Black Edition T-Shirt' })}
                    className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all" /></div>
                <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">{t({ ID: 'Kategori', EN: 'Category' })}</label>
                  <input list="kategori-list" value={form.kategori} onChange={(e) => setForm({ ...form, kategori: e.target.value })} placeholder={t({ ID: 'cth. Apparel', EN: 'e.g. Apparel' })}
                    className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all" />
                  <datalist id="kategori-list">
                    {categories.map((k) => <option key={k} value={k} />)}
                  </datalist></div>
                <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">{t({ ID: 'Harga (Rp)', EN: 'Price (Rp)' })}</label>
                  <input type="text" inputMode="numeric" value={form.harga} onChange={(e) => setForm({ ...form, harga: e.target.value })} placeholder={t({ ID: 'cth. 150.000', EN: 'e.g. 150.000' })}
                    className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all" />
                  {String(form.harga).trim() !== '' && (
                    <p className="text-[11px] text-slate-500 mt-1">= {formatRupiah(parseRupiah(form.harga))}</p>
                  )}</div>
                <div className="col-span-full"><label className="block text-xs font-semibold text-slate-700 mb-1.5">{t({ ID: 'Stok Online per Ukuran', EN: 'Online Stock per Size' })}</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                    {MERCH_SIZES.map((s) => (
                      <div key={s}>
                        <span className="block text-[11px] text-slate-500 mb-1 font-bold">{s}</span>
                        <input type="number" min={0} value={form[sizeColumn(s)]} onChange={(e) => setForm({ ...form, [sizeColumn(s)]: e.target.value })}
                          placeholder="0"
                          className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all" />
                      </div>
                    ))}
                  </div></div>
                <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">{t({ ID: 'Band', EN: 'Band' })}</label>
                  <select value={form.id_band} onChange={(e) => setForm({ ...form, id_band: e.target.value })}
                    className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all">
                    {bands.map((b) => <option key={b.id} value={b.id}>{b.nama_band}</option>)}
                  </select></div>
              </div>

              {/* Foto produk */}
              <div className="mb-5">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t({ ID: 'Foto Produk (bisa lebih dari 1)', EN: 'Product Photos (can be more than 1)' })} <span className="text-slate-400 font-normal">· {photoCount}</span></label>

                {(photoCount > 0 || newFiles.length > 0) && (
                  <div className="flex flex-wrap gap-3 mb-3">
                    {photos.map((url, i) => (
                      <div key={`ls-${i}`} className="relative w-20 h-16 group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover rounded-xl border border-slate-200 shadow-sm" />
                        <button type="button" onClick={() => removePhotoAt(i)} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-600 text-white text-xs leading-none flex items-center justify-center hover:bg-rose-700 shadow">✕</button>
                      </div>
                    ))}
                    {newFiles.map((f, i) => (
                      <div key={`nf-${i}`} className="relative w-20 h-16 group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={URL.createObjectURL(f)} alt={`Baru ${i + 1}`} className="w-full h-full object-cover rounded-xl border border-blue-500 shadow-sm" />
                        <button type="button" onClick={() => removePhotoAt(photos.length + i)} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-600 text-white text-xs leading-none flex items-center justify-center hover:bg-rose-700 shadow">✕</button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                  <input ref={fileRef} type="file" multiple accept=".png,.jpg,.jpeg,.webp" onChange={handleFileChange}
                    className="flex-1 text-xs text-slate-500 file:mr-3 file:px-3 file:py-1.5 file:rounded-xl file:border-0 file:bg-blue-50 file:text-blue-700 file:text-xs file:font-semibold file:cursor-pointer focus:outline-none" />
                  <div className="flex gap-2">
                    <input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder={t({ ID: 'https://... (tambah via URL)', EN: 'https://... (add via URL)' })}
                      className="flex-1 sm:w-72 bg-[#f8fafc] border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all" />
                    <button type="button" onClick={addPhotoUrl} className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors">+ {t({ ID: 'Tambah', EN: 'Add' })}</button>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={handleSave} disabled={busy || uploading}
                  className="px-5 py-2.5 rounded-xl bg-[#0057e7] hover:bg-[#0048c2] text-white text-sm font-semibold transition-all shadow-sm disabled:opacity-50">
                  {busy || uploading ? <>{t({ ID: 'Menyimpan', EN: 'Saving' })}<LoadingDots /></> : editing ? t({ ID: 'Simpan', EN: 'Save' }) : t({ ID: 'Tambah', EN: 'Add' })}
                </button>
                <button onClick={resetForm} className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-colors">{t({ ID: 'Batal', EN: 'Cancel' })}</button>
              </div>
            </div>
          )}

          {/* 3 Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
            {[
              { label: t({ ID: 'Total Produk', EN: 'Total Products' }), value: products.length, icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z', color: 'bg-blue-50 text-blue-600' },
              { label: t({ ID: 'Total Terjual', EN: 'Total Sold' }), value: totalTerjual.toLocaleString('id-ID'), icon: 'M5 8h14l-1.5 12H6.5L5 8zM9 8V6a3 3 0 016 0v2', color: 'bg-amber-50 text-amber-600' },
              { label: t({ ID: 'Revenue Merch', EN: 'Merch Revenue' }), value: formatRupiah(totalRevenue), icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1', color: 'bg-emerald-50 text-emerald-600' },
            ].map((s) => (
              <div key={s.label} className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm hover:border-blue-200 hover:shadow-md hover:shadow-blue-900/[0.06] hover:-translate-y-0.5 transition-all duration-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase">{s.label}</span>
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg ${s.color}`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
                    </svg>
                  </span>
                </div>
                <p className="text-2xl md:text-3xl font-bold text-slate-900">{s.value}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <select
              value={filterCat}
              onChange={(e) => { setFilterCat(e.target.value); setPage(1) }}
              className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:border-blue-600 shadow-sm"
            >
              <option value="all">{t({ ID: 'Semua Kategori', EN: 'All Categories' })}</option>
              {categories.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="w-10 px-5 py-3.5 text-xs font-semibold text-slate-500">#</th>
                    <SortTh label={t({ ID: 'Produk', EN: 'Product' })} k="nama" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortTh label={t({ ID: 'Band', EN: 'Band' })} k="band" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortTh label={t({ ID: 'Harga', EN: 'Price' })} k="harga" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortTh label={t({ ID: 'Stok per Ukuran', EN: 'Stock per Size' })} k="stok_total" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortTh label={t({ ID: 'Terjual', EN: 'Sold' })} k="terjual" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortTh label={t({ ID: 'Revenue', EN: 'Revenue' })} k="revenue" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <th className="px-5 py-3.5 text-xs font-semibold text-slate-500">{t({ ID: 'Aksi', EN: 'Actions' })}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.length === 0 && (
                    <tr><td colSpan={8} className="px-5 py-8 text-center text-slate-400 text-xs">{t({ ID: 'Belum ada produk', EN: 'No products yet' })}</td></tr>
                  )}
                  {paginatedProducts.map((p, i) => {
                    const terjual = p.terjual
                    const pfotos = Array.isArray(p.foto) && p.foto.length > 0 ? p.foto : []
                    const pjml = pfotos.length
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-4 text-slate-400 text-xs">{startIndex + i + 1}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            {pfotos.length > 0 ? (
                              <div className="shrink-0 relative">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={pfotos[0]} alt={p.nama_merch} className="w-12 h-10 object-cover rounded-lg border border-slate-200 shadow-sm" />
                                {pjml > 1 && (
                                  <span className="absolute -bottom-1 -right-1 text-[9px] font-bold bg-blue-600 text-white rounded-full px-1.5 py-0.5">{pjml}</span>
                                )}
                              </div>
                            ) : (
                              <span className="w-12 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                </svg>
                              </span>
                            )}
                            <div>
                              <p className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                {p.nama_merch}
                                {p.status === 'nonaktif' && (
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                                    {t({ ID: 'Nonaktif', EN: 'Inactive' })}
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-slate-500">{p.kategori || '-'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-slate-600 text-xs">{p.band?.nama_band || '-'}</td>
                        <td className="px-5 py-4 text-slate-900 font-semibold">{formatRupiah(Number(p.harga))}</td>
                        <td className="px-5 py-4">
                          <div className="flex gap-1">
                            {MERCH_SIZES.map((s) => (
                              <SizeStockCell
                                key={s}
                                label={s}
                                value={Number(p[sizeColumn(s)] ?? 0)}
                                disabled={readOnly}
                                onSave={(v) => handleUpdateStok(p, sizeColumn(s) as 'stok_s' | 'stok_m' | 'stok_l' | 'stok_xl' | 'stok_xxl', v)}
                              />
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-slate-600">{terjual}</td>
                        <td className="px-5 py-4 font-bold text-blue-600">{formatRupiah(Number(p.harga) * terjual)}</td>
                        <td className="px-5 py-4">
                          {readOnly ? (
                            <span className="text-xs text-slate-300">-</span>
                          ) : (
                            <div className="flex gap-3">
                              <button onClick={() => startEdit(p)} className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline">{t({ ID: 'Edit', EN: 'Edit' })}</button>
                              <button onClick={() => handleDelete(p)} className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline">{t({ ID: 'Hapus', EN: 'Delete' })}</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {filteredProducts.length === 0 ? null : (
              <Pagination
                page={page}
                totalPages={Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE))}
                onChange={setPage}
                summary={`${Math.min((page - 1) * PAGE_SIZE + 1, filteredProducts.length)}–${Math.min(page * PAGE_SIZE, filteredProducts.length)} dari ${filteredProducts.length}`}
                prevLabel="Sebelumnya"
                nextLabel="Berikutnya"
              />
            )}
          </div>

          {salesRemaining && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSalesRemaining(null)}>
              <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 max-h-[80vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="w-12 h-12 mb-3 flex items-center justify-center">
                <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
                <h2 className="text-lg font-bold text-slate-900 mb-1">{t({ ID: 'Penjualan Online Dihentikan', EN: 'Online Sales Stopped' })}</h2>
                <p className="text-sm text-slate-500 mb-4">
                  {t({ ID: 'Berikut sisa stok merchandise yang dapat dijual langsung pada hari event:', EN: 'Here are the remaining merchandise stocks that can be sold directly on the event day:' })}
                </p>
                {salesRemaining.length === 0 ? (
                  <p className="text-sm text-slate-400 py-4 text-center">{t({ ID: 'Semua merch sudah terjual habis.', EN: 'All merch has been sold out.' })}</p>
                ) : (
                  <ul className="mb-5 space-y-2 max-h-64 overflow-y-auto">
                    {salesRemaining.map((r) => (
                      <li key={r.nama} className="flex items-center justify-between bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-2.5 text-sm">
                        <span className="text-slate-800 font-medium">{r.nama}</span>
                        <span className="text-amber-700 font-bold">{r.sisa} {t({ ID: 'pcs', EN: 'pcs' })}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  onClick={() => setSalesRemaining(null)}
                  className="w-full py-3 rounded-xl bg-[#0057e7] hover:bg-[#0048c2] text-white text-sm font-semibold transition-all shadow-sm"
                >
                  {t({ ID: 'Tutup', EN: 'Close' })}
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function SizeStockCell({ label, value, onSave, disabled }: { label: string; value: number; onSave: (v: string) => void; disabled?: boolean }) {
  const [edit, setEdit] = useState(false)
  const [val, setVal] = useState(String(value))

  if (disabled) {
    const dcolor = value === 0 ? 'text-rose-600' : value < 20 ? 'text-amber-600' : 'text-slate-800'
    return (
      <span
        title={`${label}: ${value}`}
        className="flex flex-col items-center justify-center w-11 h-10 rounded-lg border border-slate-200 bg-slate-50 cursor-default"
      >
        <span className="text-[9px] font-semibold text-slate-400 leading-none">{label}</span>
        <span className={`text-xs font-bold leading-none mt-0.5 ${dcolor}`}>{value}</span>
      </span>
    )
  }

  if (edit) {
    return (
      <div className="flex items-center gap-1 w-14 h-10 rounded-lg bg-white border border-blue-500 px-1.5 shadow-sm">
        <input
          type="number"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          autoFocus
          className="w-7 bg-transparent text-xs text-slate-900 focus:outline-none"
        />
        <button onClick={() => { onSave(val); setEdit(false) }} className="text-[10px] text-emerald-600 hover:text-emerald-700 font-bold">✓</button>
        <button onClick={() => { setEdit(false); setVal(String(value)) }} className="text-[10px] text-slate-400 hover:text-slate-600">✗</button>
      </div>
    )
  }
  const color = value === 0 ? 'text-rose-600' : value < 20 ? 'text-amber-600' : 'text-slate-800'
  return (
    <button
      onClick={() => { setVal(String(value)); setEdit(true) }}
      title={`${label}: ${value}`}
      className={`flex flex-col items-center justify-center w-11 h-10 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-blue-400 transition-colors cursor-pointer ${value === 0 ? 'opacity-60' : ''}`}
    >
      <span className="text-[9px] font-semibold text-slate-400 leading-none">{label}</span>
      <span className={`text-xs font-bold leading-none mt-0.5 ${color}`}>{value}</span>
    </button>
  )
}