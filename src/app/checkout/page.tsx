'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { usePaymentCountdown, clearPaymentCountdown } from '../lib/paymentTimer'
import PaymentTimerBanner from '@/components/PaymentTimerBanner'
import PaymentStatusModal from '@/components/PaymentStatusModal'
import StickyBottomBar from '@/components/StickyBottomBar'
import LoadingDots from '@/components/LoadingDots'
import TermsModal from '@/components/TermsModal'
import { useLang } from '@/lib/i18n'
import { friendlyError } from '@/app/lib/fetchError'
import {
  EMPTY_DIGITS,
  isValidIdentitas,
  isValidUsia,
  isValidWhatsapp,
  needs16DigitIdentity,
  sanitizeIdentitas,
  sanitizeUsia,
  sanitizeWhatsapp,
  type DigitString,
  type JenisIdentitas,
} from '@/app/lib/formNumbers'

function Input({ label, required, hint, prefixIcon, ...props }: { label: string; required?: boolean; hint?: React.ReactNode; prefixIcon?: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        {prefixIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {prefixIcon}
          </div>
        )}
        <input 
          required={required} 
          {...props} 
          className={`w-full border border-gray-200 rounded-lg py-2.5 text-sm focus:outline-none focus:border-gray-400 ${prefixIcon ? 'pl-16 pr-3' : 'px-3'}`} 
        />
      </div>
      {hint && <p className="text-[11px] text-red-500 mt-1">{hint}</p>}
    </div>
  )
}

function Select({ label, required, options, ...props }: { label?: string; required?: boolean; options: readonly string[] } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      {label && (
        <label className="block text-xs font-medium text-gray-600 mb-1.5">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <select required={required} {...props} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-gray-400">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

interface TicketData {
  id: string
  kategori: string
  harga: number
  sisa_kuota: number
  status?: string | null
  id_event: string | null
  event: { nama_event: string; tanggal: string; jam: string; lokasi: string; gambar: string | null } | null
}

interface OwnerData {
  nama: string
  identitas: string
  jenisIdentitas: JenisIdentitas
  usia: DigitString
  jenisKelamin: 'Laki-laki' | 'Perempuan'
  email: string
  whatsapp: DigitString
}

const EMPTY_OWNER: OwnerData = {
  nama: '',
  identitas: '',
  jenisIdentitas: 'KTP',
  usia: EMPTY_DIGITS,
  jenisKelamin: 'Laki-laki',
  email: '',
  whatsapp: EMPTY_DIGITS,
}

const ADMIN_FEE_RATE = 0.04

const FORM_STORAGE_KEY = 'encoretix_checkout_tiket_data'

function safeGetStorage(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(key) || sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSetStorage(key: string, value: string) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, value)
    sessionStorage.setItem(key, value)
  } catch {}
}

function safeRemoveStorage(key: string) {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(key)
    sessionStorage.removeItem(key)
  } catch {}
}

function validateOwnerData(o: OwnerData, label: string, t: (x: { ID: string; EN: string }) => string): string {
  const msg = (id: string, en: string) => t({ ID: id, EN: en })

  if (o.nama.trim().length < 2) {
    return msg(`Nama lengkap ${label} wajib diisi.`, `Full name for ${label} is required.`)
  }
  const is16 = needs16DigitIdentity(o.jenisIdentitas)
  if (!isValidIdentitas(o.identitas, o.jenisIdentitas)) {
    return msg(
      is16
        ? `Nomor identitas ${o.jenisIdentitas} ${label} harus 16 digit angka.`
        : `Nomor identitas ${o.jenisIdentitas} ${label} tidak valid.`,
      is16
        ? `Your ${o.jenisIdentitas} number for ${label} must be 16 digits.`
        : `Your ${o.jenisIdentitas} number for ${label} is invalid.`
    )
  }
  if (!isValidUsia(o.usia)) {
    return msg(
      `Usia ${label} tidak valid. Masukkan angka antara 1-120.`,
      `Invalid age for ${label}. Enter a number between 1-120.`
    )
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.email.trim())) {
    return msg(`Format email ${label} tidak valid.`, `Invalid email format for ${label}.`)
  }
  if (!isValidWhatsapp(o.whatsapp)) {
    return msg(
      `Nomor WhatsApp ${label} tidak valid. Contoh: 81234567890, 081234567890, atau +6281234567890.`,
      `Invalid WhatsApp number for ${label}. e.g. 81234567890.`
    )
  }
  return ''
}

