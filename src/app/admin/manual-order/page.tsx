'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import AdminSidebar from '@/components/layout/AdminSidebar'
import DashboardHeader from '@/components/layout/DashboardHeader'
import { getAdminSession, useAdminName } from '@/lib/adminAuth'
import { useLang } from '@/lib/i18n'
import { friendlyError } from '@/app/lib/fetchError'
import Toast from '@/components/Toast'
import LoadingDots from '@/components/LoadingDots'

interface TicketItem {
  id: string
  kategori: string
  harga: number
  sisa_kuota: number
  status?: string | null
}

interface Pesanan {
  id: string
  booking_id: string
  nama: string
  kategori: string
  jumlah: number
  total_harga?: number
  source: string
  tanggal_pesan: string
  customers: { nama: string } | null
  tiket: { kategori: string; harga: number } | null
}

interface PersonData {
  nama: string
  identitas: string
  jenisIdentitas: string
  usia: string
  jenisKelamin: 'Laki-laki' | 'Perempuan'
  email: string
  whatsapp: string
}

const EMPTY_PERSON: PersonData = {
  nama: '',
  identitas: '',
  jenisIdentitas: 'KTP',
  usia: '',
  jenisKelamin: 'Laki-laki',
  email: '',
  whatsapp: '',
}

const IDENTITAS_OPTIONS = ['KTP', 'SIM', 'Kartu Pelajar', 'Paspor']
const PAYMENT_METHODS = ['Tunai', 'Transfer Bank', 'QRIS', 'Kartu Debit/Kredit']
const FORM_STORAGE_KEY = 'encoretix_manual_order_data'

function formatRupiah(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID')
}

const INPUT_CLS =
  'w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-900 placeholder-slate-500 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all'

function Input({ label, required, hint, ...props }: { label: string; required?: boolean; hint?: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-sm font-bold text-slate-900 mb-1.5">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      <input required={required} {...props} className={INPUT_CLS} />
      {hint && <p className="text-xs text-slate-600 mt-1 flex items-center gap-1">{hint}</p>}
    </div>
  )
}

function Select({ label, required, options, ...props }: { label?: string; required?: boolean; options: string[] } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      {label && (
        <label className="block text-sm font-bold text-slate-900 mb-1.5">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}
      <select required={required} {...props} className={INPUT_CLS}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  )
}

const IDENTITAS_LENGTH = ['KTP', 'SIM']

