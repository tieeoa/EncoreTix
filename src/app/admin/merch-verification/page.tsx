'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import AdminSidebar from '@/components/layout/AdminSidebar'
import DashboardHeader from '@/components/layout/DashboardHeader'
import { getAdminSession, useAdminName, adminFetch } from '@/lib/adminAuth'
import { useLang } from '@/lib/i18n'
import { friendlyError } from '@/app/lib/fetchError'
import { extractScanCode } from '@/app/lib/scanCode'
import Toast from '@/components/Toast'
import LoadingDots from '@/components/LoadingDots'
import QrScanner from '@/components/QrScanner'
import PhotoProofCapture from '@/components/PhotoProofCapture'

type PickupStatus = 'belum_diambil' | 'sudah_diambil'

interface MerchOrder {
  id: string
  kode_pengambilan: string
  kode_pesanan: string | null
  jumlah: number
  ukuran: string | null
  alamat: string | null
  tanggal_pesan: string
  total_harga: number
  status_pengambilan: PickupStatus
  bukti_pengambilan: string | null
  bukti_pengambilan_at: string | null
  customers: { nama: string; email: string } | null
  merchandise: { nama_merch: string } | null
}

interface OrderItem {
  nama_merch: string
  ukuran: string | null
  jumlah: number
}

interface GroupedOrder {
  kode: string
  nama: string
  email: string
  alamat: string | null
  status_pengambilan: PickupStatus
  bukti_pengambilan: string | null
  bukti_pengambilan_at: string | null
  jumlah_total: number
  items: OrderItem[]
  rows: MerchOrder[]
}

// Kelompokkan baris menjadi satu pesanan per kode_pesanan (rincian berisi semua item).
// Status kelompok = sudah_diambil hanya jika SEMUA baris sudah diambil (1x ambil).
function buildGroups(rows: MerchOrder[]): GroupedOrder[] {
  const map = new Map<string, GroupedOrder>()
  for (const r of rows) {
    const key = r.kode_pesanan || r.kode_pengambilan
    let g = map.get(key)
    if (!g) {
      g = {
        kode: key,
        nama: r.customers?.nama || '-',
        email: r.customers?.email || '-',
        alamat: r.alamat || null,
        status_pengambilan: r.status_pengambilan,
        bukti_pengambilan: r.bukti_pengambilan,
        bukti_pengambilan_at: r.bukti_pengambilan_at,
        jumlah_total: 0,
        items: [],
        rows: [],
      }
      map.set(key, g)
    }
    g.items.push({
      nama_merch: r.merchandise?.nama_merch || '-',
      ukuran: r.ukuran,
      jumlah: r.jumlah,
    })
    g.jumlah_total += r.jumlah
    g.rows.push(r)
  }
  // Sinkronkan status agregat setelah semua baris terkumpul.
  for (const g of map.values()) {
    const allTaken = g.rows.length > 0 && g.rows.every((r) => r.status_pengambilan === 'sudah_diambil')
    g.status_pengambilan = allTaken ? 'sudah_diambil' : 'belum_diambil'
    if (!allTaken) {
      g.bukti_pengambilan = null
      g.bukti_pengambilan_at = null
    } else if (!g.bukti_pengambilan) {
      const withProof = g.rows.find((r) => r.bukti_pengambilan)
      g.bukti_pengambilan = withProof?.bukti_pengambilan ?? null
      g.bukti_pengambilan_at = withProof?.bukti_pengambilan_at ?? g.bukti_pengambilan_at
    }
  }
  return [...map.values()]
}

