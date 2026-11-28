'use client'

import { useSyncExternalStore } from 'react'

export interface AdminSession {
  token: string
  id: string
  nama: string
  username: string
  role: string
}

// Session dashboard dibagikan antar tab pada origin yang sama (localStorage + BroadcastChannel)
// agar 1 login/logout berlaku untuk semua tab.
const SESSION_KEY = 'encoretix_session'
const CHANNEL_NAME = 'encoretix_admin_auth'

type AuthEvent = { type: 'login'; session: AdminSession } | { type: 'logout' }

let channel: BroadcastChannel | null = null
function getChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null
  if (!channel) {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME)
    } catch {
      channel = null
    }
  }
  return channel
}

const listeners = new Set<() => void>()
function emit() {
  for (const l of listeners) l()
}
function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

let cachedRaw: string | null | undefined
let cachedSession: AdminSession | null = null
function readSession(): AdminSession | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(SESSION_KEY)
  if (raw === cachedRaw) return cachedSession
  cachedRaw = raw
  if (!raw) {
    cachedSession = null
    return null
  }
  try {
    cachedSession = JSON.parse(raw) as AdminSession
  } catch {
    cachedSession = null
  }
  return cachedSession
}

function redirectTo(url: string) {
  if (typeof window === 'undefined') return
  if (window.location.pathname + window.location.search === url) return
  window.location.href = url
}

function handleAuthChange() {
  if (typeof window === 'undefined') return
  const session = readSession()
  const path = window.location.pathname
  const isAdminLogin = path === '/admin/login'
  const isSuperadminLogin = path === '/superadmin/login'
  const isAdminArea = path === '/admin' || path.startsWith('/admin/')
  const isSuperadminArea = path === '/superadmin' || path.startsWith('/superadmin/')

  if (isAdminLogin) {
    if (session?.role === 'admin') redirectTo('/admin/dashboard')
    return
  }
  if (isSuperadminLogin) {
    if (session?.role === 'superadmin') redirectTo('/superadmin/dashboard')
    return
  }
  if (isAdminArea) {
    if (!session || session.role !== 'admin') redirectTo('/admin/login')
    return
  }
  if (isSuperadminArea) {
    if (!session || session.role !== 'superadmin') redirectTo('/superadmin/login')
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== SESSION_KEY) return
    cachedRaw = undefined
    emit()
    handleAuthChange()
  })
  const ch = getChannel()
  ch?.addEventListener('message', (e: MessageEvent<AuthEvent>) => {
    cachedRaw = undefined
    emit()
    handleAuthChange()
  })
}

export function saveAdminSession(session: AdminSession) {
  if (typeof window === 'undefined') return
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  cachedRaw = JSON.stringify(session)
  cachedSession = session
  getChannel()?.postMessage({ type: 'login', session } satisfies AuthEvent)
  emit()
  handleAuthChange()
}

export function getAdminSession(role?: string): AdminSession | null {
  const session = readSession()
  if (!session) return null
  if (role && session.role !== role) return null
  return session
}

export function getAnyAdminSession(): AdminSession | null {
  return getAdminSession()
}

export function clearAdminSession(_role?: string) {
  if (typeof window === 'undefined') return
  const current = readSession()
  localStorage.removeItem(SESSION_KEY)
  cachedRaw = null
  cachedSession = null
  getChannel()?.postMessage({ type: 'logout' } satisfies AuthEvent)
  emit()
  handleAuthChange()
  return current
}

// Baca session admin secara reaktif (shared antar tab).
export function useAdminSession(role?: 'admin' | 'superadmin'): AdminSession | null {
  return useSyncExternalStore(
    subscribe,
    () => getAdminSession(role),
    () => null,
  )
}

export function useAdminName(role?: 'admin' | 'superadmin'): string {
  return useSyncExternalStore(
    subscribe,
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

// Fetch helper untuk endpoint admin/superadmin (kirim token session bersama via Authorization).
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
        redirectTo(session?.role === 'superadmin' ? '/superadmin/login' : '/admin/login')
      }
    } catch {}
  }
  return res
}