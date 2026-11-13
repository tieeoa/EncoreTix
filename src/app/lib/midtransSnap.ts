'use client'

declare global {
  interface Window {
    snap?: {
      pay: (
        token: string,
        options?: {
          onSuccess?: (result: Record<string, unknown>) => void
          onPending?: (result: Record<string, unknown>) => void
          onError?: (result: Record<string, unknown>) => void
          onClose?: () => void
        }
      ) => void
      embed?: (
        token: string,
        options?: {
          embedId: string
          onSuccess?: (result: Record<string, unknown>) => void
          onPending?: (result: Record<string, unknown>) => void
          onError?: (result: Record<string, unknown>) => void
          onClose?: () => void
        }
      ) => void
    }
  }
}

/**
 * Memastikan script Midtrans Snap (snap.js) terpasang di browser.
 * Menggunakan URL Sandbox atau Production sesuai env.
 */
export function loadSnapScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return resolve()
    if (window.snap) return resolve()

    const isProd = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true'
    const snapUrl = isProd
      ? 'https://app.midtrans.com/snap/snap.js'
      : 'https://app.sandbox.midtrans.com/snap/snap.js'

    const clientKey =
      process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ||
      'Mid-client-aVGDRkwWZxaEH5js'

    const existing = document.querySelector(`script[src*="snap/snap.js"]`)
    if (existing) {
      if (window.snap) return resolve()
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Gagal memuat script Midtrans Snap')))
      return
    }

    const script = document.createElement('script')
    script.src = snapUrl
    script.setAttribute('data-client-key', clientKey)
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Gagal memuat script Midtrans Snap'))
    document.body.appendChild(script)
  })
}

