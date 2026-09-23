'use client'

import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react'

export type Lang = 'ID' | 'EN'

interface LangCtx {
  lang: Lang
  setLang: (l: Lang) => void
  t: (id: Record<Lang, string>) => string
}

const LangContext = createContext<LangCtx | null>(null)

const LANG_STORAGE_KEY = 'lang'

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback)
  return () => window.removeEventListener('storage', callback)
}

function readLang(): Lang {
  return localStorage.getItem(LANG_STORAGE_KEY) === 'EN' ? 'EN' : 'ID'
}

function getServerLang(): Lang {
  return 'ID'
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const lang = useSyncExternalStore(subscribe, readLang, getServerLang)

  const setLang = (l: Lang) => {
    localStorage.setItem(LANG_STORAGE_KEY, l)
    window.dispatchEvent(new Event('storage'))
  }

  const t = (obj: Record<Lang, string>) => obj[lang] ?? obj.ID

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useLang must be inside LanguageProvider')
  return ctx
}