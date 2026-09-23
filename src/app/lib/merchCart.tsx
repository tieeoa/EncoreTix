'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLang } from '@/lib/i18n'

export interface MerchCartItem {
  key: string
  id_merch: string
  ukuran: string
  jumlah: number
}

interface MerchProductInfo {
  nama_merch: string
  harga: number
  foto?: string
}

interface MerchCartCtx {
  items: MerchCartItem[]
  count: number
  addItem: (id_merch: string, ukuran: string, jumlah: number) => void
  removeItem: (key: string) => void
  setJumlah: (key: string, jumlah: number) => void
  clearCart: () => void
}

const CART_KEY = 'encoretix_merch_cart_v1'
const Ctx = createContext<MerchCartCtx | null>(null)

function keyOf(id_merch: string, ukuran: string) {
  return `${id_merch}::${ukuran}`
}

export function readStoredCart(): { id_merch: string; ukuran: string; jumlah: number }[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(CART_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr.filter(
      (x) =>
        x &&
        typeof x.id_merch === 'string' &&
        typeof x.ukuran === 'string' &&
        Number(x.jumlah) > 0
    )
  } catch {
    return []
  }
}

export function clearStoredCart() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(CART_KEY)
  } catch {
    /* ignore */
  }
}

export function pushStoredCartItem(id_merch: string, ukuran: string, jumlah: number) {
  if (typeof window === 'undefined') return
  const current = readStoredCart()
  const hit = current.find((x) => x.id_merch === id_merch && x.ukuran === ukuran)
  const next = hit
    ? current.map((x) =>
        x.id_merch === id_merch && x.ukuran === ukuran ? { ...x, jumlah: x.jumlah + jumlah } : x
      )
    : [...current, { id_merch, ukuran, jumlah }]
  try {
    window.localStorage.setItem(CART_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

export function MerchCartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<MerchCartItem[]>([])
  const [ready, setReady] = useState(false)

  // Hydrate dari localStorage di effect (bukan lazy init) agar render SSR dan
  // render awal klien sama-sama kosong — menghindari hydration mismatch.
  useEffect(() => {
    const saved = readStoredCart()
    if (saved.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItems(saved.map((x) => ({ ...x, key: keyOf(x.id_merch, x.ukuran) })))
    }
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    try {
      window.localStorage.setItem(CART_KEY, JSON.stringify(items))
    } catch {
      /* ignore */
    }
  }, [items, ready])

  const addItem = useCallback((id_merch: string, ukuran: string, jumlah: number) => {
    setItems((prev) => {
      const k = keyOf(id_merch, ukuran)
      const hit = prev.find((x) => x.key === k)
      if (hit) return prev.map((x) => (x.key === k ? { ...x, jumlah: x.jumlah + jumlah } : x))
      return [...prev, { key: k, id_merch, ukuran, jumlah }]
    })
  }, [])

  const removeItem = useCallback((key: string) => {
    setItems((prev) => prev.filter((x) => x.key !== key))
  }, [])

  const setJumlah = useCallback((key: string, jumlah: number) => {
    setItems((prev) =>
      prev.map((x) => (x.key === key ? { ...x, jumlah: Math.max(1, Math.floor(jumlah)) } : x))
    )
  }, [])

  const clearCart = useCallback(() => setItems([]), [])

  const count = items.reduce((sum, x) => sum + x.jumlah, 0)

  const value = useMemo(
    () => ({ items, count, addItem, removeItem, setJumlah, clearCart }),
    [items, count, addItem, removeItem, setJumlah, clearCart]
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useMerchCart(): MerchCartCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useMerchCart must be used within MerchCartProvider')
  return ctx
}

function formatRupiah(n: number) {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID')
}

export function CartFab() {
  const { t } = useLang()
  const router = useRouter()
  const cart = useMerchCart()
  const [open, setOpen] = useState(false)
  const [products, setProducts] = useState<Record<string, MerchProductInfo>>({})

  useEffect(() => {
    if (!open || Object.keys(products).length) return
    let mounted = true
    fetch('/api/merchandise')
      .then((r) => r.json())
      .then((res) => {
        if (!mounted || res?.error) return
        const map: Record<string, MerchProductInfo> = {}
        for (const p of res.data || []) {
          map[p.id] = { nama_merch: p.nama_merch, harga: Number(p.harga), foto: p.foto?.[0] }
        }
        setProducts(map)
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [open, products])

  if (cart.count === 0) return null

  const total = cart.items.reduce(
    (sum, it) => sum + (products[it.id_merch]?.harga ?? 0) * it.jumlah,
    0
  )

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open && <div className="fixed inset-0 bg-black/40" onClick={() => setOpen(false)} />}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-14 h-14 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-xl flex items-center justify-center transition-colors cursor-pointer"
        aria-label="Keranjang merch"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
        </svg>
        {cart.count > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold min-w-5 h-5 px-1 rounded-full flex items-center justify-center">
            {cart.count}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute bottom-20 right-0 w-80 max-w-[calc(100vw-2rem)] max-h-[70vh] overflow-hidden rounded-2xl border border-gray-200 bg-white dark:bg-gray-900 shadow-2xl flex flex-col z-50"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              {t({ ID: 'Keranjang', EN: 'Cart' })} ({cart.items.length}{' '}
              {t({ ID: 'produk', EN: 'items' })})
            </p>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-600 text-lg leading-none cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="overflow-y-auto flex-1 p-3 space-y-3">
            {cart.items.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">
                {t({ ID: 'Keranjang kosong', EN: 'Cart is empty' })}
              </p>
            ) : (
              cart.items.map((it) => {
                const p = products[it.id_merch]
                return (
                  <div key={it.key} className="flex gap-3 items-center">
                    {p?.foto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.foto}
                        alt={p.nama_merch}
                        className="w-12 h-12 rounded-lg object-cover border border-gray-100 dark:border-gray-700"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-lg">
                        👕
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                        {p?.nama_merch ?? it.id_merch}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {it.ukuran ? `${it.ukuran} · ` : ''}
                        {formatRupiah((p?.harga ?? 0) * it.jumlah)}
                      </p>
                    </div>
                    <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-lg">
                      <button
                        onClick={() => cart.setJumlah(it.key, it.jumlah - 1)}
                        className="w-7 h-7 text-gray-500 hover:text-gray-700 text-sm cursor-pointer"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-xs font-medium">{it.jumlah}</span>
                      <button
                        onClick={() => cart.setJumlah(it.key, it.jumlah + 1)}
                        className="w-7 h-7 text-gray-500 hover:text-gray-700 text-sm cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={() => cart.removeItem(it.key)}
                      className="text-gray-300 hover:text-red-500 text-sm cursor-pointer"
                      aria-label="hapus"
                    >
                      ✕
                    </button>
                  </div>
                )
              })
            )}
          </div>

          {cart.items.length > 0 && (
            <div className="border-t border-gray-100 dark:border-gray-800 p-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">{t({ ID: 'Total', EN: 'Total' })}</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {formatRupiah(total)}
                </span>
              </div>
              <button
                onClick={() => router.push('/checkout/merch')}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                {t({ ID: 'Checkout Sekarang', EN: 'Checkout Now' })}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}