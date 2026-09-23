'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

// Reset scroll ke atas setiap kali pindah halaman (client-side navigation).
// Mencegah halaman baru terbuka di posisi scroll halaman sebelumnya (mis. habis submit form panjang).
export default function ScrollToTop() {
  const pathname = usePathname()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}