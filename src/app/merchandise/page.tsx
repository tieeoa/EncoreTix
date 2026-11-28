'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/i18n'
import { MERCH_SIZES, FREE_SIZE, isFreeSizeProduct } from '@/app/lib/merchStok'
import { friendlyError } from '@/app/lib/fetchError'
import { MerchCartProvider, CartFab, useMerchCart } from '@/app/lib/merchCart'
import { clearMerchCheckoutDraft } from '@/app/lib/merchCheckoutDraft'

interface MerchItem {
  id: string
  nama_merch: string
  foto: string[] | null
  harga: number
  kategori: string | null
  status: string
  sisa_stok: Record<string, number>
  band: { id: string; nama_band: string; gambar: string | null; deskripsi: string | null } | null
}

interface Band {
  id: string
  nama_band: string
  gambar: string | null
}

interface SectionItem {
  p: MerchItem
  delay: number
}

interface Section {
  id: string
  nama_band: string
  gambar: string | null
  items: SectionItem[]
}

function formatRupiah(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID')
}

// Kartu produk merch. Animasi masuk via .merch-card-enter + delay bertingkat.
function MerchCard({ p, delay, onBuy, paused = false }: { p: MerchItem; delay: number; onBuy?: (p: MerchItem) => void; paused?: boolean }) {
  const { t } = useLang()
  const inactive = p.status === 'nonaktif'
  const isFree = isFreeSizeProduct(p as unknown as Record<string, unknown>)
  const soldOut = isFree
    ? (p.sisa_stok?.[FREE_SIZE] ?? 0) <= 0
    : MERCH_SIZES.reduce((acc, s) => acc + (p.sisa_stok?.[s] ?? 0), 0) <= 0
  return (
    <Link
      href={`/merchandise/${p.id}`}
      style={{ animationDelay: `${delay}ms` }}
      className="merch-card-enter group rounded-2xl border border-gray-200 bg-white overflow-hidden flex flex-col shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
    >
      <div className="h-48 bg-gradient-to-br from-indigo-950 to-black relative flex items-center justify-center overflow-hidden">
        {p.foto?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.foto[0]}
            alt={p.nama_merch}
            className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 group-hover:scale-110 ${
              inactive ? 'grayscale group-hover:grayscale-0' : soldOut ? 'grayscale' : ''
            }`}
          />
        ) : (
          <div className="text-5xl opacity-30">👕</div>
        )}
        {soldOut && (
          <span className="absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-700/80 text-gray-200">
            {t({ ID: 'Sold Out', EN: 'Sold Out' })}
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/40 to-transparent" />
      </div>
      <div className="p-3.5 flex-1 flex flex-col">
        <p className="text-[11px] text-gray-400 mb-0.5">
          {p.kategori || t({ ID: 'Merchandise', EN: 'Merchandise' })}
          {p.band?.nama_band && <span> · {p.band.nama_band}</span>}
        </p>
        <p className={`text-sm font-semibold leading-tight ${inactive || soldOut ? 'text-gray-400' : 'text-gray-900'}`}>
          {p.nama_merch}
        </p>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-1 pt-2.5 mt-3 border-t border-gray-100">
          <span className={`text-sm font-bold ${inactive || soldOut ? 'text-gray-400' : 'text-gray-900'}`}>
            {formatRupiah(Number(p.harga))}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onBuy?.(p)
            }}
            disabled={inactive || soldOut || paused}
            title={t({ ID: 'Masukkan Keranjang', EN: 'Add to Cart' })}
            aria-label={t({ ID: 'Masukkan Keranjang', EN: 'Add to Cart' })}
            className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-indigo-600 text-white hover:bg-indigo-500 active:scale-95 transition-all disabled:bg-gray-200 disabled:text-gray-400 disabled:active:scale-100 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
            </svg>
          </button>
        </div>
      </div>
    </Link>
  )
}

function MerchandisePageContent() {
  const { t } = useLang()
  const { addItem } = useMerchCart()
  const [toast, setToast] = useState('')
  const toastTimer = useRef<number | null>(null)
  const [products, setProducts] = useState<MerchItem[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [bands, setBands] = useState<Band[]>([])
  const [eventName, setEventName] = useState('')
  const [noActiveEvent, setNoActiveEvent] = useState(false)
  const [paused, setPaused] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeCategory, setActiveCategory] = useState('Semua')

  useEffect(() => {
    clearMerchCheckoutDraft()
    Promise.all([
      fetch('/api/merchandise').then((r) => r.json()),
      fetch('/api/kategori').then((r) => r.json()),
      fetch('/api/bands').then((r) => r.json()),
      fetch('/api/events?active=true').then((r) => r.json()).catch(() => null),
    ])
      .then(([prodRes, catRes, bandRes, eventRes]) => {
        if (prodRes.error) throw new Error(prodRes.error)
        setProducts((prodRes.data || []) as MerchItem[])
        setCategories(catRes.data || [])
        setBands((bandRes.data || []) as Band[])
        if (eventRes?.data?.nama_event) setEventName(eventRes.data.nama_event)
        setNoActiveEvent(!eventRes?.data?.id)
        setPaused(eventRes?.data?.status === 'paused')
      })
      .catch((e) => setError(friendlyError(e)))
      .finally(() => setLoading(false))
  }, [])

  const filtered = (products || []).filter((p) => {
    const matchCat = activeCategory === 'Semua' || p.kategori === activeCategory
    return matchCat
  })

  // Group produk per band mengikuti urutan lineup (band pertama dahulu, dst).
  let counter = 0
  const sections: Section[] = []
  const seen = new Set<string>()
  for (const b of bands) {
    const items = filtered
      .filter((p) => p.band && (p.band.id === b.id || p.band.nama_band === b.nama_band))
      .map((p) => {
        seen.add(p.id)
        return { p, delay: Math.min(counter++, 11) * 60 }
      })
    if (items.length > 0) {
      sections.push({ id: b.id, nama_band: b.nama_band, gambar: b.gambar, items })
    }
  }
  const rest = filtered
    .filter((p) => !seen.has(p.id))
    .map((p) => ({ p, delay: Math.min(counter++, 11) * 60 }))
  if (rest.length > 0) {
    sections.push({ id: 'lainnya', nama_band: t({ ID: 'Lainnya', EN: 'Others' }), gambar: null, items: rest })
  }

  const handleBuy = (p: MerchItem) => {
    if (paused) return
    const isFree = isFreeSizeProduct(p as unknown as Record<string, unknown>)
    const size = isFree ? FREE_SIZE : MERCH_SIZES.find((s) => (p.sisa_stok?.[s] ?? 0) > 0)
    if (!size) return
    addItem(p.id, size, 1)
    setToast(isFree ? p.nama_merch : `${p.nama_merch} · ${size}`)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2200)
  }

  if (loading) {
    return (
      <div className="text-center py-24 text-gray-400 text-sm">
        {t({ ID: 'Memuat merchandise', EN: 'Loading merchandise' })}<span className="loading-dots"><span /></span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-24 text-center">
        <p className="text-red-500 text-sm font-medium">{error}</p>
        <p className="text-xs text-gray-400 mt-1">{t({ ID: 'Pastikan .env.local sudah terisi dan schema sudah dijalankan.', EN: 'Make sure .env.local is filled in and the schema has been run.' })}</p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md bg-gray-900 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg flex items-center justify-center gap-2 text-center">
          <span className="shrink-0">✓</span>
          <span className="truncate">{t({ ID: 'Ditambahkan ke keranjang', EN: 'Added to cart' })} ({toast})</span>
        </div>
      )}
      {/* Banner */}
      <div className="relative rounded-2xl overflow-hidden min-h-40 bg-gradient-to-r from-indigo-950 via-slate-900 to-zinc-900 mb-8 flex items-center px-4 sm:px-8 py-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(99,102,241,0.2),transparent_60%)]" />
        <div>
          <p className="text-indigo-300 text-xs font-semibold tracking-widest uppercase mb-1">
            {eventName || t({ ID: 'Event Segera Diumumkan', EN: 'Upcoming Event Announcement' })}
          </p>
          <p className="text-xl sm:text-2xl font-bold text-white">{t({ ID: 'Official Merchandise Store', EN: 'Official Merchandise Store' })}</p>
          <p className="text-sm text-gray-400 mt-1">{t({ ID: 'Pengambilan merch dilakukan mulai dari jam pemesanan hingga maksimal 1 hari setelahnya', EN: 'Merchandise pickup is available from order time up to at most 1 day after' })}</p>
        </div>
      </div>

      {paused && (
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
          <p className="text-sm font-semibold text-amber-800">{t({ ID: 'Event ini masih dijeda sebentar', EN: 'This event is temporarily paused' })}</p>
          <p className="text-xs text-amber-700/80 mt-0.5">{t({ ID: 'Pemesanan merchandise belum dibuka. Cek kembali sebentar lagi ya.', EN: 'Merchandise ordering is not open yet. Please check back shortly.' })}</p>
        </div>
      )}

      <div className="lg:flex lg:gap-6 lg:items-start mt-8">

        {/* Main */}
        <div className="lg:flex-1 min-w-0">

          {/* Filter + Search */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex gap-2 flex-wrap">
              {['Semua', ...categories].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    activeCategory === cat
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white border-transparent'
                      : 'border-gray-200 text-gray-600 hover:border-gray-400'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {sections.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <div className="text-4xl mb-3">{noActiveEvent ? '📭' : '🔍'}</div>
              <p className="text-sm">
                {noActiveEvent
                  ? t({ ID: 'Belum ada event aktif. Penjualan merchandise sedang ditutup.', EN: 'No active event. Merchandise sales are currently closed.' })
                  : t({ ID: 'Produk tidak ditemukan', EN: 'Product not found' })}
              </p>
            </div>
          ) : (
            <div className="space-y-10">
              {sections.map((sec) => (
                <section key={sec.id}>
                  <div className="flex items-center gap-3 mb-4">
                    {sec.gambar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={sec.gambar} alt={sec.nama_band} className="w-11 h-11 rounded-xl object-cover border border-gray-200 shadow-sm" />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center text-lg">🎵</div>
                    )}
                    <div>
                      <h3 className="text-base font-bold text-gray-900">{sec.nama_band}</h3>
                      <p className="text-[11px] text-gray-400">{sec.items.length} {t({ ID: 'produk', EN: 'items' })}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                    {sec.items.map(({ p, delay }) => (
                      <MerchCard key={p.id} p={p} delay={delay} onBuy={handleBuy} paused={paused} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar kanan — Syarat & Ketentuan (fixed) */}
        <aside className="lg:w-72 xl:w-80 shrink-0 mt-10 lg:mt-0 lg:sticky lg:top-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-1">{t({ ID: 'Syarat & Ketentuan Pembelian Merchandise', EN: 'Merchandise Purchase Terms & Conditions' })}</h2>
            <p className="text-xs text-gray-400 mb-4">{t({ ID: 'Pastikan kamu membaca seluruh ketentuan berikut sebelum melakukan pembelian.', EN: 'Please read all of the following terms before making a purchase.' })}</p>
            <ol className="space-y-2.5 text-sm text-gray-600 list-decimal list-inside">
              <li>{t({ ID: 'Merchandise hanya dapat dibeli oleh pembeli yang berdomisili di Kota Malang.', EN: 'Merchandise can only be purchased by buyers residing in the city of Malang.' })}</li>
              <li>{t({ ID: 'Pengambilan merchandise dilakukan di booth resmi, mulai dari jam pemesanan hingga maksimal 1 (satu) hari setelahnya.', EN: 'Merchandise pickup is done at the official booth, from order time up to at most 1 (one) day after.' })}</li>
              <li>{t({ ID: 'Pengambilan merch wajib menunjukkan kode pengambilan beserta identitas yang valid.', EN: 'Pickup requires showing the pickup code along with valid ID.' })}</li>
              <li>{t({ ID: 'Pembelian bersifat first come, first served selama stok/tiket tersedia.', EN: 'Purchases are first come, first served while stock/tickets are available.' })}</li>
              <li>{t({ ID: 'Merchandise yang sudah dibeli tidak dapat dikembalikan / ditukar kecuali event dibatalkan oleh penyelenggara.', EN: 'Purchased merchandise cannot be returned or exchanged unless the event is cancelled by the organizer.' })}</li>
              <li>{t({ ID: 'Resiko transaksi diluar dari website resmi tidak ditanggung oleh kami.', EN: 'We are not responsible for risks of transactions made outside of the official website.' })}</li>
              <li>{t({ ID: 'Dengan melakukan pembelian, kamu dianggap telah membaca dan menyetujui seluruh syarat & ketentuan ini.', EN: 'By making a purchase, you are deemed to have read and agreed to all of these terms & conditions.' })}</li>
            </ol>
          </div>

          {/* Media sosial */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm mt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                {t({ ID: 'Media sosial', EN: 'Social media' })}
              </span>

              <div className="flex items-center gap-3">
                {/* Instagram */}
                <a
                  href="#"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="w-7 h-7 rounded-md flex items-center justify-center bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 hover:opacity-80 transition"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-4 h-4 text-white"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="5" />
                    <circle cx="12" cy="12" r="4" />
                    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                  </svg>
                </a>

                {/* TikTok */}
                <a
                  href="#"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="TikTok"
                  className="w-7 h-7 rounded-md flex items-center justify-center bg-[#111827] hover:opacity-80 transition"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-4 h-4 text-white"
                    fill="currentColor"
                  >
                    <path d="M19.5 8.2a5.7 5.7 0 0 1-3.4-1.1v7.2a5.7 5.7 0 1 1-4.9-5.6v2.9a2.8 2.8 0 1 0 2 2.7V3h2.9c.2 1.7 1.5 3 3.4 3.2v2z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default function MerchandisePage() {
  return (
    <MerchCartProvider>
      <MerchandisePageContent />
      <CartFab />
    </MerchCartProvider>
  )
}