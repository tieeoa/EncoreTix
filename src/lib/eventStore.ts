'use client'

import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'encoretix-superadmin-event'

let currentEventId = ''
let loaded = false
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((l) => l())
}

function load() {
  if (loaded || typeof window === 'undefined') return
  loaded = true
  try {
    currentEventId = localStorage.getItem(STORAGE_KEY) || ''
  } catch {
    currentEventId = ''
  }
}

export function getSelectedEventId(): string {
  load()
  return currentEventId
}

// '' artinya "event aktif (otomatis)".
export function selectEventId(id: string) {
  load()
  currentEventId = id
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // abaikan (SSR / storage penuh)
  }
  notify()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// Hook global event terpilih untuk seluruh halaman superadmin.
export function useSelectedEventId(): string {
  return useSyncExternalStore(subscribe, getSelectedEventId, () => '')
}