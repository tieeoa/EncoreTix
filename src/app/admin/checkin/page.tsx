'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AdminSidebar from '@/components/layout/AdminSidebar'
import DashboardHeader from '@/components/layout/DashboardHeader'
import { getAdminSession, useAdminName } from '@/lib/adminAuth'
import { useLang } from '@/lib/i18n'
import { extractScanCode } from '@/app/lib/scanCode'
import { friendlyError } from '@/app/lib/fetchError'
import QrScanner from '@/components/QrScanner'
import Toast from '@/components/Toast'
import LoadingDots from '@/components/LoadingDots'

type CheckInStatus = 'idle' | 'loading' | 'resolved' | 'already' | 'invalid' | 'belum-lunas' | 'wrong-event'

interface TicketHolder {
  nama: string | null
  email: string | null
  no_hp: string | null
  usia: number | null
  no_identitas: string | null
  jenis_identitas: string | null
  jenis_kelamin: string | null
}

interface TicketEvent {
  nama_event: string
  tanggal: string
  jam: string
  lokasi: string
}

interface TicketInfo {
  booking_id: string
  jumlah: number
  status_bayar: string
  status_check_in: string
  tiket_check_in: number[] | null
  customers: TicketHolder | null
  tiket: { kategori: string; harga: number; id_event?: string | null } | null
  pemilik_tiket?: TicketHolder[] | null
  event?: TicketEvent | null
}

interface Pesanan {
  booking_id: string
  jumlah: number
  tiket_check_in: number[] | null
  status_check_in: string
  status_bayar: string
  customers: { nama: string } | null
  tiket: { kategori: string } | null
  pemilik_tiket?: { nama: string | null }[] | null
}

// Satu baris riwayat = satu tiket yang sudah masuk (bukan satu booking),
// agar nama tampil beda-beda sesuai pemilik tiap tiket.
interface RecentEntry {
  booking_id: string
  ticketIndex: number
  nama: string
  kategori: string
}

function formatRupiah(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID')
}

function HolderRows({ holder }: { holder: TicketHolder | null }) {
  const { t } = useLang()
  const rows: [string, string][] = [
    [t({ ID: 'Nama Lengkap', EN: 'Full Name' }), holder?.nama || '-'],
    [t({ ID: 'No. Identitas', EN: 'ID Number' }), `${holder?.jenis_identitas || 'KTP'}: ${holder?.no_identitas || '-'}`],
    [t({ ID: 'Jenis Kelamin', EN: 'Gender' }), holder?.jenis_kelamin || '-'],
    [t({ ID: 'Usia', EN: 'Age' }), holder?.usia != null ? String(holder.usia) : '-'],
    [t({ ID: 'Email', EN: 'Email' }), holder?.email || '-'],
    [t({ ID: 'WhatsApp', EN: 'WhatsApp' }), holder?.no_hp || '-'],
  ]
  return (
    <div className="divide-y divide-slate-100">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-start justify-between gap-3 py-1.5">
          <span className="text-[11px] text-slate-500 shrink-0">{k}</span>
          <span className="text-[11px] font-semibold text-slate-800 text-right break-all">{v}</span>
        </div>
      ))}
    </div>
  )
}

