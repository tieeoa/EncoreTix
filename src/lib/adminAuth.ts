'use client'

import { useSyncExternalStore } from 'react'

export interface AdminSession {
  token: string
  id: string
  nama: string
  username: string
  role: string
}

const ADMIN_STORAGE_KEY = 'encoretix_admin'
const SUPERADMIN_STORAGE_KEY = 'encoretix_superadmin'

function getStorageKey(role: string): string {
  return role === 'superadmin' ? SUPERADMIN_STORAGE_KEY : ADMIN_STORAGE_KEY
}

export function saveAdminSession(session: AdminSession) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(getStorageKey(session.role), JSON.stringify(session))
  }
}

export function getAdminSession(role?: string): AdminSession | null {
  if (typeof window === 'undefined') return null
  try {
    const key = role ? getStorageKey(role) : ADMIN_STORAGE_KEY
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as AdminSession) : null
  } catch {
    return null
  }
}

export function getAnyAdminSession(): AdminSession | null {
  if (typeof window === 'undefined') return null
  try {
    const adminRaw = localStorage.getItem(ADMIN_STORAGE_KEY)
    if (adminRaw) return JSON.parse(adminRaw) as AdminSession
    const superAdminRaw = localStorage.getItem(SUPERADMIN_STORAGE_KEY)
    if (superAdminRaw) return JSON.parse(superAdminRaw) as AdminSession
    return null
  } catch {
    return null
  }
}

export function clearAdminSession(role?: string) {
  if (typeof window !== 'undefined') {
    if (role) {
      localStorage.removeItem(getStorageKey(role))
    } else {
      localStorage.removeItem(ADMIN_STORAGE_KEY)
      localStorage.removeItem(SUPERADMIN_STORAGE_KEY)
    }
    // Hapus juga cookie sesi server agar API admin tidak bisa dipakai lagi.
    void fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
  }
}

const emptySubscribe = () => () => {}

// Baca nama admin dari localStorage dengan aman saat SSR (menghindari hydration error).
// Render awal (server) selalu kosong, lalu setelah hydrate diisi dari localStorage.
export function useAdminName(): string {
  return useSyncExternalStore(
    emptySubscribe,
    () => getAnyAdminSession()?.nama || '',
    () => '',
  )
}

export async function loginAdmin(
  username: string,
  password: string
): Promise<AdminSession> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || 'Login gagal')
  const session: AdminSession = result.data
  saveAdminSession(session)
  return session
}