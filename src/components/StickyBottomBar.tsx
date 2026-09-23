'use client'

import type { ReactNode } from 'react'

interface StickyBottomBarProps {
  label: string
  value: string
  children: ReactNode
}

// Bar lengket bawah layar khusus HP — dipakai konsisten di seluruh alur
// beli (home → tiket → checkout → payment): kiri total, kanan aksi utama.
export default function StickyBottomBar({ label, value, children }: StickyBottomBarProps) {
  return (
    <>
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-gray-200 bg-white/95 backdrop-blur-md shadow-[0_-8px_24px_rgba(0,0,0,0.08)]">
        <div className="px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-gray-500">{label}</p>
            <p className="text-base font-bold text-gray-900 truncate">{value}</p>
          </div>
          <div className="shrink-0">{children}</div>
        </div>
      </div>
      {/* Spacer agar konten paling bawah tidak tertutup bar di HP */}
      <div aria-hidden className="h-16 lg:hidden" />
    </>
  )
}