export default function Checkout() {
  const { t } = useLang()
  return (
    <Suspense fallback={<div className="text-center py-20 text-gray-400 text-sm">{t({ ID: 'Memuat detail pemesanan', EN: 'Loading order details' })}<span className="loading-dots"><span /></span></div>}>
      <CheckoutContent />
    </Suspense>
  )
}

function CheckoutContent() {
  const router = useRouter()
  const { t } = useLang()
  const searchParams = useSearchParams()
  const tiketId = searchParams.get('tiket') || ''
  const qtyParam = Number(searchParams.get('qty')) || 1

  const [tiket, setTiket] = useState<TicketData | null>(null)
  const [loadingTicket, setLoadingTicket] = useState(!tiketId)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(tiketId ? '' : t({ ID: 'ID tiket tidak ditemukan.', EN: 'Ticket ID not found.' }))
  const [showTerms, setShowTerms] = useState(false)

  const { remaining, isExpired } = usePaymentCountdown(false, false)

  const [pemesan, setPemesan] = useState<OwnerData>(EMPTY_OWNER)

  const [isSameAsPemesan, setIsSameAsPemesan] = useState(false)
  const ownerCount = Math.max(1, qtyParam)
  const [owners, setOwners] = useState<OwnerData[]>(() => Array.from({ length: ownerCount }, () => ({ ...EMPTY_OWNER })))
  const [syncWithPrev, setSyncWithPrev] = useState<boolean[]>(() => Array.from({ length: ownerCount }, () => false))

  // State untuk Voucher
  const [voucherCode, setVoucherCode] = useState('')
  const [discount, setDiscount] = useState(0)
  const [voucherError, setVoucherError] = useState('')
  const [isVoucherApplied, setIsVoucherApplied] = useState(false)
  const [isValidatingVoucher, setIsValidatingVoucher] = useState(false)

  // State untuk melacak apakah data tersimpan sudah selesai dipulihkan
  const [isRestored, setIsRestored] = useState(false)

  // 1. Pulihkan data form dari storage saat pertama kali mount di browser
  useEffect(() => {
    try {
      const saved = safeGetStorage(FORM_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed && typeof parsed === 'object') {
          if (parsed.pemesan && typeof parsed.pemesan === 'object') {
            setPemesan((prev) => ({ ...prev, ...parsed.pemesan }))
          }
          if (Array.isArray(parsed.owners) && parsed.owners.length > 0) {
            setOwners(
              Array.from({ length: ownerCount }, (_, i) =>
                parsed.owners[i] ? { ...EMPTY_OWNER, ...parsed.owners[i] } : { ...EMPTY_OWNER }
              )
            )
          }
          if (typeof parsed.isSameAsPemesan === 'boolean') {
            setIsSameAsPemesan(parsed.isSameAsPemesan)
          }
          if (typeof parsed.voucherCode === 'string') {
            setVoucherCode(parsed.voucherCode)
          }
        }
      }
    } catch {
      // abaikan jika parsing gagal
    }
    // Set state isRestored = true. Karena state update di-queue untuk render berikutnya,
    // Effect penyimpanan di bawah TIDAK AKAN berjalan pada initial render saat data masih kosong.
    setIsRestored(true)
  }, [ownerCount])

  // 2. Simpan setiap perubahan data form ke storage HANYA setelah data lama selesai dipulihkan
  useEffect(() => {
    if (!isRestored) return
    safeSetStorage(
      FORM_STORAGE_KEY,
      JSON.stringify({ pemesan, owners, isSameAsPemesan, voucherCode })
    )
  }, [isRestored, pemesan, owners, isSameAsPemesan, voucherCode])

  // Tombol kembali: reset timer dan form data jika user membatalkan proses checkout
  const handleBack = () => {
    clearPaymentCountdown()
    safeRemoveStorage(FORM_STORAGE_KEY)
    router.back()
  }

  const updateOwner = (i: number, patch: Partial<OwnerData>) => {
    setOwners((prev) => prev.map((o, idx) => (idx === i ? { ...o, ...patch } : o)))
    setSyncWithPrev((prev) => prev.map((s, idx) => (idx === i ? false : s)))
  }

  // Copy seluruh data Pemilik Tiket sebelumnya (#N-1) ke slot saat toggle per-tiket dinyalakan.
  const toggleSyncWithPrev = (i: number, on: boolean) => {
    setSyncWithPrev((prev) => prev.map((s, idx) => (idx === i ? on : s)))
    if (on) {
      setOwners((prev) => prev.map((o, idx) => (idx === i ? { ...prev[i - 1] } : o)))
    }
  }

  useEffect(() => {
    if (!tiketId) return
    fetch(`/api/tickets/${tiketId}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.error) throw new Error(res.error)
        if ((res.data?.status ?? 'aktif') === 'nonaktif') {
          throw new Error(t({ ID: 'Penjualan tiket ini sudah selesai.', EN: 'Ticket sales for this ticket have ended.' }))
        }
        setTiket(res.data)
      })
      .catch((e) => setError(friendlyError(e)))
      .finally(() => setLoadingTicket(false))
  }, [tiketId])

  const subtotal = tiket ? Number(tiket.harga) * qtyParam : 0
  const adminFee = Math.round(subtotal * ADMIN_FEE_RATE)
  // Kalkulasi total dengan pengurang diskon (jangan sampai minus)
  const total = Math.max(0, subtotal + adminFee - discount)

  const isLengthChecked = needs16DigitIdentity(pemesan.jenisIdentitas)
  const identitasHint =
    isLengthChecked && pemesan.identitas.length > 0 && pemesan.identitas.trim().length !== 16
      ? `Nomor identitas ${pemesan.jenisIdentitas} harus 16 digit`
      : ''

  // Logika validasi voucher
  const handleApplyVoucher = async () => {
    if (!voucherCode.trim()) {
      setVoucherError('Masukkan kode voucher terlebih dahulu.')
      return
    }

    setIsValidatingVoucher(true)
    setVoucherError('')
    try {
      const res = await fetch('/api/vouchers/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kode_voucher: voucherCode, id_event: tiket?.id_event ?? null }),
      })
      const result = await res.json()

      if (!res.ok) {
        setDiscount(0)
        setIsVoucherApplied(false)
        setVoucherError(result.error || 'Kode voucher tidak valid.')
        return
      }

      setDiscount(Number(result.data.nominal_diskon))
      setIsVoucherApplied(true)
      setVoucherError('')
    } catch {
      setDiscount(0)
      setIsVoucherApplied(false)
      setVoucherError('Terjadi kesalahan. Coba lagi nanti.')
    } finally {
      setIsValidatingVoucher(false)
    }
  }

  const handleRemoveVoucher = () => {
    setVoucherCode('')
    setDiscount(0)
    setIsVoucherApplied(false)
    setVoucherError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tiket) return
    const buyerErr = validateOwnerData(pemesan, t({ ID: 'pemesan', EN: 'the buyer' }), t)
    if (buyerErr) {
      setError(buyerErr)
      return
    }
    // Selalu hitung ulang pemilik saat submit: jika "samakan dengan pemesan"
    // aktif, ikuti data pemesan terbaru (bukan salinan saat toggle diklik).
    const effectiveOwners = isSameAsPemesan ? owners.map(() => ({ ...pemesan })) : owners
    for (let i = 0; i < effectiveOwners.length; i++) {
      const label = t({ ID: `Pemilik Tiket #${i + 1}`, EN: `Ticket Owner #${i + 1}` })
      const ownerErr = validateOwnerData(effectiveOwners[i], label, t)
      if (ownerErr) {
        setError(ownerErr)
        return
      }
    }
    const payloadOwners = effectiveOwners.map((o) => ({
      nama: o.nama,
      email: o.email,
      no_hp: o.whatsapp,
      usia: o.usia ? Number(o.usia) : null,
      no_identitas: o.identitas,
      jenis_identitas: o.jenisIdentitas,
      jenis_kelamin: o.jenisKelamin,
    }))
    setSubmitting(true)
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
          owners: payloadOwners,
          id_tiket: tiket.id,
          jumlah: qtyParam,
          kode_voucher: isVoucherApplied ? voucherCode : null,
          source: 'online',
          manual: false,
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Gagal membuat pesanan')
      // Catatan: FORM_STORAGE_KEY sengaja TIDAK dihapus di sini agar jika pemesan
      // menekan tombol 'Kembali' dari halaman pembayaran, isian form tidak hilang.
      router.push(`/payment?booking=${result.data.booking_id}`)
    } catch (err) {
      setError(friendlyError(err))
      setSubmitting(false)
    }
  }

  return (
    <>
      <PaymentTimerBanner remaining={remaining} label={t({ ID: 'Sisa waktu untuk memesan tiket', EN: 'Time left to book your ticket' })} />

      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="mb-8">
          <button onClick={handleBack} className="text-sm font-medium text-gray-600 mb-6 hover:text-gray-900">
            &lt; {t({ ID: 'Kembali', EN: 'Back' })}
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{t({ ID: 'Detail Pemesanan', EN: 'Order Details' })}</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* KIRI: BAGIAN FORM */}
          <div className="lg:col-span-2 space-y-6">
            <form id="checkout-form" onSubmit={handleSubmit} className="space-y-6">
              
              {/* Box 1: Data Pemesan */}
              <div className="border border-gray-200 rounded-xl p-4 sm:p-6 bg-white">
                <h3 className="font-semibold text-gray-900 mb-6">{t({ ID: 'Data Pemesan', EN: 'Orderer Details' })}</h3>
                <div className="space-y-4">
                  <Input label={t({ ID: 'Nama Lengkap', EN: 'Full Name' })} required placeholder="" value={pemesan.nama} onChange={(e) => setPemesan({ ...pemesan, nama: e.target.value })} />
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">{t({ ID: 'Identitas', EN: 'Identity' })} <span className="text-red-500">*</span></label>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="w-full sm:w-1/3">
                        <Select options={['KTP', 'SIM', 'Kartu Pelajar', 'Paspor']} value={pemesan.jenisIdentitas} onChange={(e) => {
                          const jenisIdentitas = e.target.value as JenisIdentitas
                          setPemesan({ ...pemesan, jenisIdentitas, identitas: sanitizeIdentitas(pemesan.identitas, jenisIdentitas) })
                        }} />
                      </div>
                      <div className="w-full sm:w-2/3">
                        <input 
                          required 
                          placeholder={t({ ID: 'Nomor Identitas', EN: 'Identity Number' })} 
                          inputMode={isLengthChecked ? 'numeric' : 'text'}
                          pattern={isLengthChecked ? '[0-9]*' : '[A-Za-z0-9]*'}
                          maxLength={isLengthChecked ? 16 : 20}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400"
                          value={pemesan.identitas} 
                          onChange={(e) => setPemesan({ ...pemesan, identitas: sanitizeIdentitas(e.target.value, pemesan.jenisIdentitas) })} 
                        />
                      </div>
                    </div>
                    {identitasHint && <p className="text-[11px] text-red-500 mt-1">{identitasHint}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">{t({ ID: 'Jenis Kelamin', EN: 'Gender' })} <span className="text-red-500">*</span></label>
                    <div className="flex flex-wrap gap-4">
                      <label className={`flex items-center gap-2 border rounded-lg px-4 py-2 cursor-pointer text-sm ${pemesan.jenisKelamin === 'Laki-laki' ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-gray-200 text-gray-600'}`}>
                        <input type="radio" name="jk_pemesan" value="Laki-laki" className="hidden" checked={pemesan.jenisKelamin === 'Laki-laki'} onChange={() => setPemesan({...pemesan, jenisKelamin: 'Laki-laki'})} />
                        <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${pemesan.jenisKelamin === 'Laki-laki' ? 'border-blue-500' : 'border-gray-300'}`}>
                          {pemesan.jenisKelamin === 'Laki-laki' && <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>}
                        </div>
                        {t({ ID: 'Laki-laki', EN: 'Male' })}
                      </label>
                      <label className={`flex items-center gap-2 border rounded-lg px-4 py-2 cursor-pointer text-sm ${pemesan.jenisKelamin === 'Perempuan' ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-gray-200 text-gray-600'}`}>
                        <input type="radio" name="jk_pemesan" value="Perempuan" className="hidden" checked={pemesan.jenisKelamin === 'Perempuan'} onChange={() => setPemesan({...pemesan, jenisKelamin: 'Perempuan'})} />
                        <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${pemesan.jenisKelamin === 'Perempuan' ? 'border-blue-500' : 'border-gray-300'}`}>
                          {pemesan.jenisKelamin === 'Perempuan' && <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>}
                        </div>
                        {t({ ID: 'Perempuan', EN: 'Female' })}
                      </label>
                    </div>
                  </div>

                  <Input label={t({ ID: 'Usia', EN: 'Age' })} type="text" inputMode="numeric" pattern="[0-9]*" maxLength={3} required value={pemesan.usia} onChange={(e) => setPemesan({ ...pemesan, usia: sanitizeUsia(e.target.value) })} />
                  <Input 
                    label={t({ ID: 'Email', EN: 'Email' })} 
                    type="email" 
                    required 
                    hint={t({ ID: 'Tiket akan dikirimkan ke email ini', EN: 'The ticket will be sent to this email' })}
                    value={pemesan.email} 
                    onChange={(e) => setPemesan({ ...pemesan, email: e.target.value })} 
                  />
<Input 
  label={t({ ID: 'Nomor WhatsApp', EN: 'WhatsApp Number' })} 
  required 
  type="tel"
  inputMode="tel"
  pattern="[0-9]*"
  maxLength={13}
  prefixIcon={<span className="text-gray-500 text-xs font-medium flex items-center gap-1">+62</span>}
  value={pemesan.whatsapp}
  onChange={(e) => setPemesan({ ...pemesan, whatsapp: sanitizeWhatsapp(e.target.value) })}
/>
                </div>
              </div>

              {/* Box 2: Pemilik Tiket */}
              <div className="border border-gray-200 rounded-xl p-4 sm:p-6 bg-white">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-semibold text-gray-900">{t({ ID: 'Pemilik Tiket', EN: 'Ticket Owner' })}</h3>
                  <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                    {t({ ID: 'Samakan seperti data pemesan', EN: 'Same as orderer details' })}
                    <div className={`w-9 h-5 rounded-full relative transition-colors ${isSameAsPemesan ? 'bg-blue-500' : 'bg-gray-200'}`}>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={isSameAsPemesan}
                        onChange={(e) => {
                          const on = e.target.checked
                          if (on) {
                            // Salin data pemesan ke pemilik tiket
                            setOwners(Array.from({ length: ownerCount }, () => ({ ...pemesan })))
                          } else {
                            // Saat dinonaktifkan: data pemesan yang sudah tersalin TETAP ADA di input form,
                            // tidak dihapus ke kosong, agar user tinggal mengganti bagian yang perlu diubah.
                            setOwners((prev) =>
                              Array.from({ length: ownerCount }, (_, i) => {
                                const current = prev[i]
                                if (current && current.nama && current.nama.trim().length > 0) {
                                  return { ...current }
                                }
                                return { ...pemesan }
                              })
                            )
                          }
                          setIsSameAsPemesan(on)
                        }}
                      />
                      <div className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform ${isSameAsPemesan ? 'translate-x-4' : 'translate-x-0'}`}></div>
                    </div>
                  </label>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-6">
                  <p className="text-[11px] text-blue-800 font-medium">{t({ ID: 'Nama Tiket', EN: 'Ticket Name' })}</p>
                  <p className="text-sm font-semibold text-blue-900 uppercase">{tiket ? tiket.kategori : 'REGULER - NORMAL'}</p>
                </div>

                {isSameAsPemesan ? (
                  <div className="flex items-center gap-2 text-xs text-gray-500 py-4">
                    <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    {t({ ID: 'Data pemilik tiket mengikuti data pemesan.', EN: 'Ticket owner details follow the orderer details.' })}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {owners.map((o, i) => (
                      <div key={i} className={i > 0 ? 'pt-6 border-t border-gray-100' : ''}>
                        <h4 className="font-semibold text-gray-900 mb-4">{t({ ID: 'Pemilik Tiket #{idx}', EN: 'Ticket Owner #{idx}' }).replace('{idx}', String(i + 1))}</h4>
                        {i > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleSyncWithPrev(i, !syncWithPrev[i])}
                            className={`w-full flex items-center justify-between rounded-lg border px-3 py-2.5 mb-4 text-sm transition ${syncWithPrev[i] ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                          >
                            <span className="text-xs font-medium">{t({ ID: 'Samakan dengan Pemilik #{prev}', EN: 'Same as Owner #{prev}' }).replace('{prev}', String(i))}</span>
                            <span className={`w-8 h-5 rounded-full relative transition ${syncWithPrev[i] ? 'bg-blue-500' : 'bg-gray-300'}`}>
                              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${syncWithPrev[i] ? 'left-3.5' : 'left-0.5'}`}></span>
                            </span>
                          </button>
                        )}
                        <div className="space-y-4">
                          <Input label={t({ ID: 'Nama Lengkap', EN: 'Full Name' })} required placeholder="" value={o.nama} onChange={(e) => updateOwner(i, { nama: e.target.value })} />

                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1.5">{t({ ID: 'Identitas', EN: 'Identity' })} <span className="text-red-500">*</span></label>
                            <div className="flex flex-col sm:flex-row gap-3">
                              <div className="w-full sm:w-1/3">
                                <Select options={['KTP', 'SIM', 'Kartu Pelajar', 'Paspor']} value={o.jenisIdentitas} onChange={(e) => {
                                  const jenisIdentitas = e.target.value as JenisIdentitas
                                  updateOwner(i, { jenisIdentitas, identitas: sanitizeIdentitas(o.identitas, jenisIdentitas) })
                                }} />
                              </div>
                              <div className="w-full sm:w-2/3">
                                <input
                                  required
                                  placeholder={t({ ID: 'Nomor Identitas', EN: 'Identity Number' })}
                                  inputMode={needs16DigitIdentity(o.jenisIdentitas) ? 'numeric' : 'text'}
                                  pattern={needs16DigitIdentity(o.jenisIdentitas) ? '[0-9]*' : '[A-Za-z0-9]*'}
                                  maxLength={needs16DigitIdentity(o.jenisIdentitas) ? 16 : 20}
                                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400"
                                  value={o.identitas}
                                  onChange={(e) => updateOwner(i, { identitas: sanitizeIdentitas(e.target.value, o.jenisIdentitas) })}
                                />
                              </div>
                            </div>
                            {needs16DigitIdentity(o.jenisIdentitas) && o.identitas.length > 0 && o.identitas.trim().length !== 16 && (
                              <p className="text-[11px] text-red-500 mt-1">{t({ ID: 'Nomor identitas harus 16 digit', EN: 'Identity number must be 16 digits' })}</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1.5">{t({ ID: 'Jenis Kelamin', EN: 'Gender' })} <span className="text-red-500">*</span></label>
                              <div className="flex flex-wrap gap-4">
                              {(['Laki-laki', 'Perempuan'] as const).map((jk) => {
                                const selected = o.jenisKelamin === jk
                                const jkLabel: Record<string, { ID: string; EN: string }> = {
                                  'Laki-laki': { ID: 'Laki-laki', EN: 'Male' },
                                  Perempuan: { ID: 'Perempuan', EN: 'Female' },
                                }
                                return (
                                  <label key={jk} className={`flex items-center gap-2 border rounded-lg px-4 py-2 cursor-pointer text-sm ${selected ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-gray-200 text-gray-600'}`}>
                                    <input type="radio" name={`jk_pemilik_${i}`} value={jk} className="hidden" checked={selected} onChange={() => updateOwner(i, { jenisKelamin: jk })} />
                                    <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${selected ? 'border-blue-500' : 'border-gray-300'}`}>
                                      {selected && <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>}
                                    </div>
                                    {t(jkLabel[jk])}
                                  </label>
                                )
                              })}
                            </div>
                          </div>

                          <Input label={t({ ID: 'Usia', EN: 'Age' })} type="text" inputMode="numeric" pattern="[0-9]*" maxLength={3} required value={o.usia} onChange={(e) => updateOwner(i, { usia: sanitizeUsia(e.target.value) })} />
                          <Input
                            label={t({ ID: 'Email', EN: 'Email' })}
                            type="email"
                            required
                            value={o.email}
                            onChange={(e) => updateOwner(i, { email: e.target.value })}
                          />
                          <Input
                            label={t({ ID: 'Nomor WhatsApp', EN: 'WhatsApp Number' })}
                            required
                            type="tel"
                            inputMode="tel"
                            pattern="[0-9]*"
                            maxLength={13}
                            prefixIcon={<span className="text-gray-500 text-xs font-medium">+62</span>}
                            value={o.whatsapp}
                            onChange={(e) => updateOwner(i, { whatsapp: sanitizeWhatsapp(e.target.value) })}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </form>
          </div>

          {/* KANAN: SIDEBAR RINGKASAN */}
          <div>
            <div className="border border-gray-200 rounded-xl p-5 lg:sticky lg:top-20 bg-white">
              <h3 className="font-semibold text-gray-900 mb-4">{t({ ID: 'Ringkasan Pesanan', EN: 'Order Summary' })}</h3>

              {tiket && (
                <div className="flex gap-3 pb-4 border-b border-gray-100">
                  <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-indigo-950 to-black shrink-0 relative overflow-hidden">
                    {tiket.event?.gambar ? (
                      <Image
                        src={tiket.event.gambar}
                        alt={tiket.event.nama_event}
                        fill
                        className="object-cover"
                        sizes="56px"
                      />
                    ) : null}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{tiket.event?.nama_event || '-'}</p>
                    <p className="text-xs text-gray-400">{tiket.event?.tanggal || '-'}</p>
                  </div>
                </div>
              )}

              <div className="space-y-1.5 text-sm py-4 border-b border-gray-100">
                {loadingTicket ? (
                  <div className="text-xs text-gray-400 flex items-center gap-2">{t({ ID: 'Memuat data tiket', EN: 'Loading ticket data' })}<span className="loading-dots"><span /></span></div>
                ) : error ? (
                  <div className="text-xs text-red-500">{error}</div>
                ) : tiket ? (
                  <>
                    <div className="flex justify-between text-gray-500"><span>{t({ ID: 'Kategori Tiket', EN: 'Ticket Category' })}</span><span className="text-gray-900 uppercase">{tiket.kategori} × {qtyParam}</span></div>
                    <div className="flex justify-between text-gray-500"><span>{t({ ID: 'Harga Satuan', EN: 'Unit Price' })}</span><span className="text-gray-900">Rp {Number(tiket.harga).toLocaleString('id-ID')}</span></div>
                    <div className="flex justify-between text-gray-500"><span>{t({ ID: 'Biaya Admin (4%)', EN: 'Admin Fee (4%)' })}</span><span className="text-gray-900">Rp {adminFee.toLocaleString('id-ID')}</span></div>
                    {/* Diskon muncul kalau voucher aktif */}
                    {isVoucherApplied && (
                      <div className="flex justify-between text-green-600 font-medium pt-1">
                        <span>{t({ ID: 'Diskon Voucher', EN: 'Voucher Discount' })}</span>
                        <span>- Rp {discount.toLocaleString('id-ID')}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-xs text-gray-400">{t({ ID: 'Pilih tiket terlebih dahulu.', EN: 'Please choose a ticket first.' })}</div>
                )}
              </div>

              {/* Form Input Voucher */}
              <div className="py-4 border-b border-gray-100">
                <label className="block text-xs font-medium text-gray-700 mb-2">{t({ ID: 'Kode Promo / Voucher', EN: 'Promo / Voucher Code' })}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={t({ ID: 'Masukkan kode promo', EN: 'Enter promo code' })}
                    value={voucherCode}
                    onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                    disabled={isVoucherApplied}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400 disabled:bg-gray-100 disabled:text-gray-500"
                  />
                  {isVoucherApplied ? (
                    <button type="button" onClick={handleRemoveVoucher} className="px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors">
                      {t({ ID: 'Hapus', EN: 'Remove' })}
                    </button>
                  ) : (
                    <button type="button" onClick={handleApplyVoucher} disabled={isValidatingVoucher} className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-lg text-sm font-medium transition-colors disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed">
                      {isValidatingVoucher ? <>{t({ ID: 'Memeriksa', EN: 'Checking' })}<LoadingDots /></> : t({ ID: 'Pakai', EN: 'Apply' })}
                    </button>
                  )}
                </div>
                {voucherError && <p className="text-[11px] text-red-500 mt-1.5">{voucherError}</p>}
                {isVoucherApplied && <p className="text-[11px] text-green-600 mt-1.5">{t({ ID: 'Voucher berhasil digunakan', EN: 'Voucher applied successfully' })}</p>}
              </div>

              <div className="flex justify-between items-center py-4">
                <span className="text-sm font-medium text-gray-900">{t({ ID: 'Total Pembayaran', EN: 'Total Payment' })}</span>
                <span className="text-lg font-bold text-gray-900">Rp {total.toLocaleString('id-ID')}</span>
              </div>
              
              <button
                type="submit"
                form="checkout-form"
                disabled={isExpired || submitting || !tiket}
                className="block w-full text-center bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-medium py-3 rounded-lg disabled:from-gray-200 disabled:to-gray-200 disabled:cursor-not-allowed disabled:text-gray-500 transition-colors"
              >
                {submitting ? <>{t({ ID: 'Menyimpan', EN: 'Saving' })}<LoadingDots /></> : isExpired ? t({ ID: 'Waktu Habis', EN: 'Time Expired' }) : t({ ID: 'Lanjutkan Pembayaran →', EN: 'Continue to Payment →' })}
              </button>
              
              <p className="text-[11px] text-gray-400 mt-2 text-center">
                {t({ ID: 'Dengan melanjutkan, kamu menyetujui', EN: 'By continuing, you agree to' })} <button type="button" onClick={() => setShowTerms(true)} className="underline">{t({ ID: 'Syarat & Ketentuan', EN: 'Terms & Conditions' })}</button>.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky bottom bar HP: total + lanjut bayar */}
      <StickyBottomBar
        label={t({ ID: 'Total Pembayaran', EN: 'Total Payment' })}
        value={`Rp ${total.toLocaleString('id-ID')}`}
      >
        <button
          type="submit"
          form="checkout-form"
          disabled={isExpired || submitting || !tiket}
          className="inline-flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-medium px-6 py-3 rounded-full disabled:from-gray-200 disabled:to-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed"
        >
          {submitting ? t({ ID: 'Menyimpan...', EN: 'Saving...' }) : isExpired ? t({ ID: 'Waktu Habis', EN: 'Time Expired' }) : t({ ID: 'Lanjut Bayar →', EN: 'Pay →' })}
        </button>
      </StickyBottomBar>

      <PaymentStatusModal
        open={isExpired}
        tone="warning"
        title={t({ ID: 'Waktu Habis', EN: 'Time Expired' })}
        message={t({ ID: 'Waktu 10 menit untuk mengisi data telah habis. Silakan mulai pemesanan ulang.', EN: 'The 10-minute window to fill in your data has expired. Please start a new booking.' })}
        actionLabel={t({ ID: 'Ulangi Pesanan', EN: 'Repeat Order' })}
        onAction={() => router.push('/tiket')}
      />
      <TermsModal open={showTerms} onClose={() => setShowTerms(false)} />
    </>
  )
}