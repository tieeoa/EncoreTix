'use client'

import { useEffect } from 'react'

// Mencegah tombol "Kembali" browser membawa user ke halaman sebelumnya.
// Dipakai pada layar "Pembayaran Berhasil" agar user tidak bisa kembali
// ke halaman checkout/payment. Selama aktif, setiap aksi back akan di-intercept
// dengan push state sehingga tetap berada di halaman ini.
export function usePreventHistoryBack(active: boolean) {
  useEffect(() => {
    if (!active) return
    const url = window.location.href
    window.history.pushState(null, '', url)
    const onPopState = () => {
      window.history.pushState(null, '', url)
    }
    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
    }
  }, [active])
}