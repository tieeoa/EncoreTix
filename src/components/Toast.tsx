'use client'

import { useEffect, useRef, type ReactNode } from 'react'

export const TOAST_DURATION_MS = 8000

interface ToastProps {
  ok: boolean
  text: ReactNode
  onClose: () => void
  className?: string
}

export default function Toast({ ok, text, onClose, className }: ToastProps) {
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const id = setTimeout(() => onCloseRef.current(), TOAST_DURATION_MS)
    return () => clearTimeout(id)
  }, [])

  return (
    <div
      role="alert"
      className={`px-4 py-3 rounded-xl text-sm border flex items-center justify-between gap-3 shadow-sm ${
        ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'
      } ${className ?? ''}`}
    >
      <span className="min-w-0 break-words [overflow-wrap:anywhere]">{text}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Tutup notifikasi"
        className="shrink-0 w-8 h-8 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-current hover:bg-black/10 transition-colors cursor-pointer"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}