export default function AdminCheckinPage() {
  const { t } = useLang()
  const router = useRouter()
  const adminName = useAdminName()
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<CheckInStatus>('idle')
  const [busy, setBusy] = useState(false)
  const [resultTicket, setResultTicket] = useState<TicketInfo | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [checkinCount, setCheckinCount] = useState(0)
  const [totalTickets, setTotalTickets] = useState(0)
  const [recentCheckins, setRecentCheckins] = useState<RecentEntry[]>([])
  const [search, setSearch] = useState('')
  // Nomor tiket yang diminta saat scan (dari suffix QR BOOKING-N), null jika scan kode booking.
  const [scannedIndex, setScannedIndex] = useState<number | null>(null)
  // Event yang sedang berjalan — hasil scan divalidasi milik event ini.
  const [activeEvent, setActiveEvent] = useState<{ id: string; nama_event: string } | null>(null)

  const loadData = () => {
    Promise.all([
      fetch('/api/dashboard/stats').then((r) => r.json()).catch(() => ({})),
      // Ambil SEMUA sumber (online + offline): siapa saja yang sudah masuk harus tampil.
      fetch('/api/transactions').then((r) => r.json()).catch(() => ({})),
    ]).then(([statsRes, ordersRes]) => {
      setCheckinCount(statsRes.data?.checkin ?? 0)
      setTotalTickets(statsRes.data?.tiketTerjual ?? 0)
      // Pecah per tiket yang sudah masuk: nama diambil dari pemilik tiket
      // ke-N, fallback ke nama pemesan bila data pemilik kosong.
      const entries: RecentEntry[] = []
      for (const o of (ordersRes.data || []) as Pesanan[]) {
        const checked: number[] = Array.isArray(o.tiket_check_in)
          ? o.tiket_check_in
          : o.status_check_in === 'sudah_check_in'
            ? Array.from({ length: o.jumlah || 0 }, (_, i) => i + 1)
            : []
        for (const idx of checked) {
          entries.push({
            booking_id: o.booking_id,
            ticketIndex: idx,
            nama: o.pemilik_tiket?.[idx - 1]?.nama || o.customers?.nama || '-',
            kategori: o.tiket?.kategori || '-',
          })
          if (entries.length >= 6) break
        }
        if (entries.length >= 6) break
      }
      setRecentCheckins(entries)
    })
  }

  useEffect(() => {
    const session = getAdminSession('admin')
    if (!session || session.role !== 'admin') {
      router.replace('/admin/login')
      return
    }
    loadData()
    fetch('/api/events?active=true')
      .then((r) => r.json())
      .then((res) => {
        if (res.data?.id) setActiveEvent({ id: res.data.id, nama_event: res.data.nama_event || '' })
      })
      .catch(() => {})
  }, [router])

  // Kirim check-in ke server. opts.index = 1 tiket, opts.all = semua tiket.
  // Server menolak check-in ganda dengan 409 (1 tiket hanya 1x check-in).
  const sendCheckIn = async (bookingId: string, opts: { index?: number; all?: boolean }) => {
    const payload: { status_check_in: string; ticketIndex?: number; all?: boolean } = {
      status_check_in: 'sudah_check_in',
    }
    if (opts.all) payload.all = true
    if (opts.index != null) payload.ticketIndex = opts.index

    const res = await fetch(`/api/transactions/${encodeURIComponent(bookingId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const result = await res.json()
    if (!res.ok) {
      // Sinkronkan state lokal saat server menolak karena sudah check-in (409),
      // agar tombol per-tiket langsung terkunci dan tidak bisa diklik lagi.
      if (res.status === 409 && result.tiket_check_in) {
        setResultTicket((prev) =>
          prev
            ? {
                ...prev,
                tiket_check_in: result.tiket_check_in ?? prev.tiket_check_in,
                status_check_in: 'sudah_check_in',
              }
            : prev
        )
      }
      throw new Error(result.error || 'Gagal check-in')
    }
    setResultTicket((prev) =>
      prev
        ? {
            ...prev,
            tiket_check_in: result.data?.tiket_check_in ?? prev.tiket_check_in,
            status_check_in: result.data?.status_check_in ?? prev.status_check_in,
          }
        : prev
    )
    loadData()
  }

  const handleScanWithCode = async (rawCode: string) => {
    const trimmed = extractScanCode(rawCode)
    if (!trimmed || busy) return
    // Kode bisa berupa booking (ETX-XXXXXX) atau per-tiket (ETX-XXXXXX-2).
    const suffixMatch = /^(.*)-(\d+)$/.exec(trimmed)
    const requestedIndex = suffixMatch ? Number(suffixMatch[2]) : null
    setScannedIndex(requestedIndex)
    setBusy(true)
    setStatus('loading')
    setNotice('')
    setError('')
    try {
      const verifyRes = await fetch(`/api/transactions/${encodeURIComponent(trimmed)}`)
      const verify = await verifyRes.json()
      if (!verifyRes.ok || !verify.data) {
        setStatus('invalid')
        setResultTicket(null)
        return
      }
      const data: TicketInfo = verify.data
      setResultTicket(data)

      if (data.status_bayar !== 'berhasil') {
        setStatus('belum-lunas')
        return
      }

      // Validasi per-event: tiket harus milik event yang sedang berjalan.
      if (activeEvent && data.tiket?.id_event && data.tiket.id_event !== activeEvent.id) {
        setStatus('wrong-event')
        return
      }

      const checked = new Set<number>(data.tiket_check_in || [])
      // Validasi 1x check-in per tiket:
      // - QR per-tiket (BOOKING-2) → tolak jika nomor itu sudah check-in.
      // - QR booking → tolak hanya jika SEMUA tiket sudah check-in.
      if (requestedIndex != null) {
        if (requestedIndex < 1 || requestedIndex > data.jumlah) {
          setStatus('invalid')
          setResultTicket(null)
          return
        }
        if (checked.has(requestedIndex)) {
          setStatus('already')
        } else {
          // Tampilkan detail dulu — check-in dicatat setelah panitia konfirmasi.
          setStatus('resolved')
        }
      } else if (checked.size >= data.jumlah && data.jumlah > 0) {
        setStatus('already')
      } else {
        // Tampilkan detail dulu — check-in dicatat setelah panitia konfirmasi.
        setStatus('resolved')
      }
    } catch (err) {
      setError(friendlyError(err))
      setStatus('invalid')
      setResultTicket(null)
    } finally {
      setBusy(false)
    }
  }

  const handleCheckInOne = async (index: number) => {
    if (!resultTicket || busy) return
    // Cegah klik ganda di UI: 1 tiket hanya 1x check-in.
    if (new Set<number>(resultTicket.tiket_check_in || []).has(index)) {
      setError(t({ ID: `Tiket #${index} sudah check-in.`, EN: `Ticket #${index} already checked in.` }))
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await sendCheckIn(resultTicket.booking_id, { index })
      setNotice(t({ ID: `Tiket #${index} berhasil check-in.`, EN: `Ticket #${index} checked in.` }))
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  const handleCheckInAll = async () => {
    if (!resultTicket || busy) return
    const alreadyCount = new Set<number>(resultTicket.tiket_check_in || []).size
    if (alreadyCount >= resultTicket.jumlah && resultTicket.jumlah > 0) {
      setError(t({ ID: 'Semua tiket sudah check-in.', EN: 'All tickets already checked in.' }))
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await sendCheckIn(resultTicket.booking_id, { all: true })
      setNotice(t({ ID: 'Semua tiket berhasil check-in.', EN: 'All tickets checked in.' }))
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  const handleScan = () => {
    handleScanWithCode(code)
  }

  const handleReset = () => {
    setCode('')
    setStatus('idle')
    setResultTicket(null)
    setScannedIndex(null)
    setNotice('')
    setError('')
  }

  const checkedIndices = new Set<number>(resultTicket?.tiket_check_in || [])
  const isMulti = (resultTicket?.jumlah || 0) > 1

  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search check-in..."
          userName={adminName || 'Panitia'}
          userRole="Gate Operations"
        />

        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto overflow-auto">
          {/* Header Title */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {t({ ID: 'Check-In Tiket', EN: 'Ticket Check-In' })}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {t({
                ID: 'Scan QR atau masukkan booking ID e-tiket penonton untuk validasi kehadiran.',
                EN: 'Scan QR or enter attendee booking ID to validate attendance.',
              })}
            </p>
            {activeEvent && (
              <p className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 mt-3 inline-block">
                {t({ ID: 'Check-in untuk:', EN: 'Checking in for:' })} {activeEvent.nama_event}
              </p>
            )}
            {error && <Toast ok={false} text={error} onClose={() => setError('')} className="mt-3" />}
          </div>

          {/* Top 2 Cards: Scanner & Manual Entry */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
            {/* Left: Scanner Section */}
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
                    ID: 'Arahkan kamera ke QR Code e-tiket penonton.',
                    EN: 'Point camera to attendee e-ticket QR Code.',
                  })}
                </p>

                {/* Real QR Scanner */}
                <QrScanner onScan={handleScanWithCode} />
              </div>
            </div>

            {/* Right: Manual Entry & Results */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                  </svg>
                  <h2 className="text-base font-bold text-slate-900">
                    {t({ ID: 'Manual Entry', EN: 'Manual Entry' })}
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mb-6">
                  {t({
                    ID: 'Ketik booking ID tiket (boleh dengan nomor tiket, mis. ETX-XXXX-2) jika QR tidak terbaca.',
                    EN: 'Type ticket booking ID (optionally with ticket number, e.g. ETX-XXXX-2) if QR is not readable.',
                  })}
                </p>

                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  {t({ ID: 'Kode Booking E-Tiket', EN: 'E-Ticket Booking ID' })}
                </label>
                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="e.g. ETX-A8K29"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleScan()}
                    className="w-full bg-[#f1f5f9] border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm font-mono placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all uppercase"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleScan}
                  disabled={busy}
                  className="w-full bg-[#0057e7] hover:bg-[#0048c2] text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-sm shadow-blue-500/20 active:scale-[0.99] flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  <span>{busy ? '...' : t({ ID: 'Check-In Sekarang', EN: 'Check-In Now' })}</span>
                  <span>→</span>
                </button>
              </div>

              {/* Status Results */}
              <div className="mt-5">
                {status === 'loading' && (
                  <p className="text-xs text-slate-400 text-center py-6">
                    {t({ ID: 'Memuat data', EN: 'Loading' })}<LoadingDots />
                  </p>
                )}

                {status === 'resolved' && resultTicket && (
                  <div className="rounded-xl overflow-hidden border border-slate-200/90 text-xs">
                    {/* Header e-tiket — mengikuti model yang dikirim ke email */}
                    <div className="bg-[#0b1d3a] px-4 py-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[10px] font-bold tracking-widest text-blue-300 uppercase">
                          {t({ ID: 'E-Tiket', EN: 'E-Ticket' })}
                        </p>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-white border border-white/20 shrink-0">
                          {checkedIndices.size}/{resultTicket.jumlah}
                        </span>
                      </div>
                      <p className="text-white font-bold text-sm mt-1">
                        {resultTicket.event?.nama_event || resultTicket.tiket?.kategori || 'TIKET'}
                      </p>
                      <p className="text-slate-300 text-[11px] mt-0.5">
                        {resultTicket.event?.tanggal || '-'} · {resultTicket.event?.jam || '-'}
                      </p>
                      <p className="text-slate-400 text-[11px]">{resultTicket.event?.lokasi || '-'}</p>
                    </div>

                    {/* Strip kategori */}
                    <div className="bg-slate-50 px-4 py-2.5 flex items-center justify-between border-b border-slate-200">
                      <div>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          {t({ ID: 'Tiket', EN: 'Ticket' })}
                        </p>
                        <p className="text-sm font-bold text-slate-900">
                          {resultTicket.tiket?.kategori || 'TIKET'} × {resultTicket.jumlah}
                        </p>
                      </div>
                      {resultTicket.tiket?.harga != null && (
                        <p className="text-sm font-bold text-[#0b1d3a]">
                          {formatRupiah(Number(resultTicket.tiket.harga) * resultTicket.jumlah)}
                        </p>
                      )}
                    </div>

                    {/* Rincian pemegang tiket per tiket */}
                    <div className="bg-white p-3.5 space-y-3">
                      {Array.from({ length: resultTicket.jumlah }).map((_, i) => {
                        const idx = i + 1
                        const holder = resultTicket.pemilik_tiket?.[i] || resultTicket.customers
                        const done = checkedIndices.has(idx)
                        return (
                          <div key={idx} className="rounded-lg border border-slate-200 overflow-hidden">
                            <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-800">
                                  {t({ ID: 'Tiket', EN: 'Ticket' })} #{idx}
                                </p>
                                <p className="text-[10px] font-mono text-slate-500 truncate">
                                  {resultTicket.booking_id}-{idx}
                                </p>
                              </div>
                              {done ? (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                                  ✓ {t({ ID: 'Sudah', EN: 'Done' })}
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleCheckInOne(idx)}
                                  disabled={busy}
                                  className="text-[11px] font-semibold px-3 py-1 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white transition-colors shrink-0 disabled:opacity-50"
                                >
                                  {t({ ID: 'Check-in', EN: 'Check-in' })}
                                </button>
                              )}
                            </div>
                            <div className="px-3 py-1.5">
                              <HolderRows holder={holder} />
                            </div>
                          </div>
                        )
                      })}

                      {isMulti && checkedIndices.size < resultTicket.jumlah && (
                        <button
                          onClick={handleCheckInAll}
                          disabled={busy}
                          className="w-full py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                        >
                          {t({ ID: 'Check-in Semua Tiket', EN: 'Check-In All Tickets' })}
                        </button>
                      )}

                      {checkedIndices.size >= resultTicket.jumlah && (
                        <p className="text-center text-emerald-700 font-semibold">
                          ✓{' '}
                          {isMulti
                            ? t({ ID: 'Semua tiket sudah check-in', EN: 'All tickets checked in' })
                            : t({ ID: 'Tiket sudah check-in', EN: 'Ticket checked in' })}
                        </p>
                      )}

                      {notice && <p className="text-[11px] text-emerald-700">{notice}</p>}

                      <button
                        onClick={handleReset}
                        className="w-full py-2 rounded-lg bg-slate-200 text-slate-800 font-medium hover:bg-slate-300 transition-colors"
                      >
                        {t({ ID: 'Scan Berikutnya', EN: 'Scan Next' })}
                      </button>
                    </div>
                  </div>
                )}

                {status === 'already' && resultTicket && (() => {
                  // Tampilkan pemilik tiket yang sesuai: tiket spesifik bila scan QR
                  // per-tiket (BOOKING-N), atau semua pemegang bila scan kode booking.
                  const holders: { idx: number; nama: string }[] =
                    scannedIndex != null
                      ? [{
                          idx: scannedIndex,
                          nama: resultTicket.pemilik_tiket?.[scannedIndex - 1]?.nama
                            || resultTicket.customers?.nama || '-',
                        }]
                      : Array.from({ length: resultTicket.jumlah }, (_, i) => ({
                          idx: i + 1,
                          nama: resultTicket.pemilik_tiket?.[i]?.nama
                            || resultTicket.customers?.nama || '-',
                        }))
                  return (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">⚠️</span>
                        <p className="text-amber-800 font-bold text-sm">
                          {t({ ID: 'Tiket Sudah Check-In (1 tiket hanya 1x)', EN: 'Ticket Already Checked In (one ticket, one check-in)' })}
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        {holders.map((h) => (
                          <div key={h.idx} className="flex items-center justify-between gap-2 rounded-lg bg-white/70 border border-amber-100 px-3 py-1.5">
                            <p className="text-slate-800 font-semibold truncate">
                              {resultTicket.jumlah > 1 ? `Tiket #${h.idx} — ` : ''}{h.nama}
                            </p>
                            <p className="font-mono text-[10px] text-slate-500 shrink-0">
                              {resultTicket.booking_id}-{h.idx}
                            </p>
                          </div>
                        ))}
                      </div>
                      <p className="text-slate-500 mt-2">
                        {resultTicket.tiket?.kategori} · {(resultTicket.tiket_check_in || []).length}/{resultTicket.jumlah} check-in
                      </p>
                      <p className="text-amber-700 mt-1">
                        {t({ ID: 'Tolak masuk ulang untuk kode ini.', EN: 'Do not allow re-entry with this code.' })}
                      </p>
                      <button
                        onClick={handleReset}
                        className="mt-3 w-full py-2 rounded-lg bg-slate-200 text-slate-800 font-medium hover:bg-slate-300 transition-colors"
                      >
                        {t({ ID: 'Reset', EN: 'Reset' })}
                      </button>
                    </div>
                  )
                })()}

                {status === 'belum-lunas' && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-800">
                    <p className="font-bold mb-1">❌ {t({ ID: 'Tiket Belum Lunas', EN: 'Ticket Not Paid' })}</p>
                    <p>{t({ ID: 'Status pembayaran belum berhasil.', EN: 'Payment status is not successful.' })}</p>
                  </div>
                )}

                {status === 'wrong-event' && resultTicket && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs">
                    <p className="font-bold mb-1 text-amber-800">⚠️ {t({ ID: 'Tiket Event Lain', EN: 'Different Event Ticket' })}</p>
                    <p className="text-amber-700">
                      {t({ ID: 'Tiket ini milik', EN: 'This ticket belongs to' })} <span className="font-bold">{resultTicket.event?.nama_event || resultTicket.tiket?.kategori}</span>
                      {activeEvent && (<>, {t({ ID: 'bukan', EN: 'not' })} <span className="font-bold">{activeEvent.nama_event}</span></>)}.
                      {t({ ID: 'Tolak check-in untuk kode ini.', EN: 'Do not check in this code.' })}
                    </p>
                    <button
                      onClick={handleReset}
                      className="mt-3 w-full py-2 rounded-lg bg-slate-200 text-slate-800 font-medium hover:bg-slate-300 transition-colors"
                    >
                      {t({ ID: 'Reset', EN: 'Reset' })}
                    </button>
                  </div>
                )}

                {status === 'invalid' && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-800">
                    <p className="font-bold mb-1">❌ {t({ ID: 'Booking ID Tidak Ditemukan', EN: 'Booking ID Not Found' })}</p>
                    <p>{t({ ID: 'Pastikan kode booking valid.', EN: 'Make sure booking ID is valid.' })}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Section: Stats & Recent Check-ins */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 uppercase">
                  {t({ ID: 'Total Hadir', EN: 'Checked In' })}
                </span>
                <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              </div>
              <p className="text-3xl font-bold text-slate-900">{checkinCount}</p>
              <p className="text-xs text-slate-400 mt-1">
                {t({ ID: 'Dari total', EN: 'From' })} {totalTickets} {t({ ID: 'tiket terjual', EN: 'tickets sold' })}
              </p>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 uppercase">
                  {t({ ID: 'Belum Hadir', EN: 'Not Yet Checked In' })}
                </span>
                <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
              </div>
              <p className="text-3xl font-bold text-slate-900">{Math.max(0, totalTickets - checkinCount)}</p>
              <p className="text-xs text-slate-400 mt-1">
                {t({ ID: 'Menunggu di pintu masuk', EN: 'Waiting at gate entrance' })}
              </p>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 uppercase">
                  {t({ ID: 'Persentase Kehadiran', EN: 'Attendance Rate' })}
                </span>
                <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </span>
              </div>
              <p className="text-3xl font-bold text-slate-900">
                {totalTickets > 0 ? Math.round((checkinCount / totalTickets) * 100) : 0}%
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {t({ ID: 'Kapasitas venue terisi', EN: 'Venue capacity filled' })}
              </p>
            </div>
          </div>

          {/* Recent Check-Ins Card Grid */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 mb-4">
              {t({ ID: 'Riwayat Check-In Terbaru', EN: 'Recent Check-Ins' })}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {recentCheckins.length === 0 ? (
                <p className="col-span-3 text-xs text-slate-400 text-center py-6">
                  {t({ ID: 'Belum ada check-in hari ini.', EN: 'No check-ins today yet.' })}
                </p>
              ) : (
                recentCheckins.map((chk, idx) => (
                  <div
                    key={`${chk.booking_id}-${chk.ticketIndex}-${idx}`}
                    className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors flex items-center justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{chk.nama}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                        {chk.kategori} · #{chk.ticketIndex}
                      </p>
                      <p className="text-[10px] font-mono text-slate-400 mt-0.5 truncate">
                        {chk.booking_id}-{chk.ticketIndex}
                      </p>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                      {t({ ID: 'Hadir', EN: 'Attended' })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}