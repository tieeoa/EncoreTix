'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useLang } from '@/lib/i18n'

export default function Navbar() {
  const pathname = usePathname()
  const { lang, setLang, t } = useLang()
  const isMerchArea = pathname.startsWith('/merchandise') || pathname === '/merch-saya'
  const isHome = pathname === '/'

  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const changeLang = (value: 'ID' | 'EN') => {
    setLang(value)
  }

  return (
    <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 h-16 flex items-center justify-between gap-2">
        <Link href="/" className="flex items-center">
          <Image
            src="/logo.png"
            alt="EncoreTix"
            width={130}
            height={32}
            priority
            className="h-7 w-[114px] sm:h-8 sm:w-auto object-contain"
          />
        </Link>

        <nav className="flex items-center gap-2 sm:gap-4 text-sm min-w-0">
          {isHome ? (
            <Link href="/merchandise" className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
              {t({ ID: 'Merchandise', EN: 'Merchandise' })}
            </Link>
          ) : (
            <Link href="/" className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
              {t({ ID: 'Beranda', EN: 'Home' })}
            </Link>
          )}

          <Link href="/cara-pembelian" className="hidden sm:inline text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
            {t({ ID: 'Cara Pembelian', EN: 'How to Buy' })}
          </Link>

          {isMerchArea ? (
            <Link
              href="/merch-saya"
              className="group relative overflow-hidden bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-full px-4 py-1.5 text-xs sm:text-sm font-bold shadow-md shadow-indigo-950/30 hover:shadow-lg hover:shadow-indigo-900/50 hover:-translate-y-px transition-all"
            >
              <span className="relative z-10 inline-flex items-center gap-1">
                {t({ ID: 'Merch Saya', EN: 'My Merch' })}
              </span>
              <span className="btn-shine" aria-hidden="true" />
            </Link>
          ) : (
            <Link
              href="/tiket-saya"
              className="group relative overflow-hidden bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-full px-4 py-1.5 text-xs sm:text-sm font-bold shadow-md shadow-indigo-950/30 hover:shadow-lg hover:shadow-indigo-900/50 hover:-translate-y-px transition-all"
            >
              <span className="relative z-10 inline-flex items-center gap-1">
                {t({ ID: 'Tiket Saya', EN: 'My Tickets' })}
              </span>
              <span className="btn-shine" aria-hidden="true" />
            </Link>
          )}

          {/* Settings dropdown */}
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setSettingsOpen(!settingsOpen)}
              aria-label="Pengaturan"
              title={t({ ID: 'Pengaturan', EN: 'Settings' })}
              className="flex items-center gap-1.5 border border-gray-300 dark:border-gray-700 rounded-full pl-3 pr-2.5 py-1.5 text-gray-700 dark:text-gray-300 hover:border-gray-500 transition-colors"
            >
              {/* Globe — bahasa aktif */}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18zm0 0c2.5-2.4 3.9-5.6 3.9-9S14.5 5.4 12 3c-2.5 2.4-3.9 5.6-3.9 9S9.5 18.6 12 21zm-8.5-9h17" />
              </svg>
              <span className="text-xs font-bold tracking-wide">{lang}</span>
            </button>

            {settingsOpen && (
              <div className="absolute right-0 mt-2 w-56 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-3 sm:p-4 text-left">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  {t({ ID: 'Bahasa', EN: 'Language' })}
                </p>
                <div className="flex gap-1 bg-gray-100 rounded-full p-1">
                  <button
                    onClick={() => changeLang('ID')}
                    className={`flex-1 text-xs font-bold py-1.5 rounded-full transition-all ${
                      lang === 'ID'
                        ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-950/20'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    Indonesia
                  </button>
                  <button
                    onClick={() => changeLang('EN')}
                    className={`flex-1 text-xs font-bold py-1.5 rounded-full transition-all ${
                      lang === 'EN'
                        ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-950/20'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    English
                  </button>
                </div>
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  )
}