export default function AdminManualOrderPage() {
  const { t } = useLang()
  const router = useRouter()
  const [tickets, setTickets] = useState<TicketItem[]>([])
  const [recent, setRecent] = useState<Pesanan[]>([])
  const [salesClosed, setSalesClosed] = useState(false)
  const readOnly = salesClosed
  const [pemesan, setPemesan] = useState<PersonData>(EMPTY_PERSON)
  const [owners, setOwners] = useState<PersonData[]>([{ ...EMPTY_PERSON }])
  const [syncWithPrev, setSyncWithPrev] = useState<boolean[]>([false])
  const [isSameAsPemesan, setIsSameAsPemesan] = useState(false)
  const [tiketId, setTiketId] = useState('')
  const [qty, setQty] = useState(1)
  const [metode, setMetode] = useState('Tunai')
  const [submitted, setSubmitted] = useState(false)
  const [lastOrder, setLastOrder] = useState<{ id: string; nama: string; email: string; tiket: string; qty: number; total: number; emailSent: boolean; pemilik: string[] } | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Simpan isian form ke sessionStorage supaya tidak hilang saat halaman di-refresh.
  const restoredRef = useRef(false)

  useEffect(() => {
    if (tickets.length === 0) return
    let saved: string | null = null
    try {
      saved = sessionStorage.getItem(FORM_STORAGE_KEY)
    } catch {
      restoredRef.current = true
      return
    }
    if (!saved) {
      restoredRef.current = true
      return
    }
    let parsed: { pemesan?: Partial<PersonData>; owners?: Partial<PersonData>[]; isSameAsPemesan?: boolean; tiketId?: string; qty?: number; metode?: string } | null = null
    try {
      parsed = JSON.parse(saved)
    } catch {
      restoredRef.current = true
      return
    }
    if (!parsed || typeof parsed !== 'object') {
      restoredRef.current = true
      return
    }
    const timer = setTimeout(() => {
      if (parsed.pemesan && typeof parsed.pemesan === 'object') {
        setPemesan({ ...EMPTY_PERSON, ...parsed.pemesan })
      }
      if (Array.isArray(parsed.owners)) {
        // Kembalikan tiap pemilik sesuai urutan — jangan samakan semua.
        const savedOwners = parsed.owners
        setOwners(
          Array.from({ length: Math.max(1, savedOwners.length) }, (_, i) => {
            const saved = savedOwners[i]
            return saved && typeof saved === 'object' ? { ...EMPTY_PERSON, ...saved } : { ...EMPTY_PERSON }
          })
        )
      }
      if (typeof parsed.isSameAsPemesan === 'boolean') {
        setIsSameAsPemesan(parsed.isSameAsPemesan)
      }
      if (typeof parsed.tiketId === 'string' && tickets.some((tk) => tk.id === parsed.tiketId)) {
        setTiketId(parsed.tiketId)
      }
      if (typeof parsed.qty === 'number' && parsed.qty >= 1) {
        setQty(parsed.qty)
      }
      if (typeof parsed.metode === 'string' && PAYMENT_METHODS.includes(parsed.metode)) {
        setMetode(parsed.metode)
      }
      restoredRef.current = true
    }, 0)
    return () => clearTimeout(timer)
  }, [tickets])

  useEffect(() => {
    if (!restoredRef.current) return
    try {
      sessionStorage.setItem(
        FORM_STORAGE_KEY,
        JSON.stringify({ pemesan, owners, isSameAsPemesan, tiketId, qty, metode })
      )
    } catch {
      // abaikan jika storage tidak tersedia
    }
  }, [pemesan, owners, isSameAsPemesan, tiketId, qty, metode])

  const loadRecent = () => {
    fetch('/api/transactions?source=offline')
      .then((r) => r.json())
      .then((res) => {
        if (!res.error) {
          setRecent((res.data || []).slice(0, 6))
        }
      })
      .catch(() => {})
  }

  useEffect(() => {
    const session = getAdminSession('admin')
    if (!session || session.role !== 'admin') {
      router.replace('/admin/login')
      return
    }
    fetch('/api/tickets')
      .then((r) => r.json())
      .then((res) => {
        if (res.error) throw new Error(res.error)
        setTickets(res.data || [])
        setSalesClosed(!!res.sales_closed)
        if ((res.data || []).length > 0) setTiketId(res.data[0].id)
      })
      .catch(() => {})
    loadRecent()
  }, [router])

  const selected = tickets.find((tick) => tick.id === tiketId)
  const harga = selected ? Number(selected.harga) : 0
  const subtotal = harga * qty
  const adminFee = metode === 'Tunai' ? 0 : Math.round(subtotal * 0.04)
  const total = subtotal + adminFee

  const owner0 = owners[0] ?? EMPTY_PERSON

  // Edit 1 pemilik hanya mengubah slot itu — slot lain tidak ikut ketimpa.
  // Edit manual juga melepas status "mengikuti" slot atasnya.
  const updateOwner = (i: number, patch: Partial<PersonData>) => {
    setOwners((prev) => prev.map((o, idx) => (idx === i ? { ...o, ...patch } : o)))
    setSyncWithPrev((prev) => prev.map((s, idx) => (idx === i ? false : s)))
  }

  // Edit data pemesan saat toggle global aktif langsung diteruskan ke semua
  // pemilik (sesuai label "Data pemilik tiket mengikuti data pemesan").
  const updatePemesan = (v: PersonData) => {
    setPemesan(v)
    if (isSameAsPemesan) {
      setOwners((prev) => prev.map(() => ({ ...v })))
    }
  }

  // Copy seluruh data pemilik di atasnya (#N-1) ke slot ini saat toggle dinyalakan.
  const toggleSyncWithPrev = (i: number, on: boolean) => {
    setSyncWithPrev((prev) => prev.map((s, idx) => (idx === i ? on : s)))
    if (on) {
      setOwners((prev) => prev.map((o, idx) => (idx === i ? { ...prev[i - 1] } : o)))
    }
  }

  const resizeOwners = (n: number) => {
    const target = Math.max(1, n)
    setOwners((prev) => {
      if (prev.length === target) return prev
      if (target < prev.length) return prev.slice(0, target)
      // Slot baru mengikuti status sync: ikut pemesan bila toggle global aktif,
      // ikut slot atasnya bila toggle per-slot aktif, selain itu dikosongkan.
      const next = [...prev]
      while (next.length < target) {
        const i = next.length
        if (isSameAsPemesan) next.push({ ...pemesan })
        else if (syncWithPrev[i]) next.push({ ...next[i - 1] })
        else next.push({ ...EMPTY_PERSON })
      }
      return next
    })
    setSyncWithPrev((prev) => Array.from({ length: target }, (_, i) => prev[i] ?? false))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (readOnly) {
      setError(t({ ID: 'Event sudah selesai — order manual tidak dapat dibuat.', EN: 'Event is finished — manual orders cannot be created.' }))
      return
    }
    if (!selected) return
    for (let i = 0; i < owners.length; i++) {
      const o = owners[i]
      if (IDENTITAS_LENGTH.includes(o.jenisIdentitas) && o.identitas.trim().length !== 16) {
        setError(
          `${t({ ID: 'Nomor identitas', EN: 'Identity number' })} ${o.jenisIdentitas} ${t({ ID: 'pemilik tiket', EN: 'for ticket' })} #${i + 1} ${t({ ID: 'harus 16 digit.', EN: 'must be 16 digits.' })}`
        )
        return
      }
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama: pemesan.nama,
          email: pemesan.email,
          no_hp: pemesan.whatsapp,
          usia: pemesan.usia ? Number(pemesan.usia) : null,
          no_identitas: pemesan.identitas,
          jenis_identitas: pemesan.jenisIdentitas,
          jenis_kelamin: pemesan.jenisKelamin,
          owners: owners.map((o) => ({
            nama: o.nama,
            email: o.email,
            no_hp: o.whatsapp,
            usia: o.usia ? Number(o.usia) : null,
            no_identitas: o.identitas,
            jenis_identitas: o.jenisIdentitas,
            jenis_kelamin: o.jenisKelamin,
          })),
          id_tiket: selected.id,
          jumlah: qty,
          source: 'offline',
          manual: metode === 'Tunai',
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || t({ ID: 'Gagal membuat order', EN: 'Failed to create order' }))
      try {
        sessionStorage.removeItem(FORM_STORAGE_KEY)
      } catch {
        // ignore
      }
      if (metode === 'Tunai') {
        setLastOrder({
          id: result.data.id,
          nama: owner0.nama,
          email: owner0.email,
          tiket: result.data.tiket?.kategori || selected.kategori,
          qty: result.data.jumlah,
          total: Number(result.data.total_bayar ?? total),
          emailSent: !!result.data.email_sent,
          pemilik: owners.map((o) => o.nama || '-'),
        })
        setSubmitted(true)
        loadRecent()
      } else {
        router.push(
          `/payment?booking=${encodeURIComponent(result.data.booking_id)}`
        )
      }
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  const handleReset = () => {
    setPemesan(EMPTY_PERSON)
    setOwners([{ ...EMPTY_PERSON }])
    setSyncWithPrev([false])
    setIsSameAsPemesan(false)
    setTiketId(tickets[0]?.id || '')
    setQty(1)
    setMetode('Tunai')
    setSubmitted(false)
    setLastOrder(null)
    setError('')
    try {
      sessionStorage.removeItem(FORM_STORAGE_KEY)
    } catch {
      // ignore
    }
  }

  const renderPersonFields = (person: PersonData, setPerson: (v: PersonData) => void, emailHint = true) => (
    <div className="space-y-4">
      <Input label={t({ ID: 'Nama Lengkap', EN: 'Full Name' })} required placeholder={t({ ID: 'Nama lengkap', EN: 'Full name' })} value={person.nama} onChange={(e) => setPerson({ ...person, nama: e.target.value })} />

      <div>
        <label className="block text-sm font-bold text-slate-900 mb-1.5">{t({ ID: 'Identitas', EN: 'Identity' })} <span className="text-rose-500">*</span></label>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="w-full sm:w-1/3">
            <Select options={IDENTITAS_OPTIONS} value={person.jenisIdentitas} onChange={(e) => setPerson({ ...person, jenisIdentitas: e.target.value })} />
          </div>
          <div className="w-full sm:w-2/3">
            <input
              required
              placeholder={t({ ID: 'Nomor Identitas', EN: 'Identity Number' })}
              className={INPUT_CLS}
              value={person.identitas}
              onChange={(e) => setPerson({ ...person, identitas: e.target.value })}
            />
          </div>
        </div>
        {IDENTITAS_LENGTH.includes(person.jenisIdentitas) && person.identitas.length > 0 && person.identitas.trim().length !== 16 && (
          <p className="text-xs font-medium text-rose-600 mt-1">{t({ ID: 'Nomor identitas', EN: 'Identity number' })} {person.jenisIdentitas} {t({ ID: 'harus 16 digit', EN: 'must be 16 digits' })}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-900 mb-1.5">{t({ ID: 'Jenis Kelamin', EN: 'Gender' })} <span className="text-rose-500">*</span></label>
        <div className="flex flex-wrap gap-4">
          {(['Laki-laki', 'Perempuan'] as const).map((jk) => {
            const selected = person.jenisKelamin === jk
            return (
              <label
                key={jk}
                className={`flex items-center gap-2 border rounded-xl px-4 py-2 cursor-pointer text-sm font-semibold transition-all ${
                  selected ? 'border-blue-600 text-blue-700 bg-blue-50' : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <input type="radio" className="hidden" checked={selected} onChange={() => setPerson({ ...person, jenisKelamin: jk })} />
                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${selected ? 'border-blue-600' : 'border-slate-300'}`}>
                  {selected && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                </div>
                {t({ ID: jk, EN: jk === 'Laki-laki' ? 'Male' : 'Female' })}
              </label>
            )
          })}
        </div>
      </div>

      <Input label={t({ ID: 'Usia', EN: 'Age' })} type="number" required placeholder={t({ ID: 'Usia', EN: 'Age' })} value={person.usia} onChange={(e) => setPerson({ ...person, usia: e.target.value })} />
      <Input
        label="Email"
        type="email"
        required
        placeholder="email@contoh.com"
        hint={emailHint ? t({ ID: 'Tiket akan dikirimkan ke email ini', EN: 'The ticket will be sent to this email' }) : undefined}
        value={person.email}
        onChange={(e) => setPerson({ ...person, email: e.target.value })}
      />
      <Input
        label={t({ ID: 'Nomor WhatsApp', EN: 'WhatsApp Number' })}
        type="tel"
        required
        placeholder="812xxxxxxx"
        value={person.whatsapp}
        onChange={(e) => setPerson({ ...person, whatsapp: e.target.value })}
      />
    </div>
  )

  const adminName = useAdminName()

  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader
          searchPlaceholder="Search manual orders..."
          userName={adminName || 'Panitia'}
          userRole="Admin Panitia"
        />

        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto overflow-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t({ ID: 'Manual Order', EN: 'Manual Order' })}</h1>
            <p className="text-sm font-medium text-slate-600 mt-1">{t({ ID: 'Buat order tiket secara manual untuk pembelian langsung di lokasi', EN: 'Create ticket orders manually for direct on-site purchases' })}</p>
            {readOnly && (
              <p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mt-3">
                {t({ ID: 'Event sudah selesai — order manual dinonaktifkan.', EN: 'Event is finished — manual orders are disabled.' })}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form */}
            <div className="lg:col-span-2 space-y-6">
              {submitted && lastOrder ? (
                <div className="bg-white border border-slate-200/90 rounded-2xl p-8 text-center shadow-sm">
                  <div className="text-5xl mb-4 flex items-center justify-center">
                    <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-1">{t({ ID: 'Order Berhasil Dibuat!', EN: 'Order Created Successfully!' })}</h3>
                  <p className="text-sm text-slate-500 mb-4">{t({ ID: 'ID Pesanan:', EN: 'Order ID:' })} <span className="font-mono text-blue-600 font-semibold">{lastOrder.id}</span></p>
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-5 text-left space-y-2.5 max-w-sm mx-auto">
                    <div className="flex justify-between text-sm"><span className="text-slate-500">{t({ ID: 'Nama', EN: 'Name' })}</span><span className="text-slate-900 font-medium">{lastOrder.nama}</span></div>
                    {lastOrder.qty > 1 && (
                      <div className="flex justify-between gap-3 text-sm">
                        <span className="text-slate-500 shrink-0">{t({ ID: 'Pemilik', EN: 'Holders' })}</span>
                        <span className="text-slate-900 font-medium text-right">{lastOrder.pemilik.map((n, i) => `#${i + 1} ${n}`).join(' · ')}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm"><span className="text-slate-500">{t({ ID: 'Tiket', EN: 'Ticket' })}</span><span className="text-slate-900 font-medium">{lastOrder.tiket} × {lastOrder.qty}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-slate-500">{t({ ID: 'Status', EN: 'Status' })}</span><span className="text-emerald-700 font-semibold">{t({ ID: 'Berhasil (offline)', EN: 'Successful (offline)' })}</span></div>
                    <div className="flex justify-between text-sm font-bold pt-2 border-t border-slate-200"><span className="text-slate-700">{t({ ID: 'Total', EN: 'Total' })}</span><span className="text-slate-900">{formatRupiah(lastOrder.total)}</span></div>
                  </div>
                  <div className={`mt-4 rounded-xl p-3 text-xs max-w-sm mx-auto text-left border ${lastOrder.emailSent ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                    {lastOrder.emailSent
                      ? `${t({ ID: 'Kode booking terkirim ke email (tanpa lampiran PDF)', EN: 'Booking code sent to email (without PDF attachment)' })} ${lastOrder.email}`
                      : `${t({ ID: 'Kode booking tidak dapat terkirim ke email. Sampaikan kode booking secara langsung.', EN: 'Booking code could not be sent to email. Share the booking code directly.' })}`}
                  </div>
                  <button onClick={handleReset} className="mt-6 w-full max-w-sm py-3 rounded-xl bg-[#0057e7] hover:bg-[#0048c2] text-white font-semibold text-sm transition-all shadow-sm">
                    + {t({ ID: 'Buat Order Baru', EN: 'Create New Order' })}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Box 1: Data Pemesan */}
                  <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
                    <h3 className="text-base font-bold text-slate-900 mb-5">{t({ ID: 'Data Pemesan', EN: 'Booker Details' })}</h3>
                    {renderPersonFields(pemesan, updatePemesan, true)}
                  </div>

                  {/* Box 2: Pemilik Tiket */}
                  <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
                    <div className="flex justify-between items-center mb-5">
                      <h3 className="text-base font-bold text-slate-900">{t({ ID: 'Pemilik Tiket', EN: 'Ticket Owner' })}</h3>
                      <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                        {t({ ID: 'Samakan seperti data pemesan', EN: 'Same as booker details' })}
                        <div className={`w-9 h-5 rounded-full relative transition-colors ${isSameAsPemesan ? 'bg-blue-600' : 'bg-slate-300'}`}>
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={isSameAsPemesan}
                            onChange={(e) => {
                              const on = e.target.checked
                              if (on) setOwners(owners.map(() => ({ ...pemesan })))
                              setIsSameAsPemesan(on)
                            }}
                          />
                          <div className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform ${isSameAsPemesan ? 'translate-x-4' : 'translate-x-0'}`} />
                        </div>
                      </label>
                    </div>

                    {isSameAsPemesan ? (
                      <div className="flex items-center gap-2 text-xs text-slate-500 py-3 px-4 rounded-xl bg-slate-50 border border-slate-200/70">
                        <span className="text-emerald-600 font-bold">✓</span> {t({ ID: 'Data pemilik tiket mengikuti data pemesan.', EN: 'Ticket owner details follow the booker details.' })}
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {owners.map((o, i) => (
                          <div key={i} className={i > 0 ? 'border-t border-slate-100 pt-6' : ''}>
                            <h4 className="text-sm font-semibold text-slate-800 mb-4">{t({ ID: 'Pemilik Tiket', EN: 'Ticket Owner' })} #{i + 1}</h4>
                            {i > 0 && (
                              <button
                                type="button"
                                onClick={() => toggleSyncWithPrev(i, !syncWithPrev[i])}
                                className={`w-full flex items-center justify-between rounded-xl border px-3.5 py-2.5 mb-4 text-sm transition ${syncWithPrev[i] ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-600 hover:border-slate-400'}`}
                              >
                                <span className="text-xs font-semibold">{t({ ID: 'Samakan dengan Pemilik #{prev}', EN: 'Same as Owner #{prev}' }).replace('{prev}', String(i))}</span>
                                <span className={`w-8 h-5 rounded-full relative transition ${syncWithPrev[i] ? 'bg-blue-600' : 'bg-slate-300'}`}>
                                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${syncWithPrev[i] ? 'left-3.5' : 'left-0.5'}`}></span>
                                </span>
                              </button>
                            )}
                            {renderPersonFields(o, (v) => updateOwner(i, v), false)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Box 3: Detail Tiket & Pembayaran */}
                  <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
                    <h3 className="text-base font-bold text-slate-900 mb-5">{t({ ID: 'Detail Tiket & Pembayaran', EN: 'Ticket & Payment Details' })}</h3>
                    <div className="bg-blue-50 border border-blue-200/80 rounded-xl p-4 mb-5">
                      <p className="text-[11px] text-blue-600 font-semibold uppercase">{t({ ID: 'Kategori Tiket Terpilih', EN: 'Selected Ticket' })}</p>
                      <p className="text-base font-bold text-slate-900">{selected ? selected.kategori : t({ ID: 'Pilih kategori di bawah', EN: 'Choose a category below' })}</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-900 mb-1.5">{t({ ID: 'Kategori Tiket', EN: 'Ticket Category' })} *</label>
                        <select required value={tiketId} onChange={(e) => setTiketId(e.target.value)} className={INPUT_CLS}>
                          {tickets.map((tick) => (
                            <option key={tick.id} value={tick.id}>
                              {tick.kategori} — {t({ ID: 'sisa', EN: 'remaining' })} {tick.sisa_kuota}{(tick.status ?? 'aktif') === 'nonaktif' ? ' (Nonaktif — offline saja)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-900 mb-1.5">{t({ ID: 'Jumlah Tiket', EN: 'Ticket Qty' })} *</label>
                        <input
                          type="number"
                          min={1}
                          max={selected?.sisa_kuota ?? 4}
                          value={qty}
                          onChange={(e) => {
                            const n = Number(e.target.value)
                            setQty(n)
                            resizeOwners(n)
                          }}
                          className={INPUT_CLS}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-bold text-slate-900 mb-1.5">{t({ ID: 'Metode Pembayaran', EN: 'Payment Method' })}</label>
                        <select value={metode} onChange={(e) => setMetode(e.target.value)} className={INPUT_CLS}>
                          {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
                        </select>
                        <p className="text-xs font-medium text-slate-600 mt-1">
                          {metode === 'Tunai'
                            ? t({ ID: 'Pembayaran langsung lunas saat pesanan dibuat.', EN: 'Payment is settled immediately when the order is created.' })
                            : t({ ID: 'Setelah order dibuat, akan diarahkan ke halaman pembayaran untuk verifikasi.', EN: 'After the order is created, you will be directed to the payment page for verification.' })}
                        </p>
                      </div>
                    </div>

                    {error && <Toast ok={false} text={error} onClose={() => setError('')} className="mb-3" />}

                    <div className="border-t border-slate-100 pt-4 space-y-2.5">
                      <div className="flex justify-between text-sm font-medium text-slate-700"><span>{t({ ID: 'Harga', EN: 'Price' })} × {qty}</span><span className="font-bold text-slate-900">{formatRupiah(subtotal)}</span></div>
                      {adminFee > 0 && <div className="flex justify-between text-sm font-medium text-slate-700"><span>{t({ ID: 'Biaya Admin', EN: 'Admin Fee' })}</span><span className="font-bold text-slate-900">{formatRupiah(adminFee)}</span></div>}
                      <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-100"><span>{metode === 'Tunai' ? t({ ID: 'Total (langsung lunas)', EN: 'Total (paid immediately)' }) : t({ ID: 'Total Tagihan', EN: 'Total Due' })}</span><span className="text-blue-600">{formatRupiah(total)}</span></div>
                    </div>

                    <button type="submit" disabled={busy || readOnly} className="w-full mt-6 py-3.5 rounded-xl bg-[#0057e7] hover:bg-[#0048c2] text-white font-semibold text-sm transition-all shadow-sm shadow-blue-500/20 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed">
                      {busy ? <>{t({ ID: 'Menyimpan', EN: 'Saving' })}<LoadingDots /></> : metode === 'Tunai' ? t({ ID: 'Buat Order Sekarang →', EN: 'Create Order Now →' }) : t({ ID: 'Lanjut ke Pembayaran →', EN: 'Continue to Payment →' })}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Right: Recent Orders List */}
            <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden h-fit sticky top-24 shadow-sm">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <p className="text-sm font-bold text-slate-900">{t({ ID: 'Order Manual Terbaru', EN: 'Recent Manual Orders' })}</p>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{recent.length}</span>
              </div>
              <div className="divide-y divide-slate-100">
                {recent.length === 0 && <div className="px-5 py-8 text-center text-slate-500 text-sm font-medium">{t({ ID: 'Belum ada order manual', EN: 'No manual orders yet' })}</div>}
                {recent.map((o) => (
                  <div key={o.booking_id} className="px-5 py-4 hover:bg-slate-50/70 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono font-medium text-blue-600">{o.id}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Offline</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900">{o.customers?.nama || '-'}</p>
                    <p className="text-[13px] font-medium text-slate-700 mt-0.5">{o.tiket?.kategori || '-'} × {o.jumlah}</p>
                    <p className="text-sm font-bold text-slate-900 mt-1">{formatRupiah(Number(o.tiket?.harga || 0) * o.jumlah)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}