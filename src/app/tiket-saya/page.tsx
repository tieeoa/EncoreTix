'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import LoadingSpinner from '@/components/LoadingSpinner'
import { useLang } from '@/lib/i18n'

function TiketSayaContent() {
  const { t } = useLang()
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialCode = searchParams.get('id') || searchParams.get('code') || ''

  const [inputCode, setInputCode] = useState(initialCode)
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = inputCode.trim().toUpperCase()
    if (!trimmed) {
      setErrorMsg('Masukkan Booking ID terlebih dahulu.')
      return
    }
    router.push(`/tiket-saya/${encodeURIComponent(trimmed)}`)
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white tracking-tight">
          {t({ ID: 'Tiket Saya', EN: 'My Tickets' })}
        </h1>
        <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-2">
          {t({ ID: 'Lihat kembali tiket yang telah kamu beli.', EN: 'View the tickets you have purchased.' })}
        </p>
      </div>

      {/* Input Search Card */}
      <div className="max-w-xl mx-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-8 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="bookingId"
              className="block text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2.5"
            >
              {t({ ID: 'Masukkan Booking ID', EN: 'Enter Booking ID' })}
            </label>
            <input
              id="bookingId"
              type="text"
              value={inputCode}
              onChange={(e) => {
                setInputCode(e.target.value)
                setErrorMsg('')
              }}
              placeholder={t({ ID: 'Contoh: ETX-XXXXXX', EN: 'Example: ETX-XXXXXX' })}
              className="w-full px-4 py-3.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-medium text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all placeholder:text-gray-400"
            />
          </div>

          {errorMsg && (
            <p className="text-xs text-red-500 font-medium">{t({ ID: 'Masukkan Booking ID terlebih dahulu.', EN: 'Please enter your Booking ID first.' })}</p>
          )}

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors text-sm sm:text-base shadow-sm active:scale-[0.99] cursor-pointer"
          >
            <svg
              className="w-4 h-4 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2.5"
            >
              <circle cx="11" cy="11" r="8" />
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35" />
            </svg>
            <span>{t({ ID: 'Lihat Tiket', EN: 'View Ticket' })}</span>
          </button>
        </form>
      </div>
    </div>
  )
}

export default function TiketSayaPage() {
  const { t } = useLang()
  return (
    <Suspense fallback={<LoadingSpinner label={t({ ID: 'Memuat halaman Tiket Saya...', EN: 'Loading My Tickets page...' })} />}>
      <TiketSayaContent />
    </Suspense>
  )
}