export default function AdminMerchVerificationPage() {
  const { t } = useLang()
  const router = useRouter()
  const adminName = useAdminName()
  const [orders, setOrders] = useState<MerchOrder[]>([])
  const [scanCode, setScanCode] = useState('')
  const [scanResult, setScanResult] = useState<GroupedOrder | null>(null)
  const [scanStatus, setScanStatus] = useState<'idle' | 'found' | 'notfound' | 'wrong-event'>('idle')
  const [wrongEventName, setWrongEventName] = useState('')
  // Event yang sedang berjalan — daftar & hasil scan dibatasi untuk event ini.
  const [activeEvent, setActiveEvent] = useState<{ id: string; nama_event: string } | null>(null)
  const [eventChecked, setEventChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [searchFilter, setSearchFilter] = useState('')
  const [filterTab, setFilterTab] = useState<'all' | 'belum_diambil' | 'sudah_diambil'>('all')
  const [showProof, setShowProof] = useState(false)
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofUploading, setProofUploading] = useState(false)

  const groups = useMemo(
    () =>
      buildGroups(
        orders
          .slice()
          .sort((a, b) => (b.tanggal_pesan ?? '').localeCompare(a.tanggal_pesan ?? ''))
      ),
    [orders]
  )

  const loadOrders = () => {
    adminFetch('/api/merch/orders')
      .then((r) => r.json())
      .then((res) => {
        if (res.error) throw new Error(res.error)
        setOrders(res.data || [])
      })
      .catch((e) => setError(friendlyError(e)))
  }

  useEffect(() => {
    const session = getAdminSession('admin')
    if (!session || session.role !== 'admin') {
      router.replace('/admin/login')
      return
    }
    loadOrders()
    adminFetch('/api/events?active=true')
      .then((r) => r.json())
      .then((res) => {
        if (res.data?.id) setActiveEvent({ id: res.data.id, nama_event: res.data.nama_event || '' })
        setEventChecked(true)
      })
      .catch(() => setEventChecked(true))
  }, [router])

  const handleScanWithCode = async (code: string) => {
    const normalized = extractScanCode(code)
    if (!normalized) return
    const found = groups.find(
      (g) => g.kode.toUpperCase() === normalized || g.rows.some((r) => r.kode_pengambilan.toUpperCase() === normalized)
    )
    if (found) {
      setScanResult(found)
      setScanStatus('found')
      setShowProof(false)
      setProofFile(null)
      return
    }
    // Tidak ada di daftar event aktif — cek apakah kode milik event lain.
    try {
      const res = await adminFetch(`/api/merch/orders/${encodeURIComponent(normalized)}`)
      const result = await res.json()
      if (res.ok && result.data) {
        const otherEventId = result.data.items?.[0]?.merchandise?.id_event ?? null
        if (activeEvent && String(otherEventId ?? '') !== String(activeEvent.id)) {
          setScanResult(null)
          setWrongEventName(result.data.event?.nama_event || '-')
          setScanStatus('wrong-event')
          return
        }
        // Event sama tapi belum di daftar (daftar basi) — muat ulang lalu tetap notfound.
        loadOrders()
      }
    } catch {
      // abaikan, jatuh ke notfound di bawah
    }
    setScanResult(null)
    setScanStatus('notfound')
  }

  const handleScan = () => {
    handleScanWithCode(scanCode)
  }

  const verifyOrder = async (group: GroupedOrder, status: PickupStatus, bukti?: string) => {
    if (busy) return
    // Validasi 1x pengambilan di UI: jangan kirim ulang jika sudah diambil.
    if (status === 'sudah_diambil' && group.status_pengambilan === 'sudah_diambil') {
      setError(t({ ID: 'Pesanan ini sudah diambil (1 kode hanya 1x pengambilan).', EN: 'This order was already picked up (one code, one pickup).' }))
      return
    }
    setBusy(true)
    try {
      const res = await adminFetch(`/api/merch/orders/${encodeURIComponent(group.kode)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status_pengambilan: status,
          bukti_pengambilan: bukti || null,
        }),
      })
      const result = await res.json()
      if (!res.ok) {
        // Server menolak pengambilan ganda dengan 409 — kunci UI ke status sudah diambil.
        if (res.status === 409) {
          loadOrders()
        }
        throw new Error(result.error || t({ ID: 'Gagal update status', EN: 'Failed to update status' }))
      }
      const bukti_pengambilan = status === 'sudah_diambil' ? bukti || null : group.bukti_pengambilan
      const bukti_pengambilan_at = status === 'sudah_diambil' ? new Date().toISOString() : null
      const nextRows = group.rows.map((o) => ({
        ...o,
        status_pengambilan: status,
        bukti_pengambilan,
        bukti_pengambilan_at,
      }))
      setOrders((prev) => prev.map((o) => {
        const matchRow = nextRows.find((n) => n.id === o.id)
        return matchRow ? matchRow : o
      }))
      setScanResult(buildGroups(nextRows).find((g) => g.kode === group.kode) ?? null)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  const submitProof = async () => {
    if (!scanResult || !proofFile) return
    setProofUploading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('file', proofFile)
      fd.append('bucket', 'pickup-proofs')
      const upRes = await adminFetch('/api/uploads', { method: 'POST', body: fd })
      const upResult = await upRes.json()
      if (!upRes.ok) throw new Error(upResult.error || t({ ID: 'Gagal upload bukti', EN: 'Failed to upload proof' }))
      await verifyOrder(scanResult, 'sudah_diambil', upResult.url)
      setShowProof(false)
      setProofFile(null)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setProofUploading(false)
    }
  }

  const filteredGroups = groups.filter((g) => {
    const matchFilter = filterTab === 'all' || g.status_pengambilan === filterTab
    const q = searchFilter.toLowerCase()
    const matchSearch =
      !q ||
      g.nama.toLowerCase().includes(q) ||
      g.kode.toLowerCase().includes(q) ||
      g.items.some((it) => it.nama_merch.toLowerCase().includes(q))
    return matchFilter && matchSearch
  })

  // Recent 3 pesanan untuk kartu preview.
  const recentGroups = groups.slice(0, 3)

  const itemLabel = (g: GroupedOrder) =>
    g.items.length === 1
      ? `${g.items[0].nama_merch}${g.items[0].ukuran ? ` (${g.items[0].ukuran})` : ''} ×${g.items[0].jumlah}`
      : `${g.items.length} ${t({ ID: 'item merch', EN: 'merch items' })} · ${g.jumlah_total} ${t({ ID: 'pcs', EN: 'pcs' })}`

  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader
          searchValue={searchFilter}
          onSearchChange={setSearchFilter}
          searchPlaceholder={t({ ID: 'Cari pesanan atau pelanggan...', EN: 'Search order or customer...' })}
          userName={adminName || 'Panitia'}
          userRole="Event Operations"
        />

        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto overflow-auto">
          {/* Header Title & Subtitle */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {t({ ID: 'Verifikasi Pengambilan Merchandise', EN: 'Merchandise Verification' })}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {t({
                ID: 'Scan QR pengambilan merchandise untuk memvalidasi pesanan. Hasil scan langsung muncul dan siap diverifikasi.',
                EN: 'Scan the merchandise pickup QR to validate orders. The result appears instantly and is ready to verify.',
              })}
            </p>
            {activeEvent && (
              <p className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 mt-3 inline-block">
                {t({ ID: 'Verifikasi untuk:', EN: 'Verifying for:' })} {activeEvent.nama_event}
              </p>
            )}
            {eventChecked && !activeEvent && (
              <p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 mt-3 inline-block">
                {t({ ID: 'Belum ada event aktif. Verifikasi pengambilan sedang dinonaktifkan.', EN: 'No active event. Merchandise pickup verification is disabled.' })}
              </p>
            )}
            {error && <Toast ok={false} text={error} onClose={() => setError('')} className="mt-3" />}
          </div>

          {/* Top 2 Cards: Scanner Section & Manual Entry */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
            {/* Left Card: Scanner Section */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  <h2 className="text-base font-bold text-slate-900">
                    {t({ ID: 'Scanner Section', EN: 'Scanner Section' })}
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mb-5">
                  {t({
                    ID: 'Arahkan kamera ke QR Code pengambilan merchandise customer.',
                    EN: 'Point camera to customer merchandise pickup QR Code.',
                  })}
                </p>

                {/* Real QR Scanner */}
                <QrScanner onScan={handleScanWithCode} />
              </div>
            </div>

            {/* Right Card: Hasil Scan */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm flex flex-col">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h2 className="text-base font-bold text-slate-900">
                  {t({ ID: 'Hasil Scan', EN: 'Scan Result' })}
                </h2>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                {t({
                  ID: 'Hasil scan QR muncul otomatis di sini, atau masukkan kode pengambilan secara manual.',
                  EN: 'The QR scan result appears here automatically, or enter the pickup code manually.',
                })}
              </p>

              <label className="block text-xs font-semibold text-slate-700 mb-2">
                {t({ ID: 'Kode Pengambilan', EN: 'Pickup Code' })}
              </label>
              <div className="mb-3">
                <input
                  type="text"
                  placeholder="e.g. MERCH-8X29A"
                  value={scanCode}
                  onChange={(e) => setScanCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleScan()}
                  className="w-full bg-[#f1f5f9] border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm font-mono placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all uppercase"
                />
              </div>

              <button
                type="button"
                onClick={handleScan}
                disabled={busy}
                className="mb-4 w-full bg-[#0057e7] hover:bg-[#0048c2] text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-sm shadow-blue-500/20 active:scale-[0.99] flex items-center justify-center gap-2 text-sm disabled:opacity-50"
              >
                <span>{t({ ID: 'Verifikasi', EN: 'Verify' })}</span>
                <span>→</span>
              </button>

              <div className="flex-1">
                {scanStatus === 'idle' && (
                  <div className="h-full min-h-[180px] rounded-xl border border-dashed border-slate-200 bg-slate-50/60 flex flex-col items-center justify-center text-center px-6">
                    <span className="text-2xl mb-2">🔍</span>
                    <p className="text-xs text-slate-400">
                      {t({ ID: 'Belum ada QR yang discan.', EN: 'No QR scanned yet.' })}
                    </p>
                  </div>
                )}

                {scanStatus === 'notfound' && (
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                    <span className="text-base">❌</span>
                    <div>
                      <p className="font-semibold">{t({ ID: 'QR Tidak Dikenali', EN: 'QR Not Recognized' })}</p>
                      <p className="text-[11px] text-rose-600">{t({ ID: 'QR bukan pesanan merchandise yang valid.', EN: 'The QR is not a valid merchandise order.' })}</p>
                    </div>
                  </div>
                )}

                {scanStatus === 'wrong-event' && (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs flex items-center gap-2">
                    <span className="text-base">⚠️</span>
                    <div>
                      <p className="font-semibold">{t({ ID: 'Pesanan Event Lain', EN: 'Different Event Order' })}</p>
                      <p className="text-[11px]">
                        {t({ ID: 'Kode ini milik', EN: 'This code belongs to' })} <span className="font-bold">{wrongEventName}</span>
                        {activeEvent && (<>, {t({ ID: 'bukan', EN: 'not' })} <span className="font-bold">{activeEvent.nama_event}</span></>)}.
                        {t({ ID: 'Tolak pengambilan untuk kode ini.', EN: 'Do not allow pickup for this code.' })}
                      </p>
                    </div>
                  </div>
                )}

                {scanStatus === 'found' && scanResult && (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 text-slate-800 text-xs">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-slate-900 truncate">{scanResult.nama}</p>
                        {scanResult.email && (
                          <p className="text-[11px] text-slate-500 truncate">{scanResult.email}</p>
                        )}
                        <p className="text-[10px] font-mono text-slate-400 mt-0.5">{scanResult.kode}</p>

                        <div className="mt-2.5 pt-2.5 border-t border-slate-200/80">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            {t({ ID: 'Item', EN: 'Items' })}
                          </p>
                          <ul className="mt-1 space-y-1">
                            {scanResult.items.map((it, i) => (
                              <li key={i} className="text-xs text-slate-700">
                                {it.nama_merch}
                                {it.ukuran ? ` (${it.ukuran})` : ''} ×{it.jumlah}
                              </li>
                            ))}
                          </ul>
                          <p className="text-[11px] text-slate-500 mt-1.5">
                            {t({ ID: 'Total', EN: 'Total' })}: {scanResult.jumlah_total}{' '}
                            {t({ ID: 'pcs', EN: 'pcs' })} · {scanResult.items.length}{' '}
                            {t({ ID: 'item', EN: 'items' })}
                          </p>
                        </div>

                        {scanResult.alamat && (
                          <div className="mt-2.5 pt-2.5 border-t border-slate-200/80">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                              {t({ ID: 'Alamat', EN: 'Address' })}
                            </p>
                            <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">{scanResult.alamat}</p>
                          </div>
                        )}
                        {scanResult.bukti_pengambilan && (
                          <div className="mt-2.5 pt-2.5 border-t border-slate-200/80">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                              {t({ ID: 'Bukti Pengambilan', EN: 'Pickup Proof' })}
                            </p>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={scanResult.bukti_pengambilan}
                              alt={t({ ID: 'Bukti pengambilan', EN: 'Pickup proof' })}
                              className="mt-1 w-28 h-28 object-cover rounded-lg border border-slate-200"
                            />
                          </div>
                        )}
                      </div>
                      <span
                        className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border shrink-0 ${
                          scanResult.status_pengambilan === 'sudah_diambil'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {scanResult.status_pengambilan === 'sudah_diambil'
                          ? t({ ID: 'Sudah Diambil', EN: 'Picked Up' })
                          : t({ ID: 'Belum Diambil', EN: 'Pending' })}
                      </span>
                    </div>

                    {scanResult.status_pengambilan === 'belum_diambil' ? (
                      <div className="mt-3">
                        {!showProof ? (
                          <button
                            onClick={() => setShowProof(true)}
                            disabled={busy}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                          >
                            <span>📷</span>
                            <span>{t({ ID: 'Foto Bukti & Konfirmasi Pengambilan (1x semua item)', EN: 'Proof Photo & Confirm Pickup (once for all items)' })}</span>
                          </button>
                        ) : (
                          <>
                            <PhotoProofCapture
                              onCaptured={(f) => setProofFile(f)}
                              onCancel={() => { setShowProof(false); setProofFile(null) }}
                            />
                            {proofFile && (
                              <button
                                onClick={submitProof}
                                disabled={busy || proofUploading}
                                className="mt-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                              >
                                {proofUploading
                                  ? <>{t({ ID: 'Mengirim', EN: 'Uploading' })}<LoadingDots /></>
                                  : (
                                    <>
                                      <span>✓</span>
                                      <span>{t({ ID: 'Konfirmasi Pengambilan', EN: 'Confirm Pickup' })}</span>
                                    </>
                                  )}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
                        <p className="font-bold text-xs">
                          ⚠️ {t({ ID: 'Sudah Diambil — 1 kode hanya 1x pengambilan', EN: 'Already Picked Up — one code, one pickup only' })}
                        </p>
                        {scanResult.bukti_pengambilan_at && (
                          <p className="text-[11px] mt-1">
                            {new Date(scanResult.bukti_pengambilan_at).toLocaleString('id-ID', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        )}
                        <p className="text-[11px] mt-1 text-amber-700">
                          {t({ ID: 'Tolak penyerahan ulang untuk kode ini.', EN: 'Do not hand over items again for this code.' })}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Section: Recent Verifications */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-bold text-slate-900">
                {t({ ID: 'Recent Verifications', EN: 'Recent Verifications' })}
              </h2>
              <div className="flex flex-wrap gap-2">
                {(['all', 'belum_diambil', 'sudah_diambil'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setFilterTab(tab)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      filterTab === tab
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {tab === 'all'
                      ? t({ ID: 'Semua', EN: 'All' })
                      : tab === 'belum_diambil'
                        ? t({ ID: 'Belum Diambil', EN: 'Pending' })
                        : t({ ID: 'Berhasil Diambil', EN: 'Picked Up' })}
                  </button>
                ))}
              </div>
            </div>

            {/* 3 Figma Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {recentGroups.length === 0 ? (
                <div className="col-span-3 bg-white border border-slate-200/90 rounded-xl p-8 text-center text-slate-400 text-xs">
                  {t({ ID: 'Belum ada data verifikasi merchandise.', EN: 'No merchandise verification records yet.' })}
                </div>
              ) : (
                recentGroups.map((g) => {
                  const isTaken = g.status_pengambilan === 'sudah_diambil'
                  return (
                    <div
                      key={g.kode}
                      className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm hover:border-blue-200 hover:shadow-md hover:shadow-blue-900/[0.06] hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <p className="font-bold text-sm text-slate-900 truncate">
                            {g.nama}
                          </p>
                          <span
                            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border shrink-0 ${
                              isTaken
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                                : 'bg-amber-50 text-amber-700 border-amber-200/60'
                            }`}
                          >
                            {isTaken
                              ? t({ ID: 'Berhasil Diambil', EN: 'Picked Up' })
                              : t({ ID: 'Belum Diambil', EN: 'Pending' })}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 text-xs text-slate-700">
                        <div className="flex items-start gap-1.5">
                          <svg className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                          </svg>
                          <div className="min-w-0">
                            {g.items.length === 1 ? (
                              <p className="truncate">{itemLabel(g)}</p>
                            ) : (
                              <>
                                <p className="font-semibold">{g.items.length} {t({ ID: 'item merch', EN: 'merch items' })}, {g.jumlah_total} {t({ ID: 'pcs', EN: 'pcs' })}</p>
                                <p className="text-[11px] text-slate-500 truncate mt-0.5">{g.items[0].nama_merch}{g.items[0].ukuran ? ` (${g.items[0].ukuran})` : ''} +{g.items.length - 1} {t({ ID: ' lainnya', EN: ' more' })}</p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Complete Table */}
            <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">
                  {t({ ID: 'Daftar Semua Pesanan Merchandise', EN: 'All Merchandise Orders' })}
                </h3>
                <span className="text-xs text-slate-400">
                  {filteredGroups.length} {t({ ID: 'pesanan', EN: 'orders' })}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50/70 border-b border-slate-200/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="text-left px-6 py-3.5">{t({ ID: 'Nama Customer', EN: 'Customer Name' })}</th>
                      <th className="text-left px-6 py-3.5">{t({ ID: 'Item Merchandise', EN: 'Items' })}</th>
                      <th className="text-left px-6 py-3.5">{t({ ID: 'Jumlah', EN: 'Qty' })}</th>
                      <th className="text-left px-6 py-3.5">{t({ ID: 'Alamat', EN: 'Address' })}</th>
                      <th className="text-left px-6 py-3.5">{t({ ID: 'Status', EN: 'Status' })}</th>
                      <th className="text-left px-6 py-3.5">{t({ ID: 'Bukti Pengambilan', EN: 'Pickup Proof' })}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredGroups.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-slate-400 text-xs">
                          {t({ ID: 'Tidak ada data yang cocok.', EN: 'No matching orders found.' })}
                        </td>
                      </tr>
                    ) : (
                      filteredGroups.map((g) => {
                        const isTaken = g.status_pengambilan === 'sudah_diambil'
                        return (
                          <tr key={g.kode} className="hover:bg-slate-50/70 transition-colors">
                            <td className="px-6 py-4">
                              <p className="font-medium text-slate-900">{g.nama}</p>
                              {isTaken && (
                                <p className="text-[11px] font-mono text-slate-400 mt-0.5">{g.kode}</p>
                              )}
                            </td>
                            <td className="px-6 py-4 text-slate-600 text-xs align-top">
                              <ul className="space-y-0.5">
                                {g.items.map((it, i) => (
                                  <li key={i}>
                                    <span className="font-semibold text-slate-700">{it.nama_merch}</span>
                                    {it.ukuran ? ` (${it.ukuran})` : ''} ×{it.jumlah}
                                  </li>
                                ))}
                              </ul>
                            </td>
                            <td className="px-6 py-4 text-slate-600 align-top">
                              {g.jumlah_total}
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-600 max-w-[240px] truncate align-top" title={g.alamat || ''}>
                              {g.alamat || '-'}
                            </td>
                            <td className="px-6 py-4 align-top">
                              <span
                                className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                                  isTaken
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}
                              >
                                {isTaken
                                  ? t({ ID: 'Berhasil Diambil', EN: 'Picked Up' })
                                  : t({ ID: 'Belum Diambil', EN: 'Pending' })}
                              </span>
                              {g.bukti_pengambilan_at && (
                                <p className="text-[10px] text-slate-400 mt-1">
                                  {new Date(g.bukti_pengambilan_at).toLocaleString('id-ID', {
                                    day: '2-digit',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </p>
                              )}
                            </td>
                            <td className="px-6 py-4 align-top">
                              {g.bukti_pengambilan ? (
                                <a
                                  href={g.bukti_pengambilan}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={t({ ID: 'Buka bukti pengambilan', EN: 'Open pickup proof' })}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={g.bukti_pengambilan}
                                    alt={t({ ID: 'Bukti pengambilan', EN: 'Pickup proof' })}
                                    className="w-12 h-12 object-cover rounded-lg border border-slate-200 hover:opacity-80 transition-opacity"
                                  />
                                </a>
                              ) : (
                                <span className="text-xs text-slate-400">-</span>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}