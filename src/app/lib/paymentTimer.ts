'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

export const PAYMENT_DURATION_MS = 10 * 60 * 1000

const DEADLINE_KEY = 'encoretix_payment_deadline'

function safeGet(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key: string, value: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // localStorage tidak bisa diakses (privasi/incognito block) — abaikan agar tidak crash.
  }
}

function safeRemove(key: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(key)
  } catch {
    // abaikan
  }
}

export function startPaymentCountdown() {
  const deadline = Date.now() + PAYMENT_DURATION_MS
  safeSet(DEADLINE_KEY, String(deadline))
  return deadline
}

export function getPaymentDeadline() {
  const raw = safeGet(DEADLINE_KEY)
  if (!raw) return 0
  const dl = Number(raw)
  return Number.isFinite(dl) && dl > 0 ? dl : 0
}

// Hapus batas waktu (dipanggil setelah pembayaran berhasil / reset).
export function clearPaymentCountdown() {
  safeRemove(DEADLINE_KEY)
}

// Sinkronkan countdown klien dengan deadline server (tanggal_pesan + 10 menit).
// Server adalah sumber kebenaran setelah pesanan dibuat, jadi batas di browser
// harus disamakan agar tidak terlihat "masih punya waktu" padahal sudah habis
// (mis. dibuka di tab baru / localStorage hilang / sebelumnya restart).
export function syncPaymentDeadline(serverStart?: string | number | null) {
  if (serverStart == null) return getPaymentDeadline()
  const start = typeof serverStart === 'number' ? serverStart : new Date(serverStart).getTime()
  if (!Number.isFinite(start)) return getPaymentDeadline()
  const serverDeadline = start + PAYMENT_DURATION_MS
  const current = getPaymentDeadline()
  if (!current || Math.abs(serverDeadline - current) > 2000) {
    safeSet(DEADLINE_KEY, String(serverDeadline))
    return serverDeadline
  }
  return current
}

export function formatRemaining(ms: number) {
  const totalSec = Math.max(0, Math.ceil((Number.isFinite(ms) ? ms : 0) / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  // Tampilkan jam bila sisa waktu > 1 jam agar tidak muncul "420:00".
  if (h > 0) return `${String(h).padStart(2, '0')}:${mm}:${ss}`
  return `${mm}:${ss}`
}

export function formatDeadline(deadline: number) {
  if (!deadline) return ''
  try {
    const d = new Date(deadline)
    if (Number.isNaN(d.getTime())) return ''
    const date = d.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    const time = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    return `${date}, ${time} WIB`
  } catch {
    return ''
  }
}

export function usePaymentCountdown(restartOnMount = false, redirectOnExpire = true) {
  const router = useRouter()
  // Inisialisasi awal statis agar SSR dan initial client render identik (mencegah hydration mismatch)
  const [deadline, setDeadline] = useState<number>(0)
  const [remaining, setRemaining] = useState<number>(PAYMENT_DURATION_MS)
  const notifiedRef = useRef(false)

  useEffect(() => {
    // Sinkronkan saat mount di browser
    const now = Date.now()
    let dl = getPaymentDeadline()
    if (restartOnMount || !dl || dl <= now) {
      dl = startPaymentCountdown()
    }
    setDeadline(dl)
    setRemaining(Math.max(0, dl - now))

    const tick = () => {
      const currentDl = getPaymentDeadline() || dl
      const rem = Math.max(0, currentDl - Date.now())
      setRemaining(rem)
      if (rem <= 0) {
        clearInterval(id)
      }
    }

    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [restartOnMount])

  const isExpired = remaining <= 0

  useEffect(() => {
    if (!isExpired || notifiedRef.current) return
    notifiedRef.current = true
    if (!redirectOnExpire) return
    router.replace('/?waktu=habis')
  }, [isExpired, router, redirectOnExpire])

  return {
    remaining,
    isExpired,
    deadline,
  }
}