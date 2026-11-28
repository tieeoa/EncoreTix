'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import LoadingSpinner from '@/components/LoadingSpinner'
import { useLang } from '@/lib/i18n'
import { MERCH_SIZES, FREE_SIZE, isFreeSizeProduct } from '@/app/lib/merchStok'
import { friendlyError } from '@/app/lib/fetchError'
import { MerchCartProvider, CartFab, useMerchCart, pushStoredCartItem } from '@/app/lib/merchCart'
import { clearMerchCheckoutDraft } from '@/app/lib/merchCheckoutDraft'
import AutoScrollTrack from '@/components/AutoScrollTrack'

interface MerchandiseData {
  id: string
  nama_merch: string
  foto: string[] | null
  harga: number
  kategori: string | null
  status: string
  sisa_stok: Record<string, number>
  band: { nama_band: string; gambar: string | null; deskripsi: string | null } | null
}

function formatRupiah(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID')
}

function MerchandiseDetailContent() {
  const { t } = useLang()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const { addItem } = useMerchCart()

  const [toast, setToast] = useState('')
  const toastTimer = useRef<number | null>(null)

  const [product, setProduct] = useState<MerchandiseData | null>(null)
  const [others, setOthers] = useState<MerchandiseData[]>([])
  const [paused, setPaused] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeImage, setActiveImage] = useState(0)
  const [lightbox, setLightbox] = useState(false)
  const touchX = useRef<number | null>(null)

  const photos = (Array.isArray(product?.foto) && product.foto.length > 0 ? product.foto : [])
    .filter((u): u is string => !!u)

  const stepImage = (dir: 1 | -1) => {
    if (photos.length <= 1) return
    setActiveImage((prev) => (prev + dir + photos.length) % photos.length)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const len = photos.length
      if (len <= 1) return
      if (e.key === 'ArrowLeft') setActiveImage((prev) => (prev - 1 + len) % len)
      if (e.key === 'ArrowRight') setActiveImage((prev) => (prev + 1) % len)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [photos.length])

  const [qty, setQty] = useState(1)
  const [size, setSize] = useState('')

  useEffect(() => {
    clearMerchCheckoutDraft()
    fetch('/api/events?active=true')
      .then((r) => r.json())
      .then((res) => setPaused(res?.data?.status === 'paused'))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!id) return
    fetch(`/api/merchandise/${id}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.error) throw new Error(res.error)
        setProduct(res.data)
      })
      .catch((e) => setError(friendlyError(e)))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!lightbox) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setLightbox(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox])

  useEffect(() => {
    if (!id) return
    fetch('/api/merchandise')
      .then((r) => r.json())
      .then((res) => {
        if (res.error || !Array.isArray(res.data)) return
        setOthers(
          (res.data as MerchandiseData[]).filter((p) => p.id !== id && p.status !== 'nonaktif')
        )
      })
      .catch(() => {})
  }, [id])

  const getEffectiveSize = (p: MerchandiseData) => {
    if (isFreeSizeProduct(p as unknown as Record<string, unknown>)) return FREE_SIZE
    if (size) return size
    const avail = MERCH_SIZES.filter((s) => (p.sisa_stok?.[s] ?? 0) > 0)
    return avail.length === 1 ? avail[0] : ''
  }

  const flashToast = (msg: string) => {
    setToast(msg)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2200)
  }

  const handleAddCart = () => {
    if (paused || !product) return
    const effectiveSize = getEffectiveSize(product)
    if (!effectiveSize || remainingSelected <= 0) return
    addItem(product.id, effectiveSize, qty)
    flashToast(`${product.nama_merch}${isFree ? '' : ' · ' + effectiveSize} · ${qty}`)
  }

  const handleCheckoutNow = () => {
    if (paused || !product) return
    const effectiveSize = getEffectiveSize(product)
    if (!effectiveSize || remainingSelected <= 0) return
    pushStoredCartItem(product.id, effectiveSize, qty)
    router.push('/checkout/merch')
  }

  if (loading) {
    return <LoadingSpinner label={t({ ID: 'Memuat produk', EN: 'Loading product' })} />
  }

  if (error || !product) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-20 text-center">
        <div className="text-5xl mb-4">😕</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">{error}</h1>
        <Link href="/merchandise" className="text-sm text-blue-600 hover:underline">← {t({ ID: 'Kembali ke Merchandise', EN: 'Back to Merchandise' })}</Link>
      </div>
    )
  }

  const sisa = product.sisa_stok ?? {}
  const unavailable = product.status === 'nonaktif'
  const isFree = isFreeSizeProduct(product as unknown as Record<string, unknown>)
  const availableSizes = MERCH_SIZES.filter((s) => (sisa[s] ?? 0) > 0)
  const hideSizePicker = isFree || availableSizes.length <= 1
  const effectiveSize = getEffectiveSize(product)
  const soldOut = isFree
    ? (sisa[FREE_SIZE] ?? 0) <= 0
    : MERCH_SIZES.every((s) => (sisa[s] ?? 0) <= 0)
  const remainingSelected = effectiveSize ? (sisa[effectiveSize] ?? 0) : 0
  const subtotal = Number(product.harga) * qty
  const gallery = photos
  const currImage = gallery[Math.min(activeImage, gallery.length - 1)] || null

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md bg-gray-900 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg flex items-center justify-center gap-2 text-center">
          <span className="shrink-0">✓</span>
          <span className="truncate">{t({ ID: 'Ditambahkan ke keranjang', EN: 'Added to cart' })} ({toast})</span>
        </div>
      )}
      <button
        onClick={() => router.back()}
        className="text-sm font-medium text-gray-600 mb-6 hover:text-gray-900"
      >
        &lt; {t({ ID: 'Kembali', EN: 'Back' })}
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Image */}
        <div>
          <div
            className="rounded-2xl h-64 sm:h-80 lg:h-96 bg-gradient-to-br from-indigo-950 to-black flex items-center justify-center relative overflow-hidden select-none group cursor-zoom-in"
            onClick={() => setLightbox(true)}
            onTouchStart={(e) => { touchX.current = e.touches[0]?.clientX ?? null }}
            onTouchEnd={(e) => {
              if (touchX.current == null || e.changedTouches.length === 0) return
              const dx = e.changedTouches[0].clientX - touchX.current
              touchX.current = null
              if (dx < -40) stepImage(1)
              if (dx > 40) stepImage(-1)
            }}
          >
            {currImage ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={currImage} alt={product.nama_merch} className={`absolute inset-0 w-full h-full object-cover transition-all duration-300 ${unavailable ? 'grayscale group-hover:grayscale-0' : ''}`} />
                {gallery.length > 1 && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); setActiveImage((activeImage - 1 + gallery.length) % gallery.length) }}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 backdrop-blur text-gray-800 text-lg font-bold shadow flex items-center justify-center hover:bg-white transition-colors cursor-pointer"
                      aria-label={t({ ID: 'Foto sebelumnya', EN: 'Previous photo' })}
                    >
                      ‹
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setActiveImage((activeImage + 1) % gallery.length) }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 backdrop-blur text-gray-800 text-lg font-bold shadow flex items-center justify-center hover:bg-white transition-colors cursor-pointer"
                      aria-label={t({ ID: 'Foto berikutnya', EN: 'Next photo' })}
                    >
                      ›
                    </button>
                    <span className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs font-semibold bg-black/50 text-white rounded-full px-2.5 py-1">
                      {activeImage + 1} / {gallery.length}
                    </span>
                  </>
                )}
              </>
            ) : (
              <div className="text-8xl opacity-20">👕</div>
            )}
            {paused ? (
              <span className="absolute top-4 left-4 text-xs font-semibold px-3 py-1 rounded-full bg-amber-500/90 text-white">
                {t({ ID: 'Event Dijeda Sebentar', EN: 'Event Temporarily Paused' })}
              </span>
            ) : unavailable ? (
              <span className="absolute top-4 left-4 text-xs font-semibold px-3 py-1 rounded-full bg-gray-700/80 text-gray-300">
                {t({ ID: 'Penjualan Telah Berakhir', EN: 'Sales Have Ended' })}
              </span>
            ) : soldOut ? (
              <span className="absolute top-4 left-4 text-xs font-semibold px-3 py-1 rounded-full bg-gray-700/80 text-gray-200">
                {t({ ID: 'Sold Out', EN: 'Sold Out' })}
              </span>
            ) : null}
          </div>

          {gallery.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
              {gallery.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImage(i)}
                  className={`w-16 h-14 rounded-lg overflow-hidden border-2 shrink-0 transition-colors ${i === activeImage ? 'border-indigo-600' : 'border-gray-200 hover:border-gray-400'}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`${product.nama_merch} ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail */}
        <div className="flex flex-col">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
            {product.kategori || t({ ID: 'Merchandise', EN: 'Merchandise' })}
            {product.band?.nama_band && <span> · {product.band.nama_band}</span>}
          </p>
          <h1 className="text-2xl font-bold text-gray-900">{product.nama_merch}</h1>

          <p className="text-3xl font-bold text-gray-900 mb-1">{formatRupiah(Number(product.harga))}</p>
          <p className="text-xs text-gray-400 mb-6">{t({ ID: 'Harga sudah termasuk pajak & pengemasan', EN: 'Price already includes tax & packaging' })}</p>

          <p className="text-sm text-gray-600 leading-relaxed mb-6">
            {t({ ID: 'Merchandise official dari berbagai kolaborasi band CoravFest, dapat diambil di booth resmi kami', EN: 'Official merchandise from various CoravFest band collaborations can be picked up at our official booth.' })}
          </p>

          {/* Ukuran */}
          {!soldOut && !unavailable && !hideSizePicker && (
            <div className="mb-6">
              <p className="text-xs font-semibold text-gray-700 mb-2">
                {t({ ID: 'Ukuran', EN: 'Size' })} <span className="text-red-500">*</span>
              </p>
              <div className="flex gap-2 flex-wrap">
                {MERCH_SIZES.map((s) => {
                  const sisaSize = sisa[s] ?? 0
                  const habis = sisaSize <= 0
                  return (
                    <button
                      key={s}
                      type="button"
                      disabled={habis}
                      onClick={() => { setSize(s); setQty(1) }}
                      title={habis ? t({ ID: 'Ukuran ini sudah habis', EN: 'This size is sold out' }) : `${s}: ${sisaSize}`}
                      className={`min-w-14 h-12 px-3 rounded-lg border text-sm font-semibold transition-colors flex flex-col items-center justify-center leading-tight ${
                        size === s && !habis ? 'bg-gradient-to-r from-indigo-600 to-violet-600 border-transparent text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-gray-400'
                      } ${habis ? 'bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed hover:border-gray-200' : ''}`}
                    >
                      <span>{s}</span>
                      {habis && <span className="text-[9px] font-semibold text-rose-400">{t({ ID: 'Habis', EN: 'Sold out' })}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Qty */}
          {!soldOut && !unavailable && !!effectiveSize && remainingSelected > 0 && (
            <div className="mb-6">
              <p className="text-xs font-semibold text-gray-700 mb-2">{t({ ID: 'Jumlah', EN: 'Quantity' })}</p>
              <div className="flex items-center border border-gray-200 rounded-lg w-fit">
                <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-10 h-10 text-gray-500 hover:bg-gray-50 rounded-l-lg text-lg">−</button>
                <span className="w-10 text-center text-sm font-medium">{qty}</span>
                <button onClick={() => setQty(Math.min(remainingSelected, qty + 1))} className="w-10 h-10 text-gray-500 hover:bg-gray-50 rounded-r-lg text-lg">+</button>
              </div>
            </div>
          )}

          {/* Subtotal */}
          {!soldOut && !unavailable && (
            <div className="bg-gray-50 rounded-xl p-4 mb-4 flex items-center justify-between">
              <span className="text-sm text-gray-500">{t({ ID: 'Total Harga', EN: 'Total Price' })}</span>
              <span className="text-lg font-bold text-gray-900">{formatRupiah(subtotal)}</span>
            </div>
          )}

          {/* CTA */}
          {paused ? (
            <div className="space-y-2">
              <button disabled className="w-full py-3.5 rounded-xl bg-amber-100 text-amber-700 font-semibold cursor-not-allowed">
                {t({ ID: 'Event sedang dijeda sebentar', EN: 'Event is temporarily paused' })}
              </button>
              <p className="text-xs text-center text-gray-500">{t({ ID: 'Pemesanan belum dibuka. Cek kembali sebentar lagi ya.', EN: 'Ordering is not open yet. Please check back shortly.' })}</p>
            </div>
          ) : unavailable ? (
            <button disabled className="w-full py-3.5 rounded-xl bg-gray-200 text-gray-400 font-semibold cursor-not-allowed">
              {t({ ID: 'Dapatkan Saat Event Dimulai!', EN: 'Get It When the Event Starts!' })}
            </button>
          ) : soldOut ? (
            <button disabled className="w-full py-3.5 rounded-xl bg-gray-200 text-gray-400 font-semibold cursor-not-allowed">
              {t({ ID: 'Stok Habis', EN: 'Out of Stock' })}
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <button
                disabled={!effectiveSize || remainingSelected <= 0}
                onClick={handleAddCart}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold transition-colors disabled:from-gray-200 disabled:to-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed cursor-pointer"
              >
                {!effectiveSize
                  ? t({ ID: 'Pilih Ukuran Dulu', EN: 'Select a Size First' })
                  : remainingSelected <= 0
                    ? t({ ID: 'Stok Habis', EN: 'Out of Stock' })
                    : `🛒 ${t({ ID: 'Tambah ke Keranjang', EN: 'Add to Cart' })}`}
              </button>
              <button
                disabled={!effectiveSize || remainingSelected <= 0}
                onClick={handleCheckoutNow}
                className="w-full py-3 rounded-xl border border-indigo-600 text-indigo-600 hover:bg-indigo-600 hover:text-white font-semibold transition-colors disabled:border-gray-200 disabled:text-gray-300 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-300 cursor-pointer"
              >
                {t({ ID: 'Checkout Sekarang', EN: 'Checkout Now' })}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Merchandise Lainnya */}
      <div className="mt-12">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">
            {t({ ID: 'Merchandise Lainnya', EN: 'Other Merchandise' })}
          </h2>
          <Link href="/merchandise" className="text-sm font-semibold text-indigo-600 hover:underline">
            {t({ ID: 'Lihat Semua →', EN: 'View All →' })}
          </Link>
        </div>
        {others.length === 0 ? (
          <p className="text-sm text-gray-400">
            {t({ ID: 'Belum ada merchandise lain.', EN: 'No other merchandise yet.' })}
          </p>
        ) : (
          <AutoScrollTrack className="gap-4">
            {others.map((p, idx) => {
              const otherSoldOut = MERCH_SIZES.every((s) => (p.sisa_stok?.[s] ?? 0) <= 0)
              return (
                <Link
                  key={p.id}
                  href={`/merchandise/${p.id}`}
                  style={{ animationDelay: `${Math.min(idx, 8) * 60}ms` }}
                  className="merch-card-enter group w-52 sm:w-60 shrink-0 rounded-2xl border border-gray-200 bg-white overflow-hidden flex flex-col shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                >
                  <div className="h-40 bg-gradient-to-br from-indigo-950 to-black relative flex items-center justify-center overflow-hidden">
                    {p.foto?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.foto[0]}
                        alt={p.nama_merch}
                        className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 group-hover:scale-110 ${otherSoldOut ? 'grayscale' : ''}`}
                      />
                    ) : (
                      <div className="text-4xl opacity-30">👕</div>
                    )}
                  </div>
                  <div className="p-3 flex-1 flex flex-col">
                    <p className="text-[11px] text-gray-400 mb-0.5">
                      {p.kategori || t({ ID: 'Merchandise', EN: 'Merchandise' })}
                    </p>
                    <p className={`text-sm font-semibold leading-tight ${otherSoldOut ? 'text-gray-400' : 'text-gray-900'}`}>
                      {p.nama_merch}
                    </p>
                    <div className="mt-auto flex items-center justify-between pt-2.5 mt-3 border-t border-gray-100">
                      <span className={`text-sm font-bold ${otherSoldOut ? 'text-gray-400' : 'text-gray-900'}`}>
                        {formatRupiah(Number(p.harga))}
                      </span>
                      <span className="text-[11px] font-semibold text-indigo-600">
                        {t({ ID: 'Beli →', EN: 'Buy →' })}
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </AutoScrollTrack>
        )}
      </div>

      {/* Lightbox — tampilkan foto full-screen */}
      {lightbox && currImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setLightbox(false)}
        >
          <button
            onClick={() => setLightbox(false)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white text-xl flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer"
            aria-label="Tutup"
          >
            ✕
          </button>
          <div
            className="relative max-w-5xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currImage}
              alt={product.nama_merch}
              className="w-full max-h-[85vh] object-contain rounded-xl"
            />
            {gallery.length > 1 && (
              <>
                <button
                  onClick={() => setActiveImage((activeImage - 1 + gallery.length) % gallery.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 text-white text-xl font-bold flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer"
                  aria-label={t({ ID: 'Foto sebelumnya', EN: 'Previous photo' })}
                >
                  ‹
                </button>
                <button
                  onClick={() => setActiveImage((activeImage + 1) % gallery.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 text-white text-xl font-bold flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer"
                  aria-label={t({ ID: 'Foto berikutnya', EN: 'Next photo' })}
                >
                  ›
                </button>
                <span className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs font-semibold bg-black/60 text-white rounded-full px-2.5 py-1">
                  {activeImage + 1} / {gallery.length}
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function MerchandiseDetailPage() {
  return (
    <MerchCartProvider>
      <MerchandiseDetailContent />
      <CartFab />
    </MerchCartProvider>
  )
}