/**
 * Rate limiter sederhana berbasis in-memory token bucket.
 * Dirancang untuk Next.js API Routes (Edge & Node runtime).
 *
 * Catatan: state disimpan in-process, sehingga tidak shared antar
 * instance serverless. Untuk produksi berskala besar, ganti dengan
 * Redis (misalnya Upstash). Untuk skala event lokal/sekolah, ini cukup.
 */

interface BucketEntry {
  count: number
  resetAt: number
}

// Map global — hidup selama proses Node.js aktif.
const buckets = new Map<string, BucketEntry>()

export interface RateLimitOptions {
  /** Jumlah request maksimum per window. Default: 20 */
  max?: number
  /** Durasi window dalam milidetik. Default: 60_000 (1 menit) */
  windowMs?: number
}

export interface RateLimitResult {
  allowed: boolean
  /** Sisa request yang diizinkan dalam window ini */
  remaining: number
  /** Timestamp (ms) saat window direset */
  resetAt: number
}

/**
 * Cek dan catat request dari `key` (biasanya IP address).
 * Kembalikan { allowed, remaining, resetAt }.
 */
export function checkRateLimit(key: string, options: RateLimitOptions = {}): RateLimitResult {
  const max = options.max ?? 20
  const windowMs = options.windowMs ?? 60_000
  const now = Date.now()

  let entry = buckets.get(key)

  // Buat atau reset bucket jika sudah kadaluarsa
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs }
    buckets.set(key, entry)
  }

  entry.count++
  const allowed = entry.count <= max
  const remaining = Math.max(0, max - entry.count)

  return { allowed, remaining, resetAt: entry.resetAt }
}

/**
 * Ambil IP address dari Next.js Request object.
 * Mendukung header forwarded (Vercel, Nginx, Cloudflare).
 */
export function getClientIp(request: Request): string {
  const headers = request.headers
  return (
    headers.get('cf-connecting-ip') ??           // Cloudflare
    headers.get('x-real-ip') ??                   // Nginx
    headers.get('x-forwarded-for')?.split(',')[0].trim() ?? // Load balancer
    'unknown'
  )
}

import { NextResponse } from 'next/server'

/**
 * Helper: kembalikan NextResponse 429 jika rate limit terlampaui.
 * Sertakan header standar Retry-After.
 */
export function rateLimitResponse(resetAt: number): NextResponse {
  const retryAfterSec = Math.ceil((resetAt - Date.now()) / 1000)
  return NextResponse.json(
    { error: 'Terlalu banyak permintaan. Coba lagi dalam beberapa saat.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSec),
        'X-RateLimit-Reset': String(Math.floor(resetAt / 1000)),
      },
    }
  )
}
