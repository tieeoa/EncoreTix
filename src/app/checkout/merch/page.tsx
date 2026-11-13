'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { usePaymentCountdown, clearPaymentCountdown } from '../../lib/paymentTimer'
import PaymentTimerBanner from '@/components/PaymentTimerBanner'
import PaymentStatusModal from '@/components/PaymentStatusModal'
import StickyBottomBar from '@/components/StickyBottomBar'
import LoadingSpinner from '@/components/LoadingSpinner'
import LoadingDots from '@/components/LoadingDots'
import { useLang } from '@/lib/i18n'
import { friendlyError } from '@/app/lib/fetchError'
import { readStoredCart, clearStoredCart } from '@/app/lib/merchCart'

const MERCH_SIZES_ARR = ['S', 'M', 'L', 'XL', 'XXL'] as const
const ADMIN_FEE_RATE = 0.04
const KECAMATAN_KOTA_MALANG = ['Klojen', 'Blimbing', 'Kedungkandang', 'Lowokwaru', 'Sukun']
const KELURAHAN_KOTA_MALANG: Record<string, string> = {
  Arjosari: 'Blimbing',
  Balearjosari: 'Blimbing',
  Blimbing: 'Blimbing',
  Bunulrejo: 'Blimbing',
  Jodipan: 'Blimbing',
  Kesatrian: 'Blimbing',
  Pandanwangi: 'Blimbing',
  Polehan: 'Blimbing',
  Polowijen: 'Blimbing',
  Purwantoro: 'Blimbing',
  Purwodadi: 'Blimbing',
  Arjowinangun: 'Kedungkandang',
  Bumiayu: 'Kedungkandang',
  Buring: 'Kedungkandang',
  Cemorokandang: 'Kedungkandang',
  Kedungkandang: 'Kedungkandang',
  Kotalama: 'Kedungkandang',
  Lesanpuro: 'Kedungkandang',
  Madyopuro: 'Kedungkandang',
  Mergosono: 'Kedungkandang',
  Sawojajar: 'Kedungkandang',
  Tlogowaru: 'Kedungkandang',
  Wonokoyo: 'Kedungkandang',
  Bareng: 'Klojen',
  Gadingkasri: 'Klojen',
  Kasin: 'Klojen',
  Kauman: 'Klojen',
  Kiduldalem: 'Klojen',
  Klojen: 'Klojen',
  'Oro-Oro Dowo': 'Klojen',
  Penanggungan: 'Klojen',
  'Rampal Celaket': 'Klojen',
  Samaan: 'Klojen',
  Sukoharjo: 'Klojen',
  Dinoyo: 'Lowokwaru',
  Jatimulyo: 'Lowokwaru',
  Ketawanggede: 'Lowokwaru',
  Lowokwaru: 'Lowokwaru',
  Merjosari: 'Lowokwaru',
  Mojolangu: 'Lowokwaru',
  Sumbersari: 'Lowokwaru',
  Tasikmadu: 'Lowokwaru',
  Tlogomas: 'Lowokwaru',
  Tulusrejo: 'Lowokwaru',
  Tunggulwulung: 'Lowokwaru',
  Tunjungsekar: 'Lowokwaru',
  Bakalankrajan: 'Sukun',
  Bandulan: 'Sukun',
  Bandungrejosari: 'Sukun',
  Ciptomulyo: 'Sukun',
  Gadang: 'Sukun',
  Karangbesuki: 'Sukun',
  Kebonsari: 'Sukun',
  Mulyorejo: 'Sukun',
  Pisangcandi: 'Sukun',
  Sukun: 'Sukun',
  Tanjungrejo: 'Sukun',
}
const KELURAHAN_BY_KECAMATAN: Record<string, string[]> = Object.fromEntries(
  KECAMATAN_KOTA_MALANG.map((kec) => [
    kec,
    Object.entries(KELURAHAN_KOTA_MALANG)
      .filter(([, k]) => k === kec)
      .map(([kel]) => kel),
  ])
)
const NORMALIZE_ADDR = (s: string) => s.toLowerCase().replace(/[\s\-']/g, '')
const IDENTITAS_OPTIONS = ['KTP', 'SIM', 'Kartu Pelajar', 'Paspor']

const FORM_STORAGE_KEY = 'encoretix_checkout_merch_data'

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

function formatRupiah(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID')
}

function validatePemesan(p: PemesanData, t: (x: { ID: string; EN: string }) => string): string {
  const msg = (id: string, en: string) => t({ ID: id, EN: en })

  if (p.nama.trim().length < 2) {
    return msg('Nama lengkap wajib diisi.', 'Full name is required.')
  }
  const ident = p.identitas.trim()
  const isLengthChecked = p.jenisIdentitas === 'KTP' || p.jenisIdentitas === 'SIM'
  if (isLengthChecked) {
    if (!/^\d{16}$/.test(ident)) {
      return msg(
        `Nomor identitas ${p.jenisIdentitas} harus 16 digit angka.`,
        `Your ${p.jenisIdentitas} number must be 16 digits.`
      )
    }
  } else if (ident.length < 4) {
    return msg(
      `Nomor identitas ${p.jenisIdentitas} tidak valid.`,
      `Your ${p.jenisIdentitas} number is invalid.`
    )
  }
  const usia = Number(p.usia)
  if (!Number.isInteger(usia) || usia < 1 || usia > 120) {
    return msg(
      'Usia tidak valid. Masukkan angka antara 1-120.',
      'Invalid age. Enter a number between 1-120.'
    )
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email.trim())) {
    return msg('Format email tidak valid.', 'Invalid email format.')
  }
  const wa = p.whatsapp.replace(/[\s-]/g, '')
  // Terima: 81234567890, +6281234567890, 081234567890
  if (!/^(?:(?:\+?62|0)8\d{8,11}|8\d{8,11})$/.test(wa)) {
    return msg(
      'Nomor WhatsApp tidak valid. Contoh: 81234567890, 081234567890, atau +6281234567890.',
      'Invalid WhatsApp number. e.g. 81234567890.'
    )
  }
  if (!p.kecamatan) {
    return msg('Pilih kecamatan terlebih dahulu.', 'Please choose a sub-district first.')
  }
  if (!p.kelurahan) {
    return msg('Pilih kelurahan terlebih dahulu.', 'Please choose a village first.')
  }
  const addrNormalized = NORMALIZE_ADDR(p.alamat)
  if (addrNormalized.length < 5) {
    return msg(
      'Detail alamat terlalu pendek. Periksa kembali alamat kamu.',
      'Address detail is too short. Please check your address.'
    )
  }
  const conflict = Object.entries(KELURAHAN_KOTA_MALANG).find(
    ([kel, kec]) => kec !== p.kecamatan && addrNormalized.includes(NORMALIZE_ADDR(kel))
  )
  if (conflict) {
    const [kel, kec] = conflict
    return msg(
      `Alamat mengindikasikan Kelurahan ${kel} yang berada di Kecamatan ${kec}, tidak sesuai dengan kecamatan yang dipilih (${p.kecamatan}). Periksa kembali alamat kamu.`,
      `The address indicates ${kel} village, which is in ${kec} sub-district, not the selected sub-district (${p.kecamatan}). Please check your address again.`
    )
  }
  return ''
}

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
      {hint && <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1">{hint}</p>}
    </div>
  )
}

