'use client'

import { useSyncExternalStore } from 'react'

export interface AdminSession {
  token: string
  id: string
  nama: string
  username: string
  role: string
}

// Sesi per-tab (sessionStorage) agar bisa login akun berbeda di tab/profil-browser yang sama.
const SESSION_KEY = 'encoretix_session'

export function saveAdminSession(session: AdminSession) {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  }
}

export function getAdminSession(role?: string): AdminSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as AdminSession
    if (role && session.role !== role) return null
    return session
  } catch {
    return null
  }
}

export function getAnyAdminSession(): AdminSession | null {
  return getAdminSession()
}

export function clearAdminSession(_role?: string) {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(SESSION_KEY)
  }
}

const emptySubscribe = () => () => {}

// Baca nama admin dari sessionStorage (per-tab) dengan aman saat SSR.
export function useAdminName(role?: 'admin' | 'superadmin'): string {
  return useSyncExternalStore(
    emptySubscribe,
    () => getAdminSession(role)?.nama || '',
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

// Fetch helper untuk endpoint admin/superadmin (kirim token per-tab via Authorization).
export async function adminFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = typeof window !== 'undefined' ? getAdminSession()?.token : null
  const headers = new Headers(init.headers || {})
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(input, { ...init, headers })
  if (typeof window !== 'undefined' && (res.status === 401 || res.status === 403)) {
    try {
      const cloned = res.clone()
      const data = await cloned.json()
      const msg = typeof data?.error === 'string' ? data.error.toLowerCase() : ''
      if (msg.includes('dinonaktifkan') || msg.includes('sesi tidak valid')) {
        const session = getAdminSession()
        clearAdminSession()
        if (session?.role === 'admin') window.location.href = '/admin/login'
        else if (session?.role === 'superadmin') window.location.href = '/superadmin/login'
      }
    } catch {}
  }
  return res
}