function Select({ label, required, options, ...props }: { label?: string; required?: boolean; options: string[] } & React.SelectHTMLAttributes<HTMLSelectElement>) {
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

interface MerchProduct {
  id: string
  nama_merch: string
  foto: string[] | null
  harga: number
  kategori: string | null
  status: string
  stok_s: number
  stok_m: number
  stok_l: number
  stok_xl: number
  stok_xxl: number
  sisa_stok?: Record<string, number>
  event: { nama_event: string; tanggal: string; jam: string; lokasi: string; gambar: string | null } | null
}

interface CartLine {
  key: string
  id_merch: string
  ukuran: string
  jumlah: number
}

interface PemesanData {
  nama: string
  identitas: string
  jenisIdentitas: string
  usia: string
  jenisKelamin: 'Laki-laki' | 'Perempuan'
  email: string
  whatsapp: string
  kecamatan: string
  kelurahan: string
  alamat: string
}

const EMPTY_PEMESAN: PemesanData = {
  nama: '',
  identitas: '',
  jenisIdentitas: 'KTP',
  usia: '',
  jenisKelamin: 'Laki-laki',
  email: '',
  whatsapp: '',
  kecamatan: '',
  kelurahan: '',
  alamat: '',
}

function newLineKey() {
  return Math.random().toString(36).slice(2)
}

function firstAvailableSize(product: MerchProduct | undefined): string {
  if (!product) return ''
  for (const s of MERCH_SIZES_ARR) {
    if ((product.sisa_stok?.[s] ?? 0) > 0) return s
  }
  return ''
}

export default function MerchCheckout() {
  const { t } = useLang()
  return (
    <Suspense fallback={<LoadingSpinner label={t({ ID: 'Memuat detail pemesanan', EN: 'Loading order details' })} />}>
      <MerchCheckoutContent />
    </Suspense>
  )
}

function MerchCheckoutContent() {
  const router = useRouter()
  const { t } = useLang()
  const searchParams = useSearchParams()
  const merchId = searchParams.get('id') || ''
  const qtyParam = Math.max(1, Number(searchParams.get('qty')) || 1)
  const sizeParam = (searchParams.get('size') || '').toUpperCase()

  const [products, setProducts] = useState<MerchProduct[]>([])
  const [lines, setLines] = useState<CartLine[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const { remaining, isExpired } = usePaymentCountdown(false, false)

  const [isRestored, setIsRestored] = useState(false)

  const handleBack = () => {
    clearPaymentCountdown()
    safeRemoveStorage(FORM_STORAGE_KEY)
    router.back()
  }

  const [pemesan, setPemesan] = useState<PemesanData>(EMPTY_PEMESAN)

  useEffect(() => {
    try {
      const saved = safeGetStorage(FORM_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed && typeof parsed === 'object') {
          if (parsed.pemesan) {
            setPemesan((prev) => ({ ...prev, ...parsed.pemesan }))
          }
          if (Array.isArray(parsed.lines) && parsed.lines.length > 0) {
            setLines(parsed.lines)
          }
        }
      }
    } catch {}
    setIsRestored(true)
  }, [])

  useEffect(() => {
    if (!isRestored) return
    safeSetStorage(FORM_STORAGE_KEY, JSON.stringify({ pemesan, lines }))
  }, [isRestored, pemesan, lines])

  useEffect(() => {
    fetch('/api/merchandise')
      .then((r) => r.json())
      .then((res) => {
        if (res.error) throw new Error(res.error)
        const aktif = (res.data as MerchProduct[]).filter((p) => p.status !== 'nonaktif')
        setProducts(aktif)
        if (aktif.length === 0) {
          setError(t({ ID: 'Belum ada merchandise yang tersedia.', EN: 'No merchandise available yet.' }))
        }
        return aktif
      })
      .then((aktif) => {
        // Prioritas: isi dari keranjang (localStorage) bila ada item.
        const stored = readStoredCart()
        if (stored.length > 0) {
          const valid = stored.filter((c) => aktif.some((p) => p.id === c.id_merch))
          setLines(
            valid.length > 0
              ? valid.map((c) => ({
                  key: newLineKey(),
                  id_merch: c.id_merch,
                  ukuran: c.ukuran,
                  jumlah: c.jumlah,
                }))
              : aktiveDefaultLines(aktif)
          )
          return
        }
        // Isi awal: dari ?id=&size=&qty= bila ada, selain itu satu baris kosong.
        const product = merchId ? aktif.find((p) => p.id === merchId) : undefined
        const wantedSize = product && MERCH_SIZES_ARR.includes(sizeParam as (typeof MERCH_SIZES_ARR)[number])
          ? sizeParam
          : ''
        const fits =
          wantedSize && Number(product?.sisa_stok?.[wantedSize] ?? 0) > 0 ? wantedSize : firstAvailableSize(product)
        const initial: CartLine[] = product
          ? [{ key: newLineKey(), id_merch: merchId, ukuran: fits, jumlah: qtyParam }]
          : aktiveDefaultLines(aktif)
        setLines(initial)
      })
      .catch((e) => setError(friendlyError(e)))
      .finally(() => setLoading(false))
  }, [merchId, qtyParam, sizeParam, t])

  const lineProduct = (line: CartLine) => products.find((p) => p.id === line.id_merch)

  const subtotal = lines.reduce((acc, line) => {
    const p = lineProduct(line)
    return acc + Number(p?.harga ?? 0) * line.jumlah
  }, 0)
  const adminFee = Math.round(subtotal * ADMIN_FEE_RATE)
  const total = subtotal + adminFee

  const isLengthChecked = pemesan.jenisIdentitas === 'KTP' || pemesan.jenisIdentitas === 'SIM'
  const identitasHint =
    isLengthChecked && pemesan.identitas.length > 0 && pemesan.identitas.trim().length !== 16
      ? `Nomor identitas ${pemesan.jenisIdentitas} harus 16 digit`
      : ''

  const updateLine = (key: string, patch: Partial<CartLine>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  const removeLine = (key: string) => {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (lines.length === 0) {
      setError(t({ ID: 'Tambahkan minimal satu merchandise.', EN: 'Add at least one merchandise item.' }))
      return
    }
    const validationError = validatePemesan(pemesan, t)
    if (validationError) {
      setError(validationError)
      return
    }
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const p = lineProduct(line)
      if (!p) {
        setError(t({ ID: `Item ke-${i + 1} tidak valid.`, EN: `Item ${i + 1} is invalid.` }))
        return
      }
      const sisa = p.sisa_stok?.[line.ukuran] ?? 0
      if (!line.ukuran) {
        setError(t({ ID: `Item ke-${i + 1}: pilih ukuran.`, EN: `Item ${i + 1}: choose a size.` }))
        return
      }
      if (sisa <= 0 || line.jumlah > sisa) {
        setError(t({
          ID: `Item ${p.nama_merch} (${line.ukuran}): stok tidak mencukupi (sisa ${sisa}).`,
          EN: `Item ${p.nama_merch} (${line.ukuran}): not enough stock (left ${sisa}).`,
        }))
        return
      }
    }
    const alamatLengkap = [
      pemesan.kecamatan ? `Kec. ${pemesan.kecamatan}` : '',
      pemesan.kelurahan ? `Kel. ${pemesan.kelurahan}` : '',
      pemesan.alamat.trim(),
      'Kota Malang',
    ]
      .filter(Boolean)
      .join(', ')

    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/merch/orders', {
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
          alamat: alamatLengkap,
          items: lines.map((l) => ({ id_merch: l.id_merch, ukuran: l.ukuran, jumlah: l.jumlah })),
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || t({ ID: 'Gagal membuat pesanan', EN: 'Failed to create order' }))
      // Catatan: FORM_STORAGE_KEY sengaja TIDAK dihapus di sini agar jika pemesan
      // menekan tombol 'Kembali' dari halaman pembayaran, isian form tidak hilang.
      clearStoredCart()
      router.push(`/payment/merch?booking=${encodeURIComponent(result.data.kode_pesanan)}`)
    } catch (err) {
      setError(friendlyError(err))
      setSubmitting(false)
    }
  }

  if (loading) {
    return <LoadingSpinner label={t({ ID: 'Memuat produk merchandise', EN: 'Loading merchandise' })} />
  }

  return (
    <>
      <PaymentTimerBanner remaining={remaining} label={t({ ID: 'Sisa waktu untuk memesan merchandise', EN: 'Time left to order merchandise' })} />

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
            <form id="merch-checkout-form" onSubmit={handleSubmit} className="space-y-6">
              {/* Box 1: Pilih Merchandise */}
              <div className="border border-gray-200 rounded-xl p-4 sm:p-6 bg-white">
                <h3 className="font-semibold text-gray-900 mb-6">{t({ ID: 'Item', EN: 'Item' })}</h3>

                {error && lines.length > 0 && (
                  <p className="text-xs text-red-500 mb-4">{error}</p>
                )}

                <div className="space-y-4">
                  {lines.map((line, i) => {
                    const product = lineProduct(line)
                    const availableSizes = MERCH_SIZES_ARR.filter((s) => (product?.sisa_stok?.[s] ?? 0) > 0)
                    return (
                      <div key={line.key} className="border border-gray-100 rounded-xl p-4 bg-gray-50/50">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                            {t({ ID: 'Item', EN: 'Item' })} {i + 1}
                          </p>
                          <button
                            type="button"
                            onClick={() => removeLine(line.key)}
                            disabled={lines.length <= 1}
                            className="text-[11px] font-medium text-red-500 hover:text-red-700 disabled:opacity-40"
                          >
                            ✕ {t({ ID: 'Hapus', EN: 'Remove' })}
                          </button>
                        </div>

                        <div className="grid grid-cols-12 gap-2 items-end">
                          <div className="col-span-12 sm:col-span-6">
                            <label className="block text-xs font-medium text-gray-600 mb-1.5">
                              {t({ ID: 'Produk', EN: 'Product' })} <span className="text-red-500">*</span>
                            </label>
                            <select
                              required
                              value={line.id_merch}
                              onChange={(e) => {
                                const next = products.find((p) => p.id === e.target.value)
                                updateLine(line.key, {
                                  id_merch: e.target.value,
                                  ukuran: firstAvailableSize(next),
                                  jumlah: 1,
                                })
                              }}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-gray-400"
                            >
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.nama_merch} — {formatRupiah(Number(p.harga))}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="col-span-6 sm:col-span-2">
                            <label className="block text-xs font-medium text-gray-600 mb-1.5">
                              {t({ ID: 'Ukuran', EN: 'Size' })} <span className="text-red-500">*</span>
                            </label>
                            <select
                              required
                              value={line.ukuran}
                              onChange={(e) => updateLine(line.key, { ukuran: e.target.value, jumlah: 1 })}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-gray-400"
                            >
                              <option value="" disabled>{t({ ID: 'Ukuran', EN: 'Size' })}</option>
                              {availableSizes.map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </div>
                          <div className="col-span-6 sm:col-span-2">
                            <label className="block text-xs font-medium text-gray-600 mb-1.5">
                              {t({ ID: 'Jumlah', EN: 'Qty' })} <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={product?.sisa_stok?.[line.ukuran] ?? 99}
                              value={line.jumlah}
                              onChange={(e) =>
                                updateLine(line.key, { jumlah: Math.max(1, Number(e.target.value) || 1) })
                              }
                              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-gray-400"
                            />
                          </div>
                          <div className="col-span-12 sm:col-span-2 sm:text-right">
                            <p className="text-xs text-gray-400 mb-1.5">{t({ ID: 'Subtotal', EN: 'Subtotal' })}</p>
                            <p className="text-sm font-semibold text-gray-900 break-words">
                              {formatRupiah(Number(product?.harga ?? 0) * line.jumlah)}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-1">
                              {t({ ID: 'Sisa', EN: 'Left' })}: {product?.sisa_stok?.[line.ukuran] ?? 0}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Box 2: Data Pemesan */}
              <div className="border border-gray-200 rounded-xl p-4 sm:p-6 bg-white">
                <h3 className="font-semibold text-gray-900 mb-6">{t({ ID: 'Data Pemesan', EN: 'Orderer Details' })}</h3>
                <div className="space-y-4">
                  <Input label={t({ ID: 'Nama Lengkap', EN: 'Full Name' })} required placeholder="" value={pemesan.nama} onChange={(e) => setPemesan({ ...pemesan, nama: e.target.value })} />

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">{t({ ID: 'Identitas', EN: 'Identity' })} <span className="text-red-500">*</span></label>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="w-full sm:w-1/3">
                        <Select options={IDENTITAS_OPTIONS} value={pemesan.jenisIdentitas} onChange={(e) => setPemesan({ ...pemesan, jenisIdentitas: e.target.value })} />
                      </div>
                      <div className="w-full sm:w-2/3">
                        <input
                          required
                          placeholder={t({ ID: 'Nomor Identitas', EN: 'Identity Number' })}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400"
                          value={pemesan.identitas}
                          onChange={(e) => setPemesan({ ...pemesan, identitas: e.target.value })}
                        />
                      </div>
                    </div>
                    {identitasHint && <p className="text-[11px] text-red-500 mt-1">⚠️ {identitasHint}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">{t({ ID: 'Jenis Kelamin', EN: 'Gender' })} <span className="text-red-500">*</span></label>
                    <div className="flex flex-wrap gap-4">
                      <label className={`flex items-center gap-2 border rounded-lg px-4 py-2 cursor-pointer text-sm ${pemesan.jenisKelamin === 'Laki-laki' ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-gray-200 text-gray-600'}`}>
                        <input type="radio" name="jk_merch" value="Laki-laki" className="hidden" checked={pemesan.jenisKelamin === 'Laki-laki'} onChange={() => setPemesan({ ...pemesan, jenisKelamin: 'Laki-laki' })} />
                        <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${pemesan.jenisKelamin === 'Laki-laki' ? 'border-blue-500' : 'border-gray-300'}`}>
                          {pemesan.jenisKelamin === 'Laki-laki' && <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>}
                        </div>
                        {t({ ID: 'Laki-laki', EN: 'Male' })}
                      </label>
                      <label className={`flex items-center gap-2 border rounded-lg px-4 py-2 cursor-pointer text-sm ${pemesan.jenisKelamin === 'Perempuan' ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-gray-200 text-gray-600'}`}>
                        <input type="radio" name="jk_merch" value="Perempuan" className="hidden" checked={pemesan.jenisKelamin === 'Perempuan'} onChange={() => setPemesan({ ...pemesan, jenisKelamin: 'Perempuan' })} />
                        <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${pemesan.jenisKelamin === 'Perempuan' ? 'border-blue-500' : 'border-gray-300'}`}>
                          {pemesan.jenisKelamin === 'Perempuan' && <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>}
                        </div>
                        {t({ ID: 'Perempuan', EN: 'Female' })}
                      </label>
                    </div>
                  </div>

                  <Input label={t({ ID: 'Usia', EN: 'Age' })} type="number" required value={pemesan.usia} onChange={(e) => setPemesan({ ...pemesan, usia: e.target.value })} />
                  <Input
                    label={t({ ID: 'Email', EN: 'Email' })}
                    type="email"
                    required
                    hint={<><span>ℹ️</span> {t({ ID: 'Bukti pembelian akan dikirimkan ke email ini', EN: 'Purchase proof will be sent to this email' })}</>}
                    value={pemesan.email}
                    onChange={(e) => setPemesan({ ...pemesan, email: e.target.value })}
                  />
<Input
  label={t({ ID: 'Nomor WhatsApp', EN: 'WhatsApp Number' })}
  required
  type="tel"
  prefixIcon={<span className="text-gray-500 text-xs font-medium flex items-center gap-1"><span className="text-red-500">🇮🇩</span> +62</span>}
  value={pemesan.whatsapp}
  onChange={(e) => setPemesan({ ...pemesan, whatsapp: e.target.value })}
/>
                </div>
              </div>

              {/* Box 3: Alamat */}
              <div className="border border-gray-200 rounded-xl p-4 sm:p-6 bg-white">
                <h3 className="font-semibold text-gray-900 mb-6">{t({ ID: 'Alamat', EN: 'Address' })}</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">{t({ ID: 'Kecamatan (Kota Malang)', EN: 'Sub-district (Malang City)' })} <span className="text-red-500">*</span></label>
                    <select
                      required
                      value={pemesan.kecamatan}
                      onChange={(e) => setPemesan({ ...pemesan, kecamatan: e.target.value, kelurahan: '' })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-gray-400"
                    >
                      <option value="" disabled>{t({ ID: 'Pilih kecamatan', EN: 'Choose sub-district' })}</option>
                      {KECAMATAN_KOTA_MALANG.map((k) => (
                        <option key={k} value={k}>{k}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">{t({ ID: 'Kelurahan', EN: 'Village' })} <span className="text-red-500">*</span></label>
                    <select
                      required
                      value={pemesan.kelurahan}
                      disabled={!pemesan.kecamatan}
                      onChange={(e) => setPemesan({ ...pemesan, kelurahan: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-gray-400 disabled:bg-gray-100 disabled:text-gray-500"
                    >
                      <option value="" disabled>{pemesan.kecamatan ? t({ ID: 'Pilih kelurahan', EN: 'Choose village' }) : t({ ID: 'Pilih kecamatan dulu', EN: 'Choose sub-district first' })}</option>
                      {(KELURAHAN_BY_KECAMATAN[pemesan.kecamatan] || []).map((kel) => (
                        <option key={kel} value={kel}>{kel}</option>
                      ))}
                    </select>
                  </div>

                  <Input label={t({ ID: 'Detail Alamat (Jalan, No, Patokan)', EN: 'Address Detail (Street, No, Landmark)' })} required placeholder={t({ ID: 'Contoh: Jl. Soekarno Hatta No. 8, dekat Taman Rekreasi', EN: 'e.g. Jl. Soekarno Hatta No. 8, near the city park' })} value={pemesan.alamat} onChange={(e) => setPemesan({ ...pemesan, alamat: e.target.value })} />
                  <p className="text-[11px] text-gray-400 -mt-2">{t({ ID: 'Penjualan hanya berlaku di area Kota Malang', EN: 'Sales are only available within Malang City' })}</p>
                </div>
              </div>
            </form>
          </div>

          {/* KANAN: SIDEBAR RINGKASAN */}
          <div>
            <div className="border border-gray-200 rounded-xl p-5 lg:sticky lg:top-20 bg-white">
              <h3 className="font-semibold text-gray-900 mb-4">{t({ ID: 'Ringkasan Pesanan', EN: 'Order Summary' })}</h3>

              <div className="space-y-1.5 text-sm py-4 border-b border-gray-100">
                {lines.length === 0 ? (
                  <div className="text-xs text-gray-400">{t({ ID: 'Belum ada item dipilih.', EN: 'No items selected yet.' })}</div>
                ) : (
                  lines.map((line, i) => {
                    const p = lineProduct(line)
                    return (
                      <div key={line.key} className="flex justify-between gap-2 text-gray-500">
                        <span className="min-w-0 truncate">
                          {i + 1}. {p?.nama_merch || '-'}
                          {line.ukuran && <span className="text-gray-400"> ({line.ukuran})</span>} × {line.jumlah}
                        </span>
                        <span className="text-gray-900 whitespace-nowrap">{formatRupiah(Number(p?.harga ?? 0) * line.jumlah)}</span>
                      </div>
                    )
                  })
                )}
                <div className="flex justify-between text-gray-500 pt-2">
                  <span>{t({ ID: 'Biaya Admin (4%)', EN: 'Admin Fee (4%)' })}</span>
                  <span className="text-gray-900">{formatRupiah(adminFee)}</span>
                </div>
              </div>

              <div className="flex justify-between items-center py-4">
                <span className="text-sm font-medium text-gray-900">{t({ ID: 'Total Pembayaran', EN: 'Total Payment' })}</span>
                <span className="text-lg font-bold text-gray-900">{formatRupiah(total)}</span>
              </div>

              <button
                type="submit"
                form="merch-checkout-form"
                disabled={isExpired || submitting || lines.length === 0}
                className="block w-full text-center bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-medium py-3 rounded-lg disabled:from-gray-200 disabled:to-gray-200 disabled:cursor-not-allowed disabled:text-gray-500 transition-colors"
              >
                {submitting ? <>{t({ ID: 'Menyimpan', EN: 'Saving' })}<LoadingDots /></> : isExpired ? t({ ID: 'Waktu Habis', EN: 'Time Expired' }) : t({ ID: 'Lanjutkan Pembayaran →', EN: 'Continue to Payment →' })}
              </button>

              <p className="text-[11px] text-gray-400 mt-2 text-center">
                {t({ ID: 'Dengan melanjutkan, kamu menyetujui', EN: 'By continuing, you agree to' })} <span className="underline">{t({ ID: 'Syarat & Ketentuan', EN: 'Terms & Conditions' })}</span>.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky bottom bar HP: total + lanjut bayar */}
      <StickyBottomBar
        label={t({ ID: 'Total Pembayaran', EN: 'Total Payment' })}
        value={formatRupiah(total)}
      >
        <button
          type="submit"
          form="merch-checkout-form"
          disabled={isExpired || submitting || lines.length === 0}
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
        onAction={() => router.push('/merchandise')}
      />
    </>
  )
}

function aktiveDefaultLines(aktif: MerchProduct[]): CartLine[] {
  const p = aktif[0]
  if (!p) return []
  return [{ key: newLineKey(), id_merch: p.id, ukuran: firstAvailableSize(p), jumlah: 1 }]
}